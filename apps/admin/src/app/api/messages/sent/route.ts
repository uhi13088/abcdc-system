import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

// GET /api/messages/sent - 보낸 메시지 목록
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { searchParams } = new URL(request.url);
    const store_id = searchParams.get('store_id');

    // Get user info
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: userProfile } = await supabase
      .from('users')
      .select('id, company_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // If store filter is applied, get users from that store first
    let recipientFilter: string[] | null = null;
    if (store_id) {
      const { data: storeUsers } = await supabase
        .from('users')
        .select('id')
        .eq('store_id', store_id)
        .eq('company_id', userProfile.company_id);

      if (storeUsers && storeUsers.length > 0) {
        recipientFilter = storeUsers.map(u => u.id);
      } else {
        // No users in this store, return empty
        return NextResponse.json([]);
      }
    }

    let query = supabase
      .from('messages')
      .select('*')
      .eq('sender_id', userProfile.id)
      .order('created_at', { ascending: false });

    // Apply store filter by recipient's store
    if (recipientFilter) {
      query = query.in('recipient_id', recipientFilter);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching sent messages:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
