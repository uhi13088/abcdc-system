import { createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

interface DeviceDataPayload {
  temperature?: number;
  humidity?: number;
  wifi_ssid?: string;
  wifi_signal?: number;
  firmware_version?: string;
  ip_address?: string;
}

// POST /api/devices/data - ESP32 기기에서 데이터 수신
export async function POST(request: NextRequest) {
  try {
    const adminClient = createAdminClient();

    // API Key 인증 (헤더에서)
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
      return NextResponse.json({ error: 'API key required' }, { status: 401 });
    }

    // 기기 조회
    const { data: device, error: deviceError } = await adminClient
      .from('esp32_devices')
      .select(`
        *,
        sensor:linked_sensor_id (
          id,
          company_id,
          name,
          alert_enabled,
          alert_threshold_min,
          alert_threshold_max
        )
      `)
      .eq('api_key', apiKey)
      .single();

    if (deviceError || !device) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    // 기기가 등록되지 않은 상태면 에러
    if (device.status === 'PROVISIONED') {
      return NextResponse.json({
        error: 'Device not registered',
        message: '이 기기는 아직 사용자에게 등록되지 않았습니다.',
        device_code: device.device_code,
      }, { status: 403 });
    }

    const body: DeviceDataPayload = await request.json();
    const {
      temperature,
      humidity,
      wifi_ssid,
      wifi_signal,
      firmware_version,
      ip_address,
    } = body;

    const now = new Date().toISOString();

    // 기기 상태 업데이트
    const deviceUpdate: Record<string, unknown> = {
      status: 'ACTIVE',
      last_seen_at: now,
      updated_at: now,
    };

    if (wifi_ssid) deviceUpdate.wifi_ssid = wifi_ssid;
    if (wifi_signal !== undefined) deviceUpdate.wifi_signal_strength = wifi_signal;
    if (firmware_version) deviceUpdate.firmware_version = firmware_version;
    if (ip_address) deviceUpdate.last_ip = ip_address;

    await adminClient
      .from('esp32_devices')
      .update(deviceUpdate)
      .eq('id', device.id);

    // 센서 데이터 처리
    if (device.sensor && temperature !== undefined) {
      const sensor = device.sensor;
      const primaryValue = temperature;

      // 범위 체크
      const isWithinRange = checkWithinRange(
        primaryValue,
        sensor.alert_threshold_min,
        sensor.alert_threshold_max
      );

      // 센서 상태 업데이트
      await adminClient
        .from('iot_sensors')
        .update({
          last_value: primaryValue,
          last_reading_at: now,
          is_online: true,
          status: 'ACTIVE',
        })
        .eq('id', sensor.id);

      // 센서 리딩 저장
      await adminClient.from('sensor_readings').insert({
        sensor_id: sensor.id,
        company_id: sensor.company_id,
        value: primaryValue,
        unit: '°C',
        secondary_value: humidity ?? null,
        secondary_unit: humidity !== undefined ? '%' : null,
        reading_time: now,
        is_within_range: isWithinRange,
        is_alert: !isWithinRange,
      });

      // 알림 체크
      if (sensor.alert_enabled !== false && !isWithinRange) {
        await triggerAlert(adminClient, device, sensor, primaryValue);
      }

      return NextResponse.json({
        success: true,
        recorded_at: now,
        value: primaryValue,
        within_range: isWithinRange,
        next_report_in: 60, // 다음 전송까지 초
      });
    }

    return NextResponse.json({
      success: true,
      recorded_at: now,
      message: 'Device status updated',
    });
  } catch (error) {
    console.error('[POST /api/devices/data] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// GET /api/devices/data - 기기 설정 조회 (기기가 부팅 시 호출)
export async function GET(request: NextRequest) {
  try {
    const adminClient = createAdminClient();

    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
      return NextResponse.json({ error: 'API key required' }, { status: 401 });
    }

    const { data: device, error } = await adminClient
      .from('esp32_devices')
      .select(`
        id,
        device_code,
        device_name,
        status,
        firmware_version,
        sensor:linked_sensor_id (
          id,
          name,
          location,
          alert_threshold_min,
          alert_threshold_max
        )
      `)
      .eq('api_key', apiKey)
      .single();

    if (error || !device) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    return NextResponse.json({
      device_id: device.id,
      device_code: device.device_code,
      device_name: device.device_name,
      status: device.status,
      firmware_version: device.firmware_version,
      sensor: device.sensor,
      config: {
        report_interval_seconds: 60,
        retry_interval_seconds: 10,
        server_url: process.env.NEXT_PUBLIC_APP_URL || '',
      },
    });
  } catch (error) {
    console.error('[GET /api/devices/data] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

function checkWithinRange(value: number, min: number | null, max: number | null): boolean {
  if (min !== null && value < min) return false;
  if (max !== null && value > max) return false;
  return true;
}

async function triggerAlert(
  adminClient: ReturnType<typeof createAdminClient>,
  device: { id: string; device_code: string },
  sensor: {
    id: string;
    company_id: string;
    name: string;
    alert_threshold_min: number | null;
    alert_threshold_max: number | null;
  },
  temperature: number
) {
  const minThreshold = sensor.alert_threshold_min;
  const maxThreshold = sensor.alert_threshold_max;

  let alertType: 'HIGH_TEMPERATURE' | 'LOW_TEMPERATURE';
  let message: string;
  let threshold: number;

  if (minThreshold !== null && temperature < minThreshold) {
    alertType = 'LOW_TEMPERATURE';
    message = `온도가 기준치 미만입니다: ${temperature}°C (최소: ${minThreshold}°C)`;
    threshold = minThreshold;
  } else if (maxThreshold !== null && temperature > maxThreshold) {
    alertType = 'HIGH_TEMPERATURE';
    message = `온도가 기준치 초과입니다: ${temperature}°C (최대: ${maxThreshold}°C)`;
    threshold = maxThreshold;
  } else {
    return;
  }

  // 중복 알림 방지 (5분)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: recentAlert } = await adminClient
    .from('iot_sensor_alerts')
    .select('id')
    .eq('sensor_id', sensor.id)
    .eq('alert_type', alertType)
    .gte('created_at', fiveMinutesAgo)
    .single();

  if (recentAlert) return;

  // 알림 저장
  await adminClient.from('iot_sensor_alerts').insert({
    sensor_id: sensor.id,
    company_id: sensor.company_id,
    alert_type: alertType,
    severity: 'CRITICAL',
    message,
    temperature_value: temperature,
    threshold_value: threshold,
    is_resolved: false,
    created_at: new Date().toISOString(),
  });

  // 푸시 알림 발송 (기존 로직 재사용)
  const { data: users } = await adminClient
    .from('users')
    .select('id')
    .eq('company_id', sensor.company_id)
    .in('role', ['company_admin', 'store_manager', 'haccp_manager']);

  if (!users) return;

  for (const user of users) {
    const { data: settings } = await adminClient
      .from('notification_settings')
      .select('haccp_alerts, push_notifications')
      .eq('user_id', user.id)
      .single();

    if (settings?.haccp_alerts === false) continue;

    // 알림 생성
    await adminClient.from('notifications').insert({
      user_id: user.id,
      category: 'HACCP',
      priority: 'HIGH',
      title: '긴급 HACCP 경고',
      body: `[${sensor.name}] ${message}`,
      data: { alertType, sensorId: sensor.id, temperature, threshold },
      deep_link: '/haccp/monitoring',
      created_at: new Date().toISOString(),
    });

    // 푸시 큐
    if (settings?.push_notifications !== false) {
      const { data: tokens } = await adminClient
        .from('user_fcm_tokens')
        .select('fcm_token')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (tokens?.length) {
        await adminClient.from('push_notification_queue').insert({
          user_id: user.id,
          fcm_tokens: tokens.map(t => t.fcm_token),
          payload: {
            title: '긴급 HACCP 경고',
            body: `[${sensor.name}] ${message}`,
            category: 'HACCP',
            priority: 'HIGH',
          },
          status: 'PENDING',
          created_at: new Date().toISOString(),
        });
      }
    }
  }
}
