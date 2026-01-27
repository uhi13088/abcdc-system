import { createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

interface TuyaSettings {
  client_id: string;
  client_secret: string;
  region: 'cn' | 'us' | 'eu' | 'in';
  enabled: boolean;
}

const TUYA_REGIONS: Record<string, string> = {
  cn: 'https://openapi.tuyacn.com',
  us: 'https://openapi.tuyaus.com',
  eu: 'https://openapi.tuyaeu.com',
  in: 'https://openapi.tuyain.com',
};

function generateTuyaSign(
  clientId: string,
  secret: string,
  t: string,
  accessToken: string = ''
): string {
  const str = clientId + t + accessToken;
  return crypto
    .createHmac('sha256', secret)
    .update(str)
    .digest('hex')
    .toUpperCase();
}

// GET /api/cron/tuya-sync - Sync all Tuya device statuses
// This should be called by a cron job every 5 minutes
export async function GET(request: Request) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = createAdminClient();

    // Get Tuya settings
    const { data: platformSettings } = await adminClient
      .from('platform_kv_settings')
      .select('value')
      .eq('key', 'tuya_api')
      .single();

    if (!platformSettings) {
      return NextResponse.json({ message: 'Tuya not configured' });
    }

    const tuyaSettings = platformSettings.value as TuyaSettings;
    if (!tuyaSettings.enabled) {
      return NextResponse.json({ message: 'Tuya disabled' });
    }

    const baseUrl = TUYA_REGIONS[tuyaSettings.region] || TUYA_REGIONS.us;

    // Get all user connections
    const { data: connections } = await adminClient
      .from('user_tuya_connections')
      .select('*');

    if (!connections || connections.length === 0) {
      return NextResponse.json({ message: 'No Tuya connections' });
    }

    let syncedDevices = 0;
    let updatedSensors = 0;

    for (const connection of connections) {
      try {
        const t = Date.now().toString();

        // Check if token needs refresh
        let accessToken = connection.access_token;
        const expireTime = new Date(connection.expire_time * 1000);

        if (expireTime <= new Date()) {
          // Refresh token
          const sign = generateTuyaSign(tuyaSettings.client_id, tuyaSettings.client_secret, t);
          const refreshResponse = await fetch(
            `${baseUrl}/v1.0/token/${connection.refresh_token}`,
            {
              method: 'GET',
              headers: {
                'client_id': tuyaSettings.client_id,
                'sign': sign,
                't': t,
                'sign_method': 'HMAC-SHA256',
              },
            }
          );
          const refreshResult = await refreshResponse.json();

          if (refreshResult.success && refreshResult.result) {
            accessToken = refreshResult.result.access_token;
            await adminClient
              .from('user_tuya_connections')
              .update({
                access_token: refreshResult.result.access_token,
                refresh_token: refreshResult.result.refresh_token,
                expire_time: refreshResult.result.expire_time,
                updated_at: new Date().toISOString(),
              })
              .eq('id', connection.id);
          } else {
            console.error(`Failed to refresh token for user ${connection.user_id}`);
            continue;
          }
        }

        // Get all devices for this user
        const { data: devices } = await adminClient
          .from('tuya_devices')
          .select('*, iot_sensors:linked_sensor_id(*)')
          .eq('user_id', connection.user_id);

        if (!devices || devices.length === 0) continue;

        // Fetch status for each device and update
        for (const device of devices) {
          try {
            const deviceT = Date.now().toString();
            const sign = generateTuyaSign(
              tuyaSettings.client_id,
              tuyaSettings.client_secret,
              deviceT,
              accessToken
            );

            const statusResponse = await fetch(
              `${baseUrl}/v1.0/devices/${device.tuya_device_id}/status`,
              {
                method: 'GET',
                headers: {
                  'client_id': tuyaSettings.client_id,
                  'sign': sign,
                  't': deviceT,
                  'sign_method': 'HMAC-SHA256',
                  'access_token': accessToken,
                },
              }
            );

            const statusResult = await statusResponse.json();

            if (statusResult.success && statusResult.result) {
              // Update device status
              await adminClient
                .from('tuya_devices')
                .update({
                  last_status: statusResult.result,
                  is_online: true,
                  synced_at: new Date().toISOString(),
                })
                .eq('id', device.id);

              syncedDevices++;

              // If linked to a sensor, update sensor reading
              if (device.linked_sensor_id) {
                const tempStatus = statusResult.result.find(
                  (s: { code: string; value: unknown }) =>
                    s.code === 'va_temperature' || s.code === 'temp_current'
                );

                if (tempStatus && typeof tempStatus.value === 'number') {
                  const temperature = tempStatus.value / 10;

                  // Update sensor with latest reading
                  await adminClient
                    .from('iot_sensors')
                    .update({
                      last_reading_value: temperature,
                      last_reading_at: new Date().toISOString(),
                      status: 'ONLINE',
                    })
                    .eq('id', device.linked_sensor_id);

                  // Insert sensor reading
                  await adminClient.from('iot_sensor_readings').insert({
                    sensor_id: device.linked_sensor_id,
                    value: temperature,
                    unit: '°C',
                    recorded_at: new Date().toISOString(),
                  });

                  updatedSensors++;
                }
              }
            }
          } catch (deviceError) {
            console.error(`Failed to sync device ${device.tuya_device_id}:`, deviceError);
          }
        }
      } catch (connectionError) {
        console.error(`Failed to process connection ${connection.id}:`, connectionError);
      }
    }

    return NextResponse.json({
      success: true,
      syncedDevices,
      updatedSensors,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[GET /api/cron/tuya-sync] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
