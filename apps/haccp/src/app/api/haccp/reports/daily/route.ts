import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const date = request.nextUrl.searchParams.get('date') || new Date().toISOString().split('T')[0];

    // 사용자 맵 생성
    const { data: allUsers } = await supabase
      .from('users')
      .select('id, full_name, role')
      .eq('company_id', userData.company_id);

    const userMap = new Map((allUsers || []).map(u => [u.id, u]));

    // 1. 출근 기록
    const { data: attendanceData } = await supabase
      .from('attendance')
      .select('user_id, check_in_time, health_status')
      .eq('company_id', userData.company_id)
      .eq('date', date)
      .not('check_in_time', 'is', null);

    const attendance = (attendanceData || []).map(a => {
      const user = userMap.get(a.user_id);
      return {
        user_id: a.user_id,
        full_name: user?.full_name || '-',
        role: user?.role || '-',
        check_in_time: a.check_in_time,
        health_status: a.health_status || '양호',
      };
    });

    // 2. CCP 기록
    const { data: ccpData } = await supabase
      .from('ccp_records')
      .select(`
        id,
        record_time,
        measurement,
        measurements,
        is_within_limit,
        recorded_by,
        lot_number,
        ccp_definitions (ccp_number, process)
      `)
      .eq('company_id', userData.company_id)
      .eq('record_date', date)
      .order('record_time');

    const ccpRecords = (ccpData || []).map(r => {
      const ccpDef = r.ccp_definitions as unknown as { ccp_number: string; process: string } | null;
      return {
        id: r.id,
        ccp_number: ccpDef?.ccp_number || '-',
        process: ccpDef?.process || '-',
        record_time: r.record_time,
        measurements: r.measurements || [],
        is_within_limit: r.is_within_limit,
        recorded_by_name: userMap.get(r.recorded_by)?.full_name || '-',
        lot_number: r.lot_number,
      };
    });

    // 3. 생산 기록
    const { data: productionData } = await supabase
      .from('production_records')
      .select(`
        id,
        lot_number,
        actual_quantity,
        unit,
        supervisor_id,
        worker_names,
        start_time,
        end_time,
        quality_check_status,
        products (name)
      `)
      .eq('company_id', userData.company_id)
      .eq('production_date', date);

    const productionRecords = (productionData || []).map(r => {
      const product = r.products as unknown as { name: string } | null;
      return {
        id: r.id,
        lot_number: r.lot_number,
        product_name: product?.name || '-',
        actual_quantity: r.actual_quantity,
        unit: r.unit,
        supervisor_name: userMap.get(r.supervisor_id)?.full_name || '-',
        worker_names: r.worker_names || [],
        start_time: r.start_time,
        end_time: r.end_time,
        quality_check_status: r.quality_check_status,
      };
    });

    // 4. 출하 기록
    const { data: shipmentData } = await supabase
      .from('shipment_records')
      .select('id, shipment_number, customer_name, items, status, shipped_by')
      .eq('company_id', userData.company_id)
      .eq('shipment_date', date);

    // 제품 정보 조회
    const allProductIds = (shipmentData || [])
      .flatMap(s => (s.items || []).map((i: { product_id: string }) => i.product_id))
      .filter(Boolean);

    let productMap: Record<string, string> = {};
    if (allProductIds.length > 0) {
      const { data: products } = await supabase
        .from('products')
        .select('id, name')
        .in('id', [...new Set(allProductIds)]);

      productMap = (products || []).reduce((acc, p) => {
        acc[p.id] = p.name;
        return acc;
      }, {} as Record<string, string>);
    }

    const shipmentRecords = (shipmentData || []).map(s => ({
      id: s.id,
      shipment_number: s.shipment_number,
      customer_name: s.customer_name,
      items: (s.items || []).map((i: { product_id: string; quantity: number; unit: string }) => ({
        product_name: productMap[i.product_id] || '-',
        quantity: i.quantity,
        unit: i.unit,
      })),
      status: s.status,
      shipped_by_name: userMap.get(s.shipped_by)?.full_name || '-',
    }));

    // 5. 원료 수불 현황 (일별)
    const { data: ledgerData } = await supabase
      .from('material_transactions')
      .select(`
        material_id,
        transaction_type,
        quantity,
        materials (name, unit)
      `)
      .eq('company_id', userData.company_id)
      .eq('transaction_date', date);

    // 원료별로 그룹화
    const materialMap: Record<string, {
      material_name: string;
      unit: string;
      in_quantity: number;
      out_quantity: number;
    }> = {};

    (ledgerData || []).forEach(t => {
      const material = t.materials as unknown as { name: string; unit: string } | null;
      const materialName = material?.name || '-';
      const unit = material?.unit || '';

      if (!materialMap[t.material_id]) {
        materialMap[t.material_id] = {
          material_name: materialName,
          unit,
          in_quantity: 0,
          out_quantity: 0,
        };
      }

      if (t.transaction_type === 'IN') {
        materialMap[t.material_id].in_quantity += t.quantity;
      } else if (t.transaction_type === 'OUT') {
        materialMap[t.material_id].out_quantity += t.quantity;
      }
    });

    // 현재 재고 조회
    const { data: stockData } = await supabase
      .from('material_stocks')
      .select('material_id, quantity')
      .eq('company_id', userData.company_id)
      .eq('status', 'AVAILABLE');

    const stockMap: Record<string, number> = {};
    (stockData || []).forEach(s => {
      stockMap[s.material_id] = (stockMap[s.material_id] || 0) + s.quantity;
    });

    const materialSummary = Object.entries(materialMap).map(([materialId, data]) => {
      const closing = stockMap[materialId] || 0;
      const opening = closing - data.in_quantity + data.out_quantity;
      return {
        material_name: data.material_name,
        unit: data.unit,
        opening_balance: Math.max(0, opening),
        in_quantity: data.in_quantity,
        out_quantity: data.out_quantity,
        closing_balance: closing,
      };
    });

    // 6. 위생점검 현황
    const { data: hygieneData } = await supabase
      .from('daily_hygiene_checks')
      .select('id, shift, check_time, overall_result, checked_by')
      .eq('company_id', userData.company_id)
      .eq('check_date', date);

    const hygieneChecks = (hygieneData || []).map(h => ({
      id: h.id,
      shift: h.shift === 'morning' ? '오전' : h.shift === 'afternoon' ? '오후' : '야간',
      check_time: h.check_time,
      passed: h.overall_result === 'PASS',
      checked_by_name: userMap.get(h.checked_by)?.full_name || '-',
    }));

    // 7. 개선조치 현황 (해당 일자 발생 또는 미완료)
    const { data: correctiveData } = await supabase
      .from('corrective_actions')
      .select('id, action_number, problem_description, status')
      .eq('company_id', userData.company_id)
      .or(`action_date.eq.${date},status.neq.COMPLETED`)
      .order('action_date', { ascending: false })
      .limit(10);

    const correctiveActions = (correctiveData || []).map(a => ({
      id: a.id,
      action_number: a.action_number,
      problem_description: a.problem_description?.substring(0, 100) || '-',
      status: a.status,
    }));

    return NextResponse.json({
      date,
      attendance,
      ccpRecords,
      productionRecords,
      shipmentRecords,
      materialSummary,
      hygieneChecks,
      correctiveActions,
    });
  } catch (error) {
    console.error('Error fetching daily report:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
