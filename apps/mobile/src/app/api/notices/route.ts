import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile to get company_id
    const { data: userData } = await adminClient
      .from('users')
      .select('id, company_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '10');

    // Fetch notices using adminClient to bypass RLS
    let query = adminClient
      .from('notices')
      .select('id, title, content, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (userData.company_id) {
      query = query.eq('company_id', userData.company_id);
    }

    const { data: notices, error } = await query;

    if (error) throw error;

    return NextResponse.json(notices || []);
  } catch (error) {
    console.error('Error fetching notices:', error);
    return NextResponse.json({ error: 'Failed to fetch notices' }, { status: 500 });
  }
}
