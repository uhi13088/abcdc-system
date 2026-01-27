import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/haccp/todos/daily - 일일 투두 목록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

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
      .eq('company_id', userProfile.company_id)
      .eq('todo_date', date)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching daily todos:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 진행률 계산 추가
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

    interface DailyTodo {
      id: string;
      company_id: string;
      todo_date: string;
      title: string;
      description?: string;
      template_id?: string;
      status: string;
      created_by?: string;
      created_at: string;
      updated_at: string;
      items: DailyTodoItem[];
      template?: { name: string; category: string } | null;
      created_by_user?: { name: string } | null;
    }

    const todosWithProgress = (data || []).map((todo: DailyTodo) => {
      const items = todo.items || [];
      const totalItems = items.length;
      const completedItems = items.filter((item: DailyTodoItem) => item.is_completed).length;
      const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

      return {
        ...todo,
        progress: {
          total: totalItems,
          completed: completedItems,
          percentage: progress,
        },
      };
    });

    return NextResponse.json(todosWithProgress);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/haccp/todos/daily - 일일 투두 생성 (템플릿에서 또는 직접)
export async function POST(request: NextRequest) {
  try {
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

    // 권한 체크: 검증자 이상만 투두 생성 가능
    if (!['super_admin', 'admin', 'manager', 'verifier'].includes(userProfile.role)) {
      return NextResponse.json({ error: '투두 생성 권한이 없습니다' }, { status: 403 });
    }

    const { template_id, title, description, date, items } = body;
    const todoDate = date || new Date().toISOString().split('T')[0];

    // 템플릿에서 생성하는 경우
    if (template_id) {
      // 같은 날짜에 같은 템플릿으로 이미 생성된 투두가 있는지 확인
      const { data: existing } = await supabase
        .from('daily_todos')
        .select('id')
        .eq('company_id', userProfile.company_id)
        .eq('todo_date', todoDate)
        .eq('template_id', template_id)
        .single();

      if (existing) {
        return NextResponse.json(
          { error: '해당 날짜에 이미 같은 템플릿으로 생성된 체크리스트가 있습니다' },
          { status: 409 }
        );
      }

      // 템플릿 조회
      const { data: template, error: templateError } = await supabase
        .from('todo_templates')
        .select(`
          *,
          items:todo_template_items(id, content, description, sort_order, is_required)
        `)
        .eq('id', template_id)
        .eq('company_id', userProfile.company_id)
        .single();

      if (templateError || !template) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      }

      // 일일 투두 생성
      const { data: dailyTodo, error: todoError } = await supabase
        .from('daily_todos')
        .insert({
          company_id: userProfile.company_id,
          todo_date: todoDate,
          title: template.name,
          description: template.description,
          template_id,
          created_by: userProfile.id,
        })
        .select()
        .single();

      if (todoError) {
        console.error('Error creating daily todo:', todoError);
        return NextResponse.json({ error: todoError.message }, { status: 500 });
      }

      // 템플릿 항목들로 일일 투두 항목 생성
      interface TemplateItem {
        id: string;
        content: string;
        description?: string;
        sort_order: number;
        is_required: boolean;
      }

      if (template.items && template.items.length > 0) {
        const dailyItems = template.items.map((item: TemplateItem) => ({
          daily_todo_id: dailyTodo.id,
          content: item.content,
          description: item.description,
          sort_order: item.sort_order,
          is_required: item.is_required,
          template_item_id: item.id,
        }));

        const { error: itemsError } = await supabase
          .from('daily_todo_items')
          .insert(dailyItems);

        if (itemsError) {
          console.error('Error creating daily todo items:', itemsError);
        }
      }

      return NextResponse.json(dailyTodo, { status: 201 });
    }

    // 직접 생성하는 경우
    const { data: dailyTodo, error: todoError } = await supabase
      .from('daily_todos')
      .insert({
        company_id: userProfile.company_id,
        todo_date: todoDate,
        title: title || '새 체크리스트',
        description,
        created_by: userProfile.id,
      })
      .select()
      .single();

    if (todoError) {
      console.error('Error creating daily todo:', todoError);
      return NextResponse.json({ error: todoError.message }, { status: 500 });
    }

    // 직접 항목을 지정한 경우
    if (items && items.length > 0) {
      const dailyItems = items.map((item: { content: string; description?: string; is_required?: boolean }, index: number) => ({
        daily_todo_id: dailyTodo.id,
        content: item.content,
        description: item.description,
        sort_order: index,
        is_required: item.is_required || false,
      }));

      const { error: itemsError } = await supabase
        .from('daily_todo_items')
        .insert(dailyItems);

      if (itemsError) {
        console.error('Error creating daily todo items:', itemsError);
      }
    }

    return NextResponse.json(dailyTodo, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
