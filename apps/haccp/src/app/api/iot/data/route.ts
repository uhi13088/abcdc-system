import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// CORS 헤더 설정
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, X-Device-Serial',
};

// OPTIONS - CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

// POST /api/iot/data - ESP32 센서 데이터 수신
export async function POST(request: NextRequest) {
  try {
    const adminClient = createAdminClient();

    // API 키 인증
    const apiKey = request.headers.get('X-API-Key');
    const deviceSerial = request.headers.get('X-Device-Serial');

    if (!apiKey || !deviceSerial) {
      return NextResponse.json(
        { error: 'Missing API key or device serial' },
        { status: 401, headers: corsHeaders }
      );
    }

    // 기기 확인
    const { data: device, error: deviceError } = await adminClient
      .from('esp32_devices')
      .select('id, sensor_id, company_id, status, device_type')
      .eq('device_serial', deviceSerial)
      .eq('api_key', apiKey)
      .single();

    if (deviceError || !device) {
      return NextResponse.json(
        { error: 'Invalid API key or device serial' },
        { status: 401, headers: corsHeaders }
      );
    }

    // 등록된 기기인지 확인
    if (!device.company_id || !device.sensor_id) {
      return NextResponse.json(
        { error: 'Device not registered to any company' },
        { status: 403, headers: corsHeaders }
      );
    }

    // 비활성화된 기기 확인
    if (device.status === 'DEACTIVATED') {
      return NextResponse.json(
        { error: 'Device is deactivated' },
        { status: 403, headers: corsHeaders }
      );
    }

    const body = await request.json();
    const {
      value,
      secondary_value,  // 온습도 센서용 두 번째 값
      unit,
      timestamp,
      wifi_ssid,
      wifi_signal,
      firmware_version,
      battery_level,
      raw_data
    } = body;

    if (value === undefined || value === null) {
      return NextResponse.json(
        { error: 'Missing required field: value' },
        { status: 400, headers: corsHeaders }
      );
    }

    // 센서 정보 조회 (임계값 확인용)
    const { data: sensor } = await adminClient
      .from('iot_sensors')
      .select('min_value, max_value, unit, alert_enabled, company_id')
      .eq('id', device.sensor_id)
      .single();

    // 범위 내 여부 확인
    let isWithinRange = true;
    let isAlert = false;

    if (sensor) {
      if (sensor.min_value !== null && value < sensor.min_value) {
        isWithinRange = false;
        isAlert = sensor.alert_enabled || false;
      }
      if (sensor.max_value !== null && value > sensor.max_value) {
        isWithinRange = false;
        isAlert = sensor.alert_enabled || false;
      }
    }

    // 센서 읽기값 저장
    const readingData = {
      sensor_id: device.sensor_id,
      company_id: device.company_id,
      value: value,
      unit: unit || sensor?.unit || getDefaultUnit(device.device_type),
      secondary_value: secondary_value || null,
      secondary_unit: secondary_value !== undefined ? '%' : null,  // 습도용
      is_within_range: isWithinRange,
      is_alert: isAlert,
      reading_time: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString()
    };

    const { data: reading, error: readingError } = await adminClient
      .from('sensor_readings')
      .insert(readingData)
      .select()
      .single();

    if (readingError) {
      console.error('Error saving reading:', readingError);
      return NextResponse.json(
        { error: 'Failed to save reading' },
        { status: 500, headers: corsHeaders }
      );
    }

    // 센서 최근 값 업데이트
    await adminClient
      .from('iot_sensors')
      .update({
        last_reading_at: reading.reading_time,
        last_value: value,
        is_online: true,
        status: 'ACTIVE'
      })
      .eq('id', device.sensor_id);

    // 기기 상태 업데이트
    const deviceUpdate: Record<string, unknown> = {
      last_seen_at: new Date().toISOString(),
      last_ip_address: getClientIP(request),
      status: 'ACTIVE'
    };

    if (wifi_ssid) deviceUpdate.wifi_ssid = wifi_ssid;
    if (wifi_signal !== undefined) deviceUpdate.wifi_signal_strength = wifi_signal;
    if (firmware_version) deviceUpdate.firmware_version = firmware_version;

    await adminClient
      .from('esp32_devices')
      .update(deviceUpdate)
      .eq('id', device.id);

    // 첫 연결 시 이벤트 로그
    if (device.status !== 'ACTIVE') {
      await adminClient.from('esp32_device_events').insert({
        device_id: device.id,
        event_type: 'CONNECTED',
        event_data: {
          ip_address: getClientIP(request),
          wifi_ssid,
          wifi_signal,
          firmware_version
        },
        ip_address: getClientIP(request)
      });
    }

    // 임계값 이탈 시 알림 생성
    if (isAlert && sensor) {
      await createAlertNotification(adminClient, {
        companyId: device.company_id,
        sensorId: device.sensor_id,
        deviceSerial: deviceSerial,
        value,
        minValue: sensor.min_value,
        maxValue: sensor.max_value,
        unit: sensor.unit
      });
    }

    return NextResponse.json({
      success: true,
      reading_id: reading.id,
      is_within_range: isWithinRange,
      is_alert: isAlert,
      server_time: new Date().toISOString()
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('Error processing IoT data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

// 클라이언트 IP 추출
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  return 'unknown';
}

// 기본 단위
function getDefaultUnit(deviceType: string): string {
  const units: Record<string, string> = {
    'TEMPERATURE': '°C',
    'HUMIDITY': '%',
    'TEMPERATURE_HUMIDITY': '°C',
    'PH': 'pH',
    'PRESSURE': 'hPa',
    'CO2': 'ppm'
  };
  return units[deviceType] || '';
}

// 알림 생성
async function createAlertNotification(
  adminClient: ReturnType<typeof createAdminClient>,
  params: {
    companyId: string;
    sensorId: string;
    deviceSerial: string;
    value: number;
    minValue: number | null;
    maxValue: number | null;
    unit: string | null;
  }
) {
  const { companyId, sensorId, deviceSerial, value, minValue, maxValue, unit } = params;

  // 센서 이름 조회
  const { data: sensor } = await adminClient
    .from('iot_sensors')
    .select('name')
    .eq('id', sensorId)
    .single();

  const sensorName = sensor?.name || deviceSerial;
  const unitStr = unit || '';

  let message = `${sensorName}: 측정값 ${value}${unitStr}`;
  if (minValue !== null && value < minValue) {
    message += ` (하한값 ${minValue}${unitStr} 이탈)`;
  } else if (maxValue !== null && value > maxValue) {
    message += ` (상한값 ${maxValue}${unitStr} 이탈)`;
  }

  // 알림 대상 사용자 조회 (관리자급)
  const { data: users } = await adminClient
    .from('users')
    .select('id')
    .eq('company_id', companyId)
    .in('role', ['company_admin', 'manager', 'store_manager']);

  if (users && users.length > 0) {
    const notifications = users.map((user: { id: string }) => ({
      company_id: companyId,
      user_id: user.id,
      type: 'SENSOR_ALERT',
      title: '센서 임계값 이탈 알림',
      message,
      data: {
        sensor_id: sensorId,
        device_serial: deviceSerial,
        value,
        min_value: minValue,
        max_value: maxValue
      },
      is_read: false
    }));

    await adminClient.from('notifications').insert(notifications);
  }
}
