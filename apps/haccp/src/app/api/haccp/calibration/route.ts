/**
 * HACCP 검교정 관리 API
 * GET /api/haccp/calibration - 검교정 기록 조회
 * POST /api/haccp/calibration - 검교정 기록 생성
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/haccp/calibration
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { searchParams } = new URL(request.url);
    const equipmentType = searchParams.get('equipmentType');
    const status = searchParams.get('status');
    const expiringSoon = searchParams.get('expiringSoon'); // 만료임박 조회

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
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    let query = supabase
      .from('calibration_records')
      .select(`
        *,
        calibrated_by_user:calibrated_by (name),
        verified_by_user:verified_by (name)
      `)
      .eq('company_id', userProfile.company_id)
      .order('calibration_date', { ascending: false });

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

    const { data, error } = await query;

    if (error) {
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
    const body = await request.json();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await supabase
      .from('users')
      .select('id, company_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 다음 검교정 일자 자동 계산
    let nextCalibrationDate = body.next_calibration_date;
    if (!nextCalibrationDate && body.calibration_date && body.calibration_cycle_months) {
      const calibrationDate = new Date(body.calibration_date);
      calibrationDate.setMonth(calibrationDate.getMonth() + body.calibration_cycle_months);
      nextCalibrationDate = calibrationDate.toISOString().split('T')[0];
    }

    const { data, error } = await supabase
      .from('calibration_records')
      .insert({
        company_id: userProfile.company_id,
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
      })
      .select()
      .single();

    if (error) {
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
    const body = await request.json();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await supabase
      .from('users')
      .select('id, company_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

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

    const { data, error } = await supabase
      .from('calibration_records')
      .update(updateData)
      .eq('id', id)
      .eq('company_id', userProfile.company_id)
      .select()
      .single();

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
