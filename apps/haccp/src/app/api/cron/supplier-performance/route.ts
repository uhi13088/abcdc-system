/**
 * Supplier Performance Calculation Cron Job
 * 공급업체 성과 자동 계산
 *
 * 기능:
 * 1. 월별 공급업체 부적합율 계산
 * 2. 공급업체 등급 자동 업데이트 (A/B/C/D)
 * 3. 부적합율 높은 공급업체 알림
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface SupplierStats {
  supplier_id: string;
  supplier_name: string;
  total_inspections: number;
  pass_count: number;
  fail_count: number;
  conditional_count: number;
  defect_rate: number;
  grade: string;
}

interface AlertResult {
  suppliers_calculated: number;
  grade_changes: number;
  high_defect_alerts: number;
  notifications: number;
}

const logger = {
  log: (message: string) => console.log(`[${new Date().toISOString()}] ${message}`),
  error: (message: string, error?: unknown) => console.error(`[${new Date().toISOString()}] ${message}`, error),
};

// 부적합율에 따른 등급 결정
function calculateGrade(defectRate: number): string {
  if (defectRate <= 2) return 'A';  // 우수
  if (defectRate <= 5) return 'B';  // 양호
  if (defectRate <= 10) return 'C'; // 보통
  return 'D';                        // 관리대상
}

export async function GET() {
  const startTime = Date.now();

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 지난 3개월 기간 설정
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const startDate = threeMonthsAgo.toISOString().split('T')[0];
    const endDate = new Date().toISOString().split('T')[0];

    // 모든 회사 조회
    const { data: companies } = await supabase
      .from('companies')
      .select('id, name');

    if (!companies || companies.length === 0) {
      return NextResponse.json({ message: 'No companies found' });
    }

    const results: Record<string, AlertResult> = {};

    for (const company of companies) {
      const result: AlertResult = {
        suppliers_calculated: 0,
        grade_changes: 0,
        high_defect_alerts: 0,
        notifications: 0,
      };

      // ========================================
      // 1. 공급업체별 검사 실적 조회
      // ========================================
      const { data: inspections } = await supabase
        .from('material_inspections')
        .select(`
          id,
          supplier_id,
          overall_result,
          suppliers:supplier_id (id, name, overall_rating)
        `)
        .eq('company_id', company.id)
        .not('supplier_id', 'is', null)
        .gte('inspection_date', startDate)
        .lte('inspection_date', endDate);

      if (!inspections || inspections.length === 0) {
        results[company.id] = result;
        continue;
      }

      // 공급업체별 통계 집계
      const supplierStats = new Map<string, SupplierStats>();

      for (const inspection of inspections) {
        const supplierId = inspection.supplier_id;
        const supplierData = inspection.suppliers as unknown as { id: string; name: string; overall_rating?: number } | null;

        if (!supplierId || !supplierData) continue;

        if (!supplierStats.has(supplierId)) {
          supplierStats.set(supplierId, {
            supplier_id: supplierId,
            supplier_name: supplierData.name || '알 수 없음',
            total_inspections: 0,
            pass_count: 0,
            fail_count: 0,
            conditional_count: 0,
            defect_rate: 0,
            grade: 'A',
          });
        }

        const stats = supplierStats.get(supplierId)!;
        stats.total_inspections++;

        switch (inspection.overall_result) {
          case 'PASS':
            stats.pass_count++;
            break;
          case 'FAIL':
            stats.fail_count++;
            break;
          case 'CONDITIONAL':
            stats.conditional_count++;
            break;
        }
      }

      // ========================================
      // 2. 부적합율 및 등급 계산
      // ========================================
      const highDefectSuppliers: SupplierStats[] = [];

      for (const [supplierId, stats] of supplierStats) {
        // 부적합율 = (FAIL + CONDITIONAL * 0.5) / 전체 * 100
        const defectRate = stats.total_inspections > 0
          ? ((stats.fail_count + stats.conditional_count * 0.5) / stats.total_inspections) * 100
          : 0;

        stats.defect_rate = Math.round(defectRate * 10) / 10; // 소수점 1자리
        stats.grade = calculateGrade(stats.defect_rate);

        // 기존 등급 조회
        const { data: currentSupplier } = await supabase
          .from('suppliers')
          .select('overall_rating, grade')
          .eq('id', supplierId)
          .single();

        const currentGrade = currentSupplier?.grade || 'A';
        const isGradeChanged = currentGrade !== stats.grade;

        // 공급업체 정보 업데이트
        await supabase
          .from('suppliers')
          .update({
            defect_rate: stats.defect_rate,
            grade: stats.grade,
            last_inspection_date: endDate,
            updated_at: new Date().toISOString(),
          })
          .eq('id', supplierId);

        result.suppliers_calculated++;

        if (isGradeChanged) {
          result.grade_changes++;
        }

        // 부적합율 10% 이상인 공급업체 기록
        if (stats.defect_rate >= 10) {
          highDefectSuppliers.push(stats);
          result.high_defect_alerts++;
        }
      }

      // ========================================
      // 3. 관리자에게 알림 생성
      // ========================================
      const { data: managers } = await supabase
        .from('users')
        .select('id')
        .eq('company_id', company.id)
        .in('role', ['HACCP_MANAGER', 'COMPANY_ADMIN']);

      // 고부적합율 공급업체 알림
      if (highDefectSuppliers.length > 0) {
        const supplierList = highDefectSuppliers
          .sort((a, b) => b.defect_rate - a.defect_rate)
          .slice(0, 5)
          .map(s => `${s.supplier_name} (${s.defect_rate}%)`)
          .join(', ');

        for (const manager of managers || []) {
          await supabase.from('notifications').insert({
            user_id: manager.id,
            category: 'SUPPLIER',
            priority: 'HIGH',
            title: `⚠️ 공급업체 관리 필요 (${highDefectSuppliers.length}개사)`,
            message: `부적합율이 높은 공급업체가 있습니다: ${supplierList}. 공급업체 관리를 검토해주세요.`,
            action_url: '/suppliers',
            is_read: false,
          });
          result.notifications++;
        }
      }

      // 등급 변동 알림
      if (result.grade_changes > 0) {
        for (const manager of managers || []) {
          await supabase.from('notifications').insert({
            user_id: manager.id,
            category: 'SUPPLIER',
            priority: 'MEDIUM',
            title: `공급업체 등급 변동 (${result.grade_changes}개사)`,
            message: `지난 3개월 검사 실적 기준으로 ${result.grade_changes}개 공급업체의 등급이 변경되었습니다.`,
            action_url: '/suppliers',
            is_read: false,
          });
          result.notifications++;
        }
      }

      // 월간 요약 로그
      logger.log(
        `[Supplier Performance] Company ${company.name}: ` +
        `${result.suppliers_calculated} suppliers calculated, ` +
        `${result.grade_changes} grade changes, ` +
        `${result.high_defect_alerts} high defect alerts`
      );

      results[company.id] = result;
    }

    const duration = Date.now() - startTime;
    logger.log(`[Supplier Performance] Completed in ${duration}ms`);

    return NextResponse.json({
      success: true,
      duration_ms: duration,
      period: { start: startDate, end: endDate },
      results,
    });
  } catch (error) {
    logger.error('[Supplier Performance] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
