import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface DailySummary {
  ccp_records: {
    total: number;
    passed: number;
    failed: number;
    items: Array<{
      id: string;
      ccp_number: string;
      process: string;
      record_time: string;
      measurement: Record<string, unknown>;
      is_within_limit: boolean;
      recorded_by_name: string;
    }>;
  };
  hygiene_checks: {
    shifts: Array<{
      shift: string;
      checked: boolean;
      checked_by_name: string;
      overall_status: string;
    }>;
  };
  equipment_temp: {
    total: number;
    items: Array<{
      id: string;
      equipment_name: string;
      temperature: number;
      recorded_at: string;
      recorded_by_name: string;
      is_normal: boolean;
    }>;
  };
  inspections: {
    total: number;
    passed: number;
    failed: number;
    conditional: number;
    items: Array<{
      id: string;
      material_name: string;
      lot_number: string;
      overall_result: string;
      inspected_by_name: string;
    }>;
  };
  production: {
    total: number;
    items: Array<{
      id: string;
      lot_number: string;
      product_name: string;
      actual_quantity: number;
      unit: string;
      status: string;
      supervisor_name: string;
    }>;
  };
  shipments: {
    total: number;
    items: Array<{
      id: string;
      shipment_number: string;
      customer_name: string;
      status: string;
      shipped_by_name: string;
    }>;
  };
  pest_control: {
    checked: boolean;
    items: Array<{
      id: string;
      check_type: string;
      overall_status: string;
      checked_by_name: string;
    }>;
  };
  deviations: Array<{
    type: string;
    description: string;
    corrective_action?: string;
  }>;
}

// GET: 특정 날짜의 일일 종합 보고서 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await adminClient
      .from('users')
      .select('company_id, store_id, current_store_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const companyId = userProfile.company_id;
    const currentStoreId = userProfile.current_store_id || userProfile.store_id;

    // 1. CCP 기록
    let ccpQuery = adminClient
      .from('ccp_records')
      .select(`
        id, ccp_id, record_time, measurement, is_within_limit, deviation_action,
        ccp:ccp_id (ccp_number, process),
        recorder:recorded_by (name)
      `)
      .eq('company_id', companyId)
      .eq('record_date', date);
    if (currentStoreId) ccpQuery = ccpQuery.eq('store_id', currentStoreId);
    const { data: ccpRecords } = await ccpQuery.order('record_time');

    // 2. 위생 점검
    let hygieneQuery = adminClient
      .from('daily_hygiene_checks')
      .select(`
        id, shift, overall_status,
        checker:checked_by (name)
      `)
      .eq('company_id', companyId)
      .eq('check_date', date);
    if (currentStoreId) hygieneQuery = hygieneQuery.eq('store_id', currentStoreId);
    const { data: hygieneChecks } = await hygieneQuery;

    // 3. 장비 온도 기록
    let equipTempQuery = adminClient
      .from('equipment_temperature_records')
      .select(`
        id, equipment_name, temperature, recorded_at, is_normal,
        recorder:recorded_by (name)
      `)
      .eq('company_id', companyId)
      .gte('recorded_at', `${date}T00:00:00`)
      .lt('recorded_at', `${date}T23:59:59`);
    if (currentStoreId) equipTempQuery = equipTempQuery.eq('store_id', currentStoreId);
    const { data: equipmentTemp } = await equipTempQuery.order('recorded_at');

    // 4. 입고 검사
    let inspQuery = adminClient
      .from('material_inspections')
      .select(`
        id, lot_number, overall_result, inspected_by_name,
        material:material_id (name)
      `)
      .eq('company_id', companyId)
      .eq('inspection_date', date);
    if (currentStoreId) inspQuery = inspQuery.eq('store_id', currentStoreId);
    const { data: inspections } = await inspQuery;

    // 5. 생산 기록
    let prodQuery = adminClient
      .from('production_records')
      .select(`
        id, lot_number, actual_quantity, unit, status,
        product:product_id (name),
        supervisor:supervisor_id (name)
      `)
      .eq('company_id', companyId)
      .eq('production_date', date);
    if (currentStoreId) prodQuery = prodQuery.eq('store_id', currentStoreId);
    const { data: productionRecords } = await prodQuery;

    // 6. 출하 기록
    let shipQuery = adminClient
      .from('shipment_records')
      .select(`
        id, shipment_number, customer_name, status, shipped_by_name
      `)
      .eq('company_id', companyId)
      .eq('shipment_date', date);
    if (currentStoreId) shipQuery = shipQuery.eq('store_id', currentStoreId);
    const { data: shipments } = await shipQuery;

    // 7. 방충방서 점검
    let pestQuery = adminClient
      .from('pest_control_checks')
      .select(`
        id, check_type, overall_status,
        checker:checked_by (name)
      `)
      .eq('company_id', companyId)
      .eq('check_date', date);
    if (currentStoreId) pestQuery = pestQuery.eq('store_id', currentStoreId);
    const { data: pestControl } = await pestQuery;

    // 8. 검증 상태 조회
    let verifyQuery = adminClient
      .from('daily_report_verifications')
      .select('*')
      .eq('company_id', companyId)
      .eq('report_date', date);
    if (currentStoreId) verifyQuery = verifyQuery.eq('store_id', currentStoreId);
    const { data: verification } = await verifyQuery.maybeSingle();

    // 요약 데이터 생성
    const ccpItems = (ccpRecords || []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      ccp_number: String((r.ccp as Record<string, unknown>)?.ccp_number || ''),
      process: String((r.ccp as Record<string, unknown>)?.process || ''),
      record_time: r.record_time as string,
      measurement: r.measurement as Record<string, unknown>,
      is_within_limit: r.is_within_limit as boolean,
      recorded_by_name: String((r.recorder as Record<string, unknown>)?.name || '미지정'),
    }));

    const deviations: Array<{ type: string; description: string; corrective_action?: string }> = [];

    // CCP 이탈 수집
    for (const r of ccpItems) {
      if (!r.is_within_limit) {
        deviations.push({
          type: 'CCP',
          description: `${r.ccp_number} (${r.process}) 한계기준 이탈`,
        });
      }
    }

    const passedCount = ccpItems.filter(r => r.is_within_limit).length;
    const failedCount = ccpItems.filter(r => !r.is_within_limit).length;

    const summary: DailySummary = {
      ccp_records: {
        total: ccpItems.length,
        passed: passedCount,
        failed: failedCount,
        items: ccpItems,
      },
      hygiene_checks: {
        shifts: ['오전', '오후', '야간'].map(shift => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const check = (hygieneChecks || []).find((h: any) => h.shift === shift) as any;
          return {
            shift,
            checked: !!check,
            checked_by_name: check?.checker?.name || '',
            overall_status: check?.overall_status || '',
          };
        }),
      },
      equipment_temp: {
        total: (equipmentTemp || []).length,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        items: (equipmentTemp || []).map((e: any) => ({
          id: e.id,
          equipment_name: e.equipment_name,
          temperature: e.temperature,
          recorded_at: e.recorded_at,
          recorded_by_name: e.recorder?.name || '미지정',
          is_normal: e.is_normal,
        })),
      },
      inspections: {
        total: (inspections || []).length,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        passed: (inspections || []).filter((i: any) => i.overall_result === 'PASS').length,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        failed: (inspections || []).filter((i: any) => i.overall_result === 'FAIL').length,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        conditional: (inspections || []).filter((i: any) => i.overall_result === 'CONDITIONAL').length,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        items: (inspections || []).map((i: any) => ({
          id: i.id,
          material_name: i.material?.name || '',
          lot_number: i.lot_number,
          overall_result: i.overall_result,
          inspected_by_name: i.inspected_by_name || '미지정',
        })),
      },
      production: {
        total: (productionRecords || []).length,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        items: (productionRecords || []).map((p: any) => ({
          id: p.id,
          lot_number: p.lot_number,
          product_name: p.product?.name || '',
          actual_quantity: p.actual_quantity,
          unit: p.unit,
          status: p.status,
          supervisor_name: p.supervisor?.name || '미지정',
        })),
      },
      shipments: {
        total: (shipments || []).length,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        items: (shipments || []).map((s: any) => ({
          id: s.id,
          shipment_number: s.shipment_number,
          customer_name: s.customer_name,
          status: s.status,
          shipped_by_name: s.shipped_by_name || '미지정',
        })),
      },
      pest_control: {
        checked: (pestControl || []).length > 0,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        items: (pestControl || []).map((p: any) => ({
          id: p.id,
          check_type: p.check_type,
          overall_status: p.overall_status,
          checked_by_name: p.checker?.name || '미지정',
        })),
      },
      deviations,
    };

    return NextResponse.json({
      date,
      summary,
      verification: verification || null,
    });
  } catch (error) {
    console.error('Error fetching daily report:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: 일일 보고서 검증 (서명)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();
    const body = await request.json();
    const { date, signature, comment } = body;

    if (!date) {
      return NextResponse.json({ error: 'Date is required' }, { status: 400 });
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await adminClient
      .from('users')
      .select('id, name, company_id, role, store_id, current_store_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const currentStoreId = userProfile.current_store_id || userProfile.store_id;

    // 검증 권한 확인 (manager 이상)
    const allowedRoles = ['super_admin', 'company_admin', 'manager', 'store_manager', 'team_leader'];
    if (!allowedRoles.includes(userProfile.role)) {
      return NextResponse.json({ error: '검증 권한이 없습니다.' }, { status: 403 });
    }

    // 해당 날짜의 요약 데이터 조회 (스냅샷 저장용)
    const reportResponse = await fetch(`${request.url}?date=${date}`);
    const reportData = await reportResponse.json();

    // 기존 검증 확인
    let existingQuery = adminClient
      .from('daily_report_verifications')
      .select('id, status')
      .eq('company_id', userProfile.company_id)
      .eq('report_date', date);
    if (currentStoreId) existingQuery = existingQuery.eq('store_id', currentStoreId);
    const { data: existingVerification } = await existingQuery.maybeSingle();

    if (existingVerification?.status === 'VERIFIED') {
      return NextResponse.json({ error: '이미 검증 완료된 보고서입니다.' }, { status: 400 });
    }

    const verificationData = {
      company_id: userProfile.company_id,
      store_id: currentStoreId || null,
      report_date: date,
      verified_by: userProfile.id,
      verified_by_name: userProfile.name,
      verified_at: new Date().toISOString(),
      verification_signature: signature || null,
      verification_comment: comment || null,
      summary_snapshot: reportData.summary,
      status: 'VERIFIED',
    };

    let result;
    if (existingVerification) {
      // 업데이트
      const { data, error } = await adminClient
        .from('daily_report_verifications')
        .update(verificationData)
        .eq('id', existingVerification.id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // 새로 생성
      const { data, error } = await adminClient
        .from('daily_report_verifications')
        .insert(verificationData)
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error verifying daily report:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
