import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/haccp/team-checklists - 사용자가 속한 팀의 체크리스트 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 현재 사용자 정보 조회
    const { data: currentUser } = await adminClient
      .from('users')
      .select('id, company_id, store_id, current_store_id, current_haccp_store_id, role')
      .eq('auth_id', user.id)
      .single();

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const teamId = searchParams.get('team_id');
    const category = searchParams.get('category');

    // 사용자가 속한 팀 조회
    const { data: userTeams } = await supabase
      .from('team_members')
      .select(`
        team_id,
        team_role,
        teams(id, name, team_type, store_id)
      `)
      .eq('user_id', currentUser.id);

    if (!userTeams || userTeams.length === 0) {
      return NextResponse.json([]);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const teamIds = userTeams.map((tm: any) => tm.team_id);

    // 팀 체크리스트 조회
    let checklistQuery = supabase
      .from('team_checklists')
      .select(`
        *,
        teams(id, name, team_type)
      `)
      .in('team_id', teamIds)
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .order('checklist_name', { ascending: true });

    if (teamId) {
      checklistQuery = checklistQuery.eq('team_id', teamId);
    }

    if (category) {
      checklistQuery = checklistQuery.eq('checklist_category', category);
    }

    const { data: checklists, error: checklistError } = await checklistQuery;

    if (checklistError) {
      console.error('Failed to fetch team checklists:', checklistError);
      return NextResponse.json({ error: checklistError.message }, { status: 500 });
    }

    if (!checklists || checklists.length === 0) {
      return NextResponse.json([]);
    }

    // 각 체크리스트의 항목과 오늘 기록 조회
    const checklistsWithDetails = await Promise.all(
      checklists.map(async (checklist) => {
        // 체크리스트 항목 조회
        const { data: items } = await supabase
          .from('team_checklist_items')
          .select('*')
          .eq('checklist_id', checklist.id)
          .eq('is_active', true)
          .order('display_order', { ascending: true });

        // 오늘 기록 조회
        const { data: records } = await supabase
          .from('team_checklist_records')
          .select(`
            *,
            performed_by_user:users!team_checklist_records_performed_by_fkey(id, name)
          `)
          .eq('checklist_id', checklist.id)
          .eq('record_date', date)
          .order('performed_at', { ascending: false })
          .limit(1);

        const todayRecord = records && records.length > 0 ? records[0] : null;

        // 기록된 항목 상세 조회
        let recordItems: { item_id: string; is_checked: boolean; value_text: string | null; value_number: number | null }[] = [];
        if (todayRecord) {
          const { data: recordItemsData } = await supabase
            .from('team_checklist_record_items')
            .select('*')
            .eq('record_id', todayRecord.id);
          recordItems = recordItemsData || [];
        }

        // 완료율 계산
        const totalItems = items?.length || 0;
        const completedItems = recordItems.filter((ri) => ri.is_checked).length;
        const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

        return {
          ...checklist,
          items: items || [],
          today_record: todayRecord,
          record_items: recordItems,
          total_items: totalItems,
          completed_items: completedItems,
          progress,
        };
      })
    );

    // 팀 정보도 함께 반환
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const teamsInfo = userTeams.map((tm: any) => ({
      id: tm.team_id,
      role: tm.team_role,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(tm.teams as any),
    }));

    return NextResponse.json({
      teams: teamsInfo,
      checklists: checklistsWithDetails,
    });
  } catch (error) {
    console.error('Team checklists GET API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/haccp/team-checklists - 체크리스트 수행 기록 생성/업데이트
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: currentUser } = await adminClient
      .from('users')
      .select('id, company_id, store_id, current_store_id, current_haccp_store_id')
      .eq('auth_id', user.id)
      .single();

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const currentStoreId = currentUser.current_store_id || currentUser.store_id;

    const body = await request.json();
    const {
      checklist_id,
      team_id,
      record_date = new Date().toISOString().split('T')[0],
      shift_time,
      items,
      notes,
    } = body;

    if (!checklist_id || !team_id) {
      return NextResponse.json({ error: 'checklist_id and team_id are required' }, { status: 400 });
    }

    // 사용자가 해당 팀에 속하는지 확인
    const { data: membership } = await supabase
      .from('team_members')
      .select('id')
      .eq('team_id', team_id)
      .eq('user_id', currentUser.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this team' }, { status: 403 });
    }

    // 오늘 기록이 있는지 확인
    const { data: existingRecord } = await supabase
      .from('team_checklist_records')
      .select('id')
      .eq('checklist_id', checklist_id)
      .eq('team_id', team_id)
      .eq('record_date', record_date)
      .single();

    let recordId: string;

    if (existingRecord) {
      // 기존 기록 업데이트
      recordId = existingRecord.id;
      await adminClient
        .from('team_checklist_records')
        .update({
          performed_by: currentUser.id,
          performed_at: new Date().toISOString(),
          notes,
          status: 'in_progress',
        })
        .eq('id', recordId);
    } else {
      // 새 기록 생성
      const { data: newRecord, error: recordError } = await adminClient
        .from('team_checklist_records')
        .insert({
          company_id: currentUser.company_id,
          store_id: currentStoreId || null,
          checklist_id,
          team_id,
          performed_by: currentUser.id,
          record_date,
          shift_time,
          notes,
          status: 'in_progress',
        })
        .select()
        .single();

      if (recordError) {
        console.error('Failed to create record:', recordError);
        return NextResponse.json({ error: recordError.message }, { status: 500 });
      }

      recordId = newRecord.id;
    }

    // 항목 기록 업데이트
    if (items && Array.isArray(items)) {
      for (const item of items) {
        const { item_id, is_checked, value_text, value_number, photo_url, notes: itemNotes } = item;

        // 기존 항목 기록이 있는지 확인
        const { data: existingItemRecord } = await supabase
          .from('team_checklist_record_items')
          .select('id')
          .eq('record_id', recordId)
          .eq('item_id', item_id)
          .single();

        if (existingItemRecord) {
          await adminClient
            .from('team_checklist_record_items')
            .update({
              is_checked,
              value_text,
              value_number,
              photo_url,
              notes: itemNotes,
            })
            .eq('id', existingItemRecord.id);
        } else {
          await adminClient
            .from('team_checklist_record_items')
            .insert({
              record_id: recordId,
              item_id,
              is_checked,
              value_text,
              value_number,
              photo_url,
              notes: itemNotes,
            });
        }
      }

      // 완료 상태 확인
      const { data: checklistItems } = await supabase
        .from('team_checklist_items')
        .select('id')
        .eq('checklist_id', checklist_id)
        .eq('is_active', true);

      const { data: recordItems } = await supabase
        .from('team_checklist_record_items')
        .select('id, is_checked')
        .eq('record_id', recordId);

      const totalItems = checklistItems?.length || 0;
      const completedItems = recordItems?.filter((ri) => ri.is_checked).length || 0;

      if (totalItems > 0 && completedItems === totalItems) {
        await adminClient
          .from('team_checklist_records')
          .update({ status: 'completed' })
          .eq('id', recordId);
      }
    }

    return NextResponse.json({ success: true, record_id: recordId });
  } catch (error) {
    console.error('Team checklists POST API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
