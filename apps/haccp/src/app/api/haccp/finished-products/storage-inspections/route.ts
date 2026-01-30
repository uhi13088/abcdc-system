/**
 * 완제품 보관창고 점검 API
 * finished_product_storage_inspections 테이블 사용
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/haccp/finished-products/storage-inspections
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

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

    const { data, error } = await adminClient
      .from('finished_product_storage_inspections')
      .select(`
        *,
        storage:storage_id (
          name
        ),
        inspector:inspected_by (
          name
        )
      `)
      .eq('company_id', userProfile.company_id)
      .eq('inspection_date', date)
      .order('inspection_time', { ascending: false });

    if (error) {
      // 테이블이 없으면 빈 배열 반환
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json([]);
      }
      console.error('Error fetching inspections:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 데이터 형식 변환
    const result = (data || []).map((item: {
      id: string;
      storage_id: string;
      inspection_date: string;
      inspection_time: string;
      temperature: number;
      humidity?: number;
      temp_status: string;
      humidity_status?: string;
      cleanliness_check: boolean;
      organization_check: boolean;
      pest_check: boolean;
      notes?: string;
      inspected_by: string;
      inspected_by_name?: string;
      storage?: { name: string };
      inspector?: { name: string };
    }) => ({
      ...item,
      storage_name: item.storage?.name || '',
      inspected_by_name: item.inspected_by_name || item.inspector?.name || '',
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/haccp/finished-products/storage-inspections
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
      .select('id, company_id, name')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 창고 정보 조회 (온도 범위 확인)
    const { data: storage } = await adminClient
      .from('finished_product_storage_locations')
      .select('temp_min, temp_max, humidity_min, humidity_max')
      .eq('id', body.storage_id)
      .single();

    // 온도 상태 판정
    let tempStatus = 'normal';
    if (storage) {
      const temp = body.temperature;
      if (temp < storage.temp_min - 2 || temp > storage.temp_max + 2) {
        tempStatus = 'critical';
      } else if (temp < storage.temp_min || temp > storage.temp_max) {
        tempStatus = 'warning';
      }
    }

    // 습도 상태 판정
    let humidityStatus = 'normal';
    if (storage && body.humidity !== undefined && storage.humidity_min !== undefined) {
      const hum = body.humidity;
      if (hum < storage.humidity_min - 5 || hum > storage.humidity_max + 5) {
        humidityStatus = 'critical';
      } else if (hum < storage.humidity_min || hum > storage.humidity_max) {
        humidityStatus = 'warning';
      }
    }

    const { data, error } = await adminClient
      .from('finished_product_storage_inspections')
      .insert({
        company_id: userProfile.company_id,
        storage_id: body.storage_id,
        inspection_date: body.inspection_date,
        inspection_time: body.inspection_time,
        temperature: body.temperature,
        humidity: body.humidity,
        temp_status: tempStatus,
        humidity_status: humidityStatus,
        cleanliness_check: body.cleanliness_check,
        organization_check: body.organization_check,
        pest_check: body.pest_check,
        notes: body.notes,
        inspected_by: userProfile.id,
        inspected_by_name: userProfile.name,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating inspection:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
