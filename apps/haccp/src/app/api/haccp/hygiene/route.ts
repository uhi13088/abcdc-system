import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient, createAdminClient } from '@/lib/supabase/server';
import { checkVerificationPermission } from '@/lib/utils/verification-permission';

export const dynamic = 'force-dynamic';

interface HygieneCheckRequest {
  check_date: string;
  check_period: '작업전' | '작업중' | '작업후';
  pre_work_checks?: Record<string, boolean | number>;
  during_work_checks?: Record<string, boolean | number>;
  post_work_checks?: Record<string, boolean | number>;
  temperature_records?: Record<string, number>;
  remarks?: string;
  improvement_result?: string;
  overall_status: 'PASS' | 'FAIL';
}

// GET /api/haccp/hygiene
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const period = searchParams.get('period'); // 특정 작업 기간만 조회

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await adminClient
      .from('users')
      .select('company_id, store_id, current_store_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 현재 선택된 매장
    const currentStoreId = userProfile.current_store_id || userProfile.store_id;

    let query = adminClient
      .from('daily_hygiene_checks')
      .select(`
        *,
        checked_by_user:checked_by (name),
        verified_by_user:verified_by (name)
      `)
      .eq('company_id', userProfile.company_id)
      .eq('check_date', date);

    // store_id 필터링
    if (currentStoreId) {
      query = query.eq('store_id', currentStoreId);
    }

    if (period) {
      query = query.eq('check_period', period);
    }

    const { data, error } = await query.order('created_at', { ascending: true });

    if (error) {
      // 테이블이 없으면 빈 배열 반환
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json([]);
      }
      console.error('Error fetching hygiene checks:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    interface HygieneCheckRow {
      id: string;
      check_date: string;
      check_period: string;
      shift?: string;
      pre_work_checks?: Record<string, boolean | number>;
      during_work_checks?: Record<string, boolean | number>;
      post_work_checks?: Record<string, boolean | number>;
      temperature_records?: Record<string, number>;
      remarks?: string;
      improvement_result?: string;
      overall_status: 'PASS' | 'FAIL';
      checked_by_user?: { name: string } | null;
      verified_by_user?: { name: string } | null;
      checked_by_name?: string;
      verified_by_name?: string;
      verified_at?: string;
      corrective_action?: string;
      created_at: string;
    }

    const result = (data || []).map((c: HygieneCheckRow) => ({
      ...c,
      checked_by_name: c.checked_by_name || c.checked_by_user?.name,
      verified_by_name: c.verified_by_name || c.verified_by_user?.name,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/haccp/hygiene
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();
    const body: HygieneCheckRequest = await request.json();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await adminClient
      .from('users')
      .select('id, company_id, name, store_id, current_store_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 현재 선택된 매장
    const currentStoreId = userProfile.current_store_id || userProfile.store_id;

    // 온도 기록이 있으면 equipment_temperature_records에도 저장
    if (body.temperature_records) {
      const tempRecords = Object.entries(body.temperature_records).map(
        ([location, temp]) => ({
          company_id: userProfile.company_id,
          store_id: currentStoreId || null,
          record_date: body.check_date,
          record_time: new Date().toTimeString().split(' ')[0],
          equipment_location: location,
          temperature: temp,
          input_type: 'manual',
          recorded_by: userProfile.id,
        })
      );

      if (tempRecords.length > 0) {
        await adminClient.from('equipment_temperature_records').insert(tempRecords);
      }
    }

    const { data, error } = await adminClient
      .from('daily_hygiene_checks')
      .insert({
        company_id: userProfile.company_id,
        store_id: currentStoreId || null,
        checked_by: userProfile.id,
        checked_by_name: userProfile.name,
        check_date: body.check_date,
        check_period: body.check_period,
        pre_work_checks: body.pre_work_checks || {},
        during_work_checks: body.during_work_checks || {},
        post_work_checks: body.post_work_checks || {},
        temperature_records: body.temperature_records || {},
        remarks: body.remarks,
        improvement_result: body.improvement_result,
        overall_status: body.overall_status,
        // 기존 shift 필드도 호환성을 위해 설정
        shift: body.check_period === '작업전' ? '오전' : body.check_period === '작업중' ? '오후' : '야간',
      })
      .select()
      .single();

    if (error) {
      // 테이블이 없으면 null 반환
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json(null);
      }
      console.error('Error creating hygiene check:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/haccp/hygiene - 검증(승인) 처리
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();
    const body = await request.json();
    const { id, action, corrective_action, improvement_result } = body;

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await adminClient
      .from('users')
      .select('id, company_id, name, role, store_id, current_store_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 현재 선택된 매장
    const currentStoreId = userProfile.current_store_id || userProfile.store_id;

    interface UpdateData {
      verified_by?: string;
      verified_by_name?: string;
      verified_at?: string;
      corrective_action?: string;
      improvement_result?: string;
    }

    let updateData: UpdateData = {};

    if (action === 'verify') {
      // 검증 대상 기록 조회 (작성자 확인용)
      let recordQuery = adminClient
        .from('daily_hygiene_checks')
        .select('checked_by')
        .eq('id', id)
        .eq('company_id', userProfile.company_id);

      if (currentStoreId) {
        recordQuery = recordQuery.eq('store_id', currentStoreId);
      }

      const { data: record } = await recordQuery.single();

      if (!record) {
        return NextResponse.json({ error: 'Record not found' }, { status: 404 });
      }

      // 검증 권한 체크
      const permissionCheck = await checkVerificationPermission(
        userProfile.company_id,
        userProfile.id,
        userProfile.role,
        'hygiene',
        record.checked_by
      );

      if (!permissionCheck.allowed) {
        return NextResponse.json(
          { error: permissionCheck.reason },
          { status: 403 }
        );
      }

      updateData = {
        verified_by: userProfile.id,
        verified_by_name: userProfile.name,
        verified_at: new Date().toISOString(),
      };
    }

    if (corrective_action) {
      updateData.corrective_action = corrective_action;
    }

    if (improvement_result) {
      updateData.improvement_result = improvement_result;
    }

    let updateQuery = adminClient
      .from('daily_hygiene_checks')
      .update(updateData)
      .eq('id', id)
      .eq('company_id', userProfile.company_id);

    if (currentStoreId) {
      updateQuery = updateQuery.eq('store_id', currentStoreId);
    }

    const { data, error } = await updateQuery.select().single();

    if (error) {
      console.error('Error updating hygiene check:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/haccp/hygiene
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
      .select('id, company_id, store_id, current_store_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 현재 선택된 매장
    const currentStoreId = userProfile.current_store_id || userProfile.store_id;

    // 기록 존재 여부 확인 (store_id 필터링 포함)
    let existingQuery = adminClient
      .from('daily_hygiene_checks')
      .select('id, verified_by')
      .eq('id', id)
      .eq('company_id', userProfile.company_id);

    if (currentStoreId) {
      existingQuery = existingQuery.eq('store_id', currentStoreId);
    }

    const { data: existing } = await existingQuery.single();

    if (!existing) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    // 검증된 기록은 삭제 불가
    if (existing.verified_by) {
      return NextResponse.json(
        { error: '검증된 위생점검 기록은 삭제할 수 없습니다.' },
        { status: 400 }
      );
    }

    // 위생점검 기록 삭제
    let deleteQuery = adminClient
      .from('daily_hygiene_checks')
      .delete()
      .eq('id', id)
      .eq('company_id', userProfile.company_id);

    if (currentStoreId) {
      deleteQuery = deleteQuery.eq('store_id', currentStoreId);
    }

    const { error } = await deleteQuery;

    if (error) {
      console.error('Error deleting hygiene check:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '위생점검 기록이 삭제되었습니다.' });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
