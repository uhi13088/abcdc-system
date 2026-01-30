import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/haccp/sensors/[id] - 센서 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();
    const adminClient = createAdminClient();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await adminClient
      .from('users')
      .select('company_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const { data: sensor, error } = await adminClient
      .from('iot_sensors')
      .select(`
        *,
        ccp_definition:ccp_definitions(id, ccp_number, process, hazard, critical_limit)
      `)
      .eq('id', id)
      .eq('company_id', userProfile.company_id)
      .single();

    if (error || !sensor) {
      return NextResponse.json({ error: 'Sensor not found' }, { status: 404 });
    }

    // 최근 24시간 읽기값
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: readings } = await adminClient
      .from('sensor_readings')
      .select('*')
      .eq('sensor_id', id)
      .gte('recorded_at', twentyFourHoursAgo)
      .order('recorded_at', { ascending: false });

    return NextResponse.json({
      ...sensor,
      readings: readings || [],
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/haccp/sensors/[id] - 센서 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();
    const adminClient = createAdminClient();
    const body = await request.json();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await adminClient
      .from('users')
      .select('company_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 권한 확인 (같은 회사 소속 센서인지)
    const { data: existingSensor } = await adminClient
      .from('iot_sensors')
      .select('id')
      .eq('id', id)
      .eq('company_id', userProfile.company_id)
      .single();

    if (!existingSensor) {
      return NextResponse.json({ error: 'Sensor not found' }, { status: 404 });
    }

    // 업데이트 가능 필드
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    const allowedFields = [
      'sensor_name',
      'sensor_type',
      'protocol',
      'connection_string',
      'device_id',
      'location',
      'store_id',
      'ccp_definition_id',
      'reading_interval_seconds',
      'alert_enabled',
      'calibration_offset',
      'calibration_due_at',
      'is_active',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // 검교정 완료 처리
    if (body.calibration_completed) {
      updateData.last_calibrated_at = new Date().toISOString();
      if (body.next_calibration_due_at) {
        updateData.calibration_due_at = body.next_calibration_due_at;
      }
    }

    const { data, error } = await adminClient
      .from('iot_sensors')
      .update(updateData)
      .eq('id', id)
      .eq('company_id', userProfile.company_id)
      .select(`
        *,
        ccp_definition:ccp_definitions(id, ccp_number, process)
      `)
      .single();

    if (error) {
      console.error('Error updating sensor:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/haccp/sensors/[id] - 센서 삭제
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();
    const adminClient = createAdminClient();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await adminClient
      .from('users')
      .select('company_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 센서 삭제 (연관 readings는 CASCADE로 자동 삭제)
    // company_id 조건 추가로 defense-in-depth 적용
    const { error } = await adminClient
      .from('iot_sensors')
      .delete()
      .eq('id', id)
      .eq('company_id', userProfile.company_id);

    if (error) {
      console.error('Error deleting sensor:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
