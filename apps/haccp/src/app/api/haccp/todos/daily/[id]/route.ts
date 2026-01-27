import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/haccp/todos/daily/[id] - 일일 투두 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await supabase
      .from('users')
      .select('company_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('daily_todos')
      .select(`
        *,
        items:daily_todo_items(
          id, content, description, sort_order, is_required,
          is_completed, completed_by, completed_at,
          completed_by_user:completed_by(name)
        ),
        template:template_id(name, category),
        created_by_user:created_by(name)
      `)
      .eq('id', id)
      .eq('company_id', userProfile.company_id)
      .single();

    if (error) {
      console.error('Error fetching daily todo:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
    }

    // 진행률 계산
    interface DailyTodoItem {
      id: string;
      content: string;
      description?: string;
      sort_order: number;
      is_required: boolean;
      is_completed: boolean;
      completed_by?: string;
      completed_at?: string;
      completed_by_user?: { name: string } | null;
    }

    const items = (data.items as DailyTodoItem[]) || [];
    const totalItems = items.length;
    const completedItems = items.filter((item) => item.is_completed).length;
    const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

    return NextResponse.json({
      ...data,
      progress: {
        total: totalItems,
        completed: completedItems,
        percentage: progress,
      },
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/haccp/todos/daily/[id] - 일일 투두 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();

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
      return NextResponse.json({ error: '투두 삭제 권한이 없습니다' }, { status: 403 });
    }

    const { error } = await supabase
      .from('daily_todos')
      .delete()
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
