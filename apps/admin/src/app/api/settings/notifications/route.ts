import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/settings/notifications - 알림 설정 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use adminClient to bypass RLS for user lookup
    const { data: userData, error: userError } = await adminClient
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (userError) {
      console.error('[GET /api/settings/notifications] User lookup error:', userError);
    }

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { data: settings, error } = await adminClient
      .from('notification_settings')
      .select('*')
      .eq('user_id', userData.id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('[GET /api/settings/notifications] Query error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Return defaults if no settings exist
    return NextResponse.json({
      data: settings || {
        email_notifications: true,
        push_notifications: true,
        sms_notifications: false,
        attendance_alerts: true,
        approval_alerts: true,
        salary_alerts: true,
      }
    });
  } catch (error) {
    console.error('[GET /api/settings/notifications] Catch error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/settings/notifications - 알림 설정 저장
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use adminClient to bypass RLS for user lookup
    const { data: userData, error: userError } = await adminClient
      .from('users')
      .select('id, company_id')
      .eq('auth_id', user.id)
      .single();

    if (userError) {
      console.error('[POST /api/settings/notifications] User lookup error:', userError);
    }

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      emailNotifications,
      pushNotifications,
      smsNotifications,
      attendanceAlerts,
      approvalAlerts,
      salaryAlerts,
    } = body;

    const settingsData = {
      user_id: userData.id,
      company_id: userData.company_id,
      email_notifications: emailNotifications ?? true,
      push_notifications: pushNotifications ?? true,
      sms_notifications: smsNotifications ?? false,
      attendance_alerts: attendanceAlerts ?? true,
      approval_alerts: approvalAlerts ?? true,
      salary_alerts: salaryAlerts ?? true,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await adminClient
      .from('notification_settings')
      .upsert(settingsData, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) {
      console.error('[POST /api/settings/notifications] Save error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data,
      message: '알림 설정이 저장되었습니다.'
    });
  } catch (error) {
    console.error('[POST /api/settings/notifications] Catch error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
