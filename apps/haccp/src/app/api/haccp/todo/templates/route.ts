import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// 검증자 이상 권한 확인
const ALLOWED_ROLES = ['validator', 'company_admin', 'super_admin'];

// GET /api/haccp/todo/templates - 템플릿 목록 조회
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
      .select('id, company_id, role')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 템플릿과 항목 수 조회
    const { data, error } = await adminClient
      .from('todo_templates')
      .select(`
        *,
        items:todo_template_items(count),
        creator:users!todo_templates_created_by_fkey(name)
      `)
      .eq('company_id', userProfile.company_id)
      .eq('status', 'ACTIVE')
      .order('category')
      .order('name');

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json([]);
      }
      console.error('Error fetching templates:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const result = (data || []).map(template => ({
      ...template,
      items_count: template.items?.[0]?.count || 0,
      creator_name: template.creator?.name || null,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/haccp/todo/templates - 템플릿 생성 (검증자 이상)
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

    // 권한 확인 (검증자 이상)
    if (!ALLOWED_ROLES.includes(userProfile.role)) {
      return NextResponse.json(
        { error: '템플릿 생성 권한이 없습니다. 검증자 이상만 가능합니다.' },
        { status: 403 }
      );
    }

    const { name, description, category, items } = body;

    if (!name || !items || items.length === 0) {
      return NextResponse.json(
        { error: '템플릿 이름과 최소 1개 이상의 항목이 필요합니다.' },
        { status: 400 }
      );
    }

    // 템플릿 생성
    const { data: template, error: templateError } = await adminClient
      .from('todo_templates')
      .insert({
        company_id: userProfile.company_id,
        name,
        description,
        category: category || 'CUSTOM',
        created_by: userProfile.id,
      })
      .select()
      .single();

    if (templateError) {
      console.error('Error creating template:', templateError);
      return NextResponse.json({ error: templateError.message }, { status: 500 });
    }

    // 템플릿 항목 생성
    const templateItems = items.map((item: { content: string; category?: string; is_required?: boolean }, index: number) => ({
      template_id: template.id,
      content: item.content,
      sort_order: index,
      category: item.category,
      is_required: item.is_required !== false,
    }));

    const { error: itemsError } = await adminClient
      .from('todo_template_items')
      .insert(templateItems);

    if (itemsError) {
      // 롤백: 템플릿 삭제
      await adminClient.from('todo_templates').delete().eq('id', template.id);
      console.error('Error creating template items:', itemsError);
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    return NextResponse.json({
      ...template,
      items_count: items.length,
    }, { status: 201 });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/haccp/todo/templates - 템플릿 삭제 (검증자 이상)
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Template ID is required' }, { status: 400 });
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

    // 권한 확인
    if (!ALLOWED_ROLES.includes(userProfile.role)) {
      return NextResponse.json(
        { error: '템플릿 삭제 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 비활성화 처리 (실제 삭제 대신)
    const { error } = await adminClient
      .from('todo_templates')
      .update({ status: 'INACTIVE' })
      .eq('id', id)
      .eq('company_id', userProfile.company_id);

    if (error) {
      console.error('Error deleting template:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
