/**
 * HACCP 반품/회수/폐기 관리 API
 * GET /api/haccp/returns-disposals - 기록 조회
 * POST /api/haccp/returns-disposals - 기록 생성
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// 관리번호 생성 (RD-YYYYMMDD-XXX)
function generateRecordNumber(): string {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `RD-${dateStr}-${random}`;
}

// GET /api/haccp/returns-disposals
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const recordType = searchParams.get('type');
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
      .from('returns_disposals')
      .select(`
        *,
        product:product_id (name, code),
        material:material_id (name, code),
        recorded_by_user:recorded_by (name),
        approved_by_user:approved_by (name)
      `)
      .eq('company_id', userProfile.company_id)
      .order('record_date', { ascending: false });

    if (startDate) {
      query = query.gte('record_date', startDate);
    }
    if (endDate) {
      query = query.lte('record_date', endDate);
    }
    if (recordType) {
      query = query.eq('record_type', recordType);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching returns/disposals:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (data || []).map((record: any) => ({
      ...record,
      product_name: record.product?.name,
      product_code: record.product?.code,
      material_name: record.material?.name,
      material_code: record.material?.code,
      recorded_by_name: record.recorded_by_user?.name,
      approved_by_name: record.approved_by_user?.name,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/haccp/returns-disposals
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
      .select('id, company_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('returns_disposals')
      .insert({
        company_id: userProfile.company_id,
        recorded_by: userProfile.id,
        record_date: body.record_date || new Date().toISOString().split('T')[0],
        record_number: body.record_number || generateRecordNumber(),
        record_type: body.record_type,
        product_id: body.product_id,
        material_id: body.material_id,
        item_name: body.item_name,
        lot_number: body.lot_number,
        quantity: body.quantity,
        unit: body.unit,
        reason_category: body.reason_category,
        reason_detail: body.reason_detail,
        action_taken: body.action_taken,
        disposal_method: body.disposal_method,
        disposal_date: body.disposal_date,
        disposal_location: body.disposal_location,
        disposal_company: body.disposal_company,
        disposal_cost: body.disposal_cost,
        customer_name: body.customer_name,
        customer_contact: body.customer_contact,
        return_date: body.return_date,
        attachment_urls: body.attachment_urls || [],
        notes: body.notes,
        status: body.status || 'PENDING',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating returns/disposal record:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/haccp/returns-disposals
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerClient();
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

    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    // If approving
    if (updateData.approved) {
      updateData.approved_by = userProfile.id;
      updateData.approved_at = new Date().toISOString();
      delete updateData.approved;
    }

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('returns_disposals')
      .update(updateData)
      .eq('id', id)
      .eq('company_id', userProfile.company_id)
      .select()
      .single();

    if (error) {
      console.error('Error updating returns/disposal record:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
