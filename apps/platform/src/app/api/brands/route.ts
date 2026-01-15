import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await adminClient
      .from('users')
      .select('role')
      .eq('auth_id', user.id)
      .single();

    if (profile?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: brands, error } = await adminClient
      .from('brands')
      .select(`
        *,
        companies(id, name)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Get store counts
    const brandsWithCounts = await Promise.all(
      (brands || []).map(async (brand) => {
        const { count } = await adminClient
          .from('stores')
          .select('*', { count: 'exact', head: true })
          .eq('brand_id', brand.id);

        return {
          ...brand,
          company_name: brand.companies?.name || '알 수 없음',
          stores_count: count || 0,
        };
      })
    );

    return NextResponse.json(brandsWithCounts);
  } catch (error) {
    console.error('Error fetching brands:', error);
    return NextResponse.json(
      { error: 'Failed to fetch brands' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await adminClient
      .from('users')
      .select('role')
      .eq('auth_id', user.id)
      .single();

    if (profile?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();

    const { data, error } = await adminClient
      .from('brands')
      .insert([{
        name: body.name,
        company_id: body.company_id,
        category: body.category,
        description: body.description,
        status: 'ACTIVE',
      }])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error creating brand:', error);
    return NextResponse.json(
      { error: 'Failed to create brand' },
      { status: 500 }
    );
  }
}
