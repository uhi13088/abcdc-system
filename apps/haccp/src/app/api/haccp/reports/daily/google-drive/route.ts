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
    const { date, file_name, verifier_name, signature } = body;

    if (!file_name) {
      return NextResponse.json({ error: '파일명이 필요합니다.' }, { status: 400 });
    }

    // TODO: 실제 Google Drive 연동 구현
    // 1. Google Cloud Console에서 프로젝트 생성
    // 2. Google Drive API 활성화
    // 3. OAuth 2.0 클라이언트 ID 생성
    // 4. 환경 변수 설정:
    //    - GOOGLE_CLIENT_ID
    //    - GOOGLE_CLIENT_SECRET
    //    - GOOGLE_REDIRECT_URI

    // 예시 구현 (googleapis 라이브러리 사용 시):
    // const { google } = require('googleapis');
    // const oauth2Client = new google.auth.OAuth2(
    //   process.env.GOOGLE_CLIENT_ID,
    //   process.env.GOOGLE_CLIENT_SECRET,
    //   process.env.GOOGLE_REDIRECT_URI
    // );
    //
    // // 사용자의 refresh token으로 access token 획득
    // oauth2Client.setCredentials({ refresh_token: userRefreshToken });
    //
    // const drive = google.drive({ version: 'v3', auth: oauth2Client });
    //
    // // PDF 생성 후 업로드
    // const fileMetadata = {
    //   name: file_name,
    //   mimeType: 'application/pdf',
    //   parents: [folderId], // 사용자가 선택한 폴더
    // };
    //
    // const media = {
    //   mimeType: 'application/pdf',
    //   body: pdfBuffer,
    // };
    //
    // const response = await drive.files.create({
    //   resource: fileMetadata,
    //   media: media,
    //   fields: 'id, webViewLink',
    // });

    // 현재는 모의 응답 반환
    console.log('Google Drive export request:', { date, file_name, verifier_name, hasSignature: !!signature });

    return NextResponse.json({
      error: 'Google Drive 연동이 설정되지 않았습니다. 환경 변수를 확인해주세요.',
      setup_guide: `
        Google Drive 연동을 위해 다음 설정이 필요합니다:

        1. Google Cloud Console 설정:
           - https://console.cloud.google.com 에서 프로젝트 생성
           - Google Drive API 활성화
           - OAuth 2.0 클라이언트 ID 생성 (웹 애플리케이션)

        2. 환경 변수 설정:
           - GOOGLE_CLIENT_ID: OAuth 클라이언트 ID
           - GOOGLE_CLIENT_SECRET: OAuth 클라이언트 시크릿
           - GOOGLE_REDIRECT_URI: 리다이렉트 URI

        3. 사용자 인증 플로우:
           - /api/auth/google/authorize 에서 사용자 인증
           - refresh_token을 사용자 설정에 저장
           - 이후 자동으로 access_token 갱신

        대안으로 이메일 내보내기를 사용할 수 있습니다.
      `,
    }, { status: 501 });
  } catch (error) {
    console.error('Google Drive export error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Google OAuth 인증 URL 생성
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // TODO: 실제 구현 시 아래 주석 해제
    // const { google } = require('googleapis');
    // const oauth2Client = new google.auth.OAuth2(
    //   process.env.GOOGLE_CLIENT_ID,
    //   process.env.GOOGLE_CLIENT_SECRET,
    //   process.env.GOOGLE_REDIRECT_URI
    // );
    //
    // const authUrl = oauth2Client.generateAuthUrl({
    //   access_type: 'offline',
    //   scope: [
    //     'https://www.googleapis.com/auth/drive.file',
    //     'https://www.googleapis.com/auth/drive.metadata.readonly',
    //   ],
    //   prompt: 'consent',
    // });
    //
    // return NextResponse.json({ auth_url: authUrl });

    return NextResponse.json({
      error: 'Google Drive 연동이 설정되지 않았습니다.',
      message: '관리자에게 문의하여 Google Drive API를 설정해주세요.',
    }, { status: 501 });
  } catch (error) {
    console.error('Google Drive auth error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
