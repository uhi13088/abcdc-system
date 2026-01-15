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

    // Fetch user profile using adminClient to bypass RLS
    const { data: userData, error } = await adminClient
      .from('users')
      .select('id, name, phone, email, position, created_at, stores(id, name)')
      .eq('auth_id', user.id)
      .single();

    if (error) throw error;

    if (userData) {
      // Supabase returns relations as arrays, extract first element
      const storeData = Array.isArray(userData.stores) ? userData.stores[0] : userData.stores;
      return NextResponse.json({
        id: userData.id,
        name: userData.name,
        phone: userData.phone,
        email: userData.email,
        position: userData.position,
        created_at: userData.created_at,
        stores: storeData || null,
      });
    }

    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}
