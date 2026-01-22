import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
}

// GET /api/messages/inbox - 받은 메시지 목록
export async function GET(request: NextRequest) {
  const supabase = getSupabaseClient();

  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: userProfile } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('recipient_id', userProfile.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching inbox:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 읽지 않은 메시지 수
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const unreadCount = (data || []).filter((m: any) => m.status === 'SENT').length;

    return NextResponse.json({
      messages: data || [],
      unreadCount,
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
