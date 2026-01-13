/**
 * FCM 토큰 등록 API
 * POST /api/notifications/register-token - 토큰 등록
 * DELETE /api/notifications/register-token - 토큰 삭제
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
}

// FCM 토큰 등록
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

    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { fcmToken, deviceType, deviceInfo } = body;

    if (!fcmToken) {
      return NextResponse.json(
        { error: 'FCM token is required' },
        { status: 400 }
      );
    }

    // 기존 토큰 확인 및 업데이트 또는 생성
    const { data: existingToken } = await supabase
      .from('user_fcm_tokens')
      .select('id')
      .eq('fcm_token', fcmToken)
      .maybeSingle();

    if (existingToken) {
      // 기존 토큰 업데이트
      await supabase
        .from('user_fcm_tokens')
        .update({
          user_id: userData.id,
          device_type: deviceType || 'unknown',
          device_info: deviceInfo,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingToken.id);
    } else {
      // 새 토큰 생성
      await supabase.from('user_fcm_tokens').insert({
        user_id: userData.id,
        fcm_token: fcmToken,
        device_type: deviceType || 'unknown',
        device_info: deviceInfo,
        is_active: true,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('FCM token registration error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// FCM 토큰 삭제 (로그아웃 시)
export async function DELETE(request: NextRequest) {
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

    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const searchParams = request.nextUrl.searchParams;
    const fcmToken = searchParams.get('token');

    if (fcmToken) {
      // 특정 토큰 비활성화
      await supabase
        .from('user_fcm_tokens')
        .update({ is_active: false })
        .eq('user_id', userData.id)
        .eq('fcm_token', fcmToken);
    } else {
      // 모든 토큰 비활성화
      await supabase
        .from('user_fcm_tokens')
        .update({ is_active: false })
        .eq('user_id', userData.id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('FCM token deletion error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
