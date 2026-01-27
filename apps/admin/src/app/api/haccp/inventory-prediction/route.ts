/**
 * HACCP 재고 소진 예측 API
 * GET /api/haccp/inventory-prediction - 재고 소진 예측 및 발주 추천
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { subDays, addDays, format } from 'date-fns';

interface MaterialPrediction {
  id: string;
  name: string;
  category: string;
  unit: string;
  current_stock: number;
  min_stock_level: number;
  avg_daily_usage: number;
  days_until_depletion: number;
  predicted_depletion_date: string | null;
  recommended_order_quantity: number;
  recommended_order_date: string | null;
  status: 'CRITICAL' | 'WARNING' | 'NORMAL' | 'OVERSTOCKED';
  usage_trend: 'INCREASING' | 'STABLE' | 'DECREASING';
  last_order_date: string | null;
  supplier_name: string | null;
}

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createServerClient();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await supabase
      .from('users')
      .select('company_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ predictions: [], summary: {} });
    }

    const companyId = userProfile.company_id;
    const today = new Date();
    const thirtyDaysAgo = subDays(today, 30);

    // 모든 원자재 조회
    const { data: materials, error: materialsError } = await supabase
      .from('haccp_materials')
      .select(`
        *,
        haccp_suppliers (name)
      `)
      .eq('company_id', companyId)
      .eq('is_active', true);

    if (materialsError) {
      return NextResponse.json({ error: materialsError.message }, { status: 500 });
    }

    const predictions: MaterialPrediction[] = [];

    for (const material of materials || []) {
      // 최근 30일 사용량 조회
      const { data: usageRecords } = await supabase
        .from('haccp_material_usage')
        .select('quantity, usage_date')
        .eq('material_id', material.id)
        .gte('usage_date', thirtyDaysAgo.toISOString().split('T')[0])
        .order('usage_date', { ascending: true });

      // 일별 평균 사용량 계산
      const totalUsage = (usageRecords || []).reduce((sum, r) => sum + (r.quantity || 0), 0);
      const daysWithData = usageRecords?.length || 1;
      const avgDailyUsage = totalUsage / Math.max(daysWithData, 1);

      // 사용량 추세 분석
      let usageTrend: MaterialPrediction['usage_trend'] = 'STABLE';
      if (usageRecords && usageRecords.length >= 14) {
        const firstHalf = usageRecords.slice(0, Math.floor(usageRecords.length / 2));
        const secondHalf = usageRecords.slice(Math.floor(usageRecords.length / 2));

        const firstHalfAvg = firstHalf.reduce((s, r) => s + r.quantity, 0) / firstHalf.length;
        const secondHalfAvg = secondHalf.reduce((s, r) => s + r.quantity, 0) / secondHalf.length;

        if (secondHalfAvg > firstHalfAvg * 1.2) {
          usageTrend = 'INCREASING';
        } else if (secondHalfAvg < firstHalfAvg * 0.8) {
          usageTrend = 'DECREASING';
        }
      }

      // 소진 예측 계산
      const currentStock = material.current_stock || 0;
      const minStockLevel = material.min_stock_level || 0;

      let daysUntilDepletion = Infinity;
      let predictedDepletionDate: string | null = null;

      if (avgDailyUsage > 0) {
        daysUntilDepletion = Math.floor(currentStock / avgDailyUsage);
        predictedDepletionDate = format(addDays(today, daysUntilDepletion), 'yyyy-MM-dd');
      }

      // 상태 결정
      let status: MaterialPrediction['status'] = 'NORMAL';
      if (currentStock <= 0) {
        status = 'CRITICAL';
      } else if (currentStock <= minStockLevel) {
        status = 'CRITICAL';
      } else if (daysUntilDepletion <= 7) {
        status = 'WARNING';
      } else if (currentStock > minStockLevel * 5) {
        status = 'OVERSTOCKED';
      }

      // 발주 추천 계산
      // 권장 재고 = 평균 일일 사용량 × 14일 (2주치)
      const recommendedStock = avgDailyUsage * 14;
      const recommendedOrderQuantity = Math.max(0, Math.ceil(recommendedStock - currentStock));

      // 권장 발주일 = 재고가 안전 재고 수준에 도달하기 3일 전
      let recommendedOrderDate: string | null = null;
      if (avgDailyUsage > 0 && currentStock > minStockLevel) {
        const daysToMinStock = Math.floor((currentStock - minStockLevel) / avgDailyUsage);
        if (daysToMinStock > 3) {
          recommendedOrderDate = format(addDays(today, daysToMinStock - 3), 'yyyy-MM-dd');
        } else {
          recommendedOrderDate = format(today, 'yyyy-MM-dd'); // 즉시 발주 필요
        }
      } else if (currentStock <= minStockLevel) {
        recommendedOrderDate = format(today, 'yyyy-MM-dd'); // 즉시 발주 필요
      }

      // 마지막 입고일 조회
      const { data: lastReceiving } = await supabase
        .from('haccp_receiving_inspections')
        .select('inspection_date')
        .eq('material_id', material.id)
        .eq('result', 'PASS')
        .order('inspection_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      predictions.push({
        id: material.id,
        name: material.name,
        category: material.category,
        unit: material.unit,
        current_stock: currentStock,
        min_stock_level: minStockLevel,
        avg_daily_usage: Math.round(avgDailyUsage * 100) / 100,
        days_until_depletion: daysUntilDepletion === Infinity ? -1 : daysUntilDepletion,
        predicted_depletion_date: predictedDepletionDate,
        recommended_order_quantity: recommendedOrderQuantity,
        recommended_order_date: recommendedOrderDate,
        status,
        usage_trend: usageTrend,
        last_order_date: lastReceiving?.inspection_date || null,
        supplier_name: material.haccp_suppliers?.name || null,
      });
    }

    // 상태별 정렬 (CRITICAL > WARNING > NORMAL > OVERSTOCKED)
    const statusOrder = { CRITICAL: 0, WARNING: 1, NORMAL: 2, OVERSTOCKED: 3 };
    predictions.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

    // 요약 통계
    const summary = {
      totalMaterials: predictions.length,
      critical: predictions.filter((p) => p.status === 'CRITICAL').length,
      warning: predictions.filter((p) => p.status === 'WARNING').length,
      normal: predictions.filter((p) => p.status === 'NORMAL').length,
      overstocked: predictions.filter((p) => p.status === 'OVERSTOCKED').length,
      needsOrderToday: predictions.filter((p) => p.recommended_order_date === format(today, 'yyyy-MM-dd')).length,
      needsOrderThisWeek: predictions.filter((p) => {
        if (!p.recommended_order_date) return false;
        const orderDate = new Date(p.recommended_order_date);
        return orderDate >= today && orderDate <= addDays(today, 7);
      }).length,
    };

    return NextResponse.json({
      predictions,
      summary,
      generatedAt: today.toISOString(),
    });
  } catch (error) {
    console.error('Inventory prediction error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
