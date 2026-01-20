import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

// GET /api/notices - 공지사항 목록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { searchParams } = new URL(request.url);
    const is_important = searchParams.get('is_important');
    const store_id = searchParams.get('store_id');

    // Get user info for company filtering
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await supabase
      .from('users')
      .select('company_id, role')
      .eq('auth_id', userData.user.id)
      .single();

    let query = supabase
      .from('notices')
      .select(`
        *,
        users:created_by (name),
        stores:store_id (name)
      `)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    // Filter by company for non-super_admin
    if (userProfile?.role !== 'super_admin' && userProfile?.company_id) {
      query = query.eq('company_id', userProfile.company_id);
    }

    if (is_important === 'true') {
      query = query.eq('is_important', true);
    }

    // 매장 필터
    if (store_id === 'null') {
      // 공통 공지만 (store_id가 null인 것)
      query = query.is('store_id', null);
    } else if (store_id) {
      // 특정 매장 공지만
      query = query.eq('store_id', store_id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching notices:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const notices = data?.map((notice: any) => ({
      ...notice,
      author_name: notice.users?.name,
      store_name: notice.stores?.name,
      // is_important를 category로 매핑 (프론트엔드 호환성)
      category: notice.is_important ? 'URGENT' : 'GENERAL',
    })) || [];

    return NextResponse.json(notices);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/notices - 공지사항 생성
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const body = await request.json();

    const {
      title,
      content,
      category, // GENERAL, URGENT, EVENT, UPDATE - URGENT면 is_important로 매핑
      is_important = false,
      is_pinned = false,
      target_roles,
      attachments,
      published_at,
      expires_at,
      brand_id,
      store_id,
    } = body;

    // category가 URGENT면 is_important를 true로 설정
    const finalIsImportant = category === 'URGENT' || is_important;

    // Get user info
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: userProfile } = await supabase
      .from('users')
      .select('id, company_id, role')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Authorization check
    const allowedRoles = ['super_admin', 'company_admin', 'manager'];
    if (!allowedRoles.includes(userProfile.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('notices')
      .insert({
        title,
        content,
        is_important: finalIsImportant,
        is_pinned,
        target_roles: target_roles || null,
        attachments: attachments || null,
        published_at: published_at || new Date().toISOString(),
        expires_at: expires_at || null,
        company_id: userProfile.company_id,
        brand_id: brand_id || null,
        store_id: store_id || null,
        created_by: userProfile.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating notice:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
