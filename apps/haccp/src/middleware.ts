import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// HACCP 접근 가능 역할 (매장 관련 모든 역할)
const HACCP_ALLOWED_ROLES = ['super_admin', 'company_admin', 'manager', 'store_manager', 'team_leader', 'staff'];

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Protect all routes except auth routes
  if (!request.nextUrl.pathname.startsWith('/auth')) {
    if (!user) {
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }

    // 사용자 역할 및 매장 정보 확인
    const { data: userData } = await supabase
      .from('users')
      .select('role, store_id')
      .eq('auth_id', user.id)
      .single();

    // 사용자 정보가 없거나 역할이 허용되지 않으면 로그아웃
    if (!userData || !HACCP_ALLOWED_ROLES.includes(userData.role)) {
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }

    // super_admin, company_admin이 아닌 경우 매장 배정 필요
    if (!['super_admin', 'company_admin'].includes(userData.role) && !userData.store_id) {
      // 매장이 배정되지 않은 직원은 접근 불가
      return NextResponse.redirect(new URL('/auth/login?error=no_store', request.url));
    }
  }

  // Redirect authenticated users from auth pages to dashboard
  if (request.nextUrl.pathname.startsWith('/auth') && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
