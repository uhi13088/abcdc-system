/**
 * HACCP 교육훈련 기록 API
 * GET /api/haccp/training - 교육 기록 조회
 * POST /api/haccp/training - 교육 기록 생성
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/haccp/training
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const trainingType = searchParams.get('type');
    const status = searchParams.get('status');

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

    // 현재 선택된 매장
    const currentStoreId = userProfile.current_haccp_store_id || userProfile.current_store_id || userProfile.store_id;

    let query = adminClient
      .from('haccp_training_records')
      .select(`
        *,
        created_by_user:created_by (name),
        verified_by_user:verified_by (name)
      `)
      .eq('company_id', userProfile.company_id);

    // store_id 필터링
    if (currentStoreId) {
      query = query.eq('store_id', currentStoreId);
    }

    query = query.order('training_date', { ascending: false });

    if (startDate) {
      query = query.gte('training_date', startDate);
    }
    if (endDate) {
      query = query.lte('training_date', endDate);
    }
    if (trainingType) {
      query = query.eq('training_type', trainingType);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      // 테이블이 없으면 빈 배열 반환
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json([]);
      }
      console.error('Error fetching training records:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (data || []).map((record: any) => ({
      ...record,
      created_by_name: record.created_by_user?.name,
      verified_by_name: record.verified_by_user?.name,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/haccp/training
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
      .select('id, company_id, store_id, current_store_id, current_haccp_store_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 현재 선택된 매장
    const currentStoreId = userProfile.current_haccp_store_id || userProfile.current_store_id || userProfile.store_id;

    const { data, error } = await adminClient
      .from('haccp_training_records')
      .insert({
        company_id: userProfile.company_id,
        store_id: currentStoreId || null,
        created_by: userProfile.id,
        training_date: body.training_date,
        training_type: body.training_type,
        title: body.title,
        instructor: body.instructor,
        instructor_company: body.instructor_company,
        duration_hours: body.duration_hours || 1,
        location: body.location,
        materials: body.materials,
        content_summary: body.content_summary,
        attendees: body.attendees || [],
        notes: body.notes,
        status: body.status || 'SCHEDULED',
      })
      .select()
      .single();

    if (error) {
      // 테이블이 없으면 null 반환
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json(null);
      }
      console.error('Error creating training record:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/haccp/training (update by id in body)
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
      .select('id, company_id, store_id, current_store_id, current_haccp_store_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 현재 선택된 매장
    const currentStoreId = userProfile.current_haccp_store_id || userProfile.current_store_id || userProfile.store_id;

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

    updateData.updated_at = new Date().toISOString();

    let updateQuery = adminClient
      .from('haccp_training_records')
      .update(updateData)
      .eq('id', id)
      .eq('company_id', userProfile.company_id);

    if (currentStoreId) {
      updateQuery = updateQuery.eq('store_id', currentStoreId);
    }

    const { data, error } = await updateQuery.select().single();

    if (error) {
      console.error('Error updating training record:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/haccp/training
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
      .select('id, company_id, store_id, current_store_id, current_haccp_store_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 현재 선택된 매장
    const currentStoreId = userProfile.current_haccp_store_id || userProfile.current_store_id || userProfile.store_id;

    // 기록 존재 여부 확인 (store_id 필터링 포함)
    let existingQuery = adminClient
      .from('haccp_training_records')
      .select('id, status, verified_by')
      .eq('id', id)
      .eq('company_id', userProfile.company_id);

    if (currentStoreId) {
      existingQuery = existingQuery.eq('store_id', currentStoreId);
    }

    const { data: existing } = await existingQuery.single();

    if (!existing) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    // 완료 및 검증된 교육기록은 삭제 불가
    if (existing.status === 'COMPLETED' && existing.verified_by) {
      return NextResponse.json(
        { error: '완료 및 검증된 교육기록은 삭제할 수 없습니다.' },
        { status: 400 }
      );
    }

    // 교육 기록 삭제 (store_id 필터링 포함)
    let deleteQuery = adminClient
      .from('haccp_training_records')
      .delete()
      .eq('id', id)
      .eq('company_id', userProfile.company_id);

    if (currentStoreId) {
      deleteQuery = deleteQuery.eq('store_id', currentStoreId);
    }

    const { error } = await deleteQuery;

    if (error) {
      console.error('Error deleting training record:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '교육 기록이 삭제되었습니다.' });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
