import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/server';
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
    const { data: existingProfile } = await adminClient
      .from('users')
      .select('id, company_id')
      .eq('auth_id', user.id)
      .single();

    // 새 사용자인 경우 프로필 생성
    if (!existingProfile) {
      // OAuth 프로바이더 정보 추출
      const provider = user.app_metadata?.provider || 'unknown';
      const providerData = user.user_metadata || {};

      // 이름 추출 (Google: full_name 또는 name, Kakao: nickname 또는 name)
      const name = providerData.full_name ||
                   providerData.name ||
                   providerData.nickname ||
                   providerData.preferred_username ||
                   user.email?.split('@')[0] ||
                   '사용자';

      // 아바타 URL 추출
      const avatarUrl = providerData.avatar_url ||
                        providerData.picture ||
                        providerData.profile_image ||
                        null;

      // 새 회사 생성 (OAuth 사용자는 자동으로 새 회사 생성)
      const { data: newCompany, error: companyError } = await adminClient
        .from('companies')
        .insert({
          name: `${name}의 회사`,
          status: 'ACTIVE',
        })
        .select()
        .single();

      if (companyError) {
        console.error('Company creation error:', companyError);
        // 회사 생성 실패해도 계속 진행 (company_id null로)
      }

      // 사용자 프로필 생성
      const { error: profileError } = await adminClient
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
        });

      if (profileError) {
        console.error('Profile creation error:', profileError);
        // 프로필 생성 실패해도 계속 진행 (대시보드에서 추가 정보 입력 유도)
      }

      // 회사가 생성된 경우 무료 구독 생성
      if (newCompany) {
        // 무료 플랜 조회
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
            });
        }
      }

      // 새 사용자는 프로필 완성 페이지로 리다이렉트 (선택적)
      // return NextResponse.redirect(`${origin}/auth/complete-profile`);
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
