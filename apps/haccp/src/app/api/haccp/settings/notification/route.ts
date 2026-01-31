import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// 알림 설정 조회 (매장별)
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
      .select('company_id, store_id, current_store_id, current_haccp_store_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const category = request.nextUrl.searchParams.get('category') || 'ccp_verification';
    const storeIdParam = request.nextUrl.searchParams.get('store_id');
    // HACCP 매장 우선순위: current_haccp_store_id > current_store_id > store_id
    const storeId = storeIdParam || userData.current_haccp_store_id || userData.current_store_id || userData.store_id;

    if (!storeId) {
      return NextResponse.json({ error: 'Store not specified' }, { status: 400 });
    }

    // 보안: store가 사용자의 company에 속하는지 확인
    const { data: store } = await adminClient
      .from('stores')
      .select('id, company_id')
      .eq('id', storeId)
      .single();

    if (!store || store.company_id !== userData.company_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { data: settings, error } = await adminClient
      .from('notification_settings')
      .select('*')
      .eq('company_id', userData.company_id)
      .eq('store_id', storeId)
      .eq('category', category)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Failed to fetch notification settings:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Return default settings if none exist
    if (!settings) {
      return NextResponse.json({
        category,
        settings: {
          monthly_verification_reminder_enabled: true,
          reminder_day: 'last_friday',
          reminder_time: '09:00',
          target_roles: ['VERIFIER', 'ADMIN', 'MANAGER'],
          reminder_message: '이번 달 CCP 월간 검증점검표를 작성해주세요.',
        },
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Failed to fetch notification settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// 알림 설정 저장 (매장별)
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
      .select('company_id, store_id, current_store_id, current_haccp_store_id, role')
      .eq('auth_id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Only allow admin/manager to change settings
    if (!['super_admin', 'company_admin', 'manager', 'ADMIN', 'MANAGER', 'VERIFIER'].includes(userData.role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { category, settings, store_id: bodyStoreId } = body;
    // HACCP 매장 우선순위: current_haccp_store_id > current_store_id > store_id
    const storeId = bodyStoreId || userData.current_haccp_store_id || userData.current_store_id || userData.store_id;

    if (!storeId) {
      return NextResponse.json({ error: 'Store not specified' }, { status: 400 });
    }

    // 보안: store가 사용자의 company에 속하는지 확인
    const { data: store } = await adminClient
      .from('stores')
      .select('id, company_id')
      .eq('id', storeId)
      .single();

    if (!store || store.company_id !== userData.company_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (!category || !settings) {
      return NextResponse.json({ error: 'category and settings are required' }, { status: 400 });
    }

    // Check if settings already exist for this store
    const { data: existing } = await adminClient
      .from('notification_settings')
      .select('id')
      .eq('company_id', userData.company_id)
      .eq('store_id', storeId)
      .eq('category', category)
      .single();

    let result;
    if (existing) {
      // Update existing
      result = await adminClient
        .from('notification_settings')
        .update({
          settings,
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        })
        .eq('id', existing.id)
        .select()
        .single();
    } else {
      // Insert new
      result = await adminClient
        .from('notification_settings')
        .insert({
          company_id: userData.company_id,
          store_id: storeId,
          category,
          settings,
          created_by: user.id,
          updated_by: user.id,
        })
        .select()
        .single();
    }

    if (result.error) {
      console.error('Failed to save notification settings:', result.error);
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error('Failed to save notification settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
