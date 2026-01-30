import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

// GET /api/teams/[id]/members - 팀원 목록 조회
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

    const { data: members, error } = await supabase
      .from('team_members')
      .select(`
        id,
        team_role,
        is_primary_team,
        joined_at,
        user:users(id, name, email, role, status, phone, position)
      `)
      .eq('team_id', id)
      .order('team_role', { ascending: true })
      .order('joined_at', { ascending: true });

    if (error) {
      console.error('Failed to fetch team members:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(members);
  } catch (error) {
    console.error('Team members GET API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/teams/[id]/members - 팀원 추가
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

    if (!['super_admin', 'company_admin', 'manager', 'store_manager'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const body = await request.json();
    const { user_id, user_ids, team_role = 'member', is_primary_team = true } = body;

    // 단일 사용자 또는 여러 사용자 추가 지원
    const userIdsToAdd = user_ids || (user_id ? [user_id] : []);

    if (userIdsToAdd.length === 0) {
      return NextResponse.json({ error: 'user_id or user_ids is required' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // 팀 존재 확인
    const { data: team } = await adminClient
      .from('teams')
      .select('id, company_id')
      .eq('id', id)
      .single();

    if (!team || team.company_id !== currentUser.company_id) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const results = [];
    const errors = [];

    for (const userId of userIdsToAdd) {
      // 이미 팀원인지 확인
      const { data: existingMember } = await adminClient
        .from('team_members')
        .select('id')
        .eq('team_id', id)
        .eq('user_id', userId)
        .single();

      if (existingMember) {
        errors.push({ user_id: userId, error: 'Already a team member' });
        continue;
      }

      const { data: member, error } = await adminClient
        .from('team_members')
        .insert({
          team_id: id,
          user_id: userId,
          team_role,
          is_primary_team,
        })
        .select(`
          id,
          team_role,
          is_primary_team,
          joined_at,
          user:users(id, name, email)
        `)
        .single();

      if (error) {
        errors.push({ user_id: userId, error: error.message });
      } else {
        results.push(member);

        // team_role이 leader면 팀의 leader_id 업데이트
        if (team_role === 'leader') {
          await adminClient
            .from('teams')
            .update({ leader_id: userId })
            .eq('id', id);
        }
      }
    }

    return NextResponse.json({
      success: results,
      errors: errors.length > 0 ? errors : undefined,
    }, { status: 201 });
  } catch (error) {
    console.error('Team members POST API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/teams/[id]/members - 팀원 역할 변경
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

    if (!['super_admin', 'company_admin', 'manager', 'store_manager'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const body = await request.json();
    const { member_id, user_id, team_role, is_primary_team } = body;

    const adminClient = createAdminClient();

    const updateData: Record<string, unknown> = {};
    if (team_role !== undefined) updateData.team_role = team_role;
    if (is_primary_team !== undefined) updateData.is_primary_team = is_primary_team;

    let query = adminClient
      .from('team_members')
      .update(updateData)
      .eq('team_id', id);

    if (member_id) {
      query = query.eq('id', member_id);
    } else if (user_id) {
      query = query.eq('user_id', user_id);
    } else {
      return NextResponse.json({ error: 'member_id or user_id is required' }, { status: 400 });
    }

    const { data: member, error } = await query.select().single();

    if (error) {
      console.error('Failed to update team member:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // team_role이 leader로 변경되면 팀의 leader_id 업데이트
    if (team_role === 'leader' && member) {
      // 기존 팀장을 member로 변경
      await adminClient
        .from('team_members')
        .update({ team_role: 'member' })
        .eq('team_id', id)
        .neq('user_id', member.user_id)
        .eq('team_role', 'leader');

      // 팀의 leader_id 업데이트
      await adminClient
        .from('teams')
        .update({ leader_id: member.user_id })
        .eq('id', id);
    }

    return NextResponse.json(member);
  } catch (error) {
    console.error('Team members PUT API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/teams/[id]/members - 팀원 제외
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

    if (!['super_admin', 'company_admin', 'manager', 'store_manager'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('member_id');
    const userId = searchParams.get('user_id');

    if (!memberId && !userId) {
      return NextResponse.json({ error: 'member_id or user_id is required' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // 삭제할 멤버 정보 조회
    let memberQuery = adminClient
      .from('team_members')
      .select('id, user_id, team_role')
      .eq('team_id', id);

    if (memberId) {
      memberQuery = memberQuery.eq('id', memberId);
    } else if (userId) {
      memberQuery = memberQuery.eq('user_id', userId);
    }

    const { data: member } = await memberQuery.single();

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // 팀장이면 팀의 leader_id도 null로 설정
    if (member.team_role === 'leader') {
      await adminClient
        .from('teams')
        .update({ leader_id: null })
        .eq('id', id);
    }

    const { error } = await adminClient
      .from('team_members')
      .delete()
      .eq('id', member.id);

    if (error) {
      console.error('Failed to remove team member:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Team members DELETE API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
