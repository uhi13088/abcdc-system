import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// PUT /api/haccp/todos/daily/[id]/items - 항목 완료/미완료 처리
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: todoId } = await params;
    const supabase = await createServerClient();
    const body = await request.json();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await supabase
      .from('users')
      .select('id, company_id, name')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const { item_id, is_completed } = body;

    if (!item_id) {
      return NextResponse.json({ error: 'item_id is required' }, { status: 400 });
    }

    // 해당 투두가 같은 회사 소속인지 확인
    const { data: todo } = await supabase
      .from('daily_todos')
      .select('id, company_id')
      .eq('id', todoId)
      .eq('company_id', userProfile.company_id)
      .single();

    if (!todo) {
      return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
    }

    // 항목 업데이트
    const updateData = is_completed
      ? {
          is_completed: true,
          completed_by: userProfile.id,
          completed_at: new Date().toISOString(),
        }
      : {
          is_completed: false,
          completed_by: null,
          completed_at: null,
        };

    const { data, error } = await supabase
      .from('daily_todo_items')
      .update(updateData)
      .eq('id', item_id)
      .eq('daily_todo_id', todoId)
      .select(`
        *,
        completed_by_user:completed_by(name)
      `)
      .single();

    if (error) {
      console.error('Error updating item:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/haccp/todos/daily/[id]/items - 항목 추가
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: todoId } = await params;
    const supabase = await createServerClient();
    const body = await request.json();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await supabase
      .from('users')
      .select('id, company_id, role')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 권한 체크
    if (!['super_admin', 'admin', 'manager', 'verifier'].includes(userProfile.role)) {
      return NextResponse.json({ error: '항목 추가 권한이 없습니다' }, { status: 403 });
    }

    // 해당 투두가 같은 회사 소속인지 확인
    const { data: todo } = await supabase
      .from('daily_todos')
      .select('id, company_id')
      .eq('id', todoId)
      .eq('company_id', userProfile.company_id)
      .single();

    if (!todo) {
      return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
    }

    const { content, description, is_required } = body;

    // 마지막 sort_order 조회
    const { data: lastItem } = await supabase
      .from('daily_todo_items')
      .select('sort_order')
      .eq('daily_todo_id', todoId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .single();

    const newSortOrder = (lastItem?.sort_order ?? -1) + 1;

    const { data, error } = await supabase
      .from('daily_todo_items')
      .insert({
        daily_todo_id: todoId,
        content,
        description,
        sort_order: newSortOrder,
        is_required: is_required || false,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding item:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/haccp/todos/daily/[id]/items - 항목 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: todoId } = await params;
    const supabase = await createServerClient();
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('item_id');

    if (!itemId) {
      return NextResponse.json({ error: 'item_id is required' }, { status: 400 });
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await supabase
      .from('users')
      .select('id, company_id, role')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 권한 체크
    if (!['super_admin', 'admin', 'manager', 'verifier'].includes(userProfile.role)) {
      return NextResponse.json({ error: '항목 삭제 권한이 없습니다' }, { status: 403 });
    }

    // 해당 투두가 같은 회사 소속인지 확인
    const { data: todo } = await supabase
      .from('daily_todos')
      .select('id, company_id')
      .eq('id', todoId)
      .eq('company_id', userProfile.company_id)
      .single();

    if (!todo) {
      return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
    }

    const { error } = await supabase
      .from('daily_todo_items')
      .delete()
      .eq('id', itemId)
      .eq('daily_todo_id', todoId);

    if (error) {
      console.error('Error deleting item:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
