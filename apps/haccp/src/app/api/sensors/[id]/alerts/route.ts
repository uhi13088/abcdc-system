import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

interface SensorAlertSettings {
  alert_enabled: boolean;
  min_threshold: number | null;
  max_threshold: number | null;
  alert_interval_minutes: number;
  offline_alert_enabled: boolean;
  offline_threshold_minutes: number;
  notify_roles: string[];
  notify_users: string[];
  push_enabled: boolean;
  email_enabled: boolean;
  sms_enabled: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  quiet_hours_exception_critical: boolean;
}

// GET /api/sensors/[id]/alerts - 센서 알림 설정 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sensorId } = await params;
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await adminClient
      .from('users')
      .select('id, company_id, role')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check sensor belongs to user's company
    const { data: sensor } = await adminClient
      .from('iot_sensors')
      .select('id, name, company_id, alert_enabled, alert_threshold_min, alert_threshold_max')
      .eq('id', sensorId)
      .single();

    if (!sensor) {
      return NextResponse.json({ error: 'Sensor not found' }, { status: 404 });
    }

    if (sensor.company_id !== userData.company_id && userData.role !== 'super_admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get sensor alert settings
    const { data: settings } = await adminClient
      .from('sensor_alert_settings')
      .select('*')
      .eq('sensor_id', sensorId)
      .single();

    // Return merged settings (base sensor settings + custom alert settings)
    const response: SensorAlertSettings = {
      alert_enabled: settings?.alert_enabled ?? sensor.alert_enabled ?? true,
      min_threshold: settings?.min_threshold ?? sensor.alert_threshold_min,
      max_threshold: settings?.max_threshold ?? sensor.alert_threshold_max,
      alert_interval_minutes: settings?.alert_interval_minutes ?? 5,
      offline_alert_enabled: settings?.offline_alert_enabled ?? true,
      offline_threshold_minutes: settings?.offline_threshold_minutes ?? 10,
      notify_roles: settings?.notify_roles ?? ['company_admin', 'store_manager', 'haccp_manager'],
      notify_users: settings?.notify_users ?? [],
      push_enabled: settings?.push_enabled ?? true,
      email_enabled: settings?.email_enabled ?? false,
      sms_enabled: settings?.sms_enabled ?? false,
      quiet_hours_enabled: settings?.quiet_hours_enabled ?? false,
      quiet_hours_start: settings?.quiet_hours_start ?? null,
      quiet_hours_end: settings?.quiet_hours_end ?? null,
      quiet_hours_exception_critical: settings?.quiet_hours_exception_critical ?? true,
    };

    return NextResponse.json({
      sensor: {
        id: sensor.id,
        name: sensor.name,
      },
      settings: response,
    });
  } catch (error) {
    console.error('[GET /api/sensors/[id]/alerts] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT /api/sensors/[id]/alerts - 센서 알림 설정 업데이트
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sensorId } = await params;
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await adminClient
      .from('users')
      .select('id, company_id, role')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check permission (only admin roles can change settings)
    if (!['super_admin', 'company_admin', 'store_manager', 'haccp_manager'].includes(userData.role)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    // Check sensor belongs to user's company
    const { data: sensor } = await adminClient
      .from('iot_sensors')
      .select('id, company_id')
      .eq('id', sensorId)
      .single();

    if (!sensor) {
      return NextResponse.json({ error: 'Sensor not found' }, { status: 404 });
    }

    if (sensor.company_id !== userData.company_id && userData.role !== 'super_admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();

    // Update base sensor thresholds
    if (body.min_threshold !== undefined || body.max_threshold !== undefined || body.alert_enabled !== undefined) {
      await adminClient
        .from('iot_sensors')
        .update({
          alert_enabled: body.alert_enabled,
          alert_threshold_min: body.min_threshold,
          alert_threshold_max: body.max_threshold,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sensorId);
    }

    // Upsert sensor alert settings
    const settingsData = {
      sensor_id: sensorId,
      alert_enabled: body.alert_enabled,
      min_threshold: body.min_threshold,
      max_threshold: body.max_threshold,
      alert_interval_minutes: body.alert_interval_minutes,
      offline_alert_enabled: body.offline_alert_enabled,
      offline_threshold_minutes: body.offline_threshold_minutes,
      notify_roles: body.notify_roles,
      notify_users: body.notify_users,
      push_enabled: body.push_enabled,
      email_enabled: body.email_enabled,
      sms_enabled: body.sms_enabled,
      quiet_hours_enabled: body.quiet_hours_enabled,
      quiet_hours_start: body.quiet_hours_start,
      quiet_hours_end: body.quiet_hours_end,
      quiet_hours_exception_critical: body.quiet_hours_exception_critical,
      updated_at: new Date().toISOString(),
    };

    const { data: settings, error } = await adminClient
      .from('sensor_alert_settings')
      .upsert(settingsData, { onConflict: 'sensor_id' })
      .select()
      .single();

    if (error) {
      console.error('[PUT /api/sensors/[id]/alerts] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: '알림 설정이 저장되었습니다.',
      settings,
    });
  } catch (error) {
    console.error('[PUT /api/sensors/[id]/alerts] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
