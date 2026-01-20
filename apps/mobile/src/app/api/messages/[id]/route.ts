import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
}

// GET /api/messages/[id] - 메시지 상세 조회 (읽음 처리)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const messageId = params.id;

    // 메시지 조회
    const { data: message, error } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();

    if (error || !message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    // 수신자인 경우 읽음 처리
    if (message.recipient_id === userProfile.id && message.status === 'SENT') {
      await supabase
        .from('messages')
        .update({
          status: 'READ',
          read_at: new Date().toISOString(),
        })
        .eq('id', messageId);

      message.status = 'READ';
      message.read_at = new Date().toISOString();
    }

    return NextResponse.json(message);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/messages/[id] - 메시지 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const messageId = params.id;

    // 본인이 보냈거나 받은 메시지만 삭제 가능
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', messageId)
      .or(`sender_id.eq.${userProfile.id},recipient_id.eq.${userProfile.id}`);

    if (error) {
      console.error('Error deleting message:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
