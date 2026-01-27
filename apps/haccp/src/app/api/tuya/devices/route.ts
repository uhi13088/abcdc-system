import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

interface TuyaSettings {
  client_id: string;
  client_secret: string;
  region: 'cn' | 'us' | 'eu' | 'in';
  enabled: boolean;
}

interface TuyaDevice {
  id: string;
  name: string;
  uid: string;
  local_key: string;
  category: string;
  product_id: string;
  product_name: string;
  sub: boolean;
  uuid: string;
  owner_id: string;
  online: boolean;
  icon: string;
  ip: string;
  time_zone: string;
  create_time: number;
  update_time: number;
  active_time: number;
  status: Array<{ code: string; value: unknown }>;
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

// GET /api/tuya/devices - 연결된 기기 목록 조회 및 동기화
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const searchParams = request.nextUrl.searchParams;
    const sync = searchParams.get('sync') === 'true';

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

    // 사용자의 Tuya 연결 확인
    const { data: userTuya } = await adminClient
      .from('user_tuya_connections')
      .select('*')
      .eq('user_id', userData.id)
      .single();

    if (!userTuya) {
      return NextResponse.json({
        error: 'Smart Life 계정이 연결되어 있지 않습니다.',
        connected: false
      }, { status: 400 });
    }

    // 동기화 요청인 경우 Tuya API에서 기기 목록 가져오기
    if (sync) {
      const { data: platformSettings } = await adminClient
        .from('platform_kv_settings')
        .select('value')
        .eq('key', 'tuya_api')
        .single();

      if (platformSettings) {
        const tuyaSettings = platformSettings.value as TuyaSettings;
        const baseUrl = TUYA_REGIONS[tuyaSettings.region] || TUYA_REGIONS.us;
        const t = Date.now().toString();

        // 토큰 갱신이 필요한지 확인
        let accessToken = userTuya.access_token;
        const expireTime = new Date(userTuya.expire_time * 1000);

        if (expireTime <= new Date()) {
          // 토큰 갱신
          const sign = generateTuyaSign(tuyaSettings.client_id, tuyaSettings.client_secret, t);
          const refreshResponse = await fetch(
            `${baseUrl}/v1.0/token/${userTuya.refresh_token}`,
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
            // 토큰 업데이트
            await adminClient
              .from('user_tuya_connections')
              .update({
                access_token: refreshResult.result.access_token,
                refresh_token: refreshResult.result.refresh_token,
                expire_time: refreshResult.result.expire_time,
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', userData.id);
          }
        }

        const sign = generateTuyaSign(
          tuyaSettings.client_id,
          tuyaSettings.client_secret,
          t,
          accessToken
        );

        // 사용자의 기기 목록 가져오기
        const devicesResponse = await fetch(
          `${baseUrl}/v1.0/users/${userTuya.tuya_uid}/devices`,
          {
            method: 'GET',
            headers: {
              'client_id': tuyaSettings.client_id,
              'sign': sign,
              't': t,
              'sign_method': 'HMAC-SHA256',
              'access_token': accessToken,
            },
          }
        );

        const devicesResult = await devicesResponse.json();

        if (devicesResult.success && devicesResult.result) {
          const devices: TuyaDevice[] = devicesResult.result;

          // 기존 기기 목록 삭제 후 새로 저장
          await adminClient
            .from('tuya_devices')
            .delete()
            .eq('user_id', userData.id);

          // 기기 정보 저장
          if (devices.length > 0) {
            const deviceRecords = devices.map((device) => ({
              user_id: userData.id,
              company_id: userData.company_id,
              tuya_device_id: device.id,
              device_name: device.name,
              category: device.category,
              product_id: device.product_id,
              product_name: device.product_name,
              is_online: device.online,
              icon: device.icon,
              ip_address: device.ip,
              time_zone: device.time_zone,
              last_status: device.status,
              synced_at: new Date().toISOString(),
            }));

            await adminClient.from('tuya_devices').insert(deviceRecords);
          }

          // 연결 정보에 기기 수 업데이트
          await adminClient
            .from('user_tuya_connections')
            .update({
              device_count: devices.length,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userData.id);
        }
      }
    }

    // DB에서 기기 목록 조회
    const { data: devices, error } = await adminClient
      .from('tuya_devices')
      .select('*')
      .eq('user_id', userData.id)
      .order('device_name');

    if (error) {
      console.error('[GET /api/tuya/devices] Query error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      devices: devices || [],
      synced_at: devices?.[0]?.synced_at || null,
    });
  } catch (error) {
    console.error('[GET /api/tuya/devices] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/tuya/devices - 기기를 센서로 등록
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
      .select('id, company_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { tuya_device_id, sensor_name, sensor_type, location, ccp_definition_id } = body;

    if (!tuya_device_id) {
      return NextResponse.json({ error: 'tuya_device_id is required' }, { status: 400 });
    }

    // Tuya 기기 확인
    const { data: tuyaDevice } = await adminClient
      .from('tuya_devices')
      .select('*')
      .eq('tuya_device_id', tuya_device_id)
      .eq('user_id', userData.id)
      .single();

    if (!tuyaDevice) {
      return NextResponse.json({ error: '기기를 찾을 수 없습니다.' }, { status: 404 });
    }

    // IoT 센서로 등록
    const { data: sensor, error } = await adminClient
      .from('iot_sensors')
      .insert({
        company_id: userData.company_id,
        sensor_name: sensor_name || tuyaDevice.device_name,
        sensor_type: sensor_type || 'TEMPERATURE',
        protocol: 'HTTP',
        device_id: tuya_device_id,
        connection_string: `tuya://${tuya_device_id}`,
        location: location || '',
        ccp_definition_id: ccp_definition_id || null,
        reading_interval_seconds: 60,
        alert_enabled: true,
        calibration_offset: 0,
        is_active: true,
        status: tuyaDevice.is_online ? 'ONLINE' : 'OFFLINE',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('[POST /api/tuya/devices] Insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Tuya 기기에 센서 연결 정보 업데이트
    await adminClient
      .from('tuya_devices')
      .update({
        linked_sensor_id: sensor.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tuyaDevice.id);

    return NextResponse.json({
      success: true,
      message: '기기가 센서로 등록되었습니다.',
      sensor,
    });
  } catch (error) {
    console.error('[POST /api/tuya/devices] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
