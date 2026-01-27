import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// POST /api/haccp/devices/register - 등록코드로 기기 등록
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await supabase
      .from('users')
      .select('company_id, id, role')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 권한 확인 (company_admin, manager 이상만 등록 가능)
    const allowedRoles = ['super_admin', 'company_admin', 'manager', 'store_manager'];
    if (!allowedRoles.includes(userProfile.role)) {
      return NextResponse.json(
        { error: '기기 등록 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { registration_code, device_name, location, ccp_definition_id } = body;

    if (!registration_code) {
      return NextResponse.json(
        { error: '등록코드를 입력해주세요.' },
        { status: 400 }
      );
    }

    // 등록코드로 기기 찾기
    const normalizedCode = registration_code.toUpperCase().trim();

    const { data: device, error: findError } = await adminClient
      .from('esp32_devices')
      .select('*')
      .eq('registration_code', normalizedCode)
      .single();

    if (findError || !device) {
      return NextResponse.json(
        { error: '유효하지 않은 등록코드입니다.' },
        { status: 404 }
      );
    }

    // 이미 등록된 기기인지 확인
    if (device.status !== 'UNREGISTERED') {
      return NextResponse.json(
        { error: '이미 등록된 기기입니다.' },
        { status: 400 }
      );
    }

    // 등록코드 만료 확인
    if (device.registration_code_expires_at) {
      const expiresAt = new Date(device.registration_code_expires_at);
      if (expiresAt < new Date()) {
        return NextResponse.json(
          { error: '등록코드가 만료되었습니다. 관리자에게 문의하세요.' },
          { status: 400 }
        );
      }
    }

    // 사전 할당 확인 (있는 경우)
    const { data: allocation } = await adminClient
      .from('esp32_device_allocations')
      .select('company_id')
      .eq('device_id', device.id)
      .maybeSingle();

    if (allocation && allocation.company_id !== userProfile.company_id) {
      return NextResponse.json(
        { error: '이 기기는 다른 회사에 할당되어 있습니다.' },
        { status: 403 }
      );
    }

    // 센서 이름 생성
    const sensorName = device_name || `${getDeviceTypeLabel(device.device_type)} (${device.device_serial})`;
    const sensorCode = `SENSOR-${device.device_serial}`;

    // 센서 생성
    const { data: sensor, error: sensorError } = await adminClient
      .from('iot_sensors')
      .insert({
        company_id: userProfile.company_id,
        sensor_code: sensorCode,
        name: sensorName,
        sensor_type: device.device_type,
        device_id: device.device_serial,
        location: location || null,
        status: 'ACTIVE',
        alert_enabled: true,
        unit: getDefaultUnit(device.device_type)
      })
      .select()
      .single();

    if (sensorError) {
      console.error('Error creating sensor:', sensorError);
      return NextResponse.json(
        { error: '센서 생성에 실패했습니다.' },
        { status: 500 }
      );
    }

    // CCP 연결 (옵션)
    if (ccp_definition_id) {
      await adminClient
        .from('iot_sensors')
        .update({ ccp_definition_id })
        .eq('id', sensor.id);
    }

    // 기기 업데이트
    const { data: updatedDevice, error: updateError } = await adminClient
      .from('esp32_devices')
      .update({
        company_id: userProfile.company_id,
        sensor_id: sensor.id,
        status: 'REGISTERED',
        registered_at: new Date().toISOString(),
        registered_by: userProfile.id
      })
      .eq('id', device.id)
      .select()
      .single();

    if (updateError) {
      // 롤백: 생성된 센서 삭제
      await adminClient.from('iot_sensors').delete().eq('id', sensor.id);
      console.error('Error updating device:', updateError);
      return NextResponse.json(
        { error: '기기 등록에 실패했습니다.' },
        { status: 500 }
      );
    }

    // 이벤트 로그
    await adminClient.from('esp32_device_events').insert({
      device_id: device.id,
      event_type: 'REGISTERED',
      event_data: {
        company_id: userProfile.company_id,
        user_id: userProfile.id,
        sensor_id: sensor.id,
        device_name: sensorName
      }
    });

    // 할당 레코드 삭제 (있는 경우)
    if (allocation) {
      await adminClient
        .from('esp32_device_allocations')
        .delete()
        .eq('device_id', device.id);
    }

    return NextResponse.json({
      success: true,
      message: '기기가 성공적으로 등록되었습니다.',
      data: {
        device: {
          id: updatedDevice.id,
          device_serial: updatedDevice.device_serial,
          device_type: updatedDevice.device_type,
          status: updatedDevice.status
        },
        sensor: {
          id: sensor.id,
          name: sensor.name,
          sensor_code: sensor.sensor_code
        }
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Error registering device:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 기기 타입 라벨
function getDeviceTypeLabel(deviceType: string): string {
  const labels: Record<string, string> = {
    'TEMPERATURE': '온도 센서',
    'HUMIDITY': '습도 센서',
    'TEMPERATURE_HUMIDITY': '온습도 센서',
    'PH': 'pH 센서',
    'PRESSURE': '압력 센서',
    'CO2': 'CO2 센서',
    'DOOR': '도어 센서',
    'WATER_LEAK': '누수 센서',
    'OTHER': '기타 센서'
  };
  return labels[deviceType] || deviceType;
}

// 기본 단위
function getDefaultUnit(deviceType: string): string {
  const units: Record<string, string> = {
    'TEMPERATURE': '°C',
    'HUMIDITY': '%',
    'TEMPERATURE_HUMIDITY': '°C/%',
    'PH': 'pH',
    'PRESSURE': 'hPa',
    'CO2': 'ppm'
  };
  return units[deviceType] || '';
}
