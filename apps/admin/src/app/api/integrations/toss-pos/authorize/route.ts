import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * 토스 POS OAuth 인증 시작
 * GET /api/integrations/toss-pos/authorize
 *
 * 사용자를 토스 로그인 페이지로 리다이렉트합니다.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 로그인 확인
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }

    // 토스 OAuth 설정
    const clientId = process.env.TOSS_CLIENT_ID;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin}/api/integrations/toss-pos/callback`;

    // 토스 OAuth가 아직 설정되지 않은 경우
    if (!clientId) {
      // 데모 모드: 바로 연결된 것처럼 처리
      const { data: userData } = await supabase
        .from('users')
        .select('company_id')
        .eq('auth_id', user.id)
        .single();

      if (userData?.company_id) {
        // 연동 정보 저장 (데모)
        await supabase.from('integrations').upsert({
          company_id: userData.company_id,
          provider: 'toss_pos',
          enabled: true,
          connected: true,
          connected_at: new Date().toISOString(),
          settings: { demo_mode: true },
        }, { onConflict: 'company_id,provider' });
      }

      // 설정 페이지로 리다이렉트 (성공 메시지와 함께)
      return NextResponse.redirect(
        new URL('/settings?tab=integrations&toss=connected', request.url)
      );
    }

    // State 생성 (CSRF 방지)
    const state = crypto.randomUUID();

    // State를 세션에 저장
    await supabase.from('oauth_states').insert({
      state,
      user_id: user.id,
      provider: 'toss_pos',
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10분
    });

    // 토스 OAuth URL 생성
    const tossAuthUrl = new URL('https://auth.tosspayments.com/oauth/authorize');
    tossAuthUrl.searchParams.set('client_id', clientId);
    tossAuthUrl.searchParams.set('redirect_uri', redirectUri);
    tossAuthUrl.searchParams.set('response_type', 'code');
    tossAuthUrl.searchParams.set('scope', 'pos:read');
    tossAuthUrl.searchParams.set('state', state);

    return NextResponse.redirect(tossAuthUrl.toString());
  } catch (error) {
    console.error('Toss POS authorize error:', error);
    return NextResponse.redirect(
      new URL('/settings?tab=integrations&error=authorize_failed', request.url)
    );
  }
}
