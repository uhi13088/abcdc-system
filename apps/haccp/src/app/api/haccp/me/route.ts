/**
 * 현재 로그인 사용자 정보 API
 * GET /api/haccp/me - 현재 사용자 정보 조회
 */

import { NextResponse } from 'next/server';
import { createClient as createServerClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile, error } = await adminClient
      .from('users')
      .select('id, name, email, role, company_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (error) {
      // 컬럼 에러인 경우 기본 필드만 조회
      if (error.message?.includes('column') || error.code === '42703') {
        const { data: fallback } = await adminClient
          .from('users')
          .select('id, name, email, role, company_id')
          .eq('auth_id', userData.user.id)
          .single();
        if (fallback) {
          return NextResponse.json(fallback);
        }
      }
      console.error('Error fetching user profile:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!userProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(userProfile);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
