import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/haccp/devices/[id] - 기기 상세 조회 (매장별)
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
      .select('company_id, store_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 기기 조회 (company_id 필터링)
    const { data: device, error } = await adminClient
      .from('esp32_devices')
      .select(`
        *,
        sensor:iot_sensors(
          id,
          name,
          sensor_code,
          status,
          last_reading_at,
          last_value,
          unit,
          min_value,
          max_value,
          alert_enabled,
          ccp_definition_id
        )
      `)
      .eq('id', id)
      .eq('company_id', userProfile.company_id)
      .single();

    if (error || !device) {
      return NextResponse.json({ error: '기기를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 보안: device의 store가 사용자의 company에 속하는지 확인
    if (device.store_id) {
      const { data: store } = await adminClient
        .from('stores')
        .select('id, company_id')
        .eq('id', device.store_id)
        .single();

      if (!store || store.company_id !== userProfile.company_id) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // 최근 이벤트 조회
    const { data: events } = await adminClient
      .from('esp32_device_events')
      .select('*')
      .eq('device_id', id)
      .order('created_at', { ascending: false })
      .limit(20);

    // 최근 센서 데이터 조회
    let recentReadings = [];
    if (device.sensor_id) {
      const { data: readings } = await adminClient
        .from('sensor_readings')
        .select('*')
        .eq('sensor_id', device.sensor_id)
        .order('reading_time', { ascending: false })
        .limit(100);
      recentReadings = readings || [];
    }

    return NextResponse.json({
      success: true,
      data: {
        ...device,
        events: events || [],
        recent_readings: recentReadings
      }
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/haccp/devices/[id] - 기기 설정 수정 (매장별)
export async function PUT(
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
      .select('company_id, store_id, role')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 권한 확인
    const allowedRoles = ['super_admin', 'company_admin', 'manager'];
    if (!allowedRoles.includes(userProfile.role)) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    // 기기 소유권 확인
    const { data: device } = await adminClient
      .from('esp32_devices')
      .select('id, sensor_id, store_id')
      .eq('id', id)
      .eq('company_id', userProfile.company_id)
      .single();

    if (!device) {
      return NextResponse.json({ error: '기기를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 보안: device의 store가 사용자의 company에 속하는지 확인
    if (device.store_id) {
      const { data: store } = await adminClient
        .from('stores')
        .select('id, company_id')
        .eq('id', device.store_id)
        .single();

      if (!store || store.company_id !== userProfile.company_id) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    const body = await request.json();
    const {
      device_name,
      location,
      reading_interval_seconds,
      ccp_definition_id,
      alert_enabled,
      min_value,
      max_value
    } = body;

    // 기기 설정 업데이트
    const deviceUpdate: Record<string, unknown> = {};
    if (reading_interval_seconds !== undefined) {
      deviceUpdate.reading_interval_seconds = reading_interval_seconds;
    }

    if (Object.keys(deviceUpdate).length > 0) {
      await adminClient
        .from('esp32_devices')
        .update(deviceUpdate)
        .eq('id', id);
    }

    // 센서 설정 업데이트
    if (device.sensor_id) {
      const sensorUpdate: Record<string, unknown> = {};
      if (device_name !== undefined) sensorUpdate.name = device_name;
      if (location !== undefined) sensorUpdate.location = location;
      if (ccp_definition_id !== undefined) sensorUpdate.ccp_definition_id = ccp_definition_id;
      if (alert_enabled !== undefined) sensorUpdate.alert_enabled = alert_enabled;
      if (min_value !== undefined) sensorUpdate.min_value = min_value;
      if (max_value !== undefined) sensorUpdate.max_value = max_value;

      if (Object.keys(sensorUpdate).length > 0) {
        await adminClient
          .from('iot_sensors')
          .update(sensorUpdate)
          .eq('id', device.sensor_id);
      }
    }

    // 업데이트된 기기 반환
    const { data: updatedDevice } = await adminClient
      .from('esp32_devices')
      .select(`
        *,
        sensor:iot_sensors(*)
      `)
      .eq('id', id)
      .single();

    return NextResponse.json({
      success: true,
      data: updatedDevice
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/haccp/devices/[id] - 기기 등록 해제 (매장별)
export async function DELETE(
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
      .select('company_id, store_id, role, id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 권한 확인 (company_admin 이상만 삭제 가능)
    const allowedRoles = ['super_admin', 'company_admin'];
    if (!allowedRoles.includes(userProfile.role)) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    // 기기 소유권 확인
    const { data: device } = await adminClient
      .from('esp32_devices')
      .select('id, sensor_id, device_serial, store_id')
      .eq('id', id)
      .eq('company_id', userProfile.company_id)
      .single();

    if (!device) {
      return NextResponse.json({ error: '기기를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 보안: device의 store가 사용자의 company에 속하는지 확인
    if (device.store_id) {
      const { data: store } = await adminClient
        .from('stores')
        .select('id, company_id')
        .eq('id', device.store_id)
        .single();

      if (!store || store.company_id !== userProfile.company_id) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // 연결된 센서 삭제
    if (device.sensor_id) {
      // 센서 데이터 먼저 삭제
      await adminClient
        .from('sensor_readings')
        .delete()
        .eq('sensor_id', device.sensor_id);

      await adminClient
        .from('iot_sensors')
        .delete()
        .eq('id', device.sensor_id);
    }

    // 기기 등록 해제 (삭제하지 않고 상태 변경)
    await adminClient
      .from('esp32_devices')
      .update({
        company_id: null,
        sensor_id: null,
        status: 'UNREGISTERED',
        registered_at: null,
        registered_by: null
      })
      .eq('id', id);

    // 이벤트 로그
    await adminClient.from('esp32_device_events').insert({
      device_id: id,
      event_type: 'DEACTIVATED',
      event_data: {
        unregistered_by: userProfile.id,
        previous_company_id: userProfile.company_id
      }
    });

    return NextResponse.json({
      success: true,
      message: '기기 등록이 해제되었습니다.'
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
