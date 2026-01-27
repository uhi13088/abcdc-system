import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/alerts - 알림 목록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const searchParams = request.nextUrl.searchParams;

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

    // Query parameters
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const resolved = searchParams.get('resolved'); // 'true', 'false', or null for all
    const severity = searchParams.get('severity'); // 'INFO', 'WARNING', 'CRITICAL'
    const sensorId = searchParams.get('sensor_id');
    const alertType = searchParams.get('alert_type');

    let query = adminClient
      .from('iot_sensor_alerts')
      .select(`
        *,
        sensor:sensor_id (
          id,
          name,
          sensor_code,
          location
        ),
        resolved_by_user:resolved_by (
          id,
          name
        )
      `, { count: 'exact' })
      .eq('company_id', userData.company_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (resolved !== null) {
      query = query.eq('is_resolved', resolved === 'true');
    }

    if (severity) {
      query = query.eq('severity', severity);
    }

    if (sensorId) {
      query = query.eq('sensor_id', sensorId);
    }

    if (alertType) {
      query = query.eq('alert_type', alertType);
    }

    const { data: alerts, error, count } = await query;

    if (error) {
      console.error('[GET /api/alerts] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      alerts: alerts || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('[GET /api/alerts] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/alerts/resolve - 알림 해결 처리
export async function POST(request: NextRequest) {
  try {
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

    const body = await request.json();
    const { alert_ids, resolution_notes, create_corrective_action } = body;

    if (!alert_ids || !Array.isArray(alert_ids) || alert_ids.length === 0) {
      return NextResponse.json({ error: 'alert_ids is required' }, { status: 400 });
    }

    // Verify alerts belong to user's company
    const { data: alerts } = await adminClient
      .from('iot_sensor_alerts')
      .select('id, company_id')
      .in('id', alert_ids)
      .eq('company_id', userData.company_id);

    if (!alerts || alerts.length !== alert_ids.length) {
      return NextResponse.json({ error: 'Some alerts not found or access denied' }, { status: 403 });
    }

    // Update alerts as resolved
    const { error: updateError } = await adminClient
      .from('iot_sensor_alerts')
      .update({
        is_resolved: true,
        resolved_at: new Date().toISOString(),
        resolved_by: userData.id,
        resolution_notes: resolution_notes || null,
        updated_at: new Date().toISOString(),
      })
      .in('id', alert_ids);

    if (updateError) {
      console.error('[POST /api/alerts/resolve] Error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Optionally create a corrective action
    let correctiveAction = null;
    if (create_corrective_action && alerts.length > 0) {
      const { data: actionData, error: actionError } = await adminClient
        .from('corrective_actions')
        .insert({
          company_id: userData.company_id,
          action_number: `CA-${Date.now()}`,
          action_date: new Date().toISOString().split('T')[0],
          source_type: 'CCP',
          problem_description: `IoT 센서 알림 (${alert_ids.length}건)`,
          corrective_action: resolution_notes || '확인 후 조치 완료',
          responsible_person: userData.id,
          status: 'COMPLETED',
          created_by: userData.id,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (!actionError && actionData) {
        correctiveAction = actionData;

        // Link alerts to corrective action
        await adminClient
          .from('iot_sensor_alerts')
          .update({ corrective_action_id: actionData.id })
          .in('id', alert_ids);
      }
    }

    return NextResponse.json({
      success: true,
      message: `${alert_ids.length}건의 알림이 해결 처리되었습니다.`,
      resolved_count: alert_ids.length,
      corrective_action: correctiveAction,
    });
  } catch (error) {
    console.error('[POST /api/alerts/resolve] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
