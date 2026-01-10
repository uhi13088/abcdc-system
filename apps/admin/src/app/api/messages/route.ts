import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// POST /api/messages - 메시지 보내기
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const body = await request.json();

    const { recipient_id, subject, body: messageBody } = body;

    // Get sender info
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get sender profile
    const { data: senderProfile } = await supabase
      .from('users')
      .select('id, name, role')
      .eq('auth_id', userData.user.id)
      .single();

    if (!senderProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Get recipient profile
    const { data: recipientProfile } = await supabase
      .from('users')
      .select('id, name, role')
      .eq('id', recipient_id)
      .single();

    if (!recipientProfile) {
      return NextResponse.json({ error: 'Recipient not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('messages')
      .insert({
        sender_id: senderProfile.id,
        sender_name: senderProfile.name,
        sender_role: senderProfile.role,
        recipient_id: recipientProfile.id,
        recipient_name: recipientProfile.name,
        recipient_role: recipientProfile.role,
        subject,
        body: messageBody,
        status: 'SENT',
        has_replies: false,
        reply_count: 0,
      })
      .select()
      .single();

    if (error) {
      console.error('Error sending message:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
