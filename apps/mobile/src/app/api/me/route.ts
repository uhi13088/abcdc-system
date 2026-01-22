import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch user profile with store and company info using adminClient to bypass RLS
    const { data: userData, error } = await adminClient
      .from('users')
      .select('id, name, email, role, phone, position, avatar_url, company_id, brand_id, store_id, stores(id, name), companies(id, name)')
      .eq('auth_id', user.id)
      .single();

    if (error) throw error;

    if (userData) {
      // Supabase returns relations as arrays, extract first element
      const storeData = Array.isArray(userData.stores) ? userData.stores[0] : userData.stores;
      const companyData = Array.isArray(userData.companies) ? userData.companies[0] : userData.companies;
      return NextResponse.json({
        id: userData.id,
        name: userData.name,
        email: userData.email,
        role: userData.role,
        phone: userData.phone,
        position: userData.position,
        profile_image: userData.avatar_url,
        company_id: userData.company_id,
        company_name: companyData?.name || null,
        brand_id: userData.brand_id,
        store_id: userData.store_id,
        store_name: storeData?.name || null,
        stores: storeData || null,
      });
    }

    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json({ error: 'Failed to fetch user profile' }, { status: 500 });
  }
}
