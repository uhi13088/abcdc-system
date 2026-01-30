/**
 * 보관창고 구역 설정 API
 * GET /api/haccp/storage-area-settings - 구역 설정 목록 조회
 * POST /api/haccp/storage-area-settings - 구역 설정 생성
 * PUT /api/haccp/storage-area-settings - 구역 설정 수정
 * DELETE /api/haccp/storage-area-settings - 구역 설정 삭제
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/haccp/storage-area-settings
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('activeOnly') === 'true';
    const withSensor = searchParams.get('withSensor') === 'true';

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
      .from('storage_area_settings')
      .select(`
        *,
        sensor:iot_sensor_id (
          id,
          name,
          sensor_type,
          current_temperature,
          current_humidity,
          last_reading_at
        )
      `)
      .eq('company_id', userProfile.company_id)
      .order('sort_order', { ascending: true })
      .order('area_name', { ascending: true });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    if (withSensor) {
      query = query.not('iot_sensor_id', 'is', null);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching storage area settings:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/haccp/storage-area-settings
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

    // 기존 정렬 순서 확인
    const { data: maxOrderData } = await adminClient
      .from('storage_area_settings')
      .select('sort_order')
      .eq('company_id', userProfile.company_id)
      .order('sort_order', { ascending: false })
      .limit(1)
      .single();

    const nextOrder = (maxOrderData?.sort_order || 0) + 1;

    const { data, error } = await adminClient
      .from('storage_area_settings')
      .insert({
        company_id: userProfile.company_id,
        area_name: body.area_name,
        area_code: body.area_code,
        storage_type: body.storage_type,
        description: body.description,
        temperature_min: body.temperature_min,
        temperature_max: body.temperature_max,
        temperature_unit: body.temperature_unit || 'C',
        humidity_min: body.humidity_min,
        humidity_max: body.humidity_max,
        iot_sensor_id: body.iot_sensor_id,
        iot_enabled: body.iot_enabled || false,
        inspection_frequency: body.inspection_frequency || 'DAILY',
        is_active: body.is_active !== false,
        sort_order: body.sort_order ?? nextOrder,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating storage area setting:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/haccp/storage-area-settings
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
      .select('company_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await adminClient
      .from('storage_area_settings')
      .update(updateData)
      .eq('id', id)
      .eq('company_id', userProfile.company_id)
      .select()
      .single();

    if (error) {
      console.error('Error updating storage area setting:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/haccp/storage-area-settings
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

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

    const { error } = await adminClient
      .from('storage_area_settings')
      .delete()
      .eq('id', id)
      .eq('company_id', userProfile.company_id);

    if (error) {
      console.error('Error deleting storage area setting:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
