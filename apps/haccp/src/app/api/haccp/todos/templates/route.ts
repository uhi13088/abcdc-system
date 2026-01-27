import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/haccp/todos/templates - 템플릿 목록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const includeItems = searchParams.get('include_items') === 'true';

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

    let query = supabase
      .from('todo_templates')
      .select(includeItems ? `
        *,
        items:todo_template_items(id, content, description, sort_order, is_required),
        created_by_user:created_by(name)
      ` : `
        *,
        created_by_user:created_by(name)
      `)
      .eq('company_id', userProfile.company_id)
      .eq('is_active', true);

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query.order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching templates:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/haccp/todos/templates - 템플릿 생성
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

    // 권한 체크: 검증자 이상만 템플릿 생성 가능
    if (!['super_admin', 'admin', 'manager', 'verifier'].includes(userProfile.role)) {
      return NextResponse.json({ error: '템플릿 생성 권한이 없습니다' }, { status: 403 });
    }

    const { name, description, category, items } = body;

    // 템플릿 생성
    const { data: template, error: templateError } = await supabase
      .from('todo_templates')
      .insert({
        company_id: userProfile.company_id,
        name,
        description,
        category,
        created_by: userProfile.id,
      })
      .select()
      .single();

    if (templateError) {
      console.error('Error creating template:', templateError);
      return NextResponse.json({ error: templateError.message }, { status: 500 });
    }

    // 템플릿 항목 생성
    if (items && items.length > 0) {
      const templateItems = items.map((item: { content: string; description?: string; is_required?: boolean }, index: number) => ({
        template_id: template.id,
        content: item.content,
        description: item.description,
        sort_order: index,
        is_required: item.is_required || false,
      }));

      const { error: itemsError } = await supabase
        .from('todo_template_items')
        .insert(templateItems);

      if (itemsError) {
        console.error('Error creating template items:', itemsError);
        // 템플릿은 생성되었으므로 항목 에러만 로깅
      }
    }

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
