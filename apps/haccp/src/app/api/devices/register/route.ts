import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/devices/register - 기기 등록 (등록 코드로)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await adminClient
      .from('users')
      .select('id, company_id, role')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { device_code, sensor_name, location } = body;

    if (!device_code) {
      return NextResponse.json({ error: '기기 등록 코드를 입력해주세요.' }, { status: 400 });
    }

    // 등록 코드 정규화 (하이픈 추가, 대문자 변환)
    const normalizedCode = device_code
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .replace(/^(.{3})(.{3})(.{3})$/, '$1-$2-$3');

    // 기기 조회
    const { data: device, error: deviceError } = await adminClient
      .from('esp32_devices')
      .select('*')
      .eq('device_code', normalizedCode)
      .single();

    if (deviceError || !device) {
      return NextResponse.json({
        error: '유효하지 않은 등록 코드입니다. 코드를 다시 확인해주세요.',
      }, { status: 404 });
    }

    // 이미 등록된 기기인지 확인
    if (device.status !== 'PROVISIONED') {
      if (device.claimed_by === userData.id) {
        return NextResponse.json({
          error: '이미 등록된 기기입니다.',
          device_id: device.id,
        }, { status: 400 });
      } else {
        return NextResponse.json({
          error: '이 기기는 다른 사용자가 이미 등록했습니다.',
        }, { status: 400 });
      }
    }

    // IoT 센서 생성
    const { data: sensor, error: sensorError } = await adminClient
      .from('iot_sensors')
      .insert({
        company_id: userData.company_id,
        sensor_code: `ESP-${normalizedCode}`,
        name: sensor_name || device.device_name || 'HACCP 온도센서',
        sensor_type: device.device_type || 'TEMPERATURE',
        location: location || '',
        device_id: device.id,
        status: 'ACTIVE',
        is_online: false,
        alert_enabled: true,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (sensorError) {
      console.error('[POST /api/devices/register] Sensor create error:', sensorError);
      return NextResponse.json({ error: '센서 등록 중 오류가 발생했습니다.' }, { status: 500 });
    }

    // 기기 상태 업데이트
    const { error: updateError } = await adminClient
      .from('esp32_devices')
      .update({
        status: 'CLAIMED',
        claimed_by: userData.id,
        claimed_at: new Date().toISOString(),
        company_id: userData.company_id,
        linked_sensor_id: sensor.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', device.id);

    if (updateError) {
      console.error('[POST /api/devices/register] Device update error:', updateError);
      // 롤백: 생성된 센서 삭제
      await adminClient.from('iot_sensors').delete().eq('id', sensor.id);
      return NextResponse.json({ error: '기기 등록 중 오류가 발생했습니다.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: '기기가 성공적으로 등록되었습니다!',
      device: {
        id: device.id,
        device_code: device.device_code,
        device_name: sensor.name,
      },
      sensor: {
        id: sensor.id,
        name: sensor.name,
        location: sensor.location,
      },
      next_steps: [
        '1. 기기의 전원을 연결하세요.',
        '2. 스마트폰에서 "HACCP-센서-' + normalizedCode.split('-')[0] + '" WiFi에 연결하세요.',
        '3. 자동으로 뜨는 화면에서 매장 WiFi를 설정하세요.',
        '4. 설정 완료 후 기기가 자동으로 데이터를 전송합니다.',
      ],
    });
  } catch (error) {
    console.error('[POST /api/devices/register] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// GET /api/devices/register - 내 등록된 기기 목록
export async function GET() {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await adminClient
      .from('users')
      .select('id, company_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 회사 소속 기기 모두 조회
    const { data: devices, error } = await adminClient
      .from('esp32_devices')
      .select(`
        *,
        sensor:linked_sensor_id (
          id,
          name,
          location,
          last_value,
          last_reading_at,
          alert_threshold_min,
          alert_threshold_max,
          status
        )
      `)
      .eq('company_id', userData.company_id)
      .order('claimed_at', { ascending: false });

    if (error) {
      console.error('[GET /api/devices/register] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      devices: devices || [],
    });
  } catch (error) {
    console.error('[GET /api/devices/register] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/devices/register - 기기 등록 해제
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await adminClient
      .from('users')
      .select('id, company_id, role')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { device_id } = body;

    if (!device_id) {
      return NextResponse.json({ error: 'device_id is required' }, { status: 400 });
    }

    // 기기 조회
    const { data: device } = await adminClient
      .from('esp32_devices')
      .select('id, company_id, linked_sensor_id')
      .eq('id', device_id)
      .single();

    if (!device) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    // 권한 확인
    if (device.company_id !== userData.company_id && userData.role !== 'super_admin') {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    // 연결된 센서 삭제
    if (device.linked_sensor_id) {
      await adminClient.from('iot_sensors').delete().eq('id', device.linked_sensor_id);
    }

    // 기기 상태 리셋 (다시 등록 가능하도록)
    await adminClient
      .from('esp32_devices')
      .update({
        status: 'PROVISIONED',
        claimed_by: null,
        claimed_at: null,
        company_id: null,
        linked_sensor_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', device_id);

    return NextResponse.json({
      success: true,
      message: '기기 등록이 해제되었습니다.',
    });
  } catch (error) {
    console.error('[DELETE /api/devices/register] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
