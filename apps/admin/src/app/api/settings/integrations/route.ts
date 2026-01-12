import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/settings/integrations - 연동 설정 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ data: [] });
    }

    const { data: integrations, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('company_id', userData.company_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: integrations || [] });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/settings/integrations - 연동 설정 저장
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('company_id, role')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // company_admin 이상만 연동 설정 변경 가능
    if (!['super_admin', 'company_admin'].includes(userData.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 회사가 없으면 먼저 회사 생성 안내
    if (!userData.company_id) {
      return NextResponse.json({
        error: '회사 정보를 먼저 등록해주세요.'
      }, { status: 400 });
    }

    const body = await request.json();
    const { provider, enabled, settings } = body;

    if (!provider) {
      return NextResponse.json({ error: 'Provider is required' }, { status: 400 });
    }

    const integrationData = {
      company_id: userData.company_id,
      provider,
      enabled: enabled ?? false,
      settings: settings || {},
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await adminClient
      .from('integrations')
      .upsert(integrationData, { onConflict: 'company_id,provider' })
      .select()
      .single();

    if (error) {
      console.error('Integration settings save error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data,
      message: '연동 설정이 저장되었습니다.'
    });
  } catch (error) {
    console.error('Integration settings API error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
