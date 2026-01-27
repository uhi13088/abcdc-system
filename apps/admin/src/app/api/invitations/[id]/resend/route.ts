import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@abc/shared';

const ResendSchema = z.object({
  sendMethods: z.array(z.enum(['kakao', 'sms', 'link'])).min(1),
  extendDays: z.number().min(1).max(30).optional(),
});

// POST /api/invitations/:id/resend - 초대 재발송
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
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

    const body = await request.json();
    const validation = ResendSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    // 초대 조회
    const { data: invitation } = await adminClient
      .from('invitations')
      .select('*, stores(name)')
      .eq('id', id)
      .eq('company_id', userData.company_id)
      .single();

    if (!invitation) {
      return NextResponse.json({ error: '초대를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (invitation.status === 'ACCEPTED') {
      return NextResponse.json({ error: '이미 수락된 초대는 재발송할 수 없습니다.' }, { status: 400 });
    }

    if (invitation.status === 'CANCELLED') {
      return NextResponse.json({ error: '취소된 초대는 재발송할 수 없습니다.' }, { status: 400 });
    }

    // 만료된 경우 유효기간 연장
    const now = new Date();
    let newExpiresAt = new Date(invitation.expires_at);

    if (newExpiresAt < now || validation.data.extendDays) {
      newExpiresAt = new Date();
      newExpiresAt.setDate(newExpiresAt.getDate() + (validation.data.extendDays || 7));
    }

    // 초대 링크 - 요청 URL에서 호스트 추출
    const requestUrl = new URL(request.url);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${requestUrl.protocol}//${requestUrl.host}`;
    const inviteUrl = `${baseUrl}/invite/${invitation.token}`;

    // 발송 결과
    const sendResults: Record<string, { success: boolean; sentAt?: string; error?: string }> =
      invitation.send_results || {};

    // 카카오톡 발송
    if (validation.data.sendMethods.includes('kakao')) {
      try {
        // TODO: 카카오 알림톡 API 호출
        sendResults.kakao = { success: true, sentAt: new Date().toISOString() };
        logger.log(`[Kakao Resend] Would send to ${invitation.phone}: ${inviteUrl}`);
      } catch (_err) {
        sendResults.kakao = { success: false, error: 'Failed to send' };
      }
    }

    // SMS 발송
    if (validation.data.sendMethods.includes('sms')) {
      try {
        // TODO: SMS API 호출
        sendResults.sms = { success: true, sentAt: new Date().toISOString() };
        logger.log(`[SMS Resend] Would send to ${invitation.phone}: ${inviteUrl}`);
      } catch (_err) {
        sendResults.sms = { success: false, error: 'Failed to send' };
      }
    }

    // 링크
    if (validation.data.sendMethods.includes('link')) {
      sendResults.link = { success: true };
    }

    // 업데이트
    const { error } = await adminClient
      .from('invitations')
      .update({
        status: 'PENDING',
        expires_at: newExpiresAt.toISOString(),
        send_methods: validation.data.sendMethods,
        send_results: sendResults,
      })
      .eq('id', id);

    if (error) {
      console.error('[POST /api/invitations/:id/resend] Update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      message: '초대가 재발송되었습니다.',
      inviteUrl,
      sendResults,
      expiresAt: newExpiresAt.toISOString(),
    });
  } catch (error) {
    console.error('[POST /api/invitations/:id/resend] Catch error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
