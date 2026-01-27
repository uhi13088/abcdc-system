import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// GET - 전체 기기 목록 조회 (Super Admin)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    // Verify super_admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await adminClient
      .from('users')
      .select('role, id')
      .eq('auth_id', user.id)
      .single();

    if (profile?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const companyId = searchParams.get('company_id');
    const deviceType = searchParams.get('device_type');
    const batchId = searchParams.get('batch_id');

    let query = adminClient
      .from('esp32_devices')
      .select(`
        *,
        company:companies(id, name),
        sensor:iot_sensors(id, name, sensor_code),
        registered_by_user:users!esp32_devices_registered_by_fkey(id, name)
      `)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }
    if (companyId) {
      query = query.eq('company_id', companyId);
    }
    if (deviceType) {
      query = query.eq('device_type', deviceType);
    }

    const { data: devices, error } = await query;

    if (error) {
      console.error('Error fetching devices:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 배치 필터링 (시리얼 기반)
    let filteredDevices = devices || [];
    if (batchId) {
      const { data: batch } = await adminClient
        .from('esp32_device_batches')
        .select('serial_prefix, serial_start, serial_end')
        .eq('id', batchId)
        .single();

      if (batch) {
        filteredDevices = filteredDevices.filter(d => {
          const serial = d.device_serial;
          if (!serial.startsWith(batch.serial_prefix)) return false;
          const num = parseInt(serial.replace(batch.serial_prefix, ''), 10);
          return num >= batch.serial_start && num <= batch.serial_end;
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: filteredDevices,
      count: filteredDevices.length
    });
  } catch (error) {
    console.error('Error in devices GET:', error);
    return NextResponse.json(
      { error: 'Failed to fetch devices' },
      { status: 500 }
    );
  }
}

// POST - 개별 기기 생성 (Super Admin)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    // Verify super_admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await adminClient
      .from('users')
      .select('role, id')
      .eq('auth_id', user.id)
      .single();

    if (profile?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { device_serial, device_type, mac_address } = body;

    if (!device_serial || !device_type) {
      return NextResponse.json(
        { error: 'device_serial and device_type are required' },
        { status: 400 }
      );
    }

    // 등록코드 생성
    const { data: regCodeResult } = await adminClient.rpc('generate_registration_code');
    const registrationCode = regCodeResult || generateFallbackCode();

    // API 키 생성
    const { data: apiKeyResult } = await adminClient.rpc('generate_api_key');
    const apiKey = apiKeyResult || generateFallbackApiKey();

    const { data: device, error } = await adminClient
      .from('esp32_devices')
      .insert({
        device_serial,
        device_type,
        mac_address,
        registration_code: registrationCode,
        registration_code_expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        api_key: apiKey,
        created_by: profile.id
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating device:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 이벤트 로그
    await adminClient.from('esp32_device_events').insert({
      device_id: device.id,
      event_type: 'CREATED',
      event_data: { created_by: profile.id }
    });

    return NextResponse.json({
      success: true,
      data: device
    }, { status: 201 });
  } catch (error) {
    console.error('Error in devices POST:', error);
    return NextResponse.json(
      { error: 'Failed to create device' },
      { status: 500 }
    );
  }
}

// 폴백 등록코드 생성
function generateFallbackCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// 폴백 API 키 생성
function generateFallbackApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 64; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
