import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/haccp/company - 매장 HACCP 정보 조회 (송장/서류용)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's company_id and store_id
    const { data: userData } = await adminClient
      .from('users')
      .select('company_id, store_id, role')
      .eq('auth_id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // store_id를 쿼리 파라미터에서 가져오거나, 사용자의 store_id 사용
    const url = new URL(request.url);
    const storeIdParam = url.searchParams.get('store_id');
    const storeId = storeIdParam || userData.store_id;

    if (!storeId) {
      return NextResponse.json({ error: 'Store not specified' }, { status: 400 });
    }

    // Get store details (매장별 HACCP 정보)
    const { data: store, error: storeError } = await adminClient
      .from('stores')
      .select('id, name, address, address_detail, phone, fax, email, business_number, representative, haccp_certification_number, haccp_certification_date, haccp_certification_expiry, company_id')
      .eq('id', storeId)
      .single();

    if (storeError) {
      console.error('Error fetching store:', storeError);
      return NextResponse.json({ error: storeError.message }, { status: 500 });
    }

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    // 보안: 요청한 store가 사용자의 company에 속하는지 확인
    if (store.company_id !== userData.company_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Map to expected format for invoice (매장별 정보)
    return NextResponse.json({
      store_id: store.id,
      name: store.name,
      business_number: store.business_number || null,
      representative: store.representative || null,
      address: store.address,
      address_detail: store.address_detail || null,
      phone: store.phone,
      fax: store.fax || null,
      email: store.email || null,
      haccp_certification_number: store.haccp_certification_number || null,
      haccp_certification_date: store.haccp_certification_date || null,
      haccp_certification_expiry: store.haccp_certification_expiry || null,
    });
  } catch (error) {
    console.error('Error in company API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
