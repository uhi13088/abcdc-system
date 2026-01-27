import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { date, email, verifier_name, signature } = body;

    if (!email) {
      return NextResponse.json({ error: '이메일 주소가 필요합니다.' }, { status: 400 });
    }

    // TODO: 실제 이메일 발송 구현
    // 옵션 1: Resend (https://resend.com)
    // 옵션 2: SendGrid (https://sendgrid.com)
    // 옵션 3: Nodemailer with SMTP

    // 예시 구현 (Resend 사용 시):
    // const resend = new Resend(process.env.RESEND_API_KEY);
    // await resend.emails.send({
    //   from: 'haccp@yourdomain.com',
    //   to: email,
    //   subject: `HACCP 일일종합보고서 - ${date}`,
    //   html: `<h1>일일종합보고서</h1><p>날짜: ${date}</p>...`,
    //   attachments: signature ? [{
    //     filename: 'signature.png',
    //     content: signature.split(',')[1],
    //   }] : [],
    // });

    // 현재는 모의 응답 반환
    console.log('Email export request:', { date, email, verifier_name, hasSignature: !!signature });

    // 실제 구현 시 아래 주석 해제
    // return NextResponse.json({ success: true, message: '이메일이 발송되었습니다.' });

    return NextResponse.json({
      error: '이메일 서비스가 설정되지 않았습니다. 환경 변수를 확인해주세요.',
      setup_guide: `
        이메일 발송을 위해 다음 설정이 필요합니다:

        1. Resend 사용 시:
           - https://resend.com 에서 API 키 발급
           - RESEND_API_KEY 환경 변수 설정

        2. SendGrid 사용 시:
           - https://sendgrid.com 에서 API 키 발급
           - SENDGRID_API_KEY 환경 변수 설정
      `,
    }, { status: 501 });
  } catch (error) {
    console.error('Email export error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
