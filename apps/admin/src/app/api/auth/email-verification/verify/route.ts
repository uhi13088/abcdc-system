import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { email, code } = await request.json();

    if (!email || !code) {
      return NextResponse.json(
        { error: '이메일과 인증 코드를 입력해주세요.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 인증 코드 확인
    const { data: verification, error: fetchError } = await supabase
      .from('email_verifications')
      .select('*')
      .eq('email', email)
      .eq('code', code)
      .single();

    if (fetchError || !verification) {
      return NextResponse.json(
        { error: '인증 코드가 올바르지 않습니다.' },
        { status: 400 }
      );
    }

    // 만료 시간 확인
    if (new Date(verification.expires_at) < new Date()) {
      // 만료된 코드 삭제
      await supabase
        .from('email_verifications')
        .delete()
        .eq('email', email);

      return NextResponse.json(
        { error: '인증 코드가 만료되었습니다. 다시 발송해주세요.' },
        { status: 400 }
      );
    }

    // 인증 완료 처리
    const { error: updateError } = await supabase
      .from('email_verifications')
      .update({ verified: true })
      .eq('email', email)
      .eq('code', code);

    if (updateError) {
      console.error('Error updating verification status:', updateError);
      return NextResponse.json(
        { error: '인증 처리 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '이메일 인증이 완료되었습니다.',
    });

  } catch (error) {
    console.error('Email verification error:', error);
    return NextResponse.json(
      { error: '인증 확인 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
