import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/invitations/:id - 초대 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await adminClient
      .from('users')
      .select('company_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const { data: invitation, error } = await adminClient
      .from('invitations')
      .select(`
        *,
        stores(id, name),
        invitation_templates(id, name),
        users(id, name, email)
      `)
      .eq('id', params.id)
      .eq('company_id', userData.company_id)
      .single();

    if (error || !invitation) {
      return NextResponse.json({ error: '초대를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 초대 링크 생성 - 요청 URL에서 호스트 추출
    const requestUrl = new URL(request.url);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${requestUrl.protocol}//${requestUrl.host}`;
    const inviteUrl = `${baseUrl}/invite/${invitation.token}`;

    return NextResponse.json({ data: invitation, inviteUrl });
  } catch (error) {
    console.error('[GET /api/invitations/:id] Catch error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/invitations/:id - 초대 취소
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await adminClient
      .from('users')
      .select('company_id, role')
      .eq('auth_id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    if (!['super_admin', 'company_admin', 'manager', 'store_manager'].includes(userData.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 초대 상태 확인
    const { data: invitation } = await adminClient
      .from('invitations')
      .select('status')
      .eq('id', params.id)
      .eq('company_id', userData.company_id)
      .single();

    if (!invitation) {
      return NextResponse.json({ error: '초대를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (invitation.status === 'ACCEPTED') {
      return NextResponse.json({ error: '이미 수락된 초대는 취소할 수 없습니다.' }, { status: 400 });
    }

    // 초대 취소
    const { error } = await adminClient
      .from('invitations')
      .update({ status: 'CANCELLED' })
      .eq('id', params.id)
      .eq('company_id', userData.company_id);

    if (error) {
      console.error('[DELETE /api/invitations/:id] Cancel error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: '초대가 취소되었습니다.' });
  } catch (error) {
    console.error('[DELETE /api/invitations/:id] Catch error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
