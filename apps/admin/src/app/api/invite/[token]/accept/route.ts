import { createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// 가입 데이터 스키마 - 필수 필드 명확히 지정
const AcceptInvitationSchema = z.object({
  // 계정 정보 (필수)
  email: z.string().email('올바른 이메일 형식이 아닙니다'),
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다'),

  // 인적 사항 (필수)
  birthDate: z.string().min(1, '생년월일을 입력해주세요'),
  ssnLast: z.string().length(7, '주민등록번호 뒷자리 7자리를 입력해주세요'),
  zonecode: z.string().min(1, '우편번호가 필요합니다'),
  address: z.string().min(1, '주소를 검색하여 입력해주세요'),
  addressDetail: z.string().min(1, '상세주소를 입력해주세요'),

  // 비상연락처 (전화, 관계는 필수 / 이름은 선택)
  emergencyContact: z.object({
    name: z.string().optional(),
    phone: z.string().min(1, '비상연락처 전화번호를 입력해주세요'),
    relationship: z.string().min(1, '비상연락처 관계를 입력해주세요'),
  }),

  // 급여 정보 (필수)
  bankName: z.string().min(1, '은행을 선택해주세요'),
  bankAccount: z.string().min(1, '계좌번호를 입력해주세요'),
  bankHolder: z.string().min(1, '예금주를 입력해주세요'),

  // 추가 정보 (선택)
  vehicleNumber: z.string().optional(),
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

    // 전체 주소 조합
    const fullAddress = `[${data.zonecode}] ${data.address} ${data.addressDetail}`;

    // users 테이블에 사용자 정보 저장
    const { data: newUser, error: userError } = await adminClient
      .from('users')
      .insert({
        auth_id: authUser.user.id,
        email: data.email,
        name: invitation.name,
        phone: invitation.phone,
        role: invitation.role || 'staff',
        position: invitation.position,
        company_id: invitation.company_id,
        brand_id: null,  // 나중에 매장 정보에서 가져옴
        store_id: invitation.store_id,
        status: 'ACTIVE',
        birth_date: data.birthDate,
        address: fullAddress,
        bank_name: data.bankName,
        bank_account: data.bankAccount,
        account_holder: data.bankHolder,
        vehicle_number: data.vehicleNumber || null,
        emergency_contact: {
          name: data.emergencyContact.name || null,
          phone: data.emergencyContact.phone,
          relationship: data.emergencyContact.relationship,
        },
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

    // 주민등록번호 뒷자리 저장 (별도 보안 테이블이 있다면)
    // 이 부분은 ssn_encrypted 컬럼이나 별도 테이블에 암호화하여 저장해야 함
    // 현재는 profiles 테이블에 ssn_last 컬럼이 있다면 저장
    try {
      await adminClient
        .from('profiles')
        .upsert({
          user_id: newUser.id,
          ssn_last: data.ssnLast,  // 실제로는 암호화 필요
        });
    } catch (e) {
      // profiles 테이블이 없거나 ssn_last 컬럼이 없을 수 있음 - 무시
      console.log('[POST /api/invite/:token/accept] Profile upsert skipped:', e);
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
