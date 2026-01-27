import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // OAuth 에러 처리
  if (error) {
    console.error('OAuth error:', error, errorDescription);
    return NextResponse.redirect(
      `${origin}/auth/login?error=${encodeURIComponent(errorDescription || error)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login?error=인증 코드가 없습니다`);
  }

  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    // 인증 코드를 세션으로 교환
    const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error('Exchange error:', exchangeError);
      return NextResponse.redirect(
        `${origin}/auth/login?error=${encodeURIComponent('인증에 실패했습니다')}`
      );
    }

    const user = sessionData?.user;
    if (!user) {
      return NextResponse.redirect(`${origin}/auth/login?error=사용자 정보를 가져올 수 없습니다`);
    }

    // 기존 사용자 프로필 확인
    let { data: userProfile } = await adminClient
      .from('users')
      .select('id, company_id, store_id, haccp_access, role')
      .eq('auth_id', user.id)
      .single();

    // 새 사용자인 경우 프로필 생성
    if (!userProfile) {
      // OAuth 프로바이더 정보 추출
      const provider = user.app_metadata?.provider || 'unknown';
      const providerData = user.user_metadata || {};

      const name = providerData.full_name ||
                   providerData.name ||
                   providerData.nickname ||
                   providerData.preferred_username ||
                   user.email?.split('@')[0] ||
                   '사용자';

      const avatarUrl = providerData.avatar_url ||
                        providerData.picture ||
                        providerData.profile_image ||
                        null;

      // 새 회사 생성
      const { data: newCompany } = await adminClient
        .from('companies')
        .insert({
          name: `${name}의 회사`,
          status: 'ACTIVE',
        })
        .select()
        .single();

      // 사용자 프로필 생성
      const { data: newProfile } = await adminClient
        .from('users')
        .insert({
          auth_id: user.id,
          email: user.email,
          name: name,
          phone: providerData.phone_number || null,
          role: 'company_admin',
          company_id: newCompany?.id || null,
          avatar_url: avatarUrl,
          oauth_provider: provider,
          status: 'ACTIVE',
          haccp_access: true,  // 신규 OAuth 사용자에게 HACCP 접근 권한 부여
        })
        .select()
        .single();

      // 회사가 생성된 경우 무료 구독 생성 (HACCP 애드온 활성화)
      if (newCompany) {
        const { data: freePlan } = await adminClient
          .from('subscription_plans')
          .select('id')
          .eq('name', 'FREE')
          .single();

        if (freePlan) {
          await adminClient
            .from('company_subscriptions')
            .insert({
              company_id: newCompany.id,
              plan_id: freePlan.id,
              status: 'ACTIVE',
              started_at: new Date().toISOString(),
              haccp_addon_enabled: true,  // HACCP 앱이므로 기본 활성화
            });
        }
      }

      userProfile = newProfile;
    }

    // HACCP 권한 확인
    if (userProfile) {
      // 회사 HACCP 애드온 확인
      const { data: subscription } = await adminClient
        .from('company_subscriptions')
        .select('haccp_addon_enabled')
        .eq('company_id', userProfile.company_id)
        .maybeSingle();

      if (!subscription?.haccp_addon_enabled) {
        return NextResponse.redirect(
          `${origin}/auth/login?error=${encodeURIComponent('HACCP 애드온이 활성화되지 않았습니다. 관리자에게 문의하세요.')}`
        );
      }

      // 권한 확인
      const isAdmin = ['super_admin', 'company_admin', 'manager'].includes(userProfile.role);

      let hasStoreAccess = false;
      if (userProfile.store_id) {
        const { data: storeData } = await adminClient
          .from('stores')
          .select('haccp_enabled')
          .eq('id', userProfile.store_id)
          .single();
        hasStoreAccess = storeData?.haccp_enabled || false;
      }

      if (!isAdmin && !hasStoreAccess && !userProfile.haccp_access) {
        return NextResponse.redirect(
          `${origin}/auth/login?error=${encodeURIComponent('HACCP 앱 접근 권한이 없습니다.')}`
        );
      }
    }

    // 로그인 성공 - 대시보드로 리다이렉트
    return NextResponse.redirect(`${origin}${next}`);
  } catch (err) {
    console.error('Callback error:', err);
    return NextResponse.redirect(
      `${origin}/auth/login?error=${encodeURIComponent('로그인 처리 중 오류가 발생했습니다')}`
    );
  }
}
