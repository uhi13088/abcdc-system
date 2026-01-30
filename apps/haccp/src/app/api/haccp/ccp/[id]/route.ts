import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// PUT /api/haccp/ccp/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();
    const { id } = await params;

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 사용자 회사 정보 조회
    const { data: userProfile } = await adminClient
      .from('users')
      .select('company_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      ccp_number,
      process,
      hazard,
      control_measure,
      critical_limit,
      critical_limits,
      monitoring_method,
      monitoring_frequency,
      corrective_action,
    } = body;

    // company_id 필터링 추가 (보안)
    const { data, error } = await adminClient
      .from('ccp_definitions')
      .update({
        ccp_number,
        process,
        hazard,
        control_measure,
        critical_limit,
        critical_limits,
        monitoring_method,
        monitoring_frequency,
        corrective_action,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('company_id', userProfile.company_id)
      .select()
      .single();

    if (error) {
      console.error('Error updating CCP definition:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'CCP definition not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/haccp/ccp/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();
    const { id } = await params;

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 사용자 회사 정보 조회
    const { data: userProfile } = await adminClient
      .from('users')
      .select('company_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 삭제 전 존재 여부 확인 (company_id 검증 포함)
    const { data: existing } = await adminClient
      .from('ccp_definitions')
      .select('id')
      .eq('id', id)
      .eq('company_id', userProfile.company_id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'CCP definition not found' }, { status: 404 });
    }

    // company_id 필터링 추가 (보안)
    const { error } = await adminClient
      .from('ccp_definitions')
      .delete()
      .eq('id', id)
      .eq('company_id', userProfile.company_id);

    if (error) {
      console.error('Error deleting CCP definition:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'CCP 정의가 삭제되었습니다.' });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
