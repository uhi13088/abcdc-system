import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// HACCP 관련 알림 카테고리 (이 카테고리들만 HACCP 앱에서 표시)
const HACCP_CATEGORIES = [
  'CCP',
  'HACCP',
  'TEMPERATURE',
  'HYGIENE',
  'PEST_CONTROL',
  'EQUIPMENT',
  'PRODUCTION',
  'SHIPMENT',
  'MATERIAL',
  'CALIBRATION',
  'TRAINING',
  'AUDIT',
  'CORRECTIVE_ACTION',
  'STORAGE',
  'SYSTEM', // 시스템 알림은 공통으로 표시
];

// GET /api/haccp/notifications - 알림 목록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await adminClient
      .from('users')
      .select('id, company_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const isRead = searchParams.get('is_read');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = adminClient
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', userProfile.id)
      .in('category', HACCP_CATEGORIES) // HACCP 관련 카테고리만 필터링
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (category) {
      query = query.eq('category', category);
    }

    if (isRead === 'true') {
      query = query.eq('read', true);
    } else if (isRead === 'false') {
      query = query.eq('read', false);
    }

    const { data, count, error } = await query;

    if (error) {
      console.error('Error fetching notifications:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 읽지 않은 알림 수 (HACCP 관련 카테고리만)
    const { count: unreadCount } = await adminClient
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userProfile.id)
      .in('category', HACCP_CATEGORIES)
      .eq('read', false);

    return NextResponse.json({
      notifications: data || [],
      total: count || 0,
      unreadCount: unreadCount || 0,
      offset,
      limit,
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/haccp/notifications - 알림 읽음 처리 (bulk)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();
    const body = await request.json();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await adminClient
      .from('users')
      .select('id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const action = body.action;

    if (action === 'mark_all_read') {
      // HACCP 관련 알림만 읽음 처리
      const { error } = await adminClient
        .from('notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('user_id', userProfile.id)
        .in('category', HACCP_CATEGORIES)
        .eq('read', false);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, action: 'mark_all_read' });
    }

    if (action === 'mark_read' && body.notification_ids) {
      // 특정 알림들 읽음 처리
      const { error } = await adminClient
        .from('notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('user_id', userProfile.id)
        .in('id', body.notification_ids);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, action: 'mark_read', count: body.notification_ids.length });
    }

    if (action === 'delete' && body.notification_ids) {
      // 특정 알림들 삭제
      const { error } = await adminClient
        .from('notifications')
        .delete()
        .eq('user_id', userProfile.id)
        .in('id', body.notification_ids);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, action: 'delete', count: body.notification_ids.length });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
