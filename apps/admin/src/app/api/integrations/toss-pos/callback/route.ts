import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * 토스 POS OAuth 콜백
 * GET /api/integrations/toss-pos/callback
 *
 * 토스에서 인증 후 리다이렉트되는 콜백입니다.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const { searchParams } = request.nextUrl;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // 에러 처리
    if (error) {
      return NextResponse.redirect(
        new URL(`/settings?tab=integrations&error=${error}`, request.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/settings?tab=integrations&error=invalid_callback', request.url)
      );
    }

    // 로그인 확인
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }

    // State 검증
    const { data: oauthState } = await adminClient
      .from('oauth_states')
      .select('*')
      .eq('state', state)
      .eq('user_id', user.id)
      .eq('provider', 'toss_pos')
      .gt('expires_at', new Date().toISOString())
      .single();

    if (!oauthState) {
      return NextResponse.redirect(
        new URL('/settings?tab=integrations&error=invalid_state', request.url)
      );
    }

    // State 삭제
    await adminClient.from('oauth_states').delete().eq('id', oauthState.id);

    // 토스 OAuth 토큰 교환
    const clientId = process.env.TOSS_POS_CLIENT_ID;
    const clientSecret = process.env.TOSS_POS_CLIENT_SECRET;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin}/api/integrations/toss-pos/callback`;

    const tokenResponse = await fetch('https://auth.tosspayments.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Toss token exchange error:', errorData);
      return NextResponse.redirect(
        new URL('/settings?tab=integrations&error=token_exchange_failed', request.url)
      );
    }

    const tokenData = await tokenResponse.json();

    // 사용자 회사 정보 조회
    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.redirect(
        new URL('/settings?tab=integrations&error=no_company', request.url)
      );
    }

    // 연동 정보 저장
    await adminClient.from('integrations').upsert({
      company_id: userData.company_id,
      provider: 'toss_pos',
      enabled: true,
      connected: true,
      connected_at: new Date().toISOString(),
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
      settings: {
        scope: tokenData.scope,
      },
    }, { onConflict: 'company_id,provider' });

    // 성공! 설정 페이지로 리다이렉트
    return NextResponse.redirect(
      new URL('/settings?tab=integrations&toss=connected', request.url)
    );
  } catch (error) {
    console.error('Toss POS callback error:', error);
    return NextResponse.redirect(
      new URL('/settings?tab=integrations&error=callback_failed', request.url)
    );
  }
}
