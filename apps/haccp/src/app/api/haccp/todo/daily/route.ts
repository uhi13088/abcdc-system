import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// 검증자 이상 권한 (생성용)
const CREATOR_ROLES = ['validator', 'company_admin', 'super_admin'];

// GET /api/haccp/todo/daily - 오늘의 투두 목록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await adminClient
      .from('users')
      .select('id, company_id, role')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 해당 날짜의 투두 목록 조회
    const { data, error } = await adminClient
      .from('daily_todos')
      .select(`
        *,
        creator:users!daily_todos_created_by_fkey(name),
        items:daily_todo_items(
          id,
          content,
          sort_order,
          category,
          is_required,
          is_completed,
          completed_by,
          completed_at,
          note,
          completer:users!daily_todo_items_completed_by_fkey(name)
        )
      `)
      .eq('company_id', userProfile.company_id)
      .eq('date', date)
      .neq('status', 'CANCELLED')
      .order('created_at');

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json([]);
      }
      console.error('Error fetching daily todos:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 항목을 정렬하고 완료자 이름 추가
    const result = (data || []).map(todo => ({
      ...todo,
      creator_name: todo.creator?.name || null,
      items: (todo.items || [])
        .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
        .map((item: { completer?: { name: string } }) => ({
          ...item,
          completer_name: item.completer?.name || null,
        })),
      progress: todo.total_items > 0
        ? Math.round((todo.completed_items / todo.total_items) * 100)
        : 0,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/haccp/todo/daily - 템플릿에서 오늘의 투두 생성 (검증자 이상)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();
    const body = await request.json();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await adminClient
      .from('users')
      .select('id, company_id, role')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 권한 확인
    if (!CREATOR_ROLES.includes(userProfile.role)) {
      return NextResponse.json(
        { error: 'To-Do 생성 권한이 없습니다. 검증자 이상만 가능합니다.' },
        { status: 403 }
      );
    }

    const { template_id, date, name, items } = body;
    const targetDate = date || new Date().toISOString().split('T')[0];

    // 템플릿에서 생성하는 경우
    if (template_id) {
      // 템플릿 확인
      const { data: template } = await adminClient
        .from('todo_templates')
        .select('id, name, company_id')
        .eq('id', template_id)
        .eq('company_id', userProfile.company_id)
        .single();

      if (!template) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      }

      // 중복 확인
      const { data: existing } = await adminClient
        .from('daily_todos')
        .select('id')
        .eq('company_id', userProfile.company_id)
        .eq('date', targetDate)
        .eq('name', template.name)
        .single();

      if (existing) {
        return NextResponse.json(
          { error: '이미 오늘 같은 이름의 투두가 있습니다.' },
          { status: 400 }
        );
      }

      // 템플릿 항목 가져오기
      const { data: templateItems } = await adminClient
        .from('todo_template_items')
        .select('*')
        .eq('template_id', template_id)
        .order('sort_order');

      // 일일 투두 생성
      const { data: dailyTodo, error: todoError } = await adminClient
        .from('daily_todos')
        .insert({
          company_id: userProfile.company_id,
          date: targetDate,
          template_id,
          name: template.name,
          created_by: userProfile.id,
          total_items: templateItems?.length || 0,
        })
        .select()
        .single();

      if (todoError) {
        console.error('Error creating daily todo:', todoError);
        return NextResponse.json({ error: todoError.message }, { status: 500 });
      }

      // 항목 복사
      if (templateItems && templateItems.length > 0) {
        const dailyItems = templateItems.map(item => ({
          daily_todo_id: dailyTodo.id,
          content: item.content,
          sort_order: item.sort_order,
          category: item.category,
          is_required: item.is_required,
        }));

        await adminClient.from('daily_todo_items').insert(dailyItems);
      }

      return NextResponse.json(dailyTodo, { status: 201 });
    }

    // 직접 생성하는 경우
    if (!name || !items || items.length === 0) {
      return NextResponse.json(
        { error: '이름과 최소 1개 이상의 항목이 필요합니다.' },
        { status: 400 }
      );
    }

    // 같은 날짜+이름의 체크리스트가 있는지 확인
    const { data: existing } = await adminClient
      .from('daily_todos')
      .select('id, total_items')
      .eq('company_id', userProfile.company_id)
      .eq('date', targetDate)
      .eq('name', name)
      .neq('status', 'CANCELLED')
      .single();

    // 이미 있으면 해당 체크리스트에 항목 추가
    if (existing) {
      // 기존 항목 개수 확인
      const { data: existingItems } = await adminClient
        .from('daily_todo_items')
        .select('sort_order')
        .eq('daily_todo_id', existing.id)
        .order('sort_order', { ascending: false })
        .limit(1);

      const lastSortOrder = existingItems?.[0]?.sort_order ?? -1;

      // 새 항목 추가
      const newItems = items.map((item: { content: string; category?: string; is_required?: boolean }, index: number) => ({
        daily_todo_id: existing.id,
        content: item.content,
        sort_order: lastSortOrder + 1 + index,
        category: item.category,
        is_required: item.is_required !== false,
      }));

      await adminClient.from('daily_todo_items').insert(newItems);

      // total_items 업데이트
      await adminClient
        .from('daily_todos')
        .update({ total_items: existing.total_items + items.length })
        .eq('id', existing.id);

      return NextResponse.json({ id: existing.id, added: items.length }, { status: 200 });
    }

    // 새로 생성
    const { data: dailyTodo, error: todoError } = await adminClient
      .from('daily_todos')
      .insert({
        company_id: userProfile.company_id,
        date: targetDate,
        name,
        created_by: userProfile.id,
        total_items: items.length,
      })
      .select()
      .single();

    if (todoError) {
      console.error('Error creating daily todo:', todoError);
      return NextResponse.json({ error: todoError.message }, { status: 500 });
    }

    // 항목 생성
    const dailyItems = items.map((item: { content: string; category?: string; is_required?: boolean }, index: number) => ({
      daily_todo_id: dailyTodo.id,
      content: item.content,
      sort_order: index,
      category: item.category,
      is_required: item.is_required !== false,
    }));

    await adminClient.from('daily_todo_items').insert(dailyItems);

    return NextResponse.json(dailyTodo, { status: 201 });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/haccp/todo/daily - 투두 삭제/취소 (검증자 이상)
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Todo ID is required' }, { status: 400 });
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await adminClient
      .from('users')
      .select('id, company_id, role')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    if (!CREATOR_ROLES.includes(userProfile.role)) {
      return NextResponse.json(
        { error: 'To-Do 삭제 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const { error } = await adminClient
      .from('daily_todos')
      .update({ status: 'CANCELLED' })
      .eq('id', id)
      .eq('company_id', userProfile.company_id);

    if (error) {
      console.error('Error deleting daily todo:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
