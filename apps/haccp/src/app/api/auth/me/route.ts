import { NextResponse } from 'next/server';
import { createClient as createServerClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile, error } = await adminClient
      .from('users')
      .select(`
        id,
        email,
        name,
        phone,
        role,
        status,
        company_id,
        company:companies(id, name)
      `)
      .eq('auth_id', userData.user.id)
      .single();

    if (error || !userProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: userProfile.id,
      email: userProfile.email,
      name: userProfile.name,
      phone: userProfile.phone,
      role: userProfile.role,
      status: userProfile.status,
      company_id: userProfile.company_id,
      company: userProfile.company,
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
