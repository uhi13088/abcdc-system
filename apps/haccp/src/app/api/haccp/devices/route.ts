import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/haccp/devices - 매장의 등록된 기기 목록 조회 (매장별)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await adminClient
      .from('users')
      .select('company_id, store_id, role')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const deviceType = searchParams.get('device_type');
    const storeIdParam = searchParams.get('store_id');
    const storeId = storeIdParam || userProfile.store_id;

    if (!storeId) {
      return NextResponse.json({ error: 'Store not specified' }, { status: 400 });
    }

    // 보안: store가 사용자의 company에 속하는지 확인
    const { data: store } = await adminClient
      .from('stores')
      .select('id, company_id')
      .eq('id', storeId)
      .single();

    if (!store || store.company_id !== userProfile.company_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    let query = adminClient
      .from('esp32_devices')
      .select(`
        id,
        device_serial,
        device_type,
        status,
        firmware_version,
        last_seen_at,
        wifi_ssid,
        wifi_signal_strength,
        reading_interval_seconds,
        registered_at,
        sensor:iot_sensors(
          id,
          name,
          sensor_code,
          status,
          last_reading_at,
          last_value,
          unit,
          ccp_definition_id
        )
      `)
      .eq('company_id', userProfile.company_id)
      .eq('store_id', storeId)
      .order('registered_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }
    if (deviceType) {
      query = query.eq('device_type', deviceType);
    }

    const { data: devices, error } = await query;

    if (error) {
      // 테이블이 없는 경우 빈 배열 반환
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json({ success: true, data: [] });
      }
      console.error('Error fetching devices:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: devices || []
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
