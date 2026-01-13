import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

// GET /api/haccp/inventory/stocks
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();

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
      .from('material_stocks')
      .select(`
        *,
        materials:material_id (name, code, unit)
      `)
      .eq('company_id', userProfile.company_id)
      .neq('status', 'DISPOSED')
      .gt('quantity', 0)
      .order('expiry_date', { ascending: true });

    if (error) {
      console.error('Error fetching stocks:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const result = (data || []).map((s: any) => ({
      ...s,
      material_name: s.materials?.name,
      material_code: s.materials?.code,
      unit: s.unit || s.materials?.unit,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
