import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const { searchParams } = new URL(request.url);
  const ccpId = searchParams.get('ccp_id');
  const date = searchParams.get('date');

  try {
    let query = supabase
      .from('ccp_records')
      .select(`
        *,
        ccp_definitions (id, ccp_number, process, critical_limit),
        recorder:users!ccp_records_recorded_by_fkey (name),
        verifier:users!ccp_records_verified_by_fkey (name)
      `)
      .order('record_date', { ascending: false })
      .order('record_time', { ascending: false });

    if (ccpId) {
      query = query.eq('ccp_id', ccpId);
    }

    if (date) {
      query = query.eq('record_date', date);
    }

    const { data, error } = await query.limit(100);

    if (error) {
      console.error('Error fetching CCP records:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error in GET /api/haccp/ccp/records:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();

  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's company_id
    const { data: profile } = await supabase
      .from('users')
      .select('id, company_id')
      .eq('auth_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('ccp_records')
      .insert({
        company_id: profile.company_id,
        ccp_id: body.ccp_id,
        record_date: body.record_date,
        record_time: body.record_time,
        recorded_by: profile.id,
        lot_number: body.lot_number || null,
        product_id: body.product_id || null,
        measurement: body.measurement,
        is_within_limit: body.is_within_limit,
        deviation_action: body.deviation_action || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating CCP record:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in POST /api/haccp/ccp/records:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
