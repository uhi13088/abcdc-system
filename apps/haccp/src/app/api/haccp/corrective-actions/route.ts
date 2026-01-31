import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { addHours, addDays, format } from 'date-fns';

export const dynamic = 'force-dynamic';

// 심각도별 기한 계산
function calculateDueDates(severity: string, baseDate: Date) {
  switch (severity) {
    case 'CRITICAL':
      return {
        immediate: addHours(baseDate, 4),
        rootCause: addDays(baseDate, 1),
        corrective: addDays(baseDate, 3),
        verification: addDays(baseDate, 7),
      };
    case 'HIGH':
      return {
        immediate: addHours(baseDate, 24),
        rootCause: addDays(baseDate, 3),
        corrective: addDays(baseDate, 7),
        verification: addDays(baseDate, 14),
      };
    case 'MEDIUM':
      return {
        immediate: addDays(baseDate, 2),
        rootCause: addDays(baseDate, 5),
        corrective: addDays(baseDate, 14),
        verification: addDays(baseDate, 21),
      };
    default: // LOW
      return {
        immediate: addDays(baseDate, 3),
        rootCause: addDays(baseDate, 7),
        corrective: addDays(baseDate, 21),
        verification: addDays(baseDate, 30),
      };
  }
}

// 개선조치 번호 생성
function generateActionNumber(date: Date): string {
  const dateStr = format(date, 'yyyyMMdd');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `CA-${dateStr}-${random}`;
}

// 개선조치 목록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await adminClient
      .from('users')
      .select('company_id, store_id, current_store_id, current_haccp_store_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 현재 선택된 매장
    const currentStoreId = userData.current_store_id || userData.store_id;

    const status = request.nextUrl.searchParams.get('status');
    const sourceType = request.nextUrl.searchParams.get('source_type');
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50');

    // 기본 쿼리 (FK 조인 없이)
    let query = adminClient
      .from('corrective_actions')
      .select('*')
      .eq('company_id', userData.company_id);

    // store_id 필터링
    if (currentStoreId) {
      query = query.eq('store_id', currentStoreId);
    }

    if (status) {
      query = query.eq('status', status);
    }
    if (sourceType) {
      query = query.eq('source_type', sourceType);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      // 테이블이 없으면 빈 배열 반환
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json([]);
      }
      console.error('Failed to fetch corrective actions:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json([]);
    }

    // 담당자 및 검증자 정보 별도 조회 (더 안정적)
    const userIds = new Set<string>();
    data.forEach(action => {
      if (action.responsible_person) userIds.add(action.responsible_person);
      if (action.verified_by) userIds.add(action.verified_by);
    });

    let usersMap: Record<string, { id: string; name: string }> = {};
    if (userIds.size > 0) {
      const { data: users } = await adminClient
        .from('users')
        .select('id, name')
        .in('id', Array.from(userIds));

      if (users) {
        usersMap = users.reduce((acc, u) => {
          acc[u.id] = u;
          return acc;
        }, {} as Record<string, { id: string; name: string }>);
      }
    }

    // 데이터에 사용자 정보 병합
    const enrichedData = data.map(action => ({
      ...action,
      responsible: action.responsible_person ? usersMap[action.responsible_person] || null : null,
      verifier: action.verified_by ? usersMap[action.verified_by] || null : null,
    }));

    return NextResponse.json(enrichedData);
  } catch (error) {
    console.error('Failed to fetch corrective actions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// 개선조치 생성
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await adminClient
      .from('users')
      .select('id, company_id, store_id, current_store_id, current_haccp_store_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 현재 선택된 매장
    const currentStoreId = userData.current_store_id || userData.store_id;

    const body = await request.json();
    const {
      source_type,
      source_id,
      problem_description,
      severity = 'HIGH',
      immediate_action,
      responsible_person,
    } = body;

    if (!source_type || !problem_description) {
      return NextResponse.json(
        { error: 'source_type and problem_description are required' },
        { status: 400 }
      );
    }

    const now = new Date();
    const dueDates = calculateDueDates(severity, now);

    const { data, error } = await adminClient
      .from('corrective_actions')
      .insert({
        company_id: userData.company_id,
        store_id: currentStoreId || null,
        action_number: generateActionNumber(now),
        action_date: format(now, 'yyyy-MM-dd'),
        source_type,
        source_id,
        problem_description,
        immediate_action,
        corrective_action: '', // 나중에 입력
        responsible_person,
        due_date: format(dueDates.corrective, 'yyyy-MM-dd'),
        status: 'OPEN',
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .select()
      .single();

    if (error || !data) {
      // 테이블이 없으면 null 반환
      if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
        return NextResponse.json(null);
      }
      console.error('Failed to create corrective action:', error);
      return NextResponse.json({ error: error?.message || 'Failed to create corrective action' }, { status: 500 });
    }

    // 담당자에게 알림 생성
    if (responsible_person && data?.id) {
      try {
        await adminClient.from('notifications').insert({
          user_id: responsible_person,
          category: 'HACCP',
          priority: severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
          title: '개선조치 배정',
          body: `새로운 개선조치가 배정되었습니다: ${problem_description.substring(0, 50)}`,
          deep_link: `/corrective-actions/${data.id}`,
        });
      } catch (notificationError) {
        console.error('Failed to send notification:', notificationError);
        // Continue even if notification fails
      }
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to create corrective action:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// 개선조치 수정
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await adminClient
      .from('users')
      .select('id, company_id, store_id, current_store_id, current_haccp_store_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 현재 선택된 매장
    const currentStoreId = userData.current_store_id || userData.store_id;

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    // 상태 변경 시 검증 정보 자동 설정
    if (updateData.status === 'VERIFIED' || updateData.status === 'CLOSED') {
      if (!updateData.verified_by) {
        updateData.verified_by = userData.id;
      }
      if (!updateData.verification_date) {
        updateData.verification_date = format(new Date(), 'yyyy-MM-dd');
      }
    }

    let updateQuery = adminClient
      .from('corrective_actions')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('company_id', userData.company_id);

    if (currentStoreId) {
      updateQuery = updateQuery.eq('store_id', currentStoreId);
    }

    const { data, error } = await updateQuery.select().single();

    if (error) {
      console.error('Failed to update corrective action:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to update corrective action:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/haccp/corrective-actions
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await adminClient
      .from('users')
      .select('id, company_id, store_id, current_store_id, current_haccp_store_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 현재 선택된 매장
    const currentStoreId = userData.current_store_id || userData.store_id;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    // 기록 존재 여부 확인 (store_id 필터링 포함)
    let existingQuery = adminClient
      .from('corrective_actions')
      .select('id, status')
      .eq('id', id)
      .eq('company_id', userData.company_id);

    if (currentStoreId) {
      existingQuery = existingQuery.eq('store_id', currentStoreId);
    }

    const { data: existing } = await existingQuery.single();

    if (!existing) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    // 검증/완료된 개선조치는 삭제 불가
    if (existing.status === 'VERIFIED' || existing.status === 'CLOSED') {
      return NextResponse.json(
        { error: '검증 또는 종료된 개선조치는 삭제할 수 없습니다.' },
        { status: 400 }
      );
    }

    // 개선조치 삭제 (store_id 필터링 포함)
    let deleteQuery = adminClient
      .from('corrective_actions')
      .delete()
      .eq('id', id)
      .eq('company_id', userData.company_id);

    if (currentStoreId) {
      deleteQuery = deleteQuery.eq('store_id', currentStoreId);
    }

    const { error } = await deleteQuery;

    if (error) {
      console.error('Failed to delete corrective action:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '개선조치가 삭제되었습니다.' });
  } catch (error) {
    console.error('Failed to delete corrective action:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
