import { createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/invite/:token - 초대 정보 조회 (공개 - 인증 불필요)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const adminClient = createAdminClient();

    const { data: invitation, error } = await adminClient
      .from('invitations')
      .select(`
        id,
        name,
        phone,
        role,
        position,
        salary_type,
        salary_amount,
        work_days,
        work_start_time,
        work_end_time,
        break_minutes,
        required_documents,
        custom_fields,
        status,
        expires_at,
        stores(id, name, brands(id, name)),
        companies(id, name)
      `)
      .eq('token', token)
      .single();

    if (error || !invitation) {
      console.error('[GET /api/invite/:token] Not found:', error);
      return NextResponse.json({ error: '유효하지 않은 초대 링크입니다.' }, { status: 404 });
    }

    // 상태 체크
    if (invitation.status === 'CANCELLED') {
      return NextResponse.json({ error: '취소된 초대입니다.' }, { status: 400 });
    }

    if (invitation.status === 'ACCEPTED') {
      return NextResponse.json({ error: '이미 가입이 완료된 초대입니다.' }, { status: 400 });
    }

    // 만료 체크
    const now = new Date();
    if (new Date(invitation.expires_at) < now) {
      // 만료 상태로 업데이트
      await adminClient
        .from('invitations')
        .update({ status: 'EXPIRED' })
        .eq('id', invitation.id);

      return NextResponse.json({ error: '만료된 초대입니다. 관리자에게 재발송을 요청해주세요.' }, { status: 400 });
    }

    return NextResponse.json({ data: invitation });
  } catch (error) {
    console.error('[GET /api/invite/:token] Catch error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
