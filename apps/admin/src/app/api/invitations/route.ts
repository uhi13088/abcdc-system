import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { logger } from '@abc/shared';

// 초대 생성 스키마
const CreateInvitationSchema = z.object({
  name: z.string().min(1, '이름을 입력해주세요').max(100),
  phone: z.string().min(1, '전화번호를 입력해주세요'),
  storeId: z.string().uuid('매장을 선택해주세요'),
  templateId: z.string().uuid().optional(),
  // 템플릿 없이 직접 입력 시
  role: z.string().optional(),
  position: z.string().optional(),
  salaryType: z.enum(['hourly', 'daily', 'monthly']).optional(),
  salaryAmount: z.number().min(0).optional(),
  workDays: z.array(z.number().min(0).max(6)).optional(),
  workStartTime: z.string().optional(),
  workEndTime: z.string().optional(),
  breakMinutes: z.number().min(0).optional(),
  requiredDocuments: z.array(z.string()).optional(),
  customFields: z.array(z.object({
    name: z.string(),
    type: z.enum(['text', 'number', 'date', 'file']),
    required: z.boolean(),
  })).optional(),
  // 발송 방법
  sendMethods: z.array(z.enum(['kakao', 'sms', 'link'])).min(1, '발송 방법을 선택해주세요'),
  expiresInDays: z.number().min(1).max(30).default(7),
});

// 토큰 생성
function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

// GET /api/invitations - 초대 목록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const storeId = searchParams.get('storeId');

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
      return NextResponse.json({ data: [] });
    }

    let query = adminClient
      .from('invitations')
      .select(`
        *,
        stores(id, name),
        invitation_templates(id, name),
        creator:users!invitations_created_by_fkey(id, name, email)
      `)
      .eq('company_id', userData.company_id)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }
    if (storeId) {
      query = query.eq('store_id', storeId);
    }

    const { data: invitations, error } = await query;

    if (error) {
      console.error('[GET /api/invitations] Query error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 만료 체크 및 상태 업데이트
    const now = new Date();
    const expiredIds: string[] = [];
    const updatedInvitations = invitations?.map(inv => {
      if (inv.status === 'PENDING' && new Date(inv.expires_at) < now) {
        expiredIds.push(inv.id);
        return { ...inv, status: 'EXPIRED' };
      }
      return inv;
    });

    // 만료된 초대들 일괄 업데이트
    if (expiredIds.length > 0) {
      await adminClient
        .from('invitations')
        .update({ status: 'EXPIRED' })
        .in('id', expiredIds);
    }

    return NextResponse.json({ data: updatedInvitations || [] });
  } catch (error) {
    console.error('[GET /api/invitations] Catch error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/invitations - 초대 생성 및 발송
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await adminClient
      .from('users')
      .select('id, company_id, role')
      .eq('auth_id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: '회사 정보가 없습니다.' }, { status: 400 });
    }

    if (!['super_admin', 'company_admin', 'manager', 'store_manager'].includes(userData.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const validation = CreateInvitationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || '입력값이 올바르지 않습니다.' },
        { status: 400 }
      );
    }

    // 매장이 회사에 속하는지 확인
    const { data: store } = await adminClient
      .from('stores')
      .select('id, company_id, name')
      .eq('id', validation.data.storeId)
      .single();

    if (!store || store.company_id !== userData.company_id) {
      return NextResponse.json({ error: '유효하지 않은 매장입니다.' }, { status: 400 });
    }

    // 템플릿 데이터 가져오기
    let templateData = null;
    if (validation.data.templateId) {
      const { data: template } = await adminClient
        .from('invitation_templates')
        .select('*')
        .eq('id', validation.data.templateId)
        .eq('company_id', userData.company_id)
        .single();
      templateData = template;
    }

    // 토큰 및 만료일 생성
    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + validation.data.expiresInDays);

    // 초대 데이터 구성
    const invitationData = {
      company_id: userData.company_id,
      store_id: validation.data.storeId,
      template_id: validation.data.templateId || null,
      name: validation.data.name,
      phone: validation.data.phone,
      role: templateData?.role || validation.data.role || 'staff',
      position: templateData?.position || validation.data.position || null,
      salary_type: templateData?.salary_type || validation.data.salaryType || 'hourly',
      salary_amount: templateData?.salary_amount || validation.data.salaryAmount || 0,
      work_days: templateData?.work_days || validation.data.workDays || [1, 2, 3, 4, 5],
      work_start_time: templateData?.work_start_time || validation.data.workStartTime || '09:00',
      work_end_time: templateData?.work_end_time || validation.data.workEndTime || '18:00',
      break_minutes: templateData?.break_minutes || validation.data.breakMinutes || 60,
      required_documents: templateData?.required_documents || validation.data.requiredDocuments || [],
      custom_fields: templateData?.custom_fields || validation.data.customFields || [],
      token,
      status: 'PENDING',
      expires_at: expiresAt.toISOString(),
      send_methods: validation.data.sendMethods,
      created_by: userData.id,
    };

    const { data: invitation, error } = await adminClient
      .from('invitations')
      .insert(invitationData)
      .select()
      .single();

    if (error) {
      console.error('[POST /api/invitations] Insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 초대 링크 생성 - 요청 URL에서 호스트 추출
    const requestUrl = new URL(request.url);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${requestUrl.protocol}//${requestUrl.host}`;
    const inviteUrl = `${baseUrl}/invite/${token}`;

    // 발송 결과 저장
    const sendResults: Record<string, { success: boolean; sentAt?: string; error?: string }> = {};

    // 카카오톡 발송 (TODO: 실제 카카오 알림톡 API 연동)
    if (validation.data.sendMethods.includes('kakao')) {
      try {
        // TODO: 카카오 알림톡 API 호출
        // await sendKakaoAlimtalk(validation.data.phone, inviteUrl, store.name, validation.data.name);
        sendResults.kakao = { success: true, sentAt: new Date().toISOString() };
        logger.log(`[Kakao] Would send to ${validation.data.phone}: ${inviteUrl}`);
      } catch (_err) {
        sendResults.kakao = { success: false, error: 'Failed to send' };
      }
    }

    // SMS 발송 (TODO: 실제 SMS API 연동)
    if (validation.data.sendMethods.includes('sms')) {
      try {
        // TODO: SMS API 호출
        // await sendSms(validation.data.phone, `[${store.name}] 직원 등록 링크: ${inviteUrl}`);
        sendResults.sms = { success: true, sentAt: new Date().toISOString() };
        logger.log(`[SMS] Would send to ${validation.data.phone}: ${inviteUrl}`);
      } catch (_err) {
        sendResults.sms = { success: false, error: 'Failed to send' };
      }
    }

    // 링크 복사 (항상 가능)
    if (validation.data.sendMethods.includes('link')) {
      sendResults.link = { success: true };
    }

    // 발송 결과 업데이트
    await adminClient
      .from('invitations')
      .update({ send_results: sendResults })
      .eq('id', invitation.id);

    return NextResponse.json({
      data: { ...invitation, send_results: sendResults },
      inviteUrl,
      sendResults,
    }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/invitations] Catch error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
