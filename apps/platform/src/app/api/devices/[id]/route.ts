import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// GET - 기기 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const adminClient = createAdminClient();

    // Verify super_admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await adminClient
      .from('users')
      .select('role')
      .eq('auth_id', user.id)
      .single();

    if (profile?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: device, error } = await adminClient
      .from('esp32_devices')
      .select(`
        *,
        company:companies(id, name, business_number),
        sensor:iot_sensors(id, name, sensor_code, status, last_reading_at, last_value),
        registered_by_user:users!esp32_devices_registered_by_fkey(id, name, email)
      `)
      .eq('id', id)
      .single();

    if (error || !device) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    // 이벤트 로그 조회
    const { data: events } = await adminClient
      .from('esp32_device_events')
      .select('*')
      .eq('device_id', id)
      .order('created_at', { ascending: false })
      .limit(50);

    return NextResponse.json({
      success: true,
      data: {
        ...device,
        events: events || []
      }
    });
  } catch (error) {
    console.error('Error fetching device:', error);
    return NextResponse.json(
      { error: 'Failed to fetch device' },
      { status: 500 }
    );
  }
}

// PUT - 기기 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const adminClient = createAdminClient();

    // Verify super_admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await adminClient
      .from('users')
      .select('role, id')
      .eq('auth_id', user.id)
      .single();

    if (profile?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const allowedFields = [
      'status',
      'device_type',
      'mac_address',
      'firmware_version',
      'reading_interval_seconds',
      'config'
    ];

    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data: device, error } = await adminClient
      .from('esp32_devices')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating device:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 상태 변경 시 이벤트 로그
    if (body.status) {
      const eventTypeMap: Record<string, string> = {
        'ACTIVE': 'ACTIVATED',
        'DEACTIVATED': 'DEACTIVATED',
        'MAINTENANCE': 'MAINTENANCE_START'
      };
      const eventType = eventTypeMap[body.status];
      if (eventType) {
        await adminClient.from('esp32_device_events').insert({
          device_id: id,
          event_type: eventType,
          event_data: { changed_by: profile.id, previous_status: body.previous_status }
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: device
    });
  } catch (error) {
    console.error('Error updating device:', error);
    return NextResponse.json(
      { error: 'Failed to update device' },
      { status: 500 }
    );
  }
}

// DELETE - 기기 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const adminClient = createAdminClient();

    // Verify super_admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await adminClient
      .from('users')
      .select('role')
      .eq('auth_id', user.id)
      .single();

    if (profile?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 기기 조회
    const { data: device } = await adminClient
      .from('esp32_devices')
      .select('sensor_id')
      .eq('id', id)
      .single();

    // 연결된 센서도 삭제
    if (device?.sensor_id) {
      await adminClient
        .from('iot_sensors')
        .delete()
        .eq('id', device.sensor_id);
    }

    const { error } = await adminClient
      .from('esp32_devices')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting device:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Device deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting device:', error);
    return NextResponse.json(
      { error: 'Failed to delete device' },
      { status: 500 }
    );
  }
}
