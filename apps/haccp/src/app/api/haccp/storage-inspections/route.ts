/**
 * HACCP 보관 창고 점검 API
 * GET /api/haccp/storage-inspections - 점검 기록 조회
 * POST /api/haccp/storage-inspections - 점검 기록 생성
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/haccp/storage-inspections
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const storageArea = searchParams.get('storageArea');
    const storageType = searchParams.get('storageType');

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

    let query = adminClient
      .from('storage_inspections')
      .select('*')
      .eq('company_id', userProfile.company_id)
      .order('inspection_date', { ascending: false })
      .order('inspection_time', { ascending: false });

    if (date) {
      query = query.eq('inspection_date', date);
    }
    if (startDate) {
      query = query.gte('inspection_date', startDate);
    }
    if (endDate) {
      query = query.lte('inspection_date', endDate);
    }
    if (storageArea) {
      query = query.eq('storage_area', storageArea);
    }
    if (storageType) {
      query = query.eq('storage_type', storageType);
    }

    const { data, error } = await query;

    if (error) {
      // 테이블이 없으면 빈 배열 반환
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json([]);
      }
      console.error('Error fetching storage inspections:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/haccp/storage-inspections
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
      .select('id, company_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 온도 결과 자동 판정
    let temperatureResult = body.temperature_result;
    if (body.temperature !== undefined && body.temperature !== null) {
      if (body.temperature_min !== undefined && body.temperature_max !== undefined) {
        temperatureResult = (body.temperature >= body.temperature_min && body.temperature <= body.temperature_max)
          ? 'PASS' : 'FAIL';
      }
    }

    // 습도 결과 자동 판정
    let humidityResult = body.humidity_result;
    if (body.humidity !== undefined && body.humidity !== null) {
      if (body.humidity_min !== undefined && body.humidity_max !== undefined) {
        humidityResult = (body.humidity >= body.humidity_min && body.humidity <= body.humidity_max)
          ? 'PASS' : 'FAIL';
      }
    }

    // 종합 판정 결정
    const checkItems = [
      temperatureResult !== 'FAIL',
      humidityResult !== 'FAIL',
      body.cleanliness_check !== false,
      body.organization_check !== false,
      body.pest_check !== true, // pest_check가 true면 해충 발견이므로 실패
      body.damage_check !== true,
    ];
    const overallResult = body.overall_result || (checkItems.every(Boolean) ? 'PASS' : 'FAIL');

    const { data, error } = await adminClient
      .from('storage_inspections')
      .insert({
        company_id: userProfile.company_id,
        inspected_by: userProfile.id,
        inspection_date: body.inspection_date || new Date().toISOString().split('T')[0],
        inspection_time: body.inspection_time || new Date().toTimeString().split(' ')[0].slice(0, 5),
        shift: body.shift,
        storage_area: body.storage_area,
        storage_area_setting_id: body.storage_area_setting_id,
        storage_type: body.storage_type,
        temperature: body.temperature,
        temperature_unit: body.temperature_unit || 'C',
        temperature_min: body.temperature_min,
        temperature_max: body.temperature_max,
        temperature_result: temperatureResult,
        humidity: body.humidity,
        humidity_min: body.humidity_min,
        humidity_max: body.humidity_max,
        humidity_result: humidityResult,
        cleanliness_check: body.cleanliness_check,
        organization_check: body.organization_check,
        pest_check: body.pest_check,
        damage_check: body.damage_check,
        labeling_check: body.labeling_check,
        fifo_check: body.fifo_check,
        overall_result: overallResult,
        findings: body.findings,
        corrective_action: body.corrective_action,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating storage inspection:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/haccp/storage-inspections
export async function PUT(request: NextRequest) {
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
      .select('id, company_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    // If marking as verified
    if (updateData.verified) {
      updateData.verified_by = userProfile.id;
      updateData.verified_at = new Date().toISOString();
      delete updateData.verified;
    }

    const { data, error } = await adminClient
      .from('storage_inspections')
      .update(updateData)
      .eq('id', id)
      .eq('company_id', userProfile.company_id)
      .select()
      .single();

    if (error) {
      console.error('Error updating storage inspection:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
