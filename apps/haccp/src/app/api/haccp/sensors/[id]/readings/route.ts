import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { subDays, subHours } from 'date-fns';

export const dynamic = 'force-dynamic';

// GET /api/haccp/sensors/[id]/readings - 센서 읽기값 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await supabase
      .from('users')
      .select('company_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 센서 존재 및 권한 확인
    const { data: sensor } = await supabase
      .from('iot_sensors')
      .select('id, company_id')
      .eq('id', id)
      .eq('company_id', userProfile.company_id)
      .single();

    if (!sensor) {
      return NextResponse.json({ error: 'Sensor not found' }, { status: 404 });
    }

    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || '24h'; // 1h, 6h, 24h, 7d, 30d
    const limit = parseInt(searchParams.get('limit') || '500');

    // 기간별 시작 시간 계산
    let startDate: Date;
    switch (period) {
      case '1h':
        startDate = subHours(new Date(), 1);
        break;
      case '6h':
        startDate = subHours(new Date(), 6);
        break;
      case '24h':
        startDate = subDays(new Date(), 1);
        break;
      case '7d':
        startDate = subDays(new Date(), 7);
        break;
      case '30d':
        startDate = subDays(new Date(), 30);
        break;
      default:
        startDate = subDays(new Date(), 1);
    }

    const { data: readings, error } = await supabase
      .from('sensor_readings')
      .select('*')
      .eq('sensor_id', id)
      .gte('recorded_at', startDate.toISOString())
      .order('recorded_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching readings:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 통계 계산
    const values = readings?.map(r => r.reading_value).filter(v => v !== null) || [];
    const stats = values.length > 0 ? {
      count: values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      withinLimit: readings?.filter(r => r.is_within_limit).length || 0,
      outOfLimit: readings?.filter(r => r.is_within_limit === false).length || 0,
    } : null;

    return NextResponse.json({
      readings: readings || [],
      stats,
      period,
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/haccp/sensors/[id]/readings - 센서 읽기값 기록 (외부 시스템/IoT 디바이스용)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();
    const body = await request.json();

    // API Key 인증 (IoT 디바이스용)
    const apiKey = request.headers.get('X-API-Key');
    if (!apiKey) {
      // 일반 사용자 인증 시도
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // 센서 정보 조회
    const { data: sensor } = await supabase
      .from('iot_sensors')
      .select('*, ccp_definition:ccp_definitions(critical_limit)')
      .eq('id', id)
      .single();

    if (!sensor) {
      return NextResponse.json({ error: 'Sensor not found' }, { status: 404 });
    }

    // 필수 필드 검증
    if (body.reading_value === undefined) {
      return NextResponse.json(
        { error: 'reading_value is required' },
        { status: 400 }
      );
    }

    const readingValue = parseFloat(body.reading_value) + (sensor.calibration_offset || 0);

    // 한계기준 내 여부 확인
    let isWithinLimit: boolean | null = null;
    if (sensor.ccp_definition?.critical_limit) {
      const limit = sensor.ccp_definition.critical_limit;
      const min = limit.min !== undefined ? parseFloat(limit.min) : null;
      const max = limit.max !== undefined ? parseFloat(limit.max) : null;

      if (min !== null && max !== null) {
        isWithinLimit = readingValue >= min && readingValue <= max;
      } else if (min !== null) {
        isWithinLimit = readingValue >= min;
      } else if (max !== null) {
        isWithinLimit = readingValue <= max;
      }
    }

    // 읽기값 저장
    const readingData = {
      sensor_id: id,
      reading_value: readingValue,
      reading_unit: body.reading_unit || sensor.sensor_type === 'TEMPERATURE' ? '°C' : null,
      is_within_limit: isWithinLimit,
      raw_data: body.raw_data || null,
      recorded_at: body.recorded_at || new Date().toISOString(),
    };

    const { data: reading, error: readingError } = await supabase
      .from('sensor_readings')
      .insert(readingData)
      .select()
      .single();

    if (readingError) {
      console.error('Error creating reading:', readingError);
      return NextResponse.json({ error: readingError.message }, { status: 500 });
    }

    // 센서의 최근 읽기값 업데이트
    const sensorUpdate: Record<string, unknown> = {
      last_reading_at: reading.recorded_at,
      last_reading_value: readingValue,
      status: 'ONLINE',
    };

    await supabase
      .from('iot_sensors')
      .update(sensorUpdate)
      .eq('id', id);

    // 한계 이탈 시 알림 생성
    if (isWithinLimit === false && sensor.alert_enabled) {
      const { data: users } = await supabase
        .from('users')
        .select('id')
        .eq('company_id', sensor.company_id)
        .in('role', ['HACCP_MANAGER', 'STORE_MANAGER', 'COMPANY_ADMIN']);

      for (const user of users || []) {
        await supabase.from('notifications').insert({
          user_id: user.id,
          category: 'HACCP',
          priority: 'HIGH',
          title: 'CCP 한계 이탈 감지',
          body: `${sensor.sensor_name}에서 한계 이탈이 감지되었습니다. 측정값: ${readingValue}`,
          deep_link: `/sensors/${id}`,
        });
      }
    }

    return NextResponse.json(reading, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
