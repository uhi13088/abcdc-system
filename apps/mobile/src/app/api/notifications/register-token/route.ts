import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

// POST /api/notifications/register-token - FCM 토큰 등록
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's staff_id
    const { data: userData, error: userError } = await adminClient
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { fcmToken, platform, deviceInfo } = body;

    if (!fcmToken) {
      return NextResponse.json({ error: 'FCM token is required' }, { status: 400 });
    }

    // Upsert FCM token
    const { data, error } = await adminClient
      .from('user_fcm_tokens')
      .upsert({
        user_id: userData.id,
        fcm_token: fcmToken,
        device_type: platform || 'WEB',
        device_name: deviceInfo?.userAgent?.substring(0, 100) || 'Unknown',
        is_active: true,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,fcm_token',
      })
      .select()
      .single();

    if (error) {
      console.error('FCM token registration error:', error);
      return NextResponse.json({ error: 'Failed to register token' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: '푸시 알림이 등록되었습니다.',
      tokenId: data.id,
    });
  } catch (error) {
    console.error('Push notification registration error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/notifications/register-token - FCM 토큰 삭제
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await adminClient
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { fcmToken } = body;

    if (!fcmToken) {
      return NextResponse.json({ error: 'FCM token is required' }, { status: 400 });
    }

    // Deactivate the token instead of deleting
    const { error } = await adminClient
      .from('user_fcm_tokens')
      .update({ is_active: false })
      .eq('user_id', userData.id)
      .eq('fcm_token', fcmToken);

    if (error) {
      console.error('FCM token deactivation error:', error);
      return NextResponse.json({ error: 'Failed to deactivate token' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: '푸시 알림이 해제되었습니다.',
    });
  } catch (error) {
    console.error('Push notification deactivation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
