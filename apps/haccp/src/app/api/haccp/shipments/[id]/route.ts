import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// 단일 출하 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await adminClient
      .from('users')
      .select('company_id, store_id, current_store_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const currentStoreId = userData.current_store_id || userData.store_id;

    let query = adminClient
      .from('shipment_records')
      .select(`
        *,
        shipped_by_user:shipped_by (full_name)
      `)
      .eq('id', params.id)
      .eq('company_id', userData.company_id);

    if (currentStoreId) {
      query = query.eq('store_id', currentStoreId);
    }

    const { data, error } = await query.single();

    if (error) {
      console.error('Error fetching shipment:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Shipment not found' }, { status: 404 });
    }

    // 제품 정보 조회
    const productIds = (data.items || [])
      .map((item: { product_id: string }) => item.product_id)
      .filter(Boolean);

    let productMap: Record<string, { name: string; code: string }> = {};
    if (productIds.length > 0) {
      const { data: products } = await adminClient
        .from('products')
        .select('id, name, code')
        .in('id', productIds);

      if (products) {
        productMap = products.reduce((acc, p) => {
          acc[p.id] = { name: p.name, code: p.code };
          return acc;
        }, {} as Record<string, { name: string; code: string }>);
      }
    }

    // 아이템에 제품명 추가
    const itemsWithProducts = (data.items || []).map((item: { product_id: string; lot_number: string; quantity: number; unit: string }) => ({
      ...item,
      product_name: productMap[item.product_id]?.name || null,
      product_code: productMap[item.product_id]?.code || null,
    }));

    // 고객 정보 조회 (있는 경우)
    let customerInfo = {
      customer_business_number: null,
      customer_representative: null,
    };

    if (data.customer_name) {
      const { data: customer } = await adminClient
        .from('customers')
        .select('business_number, representative')
        .eq('company_id', userData.company_id)
        .eq('name', data.customer_name)
        .single();

      if (customer) {
        customerInfo = {
          customer_business_number: customer.business_number,
          customer_representative: customer.representative,
        };
      }
    }

    const result = {
      ...data,
      items: itemsWithProducts,
      shipped_by_name: data.shipped_by_user?.full_name || null,
      ...customerInfo,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
