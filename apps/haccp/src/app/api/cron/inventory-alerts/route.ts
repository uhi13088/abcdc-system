/**
 * 재고 알림 자동화 Cron Job
 * - 재고 부족 알림 (안전재고 이하)
 * - 유통기한 임박 알림 (7일 이내)
 * - 유통기한 만료 자동 폐기 처리
 *
 * 실행 주기: 매일 09:00, 15:00
 */

import { NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { format, addDays } from 'date-fns';
import { logger } from '@abc/shared';

let _supabaseClient: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!_supabaseClient) {
    _supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
  }
  return _supabaseClient;
}

export const dynamic = 'force-dynamic';

interface LowStockItem {
  id: string;
  material_id: string;
  material_name: string;
  material_code: string;
  current_balance: number;
  safety_stock: number;
  unit: string;
}

interface ExpiringItem {
  id: string;
  material_id: string;
  material_name: string;
  material_code: string;
  lot_number: string;
  quantity: number;
  unit: string;
  expiry_date: string;
  days_until_expiry: number;
}

export async function GET() {
  try {
    const now = new Date();
    const today = format(now, 'yyyy-MM-dd');

    logger.log(`[Inventory Alerts] Running at ${format(now, 'yyyy-MM-dd HH:mm:ss')}`);

    const results: { type: string; count: number }[] = [];

    // 모든 활성 회사 조회
    const { data: companies } = await getSupabase()
      .from('companies')
      .select('id, name')
      .eq('status', 'ACTIVE');

    for (const company of companies || []) {
      // 1. 재고 부족 알림
      const lowStockResult = await checkLowStock(company.id);
      if (lowStockResult.count > 0) {
        results.push({ type: `LOW_STOCK_${company.id}`, count: lowStockResult.count });
      }

      // 2. 유통기한 임박 알림 (7일 이내)
      const expiryResult = await checkExpiringItems(company.id, 7);
      if (expiryResult.count > 0) {
        results.push({ type: `EXPIRY_WARNING_${company.id}`, count: expiryResult.count });
      }

      // 3. 유통기한 만료 자동 폐기 처리
      const expiredResult = await processExpiredItems(company.id, today);
      if (expiredResult.count > 0) {
        results.push({ type: `EXPIRED_DISPOSED_${company.id}`, count: expiredResult.count });
      }
    }

    logger.log(`[Inventory Alerts] Completed:`, results);

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      results,
    });
  } catch (error) {
    console.error('[Inventory Alerts] Error:', error);
    return NextResponse.json(
      { error: 'Inventory alert process failed' },
      { status: 500 }
    );
  }
}

/**
 * 재고 부족 체크 및 알림 생성
 */
async function checkLowStock(companyId: string): Promise<{ count: number; items: LowStockItem[] }> {
  const supabase = getSupabase();

  // 재고 현황 조회 (materials 조인)
  const { data: stocks } = await supabase
    .from('material_stocks')
    .select(`
      id,
      material_id,
      quantity,
      unit,
      materials!inner(
        id,
        name,
        code,
        min_stock
      )
    `)
    .eq('company_id', companyId)
    .neq('status', 'DISPOSED')
    .gt('quantity', 0);

  // 원료별 총 재고 집계
  const stockByMaterial = new Map<string, {
    material_id: string;
    material_name: string;
    material_code: string;
    total_quantity: number;
    min_stock: number;
    unit: string;
  }>();

  for (const stock of stocks || []) {
    const material = stock.materials as unknown as { id: string; name: string; code: string; min_stock: number };
    const key = stock.material_id;
    const existing = stockByMaterial.get(key);

    if (existing) {
      existing.total_quantity += stock.quantity;
    } else {
      stockByMaterial.set(key, {
        material_id: stock.material_id,
        material_name: material.name,
        material_code: material.code,
        total_quantity: stock.quantity,
        min_stock: material.min_stock || 0,
        unit: stock.unit,
      });
    }
  }

  // 부족 원료 필터링
  const lowStockItems: LowStockItem[] = [];

  for (const [, data] of stockByMaterial) {
    if (data.min_stock > 0 && data.total_quantity <= data.min_stock) {
      lowStockItems.push({
        id: data.material_id,
        material_id: data.material_id,
        material_name: data.material_name,
        material_code: data.material_code,
        current_balance: data.total_quantity,
        safety_stock: data.min_stock,
        unit: data.unit,
      });
    }
  }

  if (lowStockItems.length === 0) {
    return { count: 0, items: [] };
  }

  // 오늘 이미 알림 발송했는지 확인
  const today = format(new Date(), 'yyyy-MM-dd');
  const { data: existingAlerts } = await supabase
    .from('notifications')
    .select('id')
    .eq('category', 'INVENTORY')
    .like('title', '%재고 부족%')
    .gte('created_at', `${today}T00:00:00`)
    .limit(1);

  if (existingAlerts && existingAlerts.length > 0) {
    // 오늘 이미 알림 발송함
    return { count: 0, items: lowStockItems };
  }

  // 관리자에게 알림 생성
  const { data: managers } = await supabase
    .from('users')
    .select('id')
    .eq('company_id', companyId)
    .in('role', ['HACCP_MANAGER', 'COMPANY_ADMIN', 'STORE_MANAGER']);

  const itemList = lowStockItems
    .slice(0, 5)
    .map(i => `${i.material_name}(${i.current_balance}${i.unit})`)
    .join(', ');

  const moreText = lowStockItems.length > 5 ? ` 외 ${lowStockItems.length - 5}건` : '';

  for (const manager of managers || []) {
    await supabase.from('notifications').insert({
      user_id: manager.id,
      category: 'INVENTORY',
      priority: lowStockItems.length >= 3 ? 'HIGH' : 'NORMAL',
      title: `재고 부족 알림 (${lowStockItems.length}건)`,
      body: `안전재고 이하 원료: ${itemList}${moreText}`,
      deep_link: '/inventory',
    });
  }

  return { count: lowStockItems.length, items: lowStockItems };
}

/**
 * 유통기한 임박 체크 및 알림 생성
 */
async function checkExpiringItems(companyId: string, daysThreshold: number): Promise<{ count: number; items: ExpiringItem[] }> {
  const supabase = getSupabase();
  const today = new Date();
  const thresholdDate = format(addDays(today, daysThreshold), 'yyyy-MM-dd');
  const todayStr = format(today, 'yyyy-MM-dd');

  // 유통기한 임박 재고 조회
  const { data: expiringStocks } = await supabase
    .from('material_stocks')
    .select(`
      id,
      material_id,
      lot_number,
      quantity,
      unit,
      expiry_date,
      materials!inner(
        id,
        name,
        code
      )
    `)
    .eq('company_id', companyId)
    .eq('status', 'AVAILABLE')
    .gt('quantity', 0)
    .not('expiry_date', 'is', null)
    .lte('expiry_date', thresholdDate)
    .gt('expiry_date', todayStr)
    .order('expiry_date', { ascending: true });

  if (!expiringStocks || expiringStocks.length === 0) {
    return { count: 0, items: [] };
  }

  const expiringItems: ExpiringItem[] = expiringStocks.map(stock => {
    const material = stock.materials as unknown as { id: string; name: string; code: string };
    const expiryDate = new Date(stock.expiry_date);
    const daysUntil = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    return {
      id: stock.id,
      material_id: stock.material_id,
      material_name: material.name,
      material_code: material.code,
      lot_number: stock.lot_number,
      quantity: stock.quantity,
      unit: stock.unit,
      expiry_date: stock.expiry_date,
      days_until_expiry: daysUntil,
    };
  });

  // 오늘 이미 알림 발송했는지 확인
  const { data: existingAlerts } = await supabase
    .from('notifications')
    .select('id')
    .eq('category', 'INVENTORY')
    .like('title', '%유통기한 임박%')
    .gte('created_at', `${todayStr}T00:00:00`)
    .limit(1);

  if (existingAlerts && existingAlerts.length > 0) {
    return { count: 0, items: expiringItems };
  }

  // 관리자에게 알림 생성
  const { data: managers } = await supabase
    .from('users')
    .select('id')
    .eq('company_id', companyId)
    .in('role', ['HACCP_MANAGER', 'COMPANY_ADMIN', 'STORE_MANAGER']);

  // 긴급(3일 이내)과 주의(7일 이내) 구분
  const urgentItems = expiringItems.filter(i => i.days_until_expiry <= 3);
  const warningItems = expiringItems.filter(i => i.days_until_expiry > 3);

  if (urgentItems.length > 0) {
    const itemList = urgentItems
      .slice(0, 3)
      .map(i => `${i.material_name}(D-${i.days_until_expiry})`)
      .join(', ');

    for (const manager of managers || []) {
      await supabase.from('notifications').insert({
        user_id: manager.id,
        category: 'INVENTORY',
        priority: 'HIGH',
        title: `긴급: 유통기한 임박 (${urgentItems.length}건)`,
        body: `3일 이내 만료: ${itemList}`,
        deep_link: '/inventory',
      });
    }
  }

  if (warningItems.length > 0) {
    const itemList = warningItems
      .slice(0, 3)
      .map(i => `${i.material_name}(D-${i.days_until_expiry})`)
      .join(', ');

    for (const manager of managers || []) {
      await supabase.from('notifications').insert({
        user_id: manager.id,
        category: 'INVENTORY',
        priority: 'NORMAL',
        title: `유통기한 임박 알림 (${warningItems.length}건)`,
        body: `7일 이내 만료: ${itemList}`,
        deep_link: '/inventory',
      });
    }
  }

  return { count: expiringItems.length, items: expiringItems };
}

/**
 * 유통기한 만료 재고 자동 폐기 처리
 */
async function processExpiredItems(companyId: string, today: string): Promise<{ count: number }> {
  const supabase = getSupabase();

  // 만료된 재고 조회
  const { data: expiredStocks } = await supabase
    .from('material_stocks')
    .select(`
      id,
      material_id,
      lot_number,
      quantity,
      unit,
      expiry_date,
      materials!inner(
        id,
        name,
        code
      )
    `)
    .eq('company_id', companyId)
    .eq('status', 'AVAILABLE')
    .gt('quantity', 0)
    .not('expiry_date', 'is', null)
    .lt('expiry_date', today);

  if (!expiredStocks || expiredStocks.length === 0) {
    return { count: 0 };
  }

  let processedCount = 0;

  for (const stock of expiredStocks) {
    const material = stock.materials as unknown as { id: string; name: string; code: string };

    // 1. 재고 상태를 DISPOSED로 변경
    await supabase
      .from('material_stocks')
      .update({
        status: 'DISPOSED',
        updated_at: new Date().toISOString(),
      })
      .eq('id', stock.id);

    // 2. 폐기 트랜잭션 기록
    await supabase
      .from('material_transactions')
      .insert({
        company_id: companyId,
        material_id: stock.material_id,
        transaction_type: 'DISPOSE',
        transaction_date: today,
        quantity: -stock.quantity,
        unit: stock.unit,
        lot_number: stock.lot_number,
        notes: `유통기한 만료 자동 폐기 (만료일: ${stock.expiry_date})`,
      });

    processedCount++;

    logger.log(`[Inventory Alerts] Auto-disposed: ${material.name} (LOT: ${stock.lot_number}, Qty: ${stock.quantity})`);
  }

  // 관리자에게 폐기 처리 알림
  if (processedCount > 0) {
    const { data: managers } = await supabase
      .from('users')
      .select('id')
      .eq('company_id', companyId)
      .in('role', ['HACCP_MANAGER', 'COMPANY_ADMIN']);

    const itemList = expiredStocks
      .slice(0, 3)
      .map(s => {
        const material = s.materials as unknown as { name: string };
        return material.name;
      })
      .join(', ');

    for (const manager of managers || []) {
      await supabase.from('notifications').insert({
        user_id: manager.id,
        category: 'INVENTORY',
        priority: 'HIGH',
        title: `유통기한 만료 자동 폐기 (${processedCount}건)`,
        body: `폐기 처리됨: ${itemList}${processedCount > 3 ? ` 외 ${processedCount - 3}건` : ''}`,
        deep_link: '/inventory',
      });
    }
  }

  return { count: processedCount };
}
