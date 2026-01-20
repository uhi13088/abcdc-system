import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
}

// POST /api/messages - 메시지 보내기
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { recipient_id, subject, body: messageBody, reply_to } = body;

    // Get sender profile
    const { data: senderProfile } = await supabase
      .from('users')
      .select('id, name, role')
      .eq('auth_id', user.id)
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
        reply_to: reply_to || null,
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

    // 답장인 경우 원본 메시지 업데이트
    if (reply_to) {
      await supabase
        .from('messages')
        .update({
          has_replies: true,
          reply_count: supabase.rpc('increment_reply_count', { message_id: reply_to }),
          status: 'REPLIED',
        })
        .eq('id', reply_to);
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
