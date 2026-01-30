import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

// GET /api/teams/[id] - 팀 상세 조회
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

    const { data: team, error } = await supabase
      .from('teams')
      .select(`
        *,
        store:stores(id, name),
        leader:users!teams_leader_id_fkey(id, name, email)
      `)
      .eq('id', id)
      .eq('company_id', currentUser.company_id)
      .single();

    if (error || !team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // 팀원 목록 조회
    const { data: members } = await supabase
      .from('team_members')
      .select(`
        id,
        team_role,
        is_primary_team,
        joined_at,
        user:users(id, name, email, role, status, phone)
      `)
      .eq('team_id', id)
      .order('team_role', { ascending: true });

    return NextResponse.json({ ...team, members: members || [] });
  } catch (error) {
    console.error('Team GET API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/teams/[id] - 팀 수정
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
    const { name, team_type, description, leader_id, display_order, is_active } = body;

    const adminClient = createAdminClient();

    // 기존 팀 정보 조회
    const { data: existingTeam } = await adminClient
      .from('teams')
      .select('leader_id')
      .eq('id', id)
      .eq('company_id', currentUser.company_id)
      .single();

    if (!existingTeam) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (team_type !== undefined) updateData.team_type = team_type;
    if (description !== undefined) updateData.description = description;
    if (leader_id !== undefined) updateData.leader_id = leader_id;
    if (display_order !== undefined) updateData.display_order = display_order;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data: team, error } = await adminClient
      .from('teams')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Failed to update team:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 팀장 변경 시 team_members 업데이트
    if (leader_id !== undefined && leader_id !== existingTeam.leader_id) {
      // 기존 팀장의 역할을 member로 변경
      if (existingTeam.leader_id) {
        await adminClient
          .from('team_members')
          .update({ team_role: 'member' })
          .eq('team_id', id)
          .eq('user_id', existingTeam.leader_id);
      }

      // 새 팀장 설정
      if (leader_id) {
        // 이미 멤버인지 확인
        const { data: existingMember } = await adminClient
          .from('team_members')
          .select('id')
          .eq('team_id', id)
          .eq('user_id', leader_id)
          .single();

        if (existingMember) {
          // 기존 멤버를 팀장으로 승격
          await adminClient
            .from('team_members')
            .update({ team_role: 'leader' })
            .eq('team_id', id)
            .eq('user_id', leader_id);
        } else {
          // 새로 팀장으로 추가
          await adminClient
            .from('team_members')
            .insert({
              team_id: id,
              user_id: leader_id,
              team_role: 'leader',
              is_primary_team: true,
            });
        }
      }
    }

    return NextResponse.json(team);
  } catch (error) {
    console.error('Team PUT API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/teams/[id] - 팀 삭제
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

    const adminClient = createAdminClient();

    // 소프트 삭제 (is_active = false)
    const { error } = await adminClient
      .from('teams')
      .update({ is_active: false })
      .eq('id', id)
      .eq('company_id', currentUser.company_id);

    if (error) {
      console.error('Failed to delete team:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Team DELETE API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
