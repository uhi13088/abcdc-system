import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// POST /api/haccp/todo/daily/[id]/items/[itemId]/complete - 항목 완료 처리
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id: todoId, itemId } = await params;
    const supabase = await createServerClient();
    const adminClient = createAdminClient();
    const body = await request.json().catch(() => ({}));

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await adminClient
      .from('users')
      .select('id, company_id, name')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 해당 투두가 회사 소속인지 확인
    const { data: todo } = await adminClient
      .from('daily_todos')
      .select('id, status')
      .eq('id', todoId)
      .eq('company_id', userProfile.company_id)
      .single();

    if (!todo) {
      return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
    }

    if (todo.status === 'CANCELLED') {
      return NextResponse.json({ error: '취소된 투두입니다.' }, { status: 400 });
    }

    // 항목 완료 처리
    const { data: item, error } = await adminClient
      .from('daily_todo_items')
      .update({
        is_completed: true,
        completed_by: userProfile.id,
        completed_at: new Date().toISOString(),
        note: body.note || null,
      })
      .eq('id', itemId)
      .eq('daily_todo_id', todoId)
      .select()
      .single();

    if (error) {
      console.error('Error completing item:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ...item,
      completer_name: userProfile.name,
    });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/haccp/todo/daily/[id]/items/[itemId]/complete - 완료 취소
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id: todoId, itemId } = await params;
    const supabase = await createServerClient();
    const adminClient = createAdminClient();

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

    // 본인이 완료한 항목만 취소 가능 (또는 검증자 이상)
    const { data: item } = await adminClient
      .from('daily_todo_items')
      .select('completed_by')
      .eq('id', itemId)
      .eq('daily_todo_id', todoId)
      .single();

    const canCancel = item?.completed_by === userProfile.id ||
      ['validator', 'company_admin', 'super_admin'].includes(userProfile.role);

    if (!canCancel) {
      return NextResponse.json(
        { error: '본인이 완료한 항목만 취소할 수 있습니다.' },
        { status: 403 }
      );
    }

    // 완료 취소
    const { error } = await adminClient
      .from('daily_todo_items')
      .update({
        is_completed: false,
        completed_by: null,
        completed_at: null,
        note: null,
      })
      .eq('id', itemId)
      .eq('daily_todo_id', todoId);

    if (error) {
      console.error('Error uncompleting item:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
