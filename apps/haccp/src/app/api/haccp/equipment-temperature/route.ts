import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface TemperatureRecordRequest {
  record_date: string;
  record_time?: string;
  equipment_location: string;
  equipment_id?: string;
  temperature: number;
  target_temperature?: number;
  input_type?: 'manual' | 'iot';
  deviation_action?: string;
}

// GET /api/haccp/equipment-temperature
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const location = searchParams.get('location');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await adminClient
      .from('users')
      .select('company_id, store_id, current_store_id, current_haccp_store_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // HACCP 매장 우선순위: current_haccp_store_id > current_store_id > store_id
    const currentStoreId = userProfile.current_haccp_store_id || userProfile.current_store_id || userProfile.store_id;

    let query = adminClient
      .from('equipment_temperature_records')
      .select('*')
      .eq('company_id', userProfile.company_id);

    // store_id 필터링
    if (currentStoreId) {
      query = query.eq('store_id', currentStoreId);
    }

    // 날짜 범위 필터
    if (startDate && endDate) {
      query = query.gte('record_date', startDate).lte('record_date', endDate);
    } else {
      query = query.eq('record_date', date);
    }

    // 위치 필터
    if (location) {
      query = query.eq('equipment_location', location);
    }

    const { data, error } = await query
      .order('record_date', { ascending: false })
      .order('record_time', { ascending: false });

    if (error) {
      // 테이블이 없으면 빈 배열 반환
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json([]);
      }
      console.error('Error fetching temperature records:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/haccp/equipment-temperature
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();
    const body: TemperatureRecordRequest = await request.json();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await adminClient
      .from('users')
      .select('id, company_id, store_id, current_store_id, current_haccp_store_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 현재 선택된 매장
    const currentStoreId = userProfile.current_haccp_store_id || userProfile.current_store_id || userProfile.store_id;

    // 기준 온도 조회 (회사 설정에서)
    const { data: settings } = await adminClient
      .from('company_hygiene_settings')
      .select('temperature_locations')
      .eq('company_id', userProfile.company_id)
      .single();

    interface TempLocation {
      key: string;
      enabled: boolean;
      target_temp: number;
    }

    let targetTemp = body.target_temperature;
    if (!targetTemp && settings?.temperature_locations) {
      const locationSettings = (settings.temperature_locations as TempLocation[]).find(
        (loc) => loc.key === body.equipment_location
      );
      targetTemp = locationSettings?.target_temp;
    }

    // 기준 온도 이탈 여부 확인
    let isWithinLimit = true;
    if (targetTemp !== undefined) {
      // 냉동: -18도 이하, 냉장: 0~10도
      if (body.equipment_location.includes('냉동')) {
        isWithinLimit = body.temperature <= targetTemp + 3; // -15도까지 허용
      } else {
        isWithinLimit = body.temperature <= targetTemp + 5 && body.temperature >= 0;
      }
    }

    const recordTime = body.record_time || new Date().toTimeString().split(' ')[0];

    const { data, error } = await adminClient
      .from('equipment_temperature_records')
      .insert({
        company_id: userProfile.company_id,
        store_id: currentStoreId || null,
        record_date: body.record_date,
        record_time: recordTime,
        equipment_location: body.equipment_location,
        equipment_id: body.equipment_id,
        temperature: body.temperature,
        target_temperature: targetTemp,
        input_type: body.input_type || 'manual',
        is_within_limit: isWithinLimit,
        deviation_action: body.deviation_action,
        recorded_by: userProfile.id,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json({ error: 'equipment_temperature_records 테이블이 없습니다. DB 마이그레이션을 실행해주세요.' }, { status: 503 });
      }
      console.error('Error creating temperature record:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/haccp/equipment-temperature/bulk - IoT 장비에서 대량 입력
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();
    const body: { records: TemperatureRecordRequest[] } = await request.json();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await adminClient
      .from('users')
      .select('id, company_id, store_id, current_store_id, current_haccp_store_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 현재 선택된 매장
    const currentStoreId = userProfile.current_haccp_store_id || userProfile.current_store_id || userProfile.store_id;

    const records = body.records.map((r) => ({
      company_id: userProfile.company_id,
      store_id: currentStoreId || null,
      record_date: r.record_date,
      record_time: r.record_time || new Date().toTimeString().split(' ')[0],
      equipment_location: r.equipment_location,
      equipment_id: r.equipment_id,
      temperature: r.temperature,
      target_temperature: r.target_temperature,
      input_type: r.input_type || 'iot',
      recorded_by: userProfile.id,
    }));

    const { data, error } = await adminClient
      .from('equipment_temperature_records')
      .insert(records)
      .select();

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json({ error: 'equipment_temperature_records 테이블이 없습니다. DB 마이그레이션을 실행해주세요.' }, { status: 503 });
      }
      console.error('Error creating bulk temperature records:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ inserted: data?.length || 0 }, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
