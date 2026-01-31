import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export interface StoreInfo {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  business_number: string | null;
  haccp_certification_number: string | null;
}

// GET /api/haccp/stores - 같은 회사의 매장 목록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await adminClient
      .from('users')
      .select('company_id, store_id, role')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 권한 확인 (company_admin, manager만 전체 매장 조회 가능)
    const canViewAllStores = ['super_admin', 'company_admin', 'manager'].includes(userProfile.role);

    const searchParams = request.nextUrl.searchParams;
    const excludeCurrentStore = searchParams.get('exclude_current') === 'true';

    let query = adminClient
      .from('stores')
      .select('id, name, address, phone, business_number, haccp_certification_number')
      .eq('company_id', userProfile.company_id)
      .order('name', { ascending: true });

    // 권한이 없으면 본인 매장만
    if (!canViewAllStores && userProfile.store_id) {
      query = query.eq('id', userProfile.store_id);
    }

    // 현재 매장 제외 옵션
    if (excludeCurrentStore && userProfile.store_id) {
      query = query.neq('id', userProfile.store_id);
    }

    const { data: stores, error } = await query;

    if (error) {
      console.error('Error fetching stores:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      stores: stores || [],
      currentStoreId: userProfile.store_id,
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
