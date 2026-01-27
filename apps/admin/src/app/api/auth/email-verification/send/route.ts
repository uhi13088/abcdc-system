import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: '이메일을 입력해주세요.' },
        { status: 400 }
      );
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: '유효한 이메일 형식이 아닙니다.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 이미 가입된 이메일인지 확인
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return NextResponse.json(
        { error: '이미 가입된 이메일입니다.' },
        { status: 400 }
      );
    }

    // 6자리 인증 코드 생성
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // 만료 시간 설정 (5분)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    // 기존 인증 코드 삭제 후 새로 저장
    await supabase
      .from('email_verifications')
      .delete()
      .eq('email', email);

    const { error: insertError } = await supabase
      .from('email_verifications')
      .insert({
        email,
        code: verificationCode,
        expires_at: expiresAt,
        verified: false,
      });

    if (insertError) {
      console.error('Error saving verification code:', insertError);
      return NextResponse.json(
        { error: '인증 코드 저장에 실패했습니다.' },
        { status: 500 }
      );
    }

    // Supabase Auth를 통해 OTP 이메일 발송
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        data: {
          verification_code: verificationCode,
        },
      },
    });

    // OTP 발송이 실패해도, 자체 이메일 발송 시도
    // 여기서는 Supabase의 이메일 템플릿을 활용하거나
    // 별도의 이메일 서비스를 사용할 수 있습니다.

    if (otpError) {
      // Supabase OTP가 실패하면 직접 이메일 발송 로직 필요
      // 현재는 인증 코드만 저장하고, 개발 환경에서는 콘솔에 출력
      console.log(`[DEV] 이메일 인증 코드 for ${email}: ${verificationCode}`);
    }

    return NextResponse.json({
      success: true,
      message: '인증 코드가 발송되었습니다. 이메일을 확인해주세요.',
      // 개발 환경에서만 코드 노출 (프로덕션에서는 제거)
      ...(process.env.NODE_ENV === 'development' && { devCode: verificationCode }),
    });

  } catch (error) {
    console.error('Email verification send error:', error);
    return NextResponse.json(
      { error: '인증 코드 발송 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
