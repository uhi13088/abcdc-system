import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/haccp/sensors - IoT 센서 목록 조회
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
      .select('company_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const ccpId = searchParams.get('ccp_id');
    const includeReadings = searchParams.get('include_readings') === 'true';

    // iot_sensors 테이블 조회
    const { data: sensors, error } = await (async () => {
      let query = adminClient
        .from('iot_sensors')
        .select(`
          *,
          ccp_definition:ccp_definitions(id, ccp_number, process)
        `)
        .eq('company_id', userProfile.company_id)
        .order('created_at', { ascending: false });

      if (status === 'active') {
        query = query.eq('is_active', true);
      } else if (status === 'inactive') {
        query = query.eq('is_active', false);
      }

      if (ccpId) {
        query = query.eq('ccp_definition_id', ccpId);
      }

      return query;
    })();

    if (error) {
      // 테이블이 없으면 빈 배열 반환
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('iot_sensors table does not exist');
        return NextResponse.json([]);
      }
      console.error('Error fetching sensors:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 최근 읽기값 포함 여부
    if (includeReadings && sensors && sensors.length > 0) {
      const sensorIds = sensors.map(s => s.id);

      const { data: readings } = await adminClient
        .from('sensor_readings')
        .select('sensor_id, reading_value, reading_unit, is_within_limit, recorded_at')
        .in('sensor_id', sensorIds)
        .order('recorded_at', { ascending: false })
        .limit(100);

      // 각 센서에 최근 읽기값 첨부
      const readingsBySensor: Record<string, typeof readings> = {};
      readings?.forEach(r => {
        if (!readingsBySensor[r.sensor_id]) {
          readingsBySensor[r.sensor_id] = [];
        }
        if ((readingsBySensor[r.sensor_id]?.length || 0) < 10) {
          readingsBySensor[r.sensor_id]?.push(r);
        }
      });

      const sensorsWithReadings = sensors.map(sensor => ({
        ...sensor,
        recent_readings: readingsBySensor[sensor.id] || [],
      }));

      return NextResponse.json(sensorsWithReadings);
    }

    return NextResponse.json(sensors || []);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/haccp/sensors - IoT 센서 등록
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
      .select('company_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 필수 필드 검증
    if (!body.sensor_name || !body.sensor_type || !body.protocol) {
      return NextResponse.json(
        { error: '센서 이름, 유형, 프로토콜은 필수입니다.' },
        { status: 400 }
      );
    }

    const sensorData = {
      company_id: userProfile.company_id,
      sensor_name: body.sensor_name,
      sensor_type: body.sensor_type,
      protocol: body.protocol,
      connection_string: body.connection_string || null,
      device_id: body.device_id || null,
      location: body.location || null,
      store_id: body.store_id || null,
      ccp_definition_id: body.ccp_definition_id || null,
      reading_interval_seconds: body.reading_interval_seconds || 60,
      alert_enabled: body.alert_enabled !== false,
      calibration_offset: body.calibration_offset || 0,
      calibration_due_at: body.calibration_due_at || null,
      is_active: body.is_active !== false,
      status: 'UNKNOWN',
    };

    const { data, error } = await adminClient
      .from('iot_sensors')
      .insert(sensorData)
      .select(`
        *,
        ccp_definition:ccp_definitions(id, ccp_number, process)
      `)
      .single();

    if (error) {
      // 테이블이 없으면 의미있는 에러 반환
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json({
          error: 'IoT 센서 기능을 사용하려면 데이터베이스 마이그레이션이 필요합니다.'
        }, { status: 503 });
      }
      console.error('Error creating sensor:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
