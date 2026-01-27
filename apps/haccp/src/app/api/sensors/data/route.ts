import { createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

interface SensorDataPayload {
  sensor_id: string;
  temperature?: number;
  humidity?: number;
  value?: number; // 범용 값
  unit?: string;
}

// POST /api/sensors/data - ESP32 등 IoT 디바이스에서 데이터 수신
export async function POST(request: NextRequest) {
  try {
    const adminClient = createAdminClient();

    // API Key 인증
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
      return NextResponse.json({ error: 'API key required' }, { status: 401 });
    }

    // API Key 검증
    const { data: apiKeyData } = await adminClient
      .from('sensor_api_keys')
      .select('*, sensor:sensor_id(*)')
      .eq('api_key', apiKey)
      .eq('is_active', true)
      .single();

    if (!apiKeyData) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const body: SensorDataPayload = await request.json();
    const { sensor_id, temperature, humidity, value, unit } = body;

    // sensor_id 검증 (API key에 연결된 센서와 일치해야 함)
    if (apiKeyData.sensor_id && apiKeyData.sensor_id !== sensor_id) {
      return NextResponse.json({ error: 'Sensor ID mismatch' }, { status: 403 });
    }

    // 센서 조회
    const { data: sensor } = await adminClient
      .from('iot_sensors')
      .select('*')
      .eq('id', sensor_id)
      .single();

    if (!sensor) {
      return NextResponse.json({ error: 'Sensor not found' }, { status: 404 });
    }

    const recordedAt = new Date().toISOString();
    const primaryValue = temperature ?? value ?? 0;
    const primaryUnit = unit || (temperature !== undefined ? '°C' : 'unit');

    // 센서 상태 업데이트
    await adminClient
      .from('iot_sensors')
      .update({
        last_value: primaryValue,
        last_reading_at: recordedAt,
        is_online: true,
        status: 'ACTIVE',
      })
      .eq('id', sensor_id);

    // 범위 체크
    const isWithinRange = checkWithinRange(
      primaryValue,
      sensor.alert_threshold_min,
      sensor.alert_threshold_max
    );

    // 센서 리딩 저장
    await adminClient.from('sensor_readings').insert({
      sensor_id: sensor_id,
      company_id: sensor.company_id,
      value: primaryValue,
      unit: primaryUnit,
      secondary_value: humidity ?? null,
      secondary_unit: humidity !== undefined ? '%' : null,
      reading_time: recordedAt,
      is_within_range: isWithinRange,
      is_alert: !isWithinRange,
    });

    // API Key 마지막 사용 시간 업데이트
    await adminClient
      .from('sensor_api_keys')
      .update({ last_used_at: recordedAt })
      .eq('id', apiKeyData.id);

    // 알림 체크 및 발송
    if (sensor.alert_enabled !== false && !isWithinRange) {
      const minThreshold = sensor.alert_threshold_min;
      const maxThreshold = sensor.alert_threshold_max;

      if (minThreshold !== null && primaryValue < minThreshold) {
        await sendSensorAlert(adminClient, sensor, 'LOW_TEMPERATURE', {
          message: `온도가 기준치 미만입니다: ${primaryValue}°C (최소: ${minThreshold}°C)`,
          temperature: primaryValue,
          threshold: minThreshold,
          severity: 'CRITICAL',
        });
      } else if (maxThreshold !== null && primaryValue > maxThreshold) {
        await sendSensorAlert(adminClient, sensor, 'HIGH_TEMPERATURE', {
          message: `온도가 기준치 초과입니다: ${primaryValue}°C (최대: ${maxThreshold}°C)`,
          temperature: primaryValue,
          threshold: maxThreshold,
          severity: 'CRITICAL',
        });
      }
    }

    return NextResponse.json({
      success: true,
      recorded_at: recordedAt,
      value: primaryValue,
      within_range: isWithinRange,
    });
  } catch (error) {
    console.error('[POST /api/sensors/data] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

function checkWithinRange(value: number, min: number | null, max: number | null): boolean {
  if (min !== null && value < min) return false;
  if (max !== null && value > max) return false;
  return true;
}

async function sendSensorAlert(
  adminClient: ReturnType<typeof createAdminClient>,
  sensor: {
    id: string;
    company_id: string;
    name: string;
    location: string | null;
  },
  alertType: 'HIGH_TEMPERATURE' | 'LOW_TEMPERATURE' | 'OFFLINE',
  data: {
    message: string;
    temperature?: number;
    threshold?: number;
    severity: 'WARNING' | 'CRITICAL';
  }
) {
  const location = sensor.location || sensor.name;

  // 최근 5분 내 중복 알림 체크
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: recentAlert } = await adminClient
    .from('iot_sensor_alerts')
    .select('id')
    .eq('sensor_id', sensor.id)
    .eq('alert_type', alertType)
    .gte('created_at', fiveMinutesAgo)
    .single();

  if (recentAlert) {
    return; // 최근에 이미 알림 발송됨
  }

  // 알림 기록 저장
  await adminClient.from('iot_sensor_alerts').insert({
    sensor_id: sensor.id,
    company_id: sensor.company_id,
    alert_type: alertType,
    severity: data.severity,
    message: data.message,
    temperature_value: data.temperature,
    threshold_value: data.threshold,
    is_resolved: false,
    created_at: new Date().toISOString(),
  });

  // 알림 대상 사용자 조회
  const { data: users } = await adminClient
    .from('users')
    .select('id, name, email')
    .eq('company_id', sensor.company_id)
    .in('role', ['company_admin', 'store_manager', 'haccp_manager']);

  if (!users || users.length === 0) return;

  // 각 사용자에게 알림 발송
  for (const user of users) {
    const { data: settings } = await adminClient
      .from('notification_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    const haccpAlertsEnabled = settings?.haccp_alerts !== false;
    const pushEnabled = settings?.push_notifications !== false;

    if (!haccpAlertsEnabled) continue;

    // 알림 레코드 생성
    const notificationData = {
      user_id: user.id,
      category: 'HACCP',
      priority: data.severity === 'CRITICAL' ? 'HIGH' : 'NORMAL',
      title: data.severity === 'CRITICAL' ? '긴급 HACCP 경고' : 'HACCP 주의',
      body: `[${location}] ${data.message}`,
      data: {
        alertType,
        sensorId: sensor.id,
        temperature: data.temperature,
        threshold: data.threshold,
      },
      deep_link: '/haccp/monitoring',
      sent: false,
      read: false,
      created_at: new Date().toISOString(),
    };

    await adminClient.from('notifications').insert(notificationData);

    // 푸시 알림 큐에 추가
    if (pushEnabled) {
      const { data: fcmTokens } = await adminClient
        .from('user_fcm_tokens')
        .select('fcm_token')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (fcmTokens && fcmTokens.length > 0) {
        await adminClient.from('push_notification_queue').insert({
          user_id: user.id,
          fcm_tokens: fcmTokens.map((t) => t.fcm_token),
          payload: {
            title: notificationData.title,
            body: notificationData.body,
            category: 'HACCP',
            priority: notificationData.priority,
            data: notificationData.data,
            deepLink: notificationData.deep_link,
          },
          status: 'PENDING',
          created_at: new Date().toISOString(),
        });
      }
    }
  }
}
