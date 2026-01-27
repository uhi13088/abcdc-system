import { createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

interface TuyaWebhookPayload {
  bizCode: string;
  bizData: {
    devId: string;
    productKey?: string;
    uid?: string;
    status?: Array<{ code: string; value: unknown; t: number }>;
    dataId?: string;
  };
  ts: number;
  nonce?: string;
}

interface TuyaSettings {
  client_id: string;
  client_secret: string;
  region: 'cn' | 'us' | 'eu' | 'in';
  enabled: boolean;
  webhook_secret?: string;
}

// Tuya bizCode types
const BIZ_CODES = {
  STATUS_REPORT: 'statusReport', // 기기 상태 보고
  ONLINE: 'online', // 기기 온라인
  OFFLINE: 'offline', // 기기 오프라인
  NAME_UPDATE: 'nameUpdate', // 기기 이름 변경
  BIND_USER: 'bindUser', // 기기 바인딩
  DELETE: 'delete', // 기기 삭제
};

// POST /api/tuya/webhook - Tuya 실시간 상태 변경 웹훅
export async function POST(request: NextRequest) {
  try {
    const adminClient = createAdminClient();
    const body = await request.text();

    // Get Tuya settings for webhook verification
    const { data: platformSettings } = await adminClient
      .from('platform_kv_settings')
      .select('value')
      .eq('key', 'tuya_api')
      .single();

    if (!platformSettings) {
      console.error('[Tuya Webhook] Platform settings not found');
      return NextResponse.json({ success: false }, { status: 500 });
    }

    const tuyaSettings = platformSettings.value as TuyaSettings;

    // Verify webhook signature if webhook_secret is configured
    if (tuyaSettings.webhook_secret) {
      const signature = request.headers.get('sign');
      const timestamp = request.headers.get('t');

      if (signature && timestamp) {
        const expectedSign = crypto
          .createHmac('sha256', tuyaSettings.webhook_secret)
          .update(body + timestamp)
          .digest('hex')
          .toUpperCase();

        if (signature !== expectedSign) {
          console.error('[Tuya Webhook] Invalid signature');
          return NextResponse.json({ success: false }, { status: 401 });
        }
      }
    }

    const payload: TuyaWebhookPayload = JSON.parse(body);
    console.log('[Tuya Webhook] Received:', payload.bizCode, payload.bizData.devId);

    // Find the device in our database
    const { data: device } = await adminClient
      .from('tuya_devices')
      .select(`
        *,
        iot_sensors:linked_sensor_id (
          id,
          name,
          location,
          alert_enabled,
          alert_threshold_min,
          alert_threshold_max
        )
      `)
      .eq('tuya_device_id', payload.bizData.devId)
      .single();

    if (!device) {
      // Device not in our system, acknowledge but ignore
      return NextResponse.json({ success: true });
    }

    switch (payload.bizCode) {
      case BIZ_CODES.STATUS_REPORT:
        await handleStatusReport(adminClient, device, payload);
        break;

      case BIZ_CODES.ONLINE:
        await adminClient
          .from('tuya_devices')
          .update({ is_online: true, synced_at: new Date().toISOString() })
          .eq('id', device.id);

        if (device.linked_sensor_id) {
          await adminClient
            .from('iot_sensors')
            .update({ status: 'ONLINE' })
            .eq('id', device.linked_sensor_id);
        }
        break;

      case BIZ_CODES.OFFLINE:
        await adminClient
          .from('tuya_devices')
          .update({ is_online: false, synced_at: new Date().toISOString() })
          .eq('id', device.id);

        if (device.linked_sensor_id) {
          await adminClient
            .from('iot_sensors')
            .update({ status: 'OFFLINE' })
            .eq('id', device.linked_sensor_id);

          // Send offline alert
          await sendSensorAlert(adminClient, device, 'OFFLINE', {
            message: `센서 "${device.device_name}"가 오프라인 상태입니다.`,
            severity: 'WARNING',
          });
        }
        break;

      default:
        console.log('[Tuya Webhook] Unhandled bizCode:', payload.bizCode);
    }

    // Tuya expects a success response
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Tuya Webhook] Error:', error);
    // Still return success to prevent Tuya from retrying
    return NextResponse.json({ success: true });
  }
}

async function handleStatusReport(
  adminClient: ReturnType<typeof createAdminClient>,
  device: {
    id: string;
    user_id: string;
    company_id: string | null;
    device_name: string;
    linked_sensor_id: string | null;
    iot_sensors: {
      id: string;
      name: string;
      alert_threshold_min: number | null;
      alert_threshold_max: number | null;
      alert_enabled: boolean;
      location: string | null;
    } | null;
  },
  payload: TuyaWebhookPayload
) {
  const status = payload.bizData.status;
  if (!status || status.length === 0) return;

  // Update device status
  await adminClient
    .from('tuya_devices')
    .update({
      last_status: status,
      is_online: true,
      synced_at: new Date().toISOString(),
    })
    .eq('id', device.id);

  // If linked to a sensor, process temperature
  if (device.linked_sensor_id && device.iot_sensors) {
    const tempStatus = status.find(
      (s) => s.code === 'va_temperature' || s.code === 'temp_current' || s.code === 'temp_value'
    );

    if (tempStatus && typeof tempStatus.value === 'number') {
      const temperature = tempStatus.value / 10; // Tuya sends temperature * 10
      const sensor = device.iot_sensors;
      const recordedAt = new Date(payload.ts || Date.now()).toISOString();

      // Update sensor with latest reading
      await adminClient
        .from('iot_sensors')
        .update({
          last_value: temperature,
          last_reading_at: recordedAt,
          is_online: true,
          status: 'ACTIVE',
        })
        .eq('id', device.linked_sensor_id);

      // Insert sensor reading
      await adminClient.from('sensor_readings').insert({
        sensor_id: device.linked_sensor_id,
        company_id: device.company_id,
        value: temperature,
        unit: '°C',
        reading_time: recordedAt,
        is_within_range: checkWithinRange(temperature, sensor.alert_threshold_min, sensor.alert_threshold_max),
        is_alert: !checkWithinRange(temperature, sensor.alert_threshold_min, sensor.alert_threshold_max),
      });

      // Check thresholds and send alerts if alert is enabled
      if (sensor.alert_enabled !== false) {
        const minThreshold = sensor.alert_threshold_min;
        const maxThreshold = sensor.alert_threshold_max;

        if (minThreshold !== null && temperature < minThreshold) {
          await sendSensorAlert(adminClient, device, 'LOW_TEMPERATURE', {
            message: `온도가 기준치 미만입니다: ${temperature}°C (최소: ${minThreshold}°C)`,
            temperature,
            threshold: minThreshold,
            severity: 'CRITICAL',
          });
        } else if (maxThreshold !== null && temperature > maxThreshold) {
          await sendSensorAlert(adminClient, device, 'HIGH_TEMPERATURE', {
            message: `온도가 기준치 초과입니다: ${temperature}°C (최대: ${maxThreshold}°C)`,
            temperature,
            threshold: maxThreshold,
            severity: 'CRITICAL',
          });
        }
      }
    }
  }
}

function checkWithinRange(value: number, min: number | null, max: number | null): boolean {
  if (min !== null && value < min) return false;
  if (max !== null && value > max) return false;
  return true;
}

async function sendSensorAlert(
  adminClient: ReturnType<typeof createAdminClient>,
  device: {
    id: string;
    user_id: string;
    company_id: string | null;
    device_name: string;
    linked_sensor_id: string | null;
    iot_sensors: {
      id: string;
      name: string;
      location: string | null;
    } | null;
  },
  alertType: 'HIGH_TEMPERATURE' | 'LOW_TEMPERATURE' | 'OFFLINE',
  data: {
    message: string;
    temperature?: number;
    threshold?: number;
    severity: 'WARNING' | 'CRITICAL';
  }
) {
  const sensor = device.iot_sensors;
  const location = sensor?.location || sensor?.name || device.device_name;

  // Check for duplicate alerts in the last 5 minutes
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: recentAlert } = await adminClient
    .from('iot_sensor_alerts')
    .select('id')
    .eq('sensor_id', device.linked_sensor_id)
    .eq('alert_type', alertType)
    .gte('created_at', fiveMinutesAgo)
    .single();

  if (recentAlert) {
    // Already alerted recently, skip
    return;
  }

  // Insert alert record
  await adminClient.from('iot_sensor_alerts').insert({
    sensor_id: device.linked_sensor_id,
    company_id: device.company_id,
    alert_type: alertType,
    severity: data.severity,
    message: data.message,
    temperature_value: data.temperature,
    threshold_value: data.threshold,
    is_resolved: false,
    created_at: new Date().toISOString(),
  });

  // Get users who should receive this alert
  const { data: users } = await adminClient
    .from('users')
    .select('id, name, email')
    .eq('company_id', device.company_id)
    .in('role', ['company_admin', 'store_manager', 'haccp_manager']);

  if (!users || users.length === 0) return;

  // Check each user's notification settings
  for (const user of users) {
    const { data: settings } = await adminClient
      .from('notification_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // Default to enabled if no settings
    const haccpAlertsEnabled = settings?.haccp_alerts !== false;
    const pushEnabled = settings?.push_notifications !== false;

    if (!haccpAlertsEnabled) continue;

    // Create notification record
    const notificationData = {
      user_id: user.id,
      category: 'HACCP',
      priority: data.severity === 'CRITICAL' ? 'HIGH' : 'NORMAL',
      title: data.severity === 'CRITICAL' ? '긴급 HACCP 경고' : 'HACCP 주의',
      body: `[${location}] ${data.message}`,
      data: {
        alertType,
        sensorId: device.linked_sensor_id,
        deviceId: device.id,
        temperature: data.temperature,
        threshold: data.threshold,
      },
      deep_link: '/haccp/monitoring',
      sent: false,
      read: false,
      created_at: new Date().toISOString(),
    };

    await adminClient.from('notifications').insert(notificationData);

    // Send push notification if enabled
    if (pushEnabled) {
      const { data: fcmTokens } = await adminClient
        .from('user_fcm_tokens')
        .select('fcm_token')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (fcmTokens && fcmTokens.length > 0) {
        // Queue push notification (will be processed by push notification worker)
        await adminClient.from('push_notification_queue').insert({
          user_id: user.id,
          notification_id: null, // Will be linked after notification insert
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

// GET /api/tuya/webhook - Tuya webhook verification (challenge response)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const msg = searchParams.get('msg');

  // Tuya sends a verification challenge
  if (msg) {
    return NextResponse.json({ msg });
  }

  return NextResponse.json({ status: 'ok' });
}
