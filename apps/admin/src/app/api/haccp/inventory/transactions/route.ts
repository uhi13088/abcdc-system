import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

// GET /api/haccp/inventory/transactions
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();

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

    const { data, error } = await supabase
      .from('material_transactions')
      .select(`
        *,
        materials:material_id (name, code),
        recorded_by_user:recorded_by (name)
      `)
      .eq('company_id', userProfile.company_id)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching transactions:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

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
    const supabase = createServerClient();
    const body = await request.json();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await supabase
      .from('users')
      .select('id, company_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Create transaction
    const { data: txData, error: txError } = await supabase
      .from('material_transactions')
      .insert({
        company_id: userProfile.company_id,
        recorded_by: userProfile.id,
        ...body,
        production_lot: body.production_lot || null,
      })
      .select()
      .single();

    if (txError) {
      console.error('Error creating transaction:', txError);
      return NextResponse.json({ error: txError.message }, { status: 500 });
    }

    // Update or create stock
    if (body.transaction_type === 'IN') {
      // Check if stock exists
      const { data: existingStock } = await supabase
        .from('material_stocks')
        .select('id, quantity')
        .eq('company_id', userProfile.company_id)
        .eq('material_id', body.material_id)
        .eq('lot_number', body.lot_number)
        .single();

      if (existingStock) {
        // Update existing stock
        await supabase
          .from('material_stocks')
          .update({
            quantity: existingStock.quantity + body.quantity,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingStock.id);
      } else {
        // Create new stock
        await supabase
          .from('material_stocks')
          .insert({
            company_id: userProfile.company_id,
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
      // Deduct from stock
      const { data: existingStock } = await supabase
        .from('material_stocks')
        .select('id, quantity')
        .eq('company_id', userProfile.company_id)
        .eq('material_id', body.material_id)
        .eq('lot_number', body.lot_number)
        .single();

      if (existingStock) {
        const newQuantity = existingStock.quantity - body.quantity;
        if (newQuantity <= 0) {
          await supabase
            .from('material_stocks')
            .update({
              quantity: 0,
              status: 'DISPOSED',
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingStock.id);
        } else {
          await supabase
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
