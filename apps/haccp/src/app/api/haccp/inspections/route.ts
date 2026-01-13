import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

// GET /api/haccp/inspections
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

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
      .from('material_inspections')
      .select(`
        *,
        materials:material_id (name, code),
        suppliers:supplier_id (name),
        inspected_by_user:inspected_by (name)
      `)
      .eq('company_id', userProfile.company_id)
      .eq('inspection_date', date)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching inspections:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const result = (data || []).map((i: any) => ({
      ...i,
      material_name: i.materials?.name,
      material_code: i.materials?.code,
      supplier_name: i.suppliers?.name,
      inspected_by_name: i.inspected_by_user?.name,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/haccp/inspections
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
      .from('material_inspections')
      .insert({
        company_id: userProfile.company_id,
        inspected_by: userProfile.id,
        ...body,
        supplier_id: body.supplier_id || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating inspection:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
