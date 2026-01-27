import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// 기기 코드 생성 함수 (XXX-XXX-XXX 형식)
function generateDeviceCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 혼동 문자 제외
  let code = '';
  for (let i = 0; i < 9; i++) {
    if (i === 3 || i === 6) code += '-';
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// API Key 생성 함수
function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = 'dev_';
  for (let i = 0; i < 40; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

// GET /api/devices/provision - 프로비저닝된 기기 목록 (super_admin only)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await adminClient
      .from('users')
      .select('role')
      .eq('auth_id', user.id)
      .single();

    if (userData?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = adminClient
      .from('esp32_devices')
      .select(`
        *,
        claimed_by_user:claimed_by (id, name, email),
        company:company_id (id, name),
        sensor:linked_sensor_id (id, name, location)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: devices, error, count } = await query;

    if (error) {
      console.error('[GET /api/devices/provision] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // API Key 마스킹
    const maskedDevices = devices?.map(device => ({
      ...device,
      api_key: device.api_key ? device.api_key.substring(0, 8) + '****' : null,
    }));

    return NextResponse.json({
      devices: maskedDevices || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('[GET /api/devices/provision] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/devices/provision - 새 기기 프로비저닝 (super_admin only)
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
      .select('role')
      .eq('auth_id', user.id)
      .single();

    if (userData?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      count = 1,  // 생성할 기기 수
      device_type = 'TEMPERATURE',
      device_name = 'HACCP 온도센서',
      firmware_version = '1.0.0',
      hardware_version = '1.0',
      notes,
    } = body;

    if (count < 1 || count > 100) {
      return NextResponse.json({ error: '한 번에 1~100개까지 생성 가능합니다.' }, { status: 400 });
    }

    const createdDevices = [];

    for (let i = 0; i < count; i++) {
      // 고유 코드 생성 (중복 체크)
      let deviceCode: string;
      let attempts = 0;
      do {
        deviceCode = generateDeviceCode();
        const { data: existing } = await adminClient
          .from('esp32_devices')
          .select('id')
          .eq('device_code', deviceCode)
          .single();
        if (!existing) break;
        attempts++;
      } while (attempts < 10);

      if (attempts >= 10) {
        continue; // 코드 생성 실패, 스킵
      }

      const apiKey = generateApiKey();

      const { data: device, error } = await adminClient
        .from('esp32_devices')
        .insert({
          device_code: deviceCode,
          api_key: apiKey,
          device_type,
          device_name,
          firmware_version,
          hardware_version,
          status: 'PROVISIONED',
          notes,
          manufactured_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (!error && device) {
        createdDevices.push({
          ...device,
          api_key: apiKey,  // 생성 시에만 전체 키 노출
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `${createdDevices.length}개의 기기가 프로비저닝되었습니다.`,
      devices: createdDevices,
    });
  } catch (error) {
    console.error('[POST /api/devices/provision] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PATCH /api/devices/provision - 기기 정보 수정 (super_admin only)
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await adminClient
      .from('users')
      .select('role')
      .eq('auth_id', user.id)
      .single();

    if (userData?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { device_id, shipped_at, notes, status } = body;

    if (!device_id) {
      return NextResponse.json({ error: 'device_id is required' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (shipped_at !== undefined) updateData.shipped_at = shipped_at;
    if (notes !== undefined) updateData.notes = notes;
    if (status !== undefined) updateData.status = status;

    const { error } = await adminClient
      .from('esp32_devices')
      .update(updateData)
      .eq('id', device_id);

    if (error) {
      console.error('[PATCH /api/devices/provision] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: '기기 정보가 업데이트되었습니다.',
    });
  } catch (error) {
    console.error('[PATCH /api/devices/provision] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
