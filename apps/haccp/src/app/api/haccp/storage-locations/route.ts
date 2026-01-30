/**
 * 보관위치 API - storage_area_settings 테이블 사용 (통합)
 * 원부재료 보관위치 선택 시 사용
 * storage_area_settings와 통합하여 일관된 보관위치 관리
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// zone_type <-> storage_type 매핑
const zoneTypeToStorageType: Record<string, string> = {
  '냉장': 'REFRIGERATOR',
  '냉동': 'FREEZER',
  '상온': 'DRY_STORAGE',
};

const storageTypeToZoneType: Record<string, string> = {
  'REFRIGERATOR': '냉장',
  'FREEZER': '냉동',
  'DRY_STORAGE': '상온',
  'CHEMICAL_STORAGE': '상온',
  'PACKAGING_STORAGE': '상온',
  'OTHER': '상온',
};

// GET /api/haccp/storage-locations
export async function GET() {
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

    // storage_area_settings에서 조회
    const { data, error } = await adminClient
      .from('storage_area_settings')
      .select('id, area_name, area_code, storage_type, description, is_active')
      .eq('company_id', userProfile.company_id)
      .eq('is_active', true)
      .order('sort_order')
      .order('area_name');

    if (error) {
      console.error('Error fetching storage locations:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 기존 형식으로 매핑 (하위 호환)
    const result = (data || []).map(item => ({
      id: item.id,
      name: item.area_name,
      zone_type: storageTypeToZoneType[item.storage_type] || '상온',
      description: item.description,
      is_active: item.is_active,
      // 추가 필드
      area_code: item.area_code,
      storage_type: item.storage_type,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/haccp/storage-locations
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

    // storage_type 결정 (zone_type이 있으면 변환, 아니면 직접 사용)
    let storageType = body.storage_type || 'DRY_STORAGE';
    if (body.zone_type && !body.storage_type) {
      storageType = zoneTypeToStorageType[body.zone_type] || 'DRY_STORAGE';
    }

    // storage_area_settings에 삽입
    const { data, error } = await adminClient
      .from('storage_area_settings')
      .insert({
        company_id: userProfile.company_id,
        area_name: body.name || body.area_name,
        area_code: body.area_code,
        storage_type: storageType,
        description: body.description || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating storage location:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 기존 형식으로 반환
    const result = {
      id: data.id,
      name: data.area_name,
      zone_type: storageTypeToZoneType[data.storage_type] || '상온',
      description: data.description,
      is_active: data.is_active,
    };

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/haccp/storage-locations
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();
    const body = await request.json();
    const { id, ...updateData } = body;

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

    // 필드 매핑
    const mapped: Record<string, unknown> = {};
    if (updateData.name !== undefined) mapped.area_name = updateData.name;
    if (updateData.area_name !== undefined) mapped.area_name = updateData.area_name;
    if (updateData.zone_type !== undefined) {
      mapped.storage_type = zoneTypeToStorageType[updateData.zone_type] || updateData.zone_type;
    }
    if (updateData.storage_type !== undefined) mapped.storage_type = updateData.storage_type;
    if (updateData.description !== undefined) mapped.description = updateData.description;
    if (updateData.is_active !== undefined) mapped.is_active = updateData.is_active;
    mapped.updated_at = new Date().toISOString();

    const { data, error } = await adminClient
      .from('storage_area_settings')
      .update(mapped)
      .eq('id', id)
      .eq('company_id', userProfile.company_id)
      .select()
      .single();

    if (error) {
      console.error('Error updating storage location:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const result = {
      id: data.id,
      name: data.area_name,
      zone_type: storageTypeToZoneType[data.storage_type] || '상온',
      description: data.description,
      is_active: data.is_active,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/haccp/storage-locations
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
      console.error('Error deleting storage location:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
