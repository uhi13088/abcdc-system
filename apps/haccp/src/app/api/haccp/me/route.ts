/**
 * 현재 로그인 사용자 정보 API
 * GET /api/haccp/me - 현재 사용자 정보 조회 (매장 정보 포함)
 * PUT /api/haccp/me - 현재 매장 변경
 */

import { NextRequest, NextResponse } from 'next/server';
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

    // 사용자 정보 조회 (store_id, current_store_id 포함)
    const { data: userProfile, error } = await adminClient
      .from('users')
      .select('id, name, email, role, company_id, store_id, current_store_id')
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

    // HACCP 활성화된 매장 목록 조회
    const { data: stores } = await adminClient
      .from('stores')
      .select('id, name, haccp_factory_name, is_haccp_enabled')
      .eq('company_id', userProfile.company_id)
      .eq('is_haccp_enabled', true)
      .order('name');

    // 현재 선택된 매장 정보
    let currentStore = null;
    const effectiveStoreId = userProfile.current_store_id || userProfile.store_id;
    if (effectiveStoreId) {
      const { data: store } = await adminClient
        .from('stores')
        .select('id, name, haccp_factory_name')
        .eq('id', effectiveStoreId)
        .single();
      currentStore = store;
    }

    return NextResponse.json({
      ...userProfile,
      current_store: currentStore,
      available_stores: stores || [],
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - 현재 매장 변경
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();
    const body = await request.json();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await adminClient
      .from('users')
      .select('id, company_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 매장이 해당 회사의 HACCP 매장인지 확인
    if (body.current_store_id) {
      const { data: store } = await adminClient
        .from('stores')
        .select('id')
        .eq('id', body.current_store_id)
        .eq('company_id', userProfile.company_id)
        .eq('is_haccp_enabled', true)
        .single();

      if (!store) {
        return NextResponse.json({ error: 'Invalid store' }, { status: 400 });
      }
    }

    // 현재 매장 업데이트
    const { error } = await adminClient
      .from('users')
      .update({ current_store_id: body.current_store_id || null })
      .eq('id', userProfile.id);

    if (error) {
      console.error('Error updating current store:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
