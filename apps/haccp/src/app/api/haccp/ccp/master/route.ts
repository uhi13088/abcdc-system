import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/haccp/ccp/master - CCP 마스터 그룹 목록 조회
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
      .select('company_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // CCP 마스터 그룹 조회 (연결된 CCP 항목 수 포함)
    const { data, error } = await adminClient
      .from('ccp_master')
      .select(`
        *,
        ccp_definitions:ccp_definitions(count)
      `)
      .eq('company_id', userProfile.company_id)
      .order('sort_order', { ascending: true })
      .order('master_code', { ascending: true });

    if (error) {
      console.error('Error fetching CCP masters:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 각 그룹의 CCP 항목 수 계산
    const result = (data || []).map(master => ({
      ...master,
      items_count: master.ccp_definitions?.[0]?.count || 0,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/haccp/ccp/master - CCP 마스터 그룹 생성
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
      .select('company_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const { data, error } = await adminClient
      .from('ccp_master')
      .insert({
        company_id: userProfile.company_id,
        master_code: body.master_code,
        group_prefix: body.group_prefix,
        process_name: body.process_name,
        hazard_type: body.hazard_type,
        monitoring_frequency: body.monitoring_frequency,
        description: body.description,
        sort_order: body.sort_order || 0,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating CCP master:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/haccp/ccp/master - CCP 마스터 그룹 수정
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await adminClient
      .from('users')
      .select('company_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const { data, error } = await adminClient
      .from('ccp_master')
      .update({
        master_code: body.master_code,
        group_prefix: body.group_prefix,
        process_name: body.process_name,
        hazard_type: body.hazard_type,
        monitoring_frequency: body.monitoring_frequency,
        description: body.description,
        sort_order: body.sort_order,
        status: body.status,
      })
      .eq('id', body.id)
      .eq('company_id', userProfile.company_id)
      .select()
      .single();

    if (error) {
      console.error('Error updating CCP master:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/haccp/ccp/master - CCP 마스터 그룹 삭제
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await adminClient
      .from('users')
      .select('company_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 먼저 연결된 CCP 항목들의 master_id를 null로 설정
    await adminClient
      .from('ccp_definitions')
      .update({ master_id: null })
      .eq('master_id', id);

    // 마스터 그룹 삭제
    const { error } = await adminClient
      .from('ccp_master')
      .delete()
      .eq('id', id)
      .eq('company_id', userProfile.company_id);

    if (error) {
      console.error('Error deleting CCP master:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
