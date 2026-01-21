/**
 * GET /api/attendance-corrections/[id] - 수정 요청 상세 조회
 * PATCH /api/attendance-corrections/[id] - 수정 요청 승인/거절
 */

import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// 수정 요청 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const requestId = id;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('id, role, company_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 관리자만 조회 가능
    if (!['super_admin', 'company_admin', 'manager'].includes(userData.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: correctionRequest, error } = await adminClient
      .from('attendance_correction_requests')
      .select(`
        *,
        requester:users!attendance_correction_requests_requested_by_fkey(id, name, email, position),
        attendance:attendances(
          id,
          work_date,
          actual_check_in,
          actual_check_out,
          scheduled_check_in,
          scheduled_check_out,
          status,
          work_hours,
          base_pay,
          overtime_pay,
          night_pay,
          daily_total
        )
      `)
      .eq('id', requestId)
      .single();

    if (error || !correctionRequest) {
      return NextResponse.json({ error: '수정 요청을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 회사 권한 체크
    if (userData.role !== 'super_admin' && correctionRequest.company_id !== userData.company_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(correctionRequest);
  } catch (error) {
    console.error('Error fetching correction request:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// 수정 요청 승인/거절
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const requestId = id;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('id, name, role, company_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 관리자만 처리 가능
    if (!['super_admin', 'company_admin', 'manager'].includes(userData.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 수정 요청 조회
    const { data: correctionRequest, error: fetchError } = await adminClient
      .from('attendance_correction_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchError || !correctionRequest) {
      return NextResponse.json({ error: '수정 요청을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 회사 권한 체크
    if (userData.role !== 'super_admin' && correctionRequest.company_id !== userData.company_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 이미 처리된 요청인지 확인
    if (correctionRequest.status !== 'PENDING') {
      return NextResponse.json({ error: '이미 처리된 요청입니다.' }, { status: 400 });
    }

    const body = await request.json();
    const { action, rejection_reason } = body;

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const now = new Date().toISOString();

    if (action === 'reject') {
      // 거절 처리
      const { error: updateError } = await adminClient
        .from('attendance_correction_requests')
        .update({
          status: 'REJECTED',
          processed_by: userData.id,
          processed_at: now,
          rejection_reason: rejection_reason || null,
        })
        .eq('id', requestId);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      // 직원에게 거절 알림
      await adminClient.from('notifications').insert({
        user_id: correctionRequest.requested_by,
        category: 'ATTENDANCE',
        priority: 'HIGH',
        title: '출퇴근 수정 요청 거절',
        body: `출퇴근 수정 요청이 거절되었습니다.${rejection_reason ? ` 사유: ${rejection_reason}` : ''}`,
        deep_link: `/attendance/${correctionRequest.attendance_id}`,
        reference_type: 'CORRECTION_REJECTED',
        reference_id: requestId,
      });

      return NextResponse.json({
        success: true,
        message: '수정 요청이 거절되었습니다.',
      });
    }

    // 승인 처리
    // 1. 출퇴근 기록 업데이트
    const attendanceUpdate: Record<string, any> = {
      admin_corrected_at: now,
      admin_corrected_by: userData.id,
      admin_correction_reason: `수정 요청 승인: ${correctionRequest.reason}`,
    };

    if (correctionRequest.requested_check_in) {
      attendanceUpdate.actual_check_in = correctionRequest.requested_check_in;
    }
    if (correctionRequest.requested_check_out) {
      attendanceUpdate.actual_check_out = correctionRequest.requested_check_out;
    }
    if (correctionRequest.requested_status) {
      attendanceUpdate.status = correctionRequest.requested_status;
    }

    // 급여 정보 업데이트 (미리 계산된 값 사용)
    if (correctionRequest.calculated_work_hours !== null) {
      attendanceUpdate.work_hours = correctionRequest.calculated_work_hours;
      attendanceUpdate.base_pay = correctionRequest.calculated_base_pay;
      attendanceUpdate.overtime_pay = correctionRequest.calculated_overtime_pay;
      attendanceUpdate.night_pay = correctionRequest.calculated_night_pay;
      attendanceUpdate.daily_total = correctionRequest.calculated_daily_total;
    }

    const { error: attendanceError } = await adminClient
      .from('attendances')
      .update(attendanceUpdate)
      .eq('id', correctionRequest.attendance_id);

    if (attendanceError) {
      console.error('Attendance update error:', attendanceError);
      return NextResponse.json({ error: attendanceError.message }, { status: 500 });
    }

    // 2. 수정 요청 상태 업데이트
    const { error: requestUpdateError } = await adminClient
      .from('attendance_correction_requests')
      .update({
        status: 'APPROVED',
        processed_by: userData.id,
        processed_at: now,
      })
      .eq('id', requestId);

    if (requestUpdateError) {
      console.error('Request update error:', requestUpdateError);
      return NextResponse.json({ error: requestUpdateError.message }, { status: 500 });
    }

    // 3. 직원에게 승인 알림
    await adminClient.from('notifications').insert({
      user_id: correctionRequest.requested_by,
      category: 'ATTENDANCE',
      priority: 'NORMAL',
      title: '출퇴근 수정 요청 승인',
      body: '출퇴근 수정 요청이 승인되어 급여에 반영되었습니다.',
      deep_link: `/attendance/${correctionRequest.attendance_id}`,
      reference_type: 'CORRECTION_APPROVED',
      reference_id: requestId,
    });

    return NextResponse.json({
      success: true,
      message: '수정 요청이 승인되어 급여에 반영되었습니다.',
    });
  } catch (error) {
    console.error('Error processing correction request:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
