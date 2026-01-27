import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// API Key 생성 함수
function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = 'sk_';
  for (let i = 0; i < 40; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

// GET /api/sensors/api-keys - API Key 목록 조회
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
      .select('id, company_id, role')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 권한 체크
    if (!['super_admin', 'company_admin', 'store_manager', 'haccp_manager'].includes(userData.role)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const { data: apiKeys, error } = await adminClient
      .from('sensor_api_keys')
      .select(`
        *,
        sensor:sensor_id (
          id,
          name,
          sensor_code,
          location
        ),
        created_by_user:created_by (
          id,
          name
        )
      `)
      .eq('company_id', userData.company_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[GET /api/sensors/api-keys] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // API Key 마스킹 (앞 7자리만 보여줌)
    const maskedKeys = apiKeys?.map(key => ({
      ...key,
      api_key: key.api_key.substring(0, 7) + '************************************',
    }));

    return NextResponse.json({ api_keys: maskedKeys || [] });
  } catch (error) {
    console.error('[GET /api/sensors/api-keys] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/sensors/api-keys - 새 API Key 생성
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
      .select('id, company_id, role')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 권한 체크
    if (!['super_admin', 'company_admin', 'store_manager'].includes(userData.role)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const body = await request.json();
    const { name, sensor_id, expires_at } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // sensor_id가 있으면 검증
    if (sensor_id) {
      const { data: sensor } = await adminClient
        .from('iot_sensors')
        .select('id, company_id')
        .eq('id', sensor_id)
        .single();

      if (!sensor || sensor.company_id !== userData.company_id) {
        return NextResponse.json({ error: 'Sensor not found' }, { status: 404 });
      }
    }

    // API Key 생성
    const apiKey = generateApiKey();

    const { data: newKey, error } = await adminClient
      .from('sensor_api_keys')
      .insert({
        company_id: userData.company_id,
        sensor_id: sensor_id || null,
        api_key: apiKey,
        name,
        is_active: true,
        expires_at: expires_at || null,
        created_by: userData.id,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('[POST /api/sensors/api-keys] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 새로 생성된 키는 전체 표시 (이후에는 마스킹됨)
    return NextResponse.json({
      success: true,
      message: 'API Key가 생성되었습니다. 이 키는 다시 표시되지 않으니 안전하게 보관하세요.',
      api_key: newKey,
    });
  } catch (error) {
    console.error('[POST /api/sensors/api-keys] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/sensors/api-keys - API Key 삭제
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await adminClient
      .from('users')
      .select('id, company_id, role')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { key_id } = body;

    if (!key_id) {
      return NextResponse.json({ error: 'key_id is required' }, { status: 400 });
    }

    // 키 조회 및 권한 확인
    const { data: apiKey } = await adminClient
      .from('sensor_api_keys')
      .select('id, company_id')
      .eq('id', key_id)
      .single();

    if (!apiKey) {
      return NextResponse.json({ error: 'API Key not found' }, { status: 404 });
    }

    if (apiKey.company_id !== userData.company_id && userData.role !== 'super_admin') {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    // 삭제
    const { error } = await adminClient
      .from('sensor_api_keys')
      .delete()
      .eq('id', key_id);

    if (error) {
      console.error('[DELETE /api/sensors/api-keys] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'API Key가 삭제되었습니다.',
    });
  } catch (error) {
    console.error('[DELETE /api/sensors/api-keys] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PATCH /api/sensors/api-keys - API Key 활성화/비활성화
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
      .select('id, company_id, role')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { key_id, is_active } = body;

    if (!key_id || typeof is_active !== 'boolean') {
      return NextResponse.json({ error: 'key_id and is_active are required' }, { status: 400 });
    }

    // 키 조회 및 권한 확인
    const { data: apiKey } = await adminClient
      .from('sensor_api_keys')
      .select('id, company_id')
      .eq('id', key_id)
      .single();

    if (!apiKey) {
      return NextResponse.json({ error: 'API Key not found' }, { status: 404 });
    }

    if (apiKey.company_id !== userData.company_id && userData.role !== 'super_admin') {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    // 업데이트
    const { error } = await adminClient
      .from('sensor_api_keys')
      .update({
        is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', key_id);

    if (error) {
      console.error('[PATCH /api/sensors/api-keys] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: is_active ? 'API Key가 활성화되었습니다.' : 'API Key가 비활성화되었습니다.',
    });
  } catch (error) {
    console.error('[PATCH /api/sensors/api-keys] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
