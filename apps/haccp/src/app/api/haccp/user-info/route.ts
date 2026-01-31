/**
 * HACCP 유저 정보 API
 * GET /api/haccp/user-info - 현재 로그인한 유저 정보 조회
 * @version 1.0.1
 */

import { NextResponse } from 'next/server';
import { createClient as createServerClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await adminClient
      .from('users')
      .select(`
        name,
        role,
        company_id,
        store_id,
        current_store_id,
        current_haccp_store_id,
        company:companies(name),
        store:stores(name)
      `)
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 현재 선택된 매장 정보 가져오기
    const currentStoreId = userProfile.current_haccp_store_id || userProfile.current_store_id || userProfile.store_id;
    let currentStoreName = null;

    if (currentStoreId && currentStoreId !== userProfile.store_id) {
      const { data: storeData } = await adminClient
        .from('stores')
        .select('name')
        .eq('id', currentStoreId)
        .single();
      currentStoreName = storeData?.name;
    } else if (userProfile.store) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const storeData = userProfile.store as any;
      currentStoreName = storeData?.name || null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const companyData = userProfile.company as any;

    return NextResponse.json({
      name: userProfile.name,
      role: userProfile.role,
      companyName: companyData?.name || null,
      storeName: currentStoreName,
    });
  } catch (error) {
    console.error('Error fetching user info:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
