import { createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// 가입 데이터 스키마
const AcceptInvitationSchema = z.object({
  // 계정 정보
  email: z.string().email('올바른 이메일 형식이 아닙니다'),
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다'),

  // 인적 사항
  birthDate: z.string().optional(),
  ssnLast: z.string().length(7, '주민등록번호 뒷자리 7자리를 입력해주세요').optional(),
  address: z.string().optional(),
  addressDetail: z.string().optional(),
  emergencyContact: z.object({
    name: z.string(),
    phone: z.string(),
    relationship: z.string(),
  }).optional(),

  // 급여 정보
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
  bankHolder: z.string().optional(),
  salaryAmount: z.number().min(0).optional(),  // 확인된 시급

  // 근무 스케줄 (확인)
  workDays: z.array(z.number()).optional(),
  workStartTime: z.string().optional(),
  workEndTime: z.string().optional(),
  breakMinutes: z.number().optional(),

  // 추가 정보
  position: z.string().optional(),
  vehicleNumber: z.string().optional(),
  certifications: z.array(z.object({
    name: z.string(),
    issuer: z.string().optional(),
    date: z.string().optional(),
  })).optional(),

  // 서류 URL (업로드된 파일)
  documents: z.object({
    healthCertificate: z.string().optional(),
    bankCopy: z.string().optional(),
    careerCertificate: z.string().optional(),
  }).optional(),
});

// POST /api/invite/:token/accept - 초대 수락 (가입 완료)
export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const adminClient = createAdminClient();

    // 초대 조회
    const { data: invitation, error: invError } = await adminClient
      .from('invitations')
      .select('*')
      .eq('token', params.token)
      .single();

    if (invError || !invitation) {
      return NextResponse.json({ error: '유효하지 않은 초대 링크입니다.' }, { status: 404 });
    }

    // 상태 체크
    if (invitation.status !== 'PENDING') {
      const messages: Record<string, string> = {
        CANCELLED: '취소된 초대입니다.',
        ACCEPTED: '이미 가입이 완료된 초대입니다.',
        EXPIRED: '만료된 초대입니다.',
      };
      return NextResponse.json({ error: messages[invitation.status] || '유효하지 않은 초대입니다.' }, { status: 400 });
    }

    // 만료 체크
    if (new Date(invitation.expires_at) < new Date()) {
      await adminClient
        .from('invitations')
        .update({ status: 'EXPIRED' })
        .eq('id', invitation.id);
      return NextResponse.json({ error: '만료된 초대입니다.' }, { status: 400 });
    }

    // 요청 데이터 파싱
    const body = await request.json();
    const validation = AcceptInvitationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const data = validation.data;

    // 이메일 중복 체크
    const { data: existingUser } = await adminClient
      .from('users')
      .select('id')
      .eq('email', data.email)
      .single();

    if (existingUser) {
      return NextResponse.json({ error: '이미 사용 중인 이메일입니다.' }, { status: 409 });
    }

    // Supabase Auth 사용자 생성
    const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,  // 이메일 인증 건너뛰기
    });

    if (authError) {
      console.error('[POST /api/invite/:token/accept] Auth error:', authError);
      return NextResponse.json({ error: '계정 생성에 실패했습니다: ' + authError.message }, { status: 500 });
    }

    // users 테이블에 사용자 정보 저장 (기본 스키마 필드만 사용)
    const { data: newUser, error: userError } = await adminClient
      .from('users')
      .insert({
        auth_id: authUser.user.id,
        email: data.email,
        name: invitation.name,
        phone: invitation.phone,
        role: invitation.role || 'staff',
        position: data.position || invitation.position,
        company_id: invitation.company_id,
        brand_id: null,  // 나중에 매장 정보에서 가져옴
        store_id: invitation.store_id,
        status: 'ACTIVE',
        birth_date: data.birthDate || null,
        address: data.address || null,
        bank_name: data.bankName || null,
        bank_account: data.bankAccount || null,
        account_holder: data.bankHolder || null,
      })
      .select()
      .single();

    if (userError) {
      console.error('[POST /api/invite/:token/accept] User insert error:', userError);
      // Auth 사용자 삭제 (롤백)
      await adminClient.auth.admin.deleteUser(authUser.user.id);
      return NextResponse.json({ error: '사용자 정보 저장에 실패했습니다: ' + userError.message }, { status: 500 });
    }

    // 매장의 brand_id 가져와서 업데이트
    const { data: store } = await adminClient
      .from('stores')
      .select('brand_id')
      .eq('id', invitation.store_id)
      .single();

    if (store?.brand_id) {
      await adminClient
        .from('users')
        .update({ brand_id: store.brand_id })
        .eq('id', newUser.id);
    }

    // 초대 상태 업데이트
    await adminClient
      .from('invitations')
      .update({
        status: 'ACCEPTED',
        accepted_at: new Date().toISOString(),
        user_id: newUser.id,
      })
      .eq('id', invitation.id);

    return NextResponse.json({
      message: '가입이 완료되었습니다!',
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/invite/:token/accept] Catch error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
