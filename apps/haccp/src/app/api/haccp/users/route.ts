/**
 * HACCP 사용자 목록 API
 * GET /api/haccp/users - 같은 매장의 사용자 목록 조회 (매장별)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/haccp/users
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('activeOnly') !== 'false';
    const role = searchParams.get('role');
    const storeIdParam = searchParams.get('store_id');

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await adminClient
      .from('users')
      .select('company_id, store_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // store_id를 쿼리 파라미터에서 가져오거나, 사용자의 store_id 사용
    const storeId = storeIdParam || userProfile.store_id;

    if (!storeId) {
      return NextResponse.json({ error: 'Store not specified' }, { status: 400 });
    }

    // 보안: store가 사용자의 company에 속하는지 확인
    const { data: store } = await adminClient
      .from('stores')
      .select('id, company_id')
      .eq('id', storeId)
      .single();

    if (!store || store.company_id !== userProfile.company_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    let query = adminClient
      .from('users')
      .select('id, name, email, role, is_active')
      .eq('company_id', userProfile.company_id)
      .eq('store_id', storeId)
      .order('name', { ascending: true });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    if (role) {
      query = query.eq('role', role);
    }

    const { data, error } = await query;

    if (error) {
      // 테이블이 없으면 빈 배열 반환
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json([]);
      }
      console.error('Error fetching users:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
