import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { generateShipmentNumber } from '@/lib/utils/lot-number';

export const dynamic = 'force-dynamic';

// GET /api/haccp/shipments
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const status = searchParams.get('status');

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await supabase
      .from('users')
      .select('company_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    let query = supabase
      .from('shipment_records')
      .select(`
        *,
        shipped_by_user:shipped_by (name),
        pre_shipment_checker:pre_shipment_checked_by (name)
      `)
      .eq('company_id', userProfile.company_id)
      .eq('shipment_date', date);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching shipments:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 아이템에 제품명 추가
    const shipments = data || [];
    for (const shipment of shipments) {
      if (shipment.items && Array.isArray(shipment.items)) {
        const productIds = shipment.items.map((item: { product_id: string }) => item.product_id).filter(Boolean);
        if (productIds.length > 0) {
          const { data: products } = await supabase
            .from('products')
            .select('id, name, code')
            .in('id', productIds);

          if (products) {
            const productMap = new Map(products.map(p => [p.id, p]));
            shipment.items = shipment.items.map((item: { product_id: string }) => ({
              ...item,
              product_name: productMap.get(item.product_id)?.name,
              product_code: productMap.get(item.product_id)?.code,
            }));
          }
        }
      }

      // 이름 필드 정리
      shipment.shipped_by_name = shipment.shipped_by_name || shipment.shipped_by_user?.name;
      shipment.pre_shipment_checked_by_name = shipment.pre_shipment_checked_by_name || shipment.pre_shipment_checker?.name;
    }

    return NextResponse.json(shipments);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/haccp/shipments
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const body = await request.json();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await supabase
      .from('users')
      .select('id, name, company_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 출하번호 자동생성
    const autoShipmentNumber = body.shipment_number || await generateShipmentNumber(supabase, userProfile.company_id);

    const insertData = {
      company_id: userProfile.company_id,
      shipped_by: userProfile.id,
      shipped_by_name: userProfile.name,
      status: body.status || 'PENDING',
      pre_shipment_check: false,
      ...body,
      shipment_number: autoShipmentNumber,
    };

    const { data, error } = await supabase
      .from('shipment_records')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Error creating shipment:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/haccp/shipments
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const body = await request.json();
    const { id, action, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await supabase
      .from('users')
      .select('id, name, company_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 특수 액션 처리
    if (action === 'pre_shipment_check') {
      // 출하 전 검사 수행
      const checks = [
        updateData.product_condition_check,
        updateData.packaging_condition_check,
        updateData.quantity_check,
        updateData.label_check,
        updateData.vehicle_cleanliness_check,
        updateData.vehicle_temp_check,
      ].filter(v => v !== undefined);

      const allPassed = checks.every(Boolean);

      updateData.pre_shipment_check = allPassed;
      updateData.pre_shipment_checked_by = userProfile.id;
      updateData.pre_shipment_checked_by_name = userProfile.name;
      updateData.pre_shipment_checked_at = new Date().toISOString();

      // 온도 체크 여부에 따라 온도 기록
      if (updateData.vehicle_temp_check && updateData.departure_temp !== undefined) {
        updateData.vehicle_temp = updateData.departure_temp;
      }
    }

    if (action === 'ship') {
      // 출하 처리
      updateData.status = 'SHIPPED';
      if (!updateData.shipment_time) {
        updateData.shipment_time = new Date().toTimeString().split(' ')[0];
      }
    }

    if (action === 'deliver') {
      // 배송완료 처리
      updateData.status = 'DELIVERED';
      updateData.actual_arrival_time = new Date().toISOString();
    }

    if (action === 'receive') {
      // 수령 확인
      updateData.received_at = new Date().toISOString();
      if (!updateData.received_by) {
        updateData.received_by = body.received_by || 'Unknown';
      }
    }

    if (action === 'cancel') {
      updateData.status = 'CANCELLED';
    }

    const { data, error } = await supabase
      .from('shipment_records')
      .update(updateData)
      .eq('id', id)
      .eq('company_id', userProfile.company_id)
      .select()
      .single();

    if (error) {
      console.error('Error updating shipment:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
