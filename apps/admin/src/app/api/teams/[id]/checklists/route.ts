import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

// GET /api/teams/[id]/checklists - 팀별 체크리스트 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: currentUser } = await supabase
      .from('users')
      .select('id, company_id, role')
      .eq('auth_id', user.id)
      .single();

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const includeItems = searchParams.get('include_items') === 'true';
    const category = searchParams.get('category');
    const activeOnly = searchParams.get('active_only') !== 'false';

    let query = supabase
      .from('team_checklists')
      .select('*')
      .eq('team_id', id)
      .order('display_order', { ascending: true })
      .order('checklist_name', { ascending: true });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    if (category) {
      query = query.eq('checklist_category', category);
    }

    const { data: checklists, error } = await query;

    if (error) {
      console.error('Failed to fetch team checklists:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (includeItems && checklists) {
      const checklistsWithItems = await Promise.all(
        checklists.map(async (checklist) => {
          const { data: items } = await supabase
            .from('team_checklist_items')
            .select('*')
            .eq('checklist_id', checklist.id)
            .eq('is_active', true)
            .order('display_order', { ascending: true });

          return { ...checklist, items: items || [] };
        })
      );

      return NextResponse.json(checklistsWithItems);
    }

    return NextResponse.json(checklists);
  } catch (error) {
    console.error('Team checklists GET API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/teams/[id]/checklists - 팀 체크리스트 생성
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: currentUser } = await supabase
      .from('users')
      .select('id, company_id, role')
      .eq('auth_id', user.id)
      .single();

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!['super_admin', 'company_admin', 'manager'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const body = await request.json();
    const {
      checklist_name,
      checklist_category = 'other',
      description,
      frequency = 'daily',
      shift_time,
      is_required = true,
      display_order = 0,
      items = [],
    } = body;

    if (!checklist_name) {
      return NextResponse.json({ error: 'checklist_name is required' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // 체크리스트 생성
    const { data: checklist, error } = await adminClient
      .from('team_checklists')
      .insert({
        company_id: currentUser.company_id,
        team_id: id,
        checklist_name,
        checklist_category,
        description,
        frequency,
        shift_time,
        is_required,
        display_order,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create team checklist:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 체크리스트 항목 생성
    if (items.length > 0) {
      const itemsToInsert = items.map((item: {
        item_name: string;
        item_type?: string;
        is_required?: boolean;
        display_order?: number;
        min_value?: number;
        max_value?: number;
        unit?: string;
      }, index: number) => ({
        checklist_id: checklist.id,
        item_name: item.item_name,
        item_type: item.item_type || 'checkbox',
        is_required: item.is_required ?? true,
        display_order: item.display_order ?? index,
        min_value: item.min_value,
        max_value: item.max_value,
        unit: item.unit,
        is_active: true,
      }));

      await adminClient
        .from('team_checklist_items')
        .insert(itemsToInsert);
    }

    return NextResponse.json(checklist, { status: 201 });
  } catch (error) {
    console.error('Team checklists POST API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/teams/[id]/checklists - 팀 체크리스트 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: currentUser } = await supabase
      .from('users')
      .select('id, company_id, role')
      .eq('auth_id', user.id)
      .single();

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!['super_admin', 'company_admin', 'manager'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const body = await request.json();
    const {
      checklist_id,
      checklist_name,
      checklist_category,
      description,
      frequency,
      shift_time,
      is_required,
      display_order,
      is_active,
      items,
    } = body;

    if (!checklist_id) {
      return NextResponse.json({ error: 'checklist_id is required' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    const updateData: Record<string, unknown> = {};
    if (checklist_name !== undefined) updateData.checklist_name = checklist_name;
    if (checklist_category !== undefined) updateData.checklist_category = checklist_category;
    if (description !== undefined) updateData.description = description;
    if (frequency !== undefined) updateData.frequency = frequency;
    if (shift_time !== undefined) updateData.shift_time = shift_time;
    if (is_required !== undefined) updateData.is_required = is_required;
    if (display_order !== undefined) updateData.display_order = display_order;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data: checklist, error } = await adminClient
      .from('team_checklists')
      .update(updateData)
      .eq('id', checklist_id)
      .eq('team_id', id)
      .select()
      .single();

    if (error) {
      console.error('Failed to update team checklist:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 항목 업데이트 (전체 교체 방식)
    if (items !== undefined) {
      // 기존 항목 비활성화
      await adminClient
        .from('team_checklist_items')
        .update({ is_active: false })
        .eq('checklist_id', checklist_id);

      // 새 항목 추가
      if (items.length > 0) {
        const itemsToInsert = items.map((item: {
          item_name: string;
          item_type?: string;
          is_required?: boolean;
          display_order?: number;
          min_value?: number;
          max_value?: number;
          unit?: string;
        }, index: number) => ({
          checklist_id: checklist_id,
          item_name: item.item_name,
          item_type: item.item_type || 'checkbox',
          is_required: item.is_required ?? true,
          display_order: item.display_order ?? index,
          min_value: item.min_value,
          max_value: item.max_value,
          unit: item.unit,
          is_active: true,
        }));

        await adminClient
          .from('team_checklist_items')
          .insert(itemsToInsert);
      }
    }

    return NextResponse.json(checklist);
  } catch (error) {
    console.error('Team checklists PUT API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/teams/[id]/checklists - 팀 체크리스트 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: currentUser } = await supabase
      .from('users')
      .select('id, company_id, role')
      .eq('auth_id', user.id)
      .single();

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!['super_admin', 'company_admin', 'manager'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const checklistId = searchParams.get('checklist_id');

    if (!checklistId) {
      return NextResponse.json({ error: 'checklist_id is required' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // 소프트 삭제
    const { error } = await adminClient
      .from('team_checklists')
      .update({ is_active: false })
      .eq('id', checklistId)
      .eq('team_id', id);

    if (error) {
      console.error('Failed to delete team checklist:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Team checklists DELETE API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
