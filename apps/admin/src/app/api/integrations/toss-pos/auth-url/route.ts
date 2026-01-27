import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

// POST /api/integrations/toss-pos/auth-url - Toss POS OAuth 인증 URL 생성
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const _body = await request.json();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await supabase
      .from('users')
      .select('company_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const clientId = process.env.TOSS_POS_CLIENT_ID;
    const redirectUri = process.env.TOSS_POS_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/toss-pos/callback`;

    if (!clientId) {
      return NextResponse.json({
        error: 'Toss POS 연동이 설정되지 않았습니다.',
        message: 'TOSS_POS_CLIENT_ID 환경변수가 필요합니다.',
      }, { status: 500 });
    }

    // Generate state token for security
    const state = crypto.randomUUID();

    // Store state temporarily for validation in oauth_states table
    // State expires in 10 minutes
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await supabase
      .from('oauth_states')
      .insert({
        state,
        user_id: userData.user.id,
        provider: 'toss_pos',
        expires_at: expiresAt,
      });

    // Construct OAuth authorization URL
    const authUrl = new URL('https://api.tosspayments.com/v1/oauth/authorize');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'pos.read pos.sales.read');
    authUrl.searchParams.set('state', state);

    return NextResponse.json({
      success: true,
      authUrl: authUrl.toString(),
      state,
    });
  } catch (error) {
    console.error('Toss POS auth URL error:', error);
    return NextResponse.json({ error: 'Failed to generate auth URL' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
