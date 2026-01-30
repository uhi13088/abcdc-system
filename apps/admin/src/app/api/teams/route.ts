import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

// GET /api/teams - 팀 목록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 현재 사용자 정보 조회
    const { data: currentUser } = await supabase
      .from('users')
      .select('id, company_id, role')
      .eq('auth_id', user.id)
      .single();

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('store_id');
    const includeMembers = searchParams.get('include_members') === 'true';

    let query = supabase
      .from('teams')
      .select(`
        *,
        stores(id, name)
      `)
      .eq('company_id', currentUser.company_id)
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .order('name', { ascending: true });

    if (storeId) {
      query = query.eq('store_id', storeId);
    }

    const { data: teams, error } = await query;

    if (error) {
      console.error('Failed to fetch teams:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 팀원 정보 포함 옵션
    if (includeMembers && teams) {
      const teamsWithMembers = await Promise.all(
        teams.map(async (team) => {
          const { data: members } = await supabase
            .from('team_members')
            .select(`
              id,
              user_id,
              team_role,
              is_primary_team,
              joined_at,
              users(id, name, email, role, profile_image_url)
            `)
            .eq('team_id', team.id)
            .order('team_role', { ascending: true });

          return { ...team, members: members || [] };
        })
      );

      return NextResponse.json(teamsWithMembers);
    }

    return NextResponse.json(teams);
  } catch (error) {
    console.error('Teams API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/teams - 팀 생성
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 현재 사용자 정보 조회
    const { data: currentUser } = await supabase
      .from('users')
      .select('id, company_id, role')
      .eq('auth_id', user.id)
      .single();

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 권한 확인
    if (!['super_admin', 'company_admin', 'manager'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const body = await request.json();
    const { store_id, name, team_type, description, leader_id, display_order } = body;

    if (!store_id || !name) {
      return NextResponse.json({ error: 'store_id and name are required' }, { status: 400 });
    }

    // 매장의 brand_id 조회
    const { data: store } = await supabase
      .from('stores')
      .select('brand_id')
      .eq('id', store_id)
      .single();

    const adminClient = createAdminClient();

    const { data: team, error } = await adminClient
      .from('teams')
      .insert({
        company_id: currentUser.company_id,
        store_id,
        brand_id: store?.brand_id,
        name,
        team_type: team_type || 'other',
        description,
        display_order: display_order || 0,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create team:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // leader_id가 있으면 team_members에 팀장으로 추가
    if (leader_id) {
      await adminClient
        .from('team_members')
        .insert({
          team_id: team.id,
          user_id: leader_id,
          team_role: 'leader',
          is_primary_team: true,
        });
    }

    return NextResponse.json(team, { status: 201 });
  } catch (error) {
    console.error('Teams API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
