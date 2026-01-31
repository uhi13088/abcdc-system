/**
 * HACCP 검교정 관리 API
 * GET /api/haccp/calibration - 검교정 기록 조회
 * POST /api/haccp/calibration - 검교정 기록 생성
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/haccp/calibration
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();
    const { searchParams } = new URL(request.url);
    const equipmentType = searchParams.get('equipmentType');
    const status = searchParams.get('status');
    const expiringSoon = searchParams.get('expiringSoon'); // 만료임박 조회

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await adminClient
      .from('users')
      .select('company_id, store_id, current_store_id, current_haccp_store_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // HACCP 매장 우선순위: current_haccp_store_id > current_store_id > store_id
    const currentStoreId = userProfile.current_haccp_store_id || userProfile.current_store_id || userProfile.store_id;

    let query = adminClient
      .from('equipment_calibration_records')
      .select(`
        *,
        calibrated_by_user:calibrated_by (name),
        verified_by_user:verified_by (name)
      `)
      .eq('company_id', userProfile.company_id);

    query = query.order('calibration_date', { ascending: false });

    if (equipmentType) {
      query = query.eq('equipment_type', equipmentType);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (expiringSoon === 'true') {
      // 30일 이내 만료 예정
      const thirtyDaysLater = new Date();
      thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
      query = query.lte('next_calibration_date', thirtyDaysLater.toISOString().split('T')[0]);
      query = query.gte('next_calibration_date', new Date().toISOString().split('T')[0]);
    }

    // store_id 필터링 시도
    if (currentStoreId) {
      query = query.eq('store_id', currentStoreId);
    }

    let { data, error } = await query;

    // store_id 컬럼 오류 시 store_id 필터 없이 재시도
    if (error && (error.code === '42703' || error.message?.includes('store_id'))) {
      console.log('store_id column not found, retrying without store filter');
      let retryQuery = adminClient
        .from('equipment_calibration_records')
        .select(`
          *,
          calibrated_by_user:calibrated_by (name),
          verified_by_user:verified_by (name)
        `)
        .eq('company_id', userProfile.company_id)
        .order('calibration_date', { ascending: false });

      if (equipmentType) retryQuery = retryQuery.eq('equipment_type', equipmentType);
      if (status) retryQuery = retryQuery.eq('status', status);
      if (expiringSoon === 'true') {
        const thirtyDaysLater = new Date();
        thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
        retryQuery = retryQuery.lte('next_calibration_date', thirtyDaysLater.toISOString().split('T')[0]);
        retryQuery = retryQuery.gte('next_calibration_date', new Date().toISOString().split('T')[0]);
      }

      const retryResult = await retryQuery;
      data = retryResult.data;
      error = retryResult.error;
    }

    if (error) {
      // 테이블이 없으면 빈 배열 반환
      if (
        error.code === '42P01' ||
        error.code === 'PGRST116' ||
        error.code === 'PGRST205' ||
        error.message?.includes('does not exist') ||
        error.message?.includes('relation') ||
        error.message?.includes('schema cache')
      ) {
        console.log('equipment_calibration_records table not found, returning empty result');
        return NextResponse.json([]);
      }
      console.error('Error fetching calibration records:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (data || []).map((record: any) => ({
      ...record,
      calibrated_by_name: record.calibrated_by_user?.name,
      verified_by_name: record.verified_by_user?.name,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/haccp/calibration
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();
    const body = await request.json();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await adminClient
      .from('users')
      .select('id, company_id, store_id, current_store_id, current_haccp_store_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const currentStoreId = userProfile.current_haccp_store_id || userProfile.current_store_id || userProfile.store_id;

    // 다음 검교정 일자 자동 계산
    let nextCalibrationDate = body.next_calibration_date;
    if (!nextCalibrationDate && body.calibration_date && body.calibration_cycle_months) {
      const calibrationDate = new Date(body.calibration_date);
      calibrationDate.setMonth(calibrationDate.getMonth() + body.calibration_cycle_months);
      nextCalibrationDate = calibrationDate.toISOString().split('T')[0];
    }

    const insertData: Record<string, unknown> = {
      company_id: userProfile.company_id,
      store_id: currentStoreId || null,
      calibrated_by: userProfile.id,
      equipment_name: body.equipment_name,
      equipment_code: body.equipment_code,
      equipment_type: body.equipment_type,
      manufacturer: body.manufacturer,
      model: body.model,
      serial_number: body.serial_number,
      location: body.location,
      calibration_date: body.calibration_date,
      next_calibration_date: nextCalibrationDate,
      calibration_cycle_months: body.calibration_cycle_months || 12,
      calibration_type: body.calibration_type,
      calibration_agency: body.calibration_agency,
      certificate_number: body.certificate_number,
      certificate_url: body.certificate_url,
      standard_value: body.standard_value,
      measured_value: body.measured_value,
      tolerance: body.tolerance,
      unit: body.unit,
      result: body.result,
      deviation_action: body.deviation_action,
      notes: body.notes,
      status: body.status || 'ACTIVE',
    };

    let { data, error } = await adminClient
      .from('equipment_calibration_records')
      .insert(insertData)
      .select()
      .single();

    // store_id 컬럼 오류 시 store_id 없이 재시도
    if (error && (error.code === '42703' || error.message?.includes('store_id'))) {
      console.log('store_id column not found, retrying without store_id');
      delete insertData.store_id;
      const retryResult = await adminClient
        .from('equipment_calibration_records')
        .insert(insertData)
        .select()
        .single();
      data = retryResult.data;
      error = retryResult.error;
    }

    if (error) {
      // 테이블이 없으면 null 반환
      if (
        error.code === '42P01' ||
        error.code === 'PGRST116' ||
        error.message?.includes('does not exist') ||
        error.message?.includes('relation')
      ) {
        console.log('equipment_calibration_records table not found');
        return NextResponse.json(null);
      }
      console.error('Error creating calibration record:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/haccp/calibration
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();
    const body = await request.json();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await adminClient
      .from('users')
      .select('id, company_id, store_id, current_store_id, current_haccp_store_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const currentStoreId = userProfile.current_haccp_store_id || userProfile.current_store_id || userProfile.store_id;

    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    // If marking as verified
    if (updateData.verified) {
      updateData.verified_by = userProfile.id;
      updateData.verified_at = new Date().toISOString();
      delete updateData.verified;
    }

    updateData.updated_at = new Date().toISOString();

    let query = adminClient
      .from('equipment_calibration_records')
      .update(updateData)
      .eq('id', id)
      .eq('company_id', userProfile.company_id);

    if (currentStoreId) {
      query = query.eq('store_id', currentStoreId);
    }

    let { data, error } = await query
      .select()
      .single();

    // store_id 컬럼 오류 시 store_id 필터 없이 재시도
    if (error && (error.code === '42703' || error.message?.includes('store_id'))) {
      console.log('store_id column not found, retrying without store filter');
      const retryResult = await adminClient
        .from('equipment_calibration_records')
        .update(updateData)
        .eq('id', id)
        .eq('company_id', userProfile.company_id)
        .select()
        .single();
      data = retryResult.data;
      error = retryResult.error;
    }

    if (error) {
      console.error('Error updating calibration record:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
