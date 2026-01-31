import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/haccp/inventory/transactions
export async function GET(_request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await adminClient
      .from('users')
      .select('company_id, store_id, current_store_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 현재 선택된 매장
    const currentStoreId = userProfile.current_store_id || userProfile.store_id;

    let query = adminClient
      .from('material_transactions')
      .select(`
        *,
        materials:material_id (name, code),
        recorded_by_user:recorded_by (name)
      `)
      .eq('company_id', userProfile.company_id);

    // store_id 필터링
    if (currentStoreId) {
      query = query.eq('store_id', currentStoreId);
    }

    const { data, error } = await query
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      // 테이블이 없으면 빈 배열 반환
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json([]);
      }
      console.error('Error fetching transactions:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (data || []).map((t: any) => ({
      ...t,
      material_name: t.materials?.name,
      material_code: t.materials?.code,
      recorded_by_name: t.recorded_by_user?.name,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/haccp/inventory/transactions
export async function POST(request: NextRequest) {
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
      .select('id, company_id, store_id, current_store_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 현재 선택된 매장
    const currentStoreId = userProfile.current_store_id || userProfile.store_id;

    // Create transaction
    const { data: txData, error: txError } = await adminClient
      .from('material_transactions')
      .insert({
        company_id: userProfile.company_id,
        store_id: currentStoreId || null,
        recorded_by: userProfile.id,
        ...body,
        production_lot: body.production_lot || null,
      })
      .select()
      .single();

    if (txError) {
      // 테이블이 없으면 null 반환
      if (txError.code === '42P01' || txError.message?.includes('does not exist')) {
        return NextResponse.json(null);
      }
      console.error('Error creating transaction:', txError);
      return NextResponse.json({ error: txError.message }, { status: 500 });
    }

    // Update or create stock
    if (body.transaction_type === 'IN') {
      // Check if stock exists (store_id 필터링 추가)
      let stockQuery = adminClient
        .from('material_stocks')
        .select('id, quantity')
        .eq('company_id', userProfile.company_id)
        .eq('material_id', body.material_id)
        .eq('lot_number', body.lot_number);

      if (currentStoreId) {
        stockQuery = stockQuery.eq('store_id', currentStoreId);
      }

      const { data: existingStock } = await stockQuery.single();

      if (existingStock) {
        // Update existing stock
        await adminClient
          .from('material_stocks')
          .update({
            quantity: existingStock.quantity + body.quantity,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingStock.id);
      } else {
        // Create new stock (store_id 포함)
        await adminClient
          .from('material_stocks')
          .insert({
            company_id: userProfile.company_id,
            store_id: currentStoreId || null,
            material_id: body.material_id,
            lot_number: body.lot_number,
            quantity: body.quantity,
            unit: body.unit,
            received_date: body.transaction_date,
            expiry_date: body.expiry_date || null,
            location: body.location || null,
            status: 'AVAILABLE',
          });
      }
    } else if (body.transaction_type === 'OUT') {
      // Deduct from stock (store_id 필터링 추가)
      let stockQuery = adminClient
        .from('material_stocks')
        .select('id, quantity')
        .eq('company_id', userProfile.company_id)
        .eq('material_id', body.material_id)
        .eq('lot_number', body.lot_number);

      if (currentStoreId) {
        stockQuery = stockQuery.eq('store_id', currentStoreId);
      }

      const { data: existingStock } = await stockQuery.single();

      if (existingStock) {
        const newQuantity = existingStock.quantity - body.quantity;
        if (newQuantity <= 0) {
          await adminClient
            .from('material_stocks')
            .update({
              quantity: 0,
              status: 'DISPOSED',
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingStock.id);
        } else {
          await adminClient
            .from('material_stocks')
            .update({
              quantity: newQuantity,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingStock.id);
        }
      }
    }

    return NextResponse.json(txData, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/haccp/inventory/transactions
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await adminClient
      .from('users')
      .select('id, company_id, store_id, current_store_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 현재 선택된 매장
    const currentStoreId = userProfile.current_store_id || userProfile.store_id;

    // 기록 존재 여부 확인 (롤백용 정보 포함, store_id 필터링 추가)
    let existingQuery = adminClient
      .from('material_transactions')
      .select('id, material_id, lot_number, quantity, transaction_type')
      .eq('id', id)
      .eq('company_id', userProfile.company_id);

    if (currentStoreId) {
      existingQuery = existingQuery.eq('store_id', currentStoreId);
    }

    const { data: existing } = await existingQuery.single();

    if (!existing) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    // 재고 롤백 처리 (store_id 필터링 추가)
    let stockQuery = adminClient
      .from('material_stocks')
      .select('id, quantity')
      .eq('company_id', userProfile.company_id)
      .eq('material_id', existing.material_id)
      .eq('lot_number', existing.lot_number);

    if (currentStoreId) {
      stockQuery = stockQuery.eq('store_id', currentStoreId);
    }

    const { data: stock } = await stockQuery.single();

    if (stock) {
      let newQuantity = stock.quantity;
      // 입고 취소 -> 재고 감소
      if (existing.transaction_type === 'IN') {
        newQuantity = Math.max(0, stock.quantity - existing.quantity);
      }
      // 출고 취소 -> 재고 증가
      else if (existing.transaction_type === 'OUT' || existing.transaction_type === 'DISPOSE') {
        newQuantity = stock.quantity + existing.quantity;
      }

      await adminClient
        .from('material_stocks')
        .update({
          quantity: newQuantity,
          status: newQuantity > 0 ? 'AVAILABLE' : 'DISPOSED',
          updated_at: new Date().toISOString(),
        })
        .eq('id', stock.id);
    }

    // 트랜잭션 삭제 (store_id 필터링 추가)
    let deleteQuery = adminClient
      .from('material_transactions')
      .delete()
      .eq('id', id)
      .eq('company_id', userProfile.company_id);

    if (currentStoreId) {
      deleteQuery = deleteQuery.eq('store_id', currentStoreId);
    }

    const { error } = await deleteQuery;

    if (error) {
      console.error('Error deleting transaction:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '재고 트랜잭션이 삭제되었습니다.' });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
