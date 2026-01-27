import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// CORS 헤더 설정
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, X-Device-Serial',
};

// OPTIONS - CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

// GET /api/iot/config - ESP32 기기 설정 조회
export async function GET(request: NextRequest) {
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
      .select(`
        id,
        device_serial,
        device_type,
        status,
        reading_interval_seconds,
        config,
        firmware_version,
        company_id,
        sensor_id
      `)
      .eq('device_serial', deviceSerial)
      .eq('api_key', apiKey)
      .single();

    if (deviceError || !device) {
      return NextResponse.json(
        { error: 'Invalid API key or device serial' },
        { status: 401, headers: corsHeaders }
      );
    }

    // 등록 상태 확인
    if (!device.company_id) {
      return NextResponse.json({
        registered: false,
        device_serial: device.device_serial,
        device_type: device.device_type,
        message: 'Device not registered. Please register with the registration code.'
      }, { headers: corsHeaders });
    }

    // 센서 설정 조회
    let sensorConfig = null;
    if (device.sensor_id) {
      const { data: sensor } = await adminClient
        .from('iot_sensors')
        .select('min_value, max_value, unit, alert_enabled, name')
        .eq('id', device.sensor_id)
        .single();

      if (sensor) {
        sensorConfig = {
          name: sensor.name,
          min_value: sensor.min_value,
          max_value: sensor.max_value,
          unit: sensor.unit,
          alert_enabled: sensor.alert_enabled
        };
      }
    }

    // 기기 마지막 확인 시간 업데이트
    await adminClient
      .from('esp32_devices')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', device.id);

    return NextResponse.json({
      registered: true,
      device_serial: device.device_serial,
      device_type: device.device_type,
      status: device.status,
      reading_interval_seconds: device.reading_interval_seconds,
      sensor: sensorConfig,
      config: device.config || {},
      server_time: new Date().toISOString()
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('Error getting config:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
