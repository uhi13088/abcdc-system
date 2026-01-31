import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// PUT /api/haccp/equipment-settings/[id] - 개별 장비 수정 (매장별)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();
    const adminClient = createAdminClient();
    const body = await request.json();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await adminClient
      .from('users')
      .select('company_id, store_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // store_id 확인 (body에서 가져오거나 사용자의 store_id 사용)
    const storeId = body.store_id || userProfile.store_id;
    if (!storeId) {
      return NextResponse.json({ error: 'Store not specified' }, { status: 400 });
    }

    // 보안: store가 사용자의 company에 속하는지 확인
    const { data: store } = await adminClient
      .from('stores')
      .select('id, company_id')
      .eq('id', storeId)
      .single();

    if (!store || store.company_id !== userProfile.company_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.key !== undefined) updateData.key = body.key;
    if (body.type !== undefined) updateData.type = body.type;
    if (body.target_temp !== undefined) updateData.target_temp = body.target_temp;
    if (body.enabled !== undefined) updateData.enabled = body.enabled;
    if (body.location !== undefined) updateData.location = body.location;
    if (body.sensor_id !== undefined) updateData.sensor_id = body.sensor_id;

    const { data, error } = await adminClient
      .from('company_equipment_settings')
      .update(updateData)
      .eq('id', id)
      .eq('company_id', userProfile.company_id)
      .eq('store_id', storeId)
      .select()
      .single();

    if (error) {
      console.error('Error updating equipment:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Equipment not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/haccp/equipment-settings/[id] - 장비 삭제 (매장별)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();
    const adminClient = createAdminClient();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await adminClient
      .from('users')
      .select('company_id, store_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 삭제 대상 장비의 store_id 확인
    const { data: equipment } = await adminClient
      .from('company_equipment_settings')
      .select('store_id')
      .eq('id', id)
      .eq('company_id', userProfile.company_id)
      .single();

    if (!equipment) {
      return NextResponse.json({ error: 'Equipment not found' }, { status: 404 });
    }

    // 보안: store가 사용자의 company에 속하는지 확인
    const { data: store } = await adminClient
      .from('stores')
      .select('id, company_id')
      .eq('id', equipment.store_id)
      .single();

    if (!store || store.company_id !== userProfile.company_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { error } = await adminClient
      .from('company_equipment_settings')
      .delete()
      .eq('id', id)
      .eq('company_id', userProfile.company_id)
      .eq('store_id', equipment.store_id);

    if (error) {
      console.error('Error deleting equipment:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
