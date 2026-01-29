import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/haccp/todo/suggestions - 이전에 사용한 체크리스트 항목들 조회
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

    // todo_suggestions 테이블에서 조회
    const { data, error } = await adminClient
      .from('todo_suggestions')
      .select('id, content, usage_count')
      .eq('company_id', userProfile.company_id)
      .eq('is_hidden', false)
      .order('usage_count', { ascending: false })
      .order('content', { ascending: true });

    if (error) {
      // 테이블이 없으면 daily_todo_items에서 기존 항목 조회
      console.error('todo_suggestions table not found, fallback to daily_todo_items');

      const { data: todos } = await adminClient
        .from('daily_todos')
        .select('id')
        .eq('company_id', userProfile.company_id);

      if (todos && todos.length > 0) {
        const todoIds = todos.map(t => t.id);
        const { data: items } = await adminClient
          .from('daily_todo_items')
          .select('content')
          .in('daily_todo_id', todoIds);

        // 중복 제거
        const uniqueContents = [...new Set((items || []).map(i => i.content))];
        return NextResponse.json(uniqueContents.map(content => ({ content })));
      }

      return NextResponse.json([]);
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json([]);
  }
}

// POST /api/haccp/todo/suggestions - 새 suggestion 추가
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

    // upsert로 처리 (있으면 usage_count 증가, 없으면 생성)
    const { data, error } = await adminClient
      .from('todo_suggestions')
      .upsert(
        {
          company_id: userProfile.company_id,
          content: content.trim(),
          usage_count: 1,
          is_hidden: false,
        },
        {
          onConflict: 'company_id,content',
        }
      )
      .select()
      .single();

    if (error) {
      // 테이블이 없으면 무시
      console.error('Error creating suggestion:', error);
      return NextResponse.json({ content: content.trim() });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ content: '' });
  }
}

// DELETE /api/haccp/todo/suggestions - suggestion 숨기기
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const content = searchParams.get('content');

    if (!id && !content) {
      return NextResponse.json({ error: 'ID or content is required' }, { status: 400 });
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

    // todo_suggestions 테이블에서 숨김 처리
    if (id) {
      await adminClient
        .from('todo_suggestions')
        .update({ is_hidden: true })
        .eq('id', id)
        .eq('company_id', userProfile.company_id);
    } else if (content) {
      // content 기반 삭제 (테이블이 있으면 숨김 처리, 없으면 무시)
      await adminClient
        .from('todo_suggestions')
        .update({ is_hidden: true })
        .eq('content', content)
        .eq('company_id', userProfile.company_id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ success: true });
  }
}
