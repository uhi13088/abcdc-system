import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/haccp/todo/suggestions - 이전에 사용한 체크리스트 항목들 조회 (버튼 태그용)
export async function GET(_request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await adminClient
      .from('users')
      .select('company_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // todo_suggestions 테이블에서 조회 (숨기지 않은 것만)
    const { data, error } = await adminClient
      .from('todo_suggestions')
      .select('id, content, usage_count')
      .eq('company_id', userProfile.company_id)
      .eq('is_hidden', false)
      .order('usage_count', { ascending: false })
      .order('content', { ascending: true });

    if (error) {
      // 테이블이 없으면 daily_todo_items에서 직접 조회
      if (error.code === '42P01') {
        const { data: items } = await adminClient
          .from('daily_todo_items')
          .select('content, daily_todos!inner(company_id)')
          .eq('daily_todos.company_id', userProfile.company_id);

        // 중복 제거
        const uniqueContents = [...new Set((items || []).map((item: { content: string }) => item.content))];
        return NextResponse.json(uniqueContents.map(content => ({ content, usage_count: 1 })));
      }
      console.error('Error fetching suggestions:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/haccp/todo/suggestions - 새 suggestion 추가 (항목 추가 시 자동 호출)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();
    const body = await request.json();
    const { content } = body;

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await adminClient
      .from('users')
      .select('company_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 이미 존재하는지 확인
    const { data: existing } = await adminClient
      .from('todo_suggestions')
      .select('id, usage_count')
      .eq('company_id', userProfile.company_id)
      .eq('content', content.trim())
      .single();

    if (existing) {
      // 사용 횟수 증가
      const { data, error } = await adminClient
        .from('todo_suggestions')
        .update({
          usage_count: existing.usage_count + 1,
          is_hidden: false // 숨겨진 경우 다시 표시
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating suggestion:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json(data);
    }

    // 새로 추가
    const { data, error } = await adminClient
      .from('todo_suggestions')
      .insert({
        company_id: userProfile.company_id,
        content: content.trim(),
        usage_count: 1,
      })
      .select()
      .single();

    if (error) {
      // 테이블이 없으면 무시
      if (error.code === '42P01') {
        return NextResponse.json({ content: content.trim(), usage_count: 1 });
      }
      console.error('Error creating suggestion:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/haccp/todo/suggestions - suggestion 숨기기 (검증자 이상)
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await adminClient
      .from('users')
      .select('company_id, role')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 권한 확인
    const MANAGER_ROLES = ['validator', 'company_admin', 'super_admin'];
    if (!MANAGER_ROLES.includes(userProfile.role)) {
      return NextResponse.json({ error: '삭제 권한이 없습니다.' }, { status: 403 });
    }

    // 숨김 처리 (실제 삭제 대신)
    const { error } = await adminClient
      .from('todo_suggestions')
      .update({ is_hidden: true })
      .eq('id', id)
      .eq('company_id', userProfile.company_id);

    if (error) {
      console.error('Error hiding suggestion:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
