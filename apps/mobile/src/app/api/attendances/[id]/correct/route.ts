/**
 * POST /api/attendances/[id]/correct - 직원 출퇴근 수정 요청
 * 직원이 자신의 출퇴근 기록 수정을 요청 (관리자 승인 필요)
 */

import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_MINIMUM_WAGE } from '@abc/shared';

export const dynamic = 'force-dynamic';

// 근무 시간 및 급여 미리 계산
function calculateWorkHoursAndPay(
  checkIn: Date,
  checkOut: Date,
  hourlyRate: number = DEFAULT_MINIMUM_WAGE
) {
  const diffMs = checkOut.getTime() - checkIn.getTime();
  const rawHours = diffMs / (1000 * 60 * 60);

  const breakHours = rawHours >= 8 ? 1 : rawHours >= 4 ? 0.5 : 0;
  const workHours = Math.max(0, rawHours - breakHours);

  const overtimeHours = Math.max(0, workHours - 8);
  const regularHours = Math.min(workHours, 8);

  const checkOutHour = checkOut.getHours();
  let nightHours = 0;
  if (checkOutHour >= 22 || checkOutHour < 6) {
    nightHours = Math.min(overtimeHours, 2);
  }

  const basePay = Math.round(regularHours * hourlyRate);
  const overtimePay = Math.round(overtimeHours * hourlyRate * 1.5);
  const nightPay = Math.round(nightHours * hourlyRate * 0.5);

  return {
    workHours: Math.round(workHours * 100) / 100,
    basePay,
    overtimePay,
    nightPay,
    dailyTotal: basePay + overtimePay + nightPay,
  };
}

// 관리자들에게 알림 발송
async function notifyManagers(
  adminClient: any,
  companyId: string,
  storeId: string | null,
  staffName: string,
  workDate: string,
  requestId: string
) {
  try {
    let managerQuery = adminClient
      .from('users')
      .select('id')
      .eq('company_id', companyId)
      .in('role', ['company_admin', 'manager', 'store_manager']);

    if (storeId) {
      managerQuery = adminClient
        .from('users')
        .select('id')
        .eq('company_id', companyId)
        .or(`store_id.eq.${storeId},role.eq.company_admin`);
    }

    const { data: managers } = await managerQuery;

    if (managers && managers.length > 0) {
      const notifications = managers.map((manager: { id: string }) => ({
        user_id: manager.id,
        category: 'ATTENDANCE',
        priority: 'HIGH',
        title: `[수정 요청] ${staffName}`,
        body: `${staffName}님이 ${workDate} 출퇴근 기록 수정을 요청했습니다. 승인이 필요합니다.`,
        deep_link: `/attendance-corrections/${requestId}`,
        reference_type: 'CORRECTION_REQUEST',
        reference_id: requestId,
        data: {
          request_id: requestId,
          staff_name: staffName,
          work_date: workDate,
        },
      }));

      await adminClient.from('notifications').insert(notifications);
    }
  } catch (error) {
    console.error('Failed to notify managers:', error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const attendanceId = params.id;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: userData } = await adminClient
      .from('users')
      .select('id, name, company_id, store_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get the attendance record - verify ownership
    const { data: attendance, error: attendanceError } = await adminClient
      .from('attendances')
      .select('*')
      .eq('id', attendanceId)
      .single();

    if (attendanceError || !attendance) {
      return NextResponse.json({ error: '출퇴근 기록을 찾을 수 없습니다.' }, { status: 404 });
    }

    // Only allow users to modify their own attendance
    if (attendance.staff_id !== userData.id) {
      return NextResponse.json({ error: '본인의 출퇴근 기록만 수정할 수 있습니다.' }, { status: 403 });
    }

    const body = await request.json();
    const {
      corrected_check_in,
      corrected_check_out,
      corrected_status,
      correction_reason
    } = body;

    if (!corrected_check_in && !corrected_check_out && !corrected_status) {
      return NextResponse.json(
        { error: '수정할 내용을 입력해주세요.' },
        { status: 400 }
      );
    }

    if (!correction_reason || correction_reason.trim().length < 2) {
      return NextResponse.json(
        { error: '수정 사유를 입력해주세요.' },
        { status: 400 }
      );
    }

    // 이미 대기중인 요청이 있는지 확인
    const { data: pendingRequest } = await adminClient
      .from('attendance_correction_requests')
      .select('id')
      .eq('attendance_id', attendanceId)
      .eq('status', 'PENDING')
      .single();

    if (pendingRequest) {
      return NextResponse.json(
        { error: '이미 대기 중인 수정 요청이 있습니다.' },
        { status: 400 }
      );
    }

    // 요청 타입 결정
    let requestType = 'BOTH';
    if (corrected_check_in && !corrected_check_out) {
      requestType = 'CHECK_IN';
    } else if (!corrected_check_in && corrected_check_out) {
      requestType = 'CHECK_OUT';
    } else if (corrected_status && !corrected_check_in && !corrected_check_out) {
      requestType = 'STATUS';
    }

    // 급여 미리 계산 (승인 시 반영될 값)
    const checkIn = corrected_check_in
      ? new Date(corrected_check_in)
      : attendance.actual_check_in
        ? new Date(attendance.actual_check_in)
        : null;

    const checkOut = corrected_check_out
      ? new Date(corrected_check_out)
      : attendance.actual_check_out
        ? new Date(attendance.actual_check_out)
        : null;

    let calculatedPay = null;
    if (checkIn && checkOut) {
      calculatedPay = calculateWorkHoursAndPay(checkIn, checkOut);
    }

    // 수정 요청 생성
    const { data: correctionRequest, error: insertError } = await adminClient
      .from('attendance_correction_requests')
      .insert({
        attendance_id: attendanceId,
        requested_by: userData.id,
        company_id: userData.company_id,
        store_id: userData.store_id,
        request_type: requestType,
        original_check_in: attendance.actual_check_in,
        original_check_out: attendance.actual_check_out,
        original_status: attendance.status,
        requested_check_in: corrected_check_in || null,
        requested_check_out: corrected_check_out || null,
        requested_status: corrected_status || null,
        reason: correction_reason,
        status: 'PENDING',
        calculated_work_hours: calculatedPay?.workHours || null,
        calculated_base_pay: calculatedPay?.basePay || null,
        calculated_overtime_pay: calculatedPay?.overtimePay || null,
        calculated_night_pay: calculatedPay?.nightPay || null,
        calculated_daily_total: calculatedPay?.dailyTotal || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Correction request insert error:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // 관리자에게 알림 발송
    await notifyManagers(
      adminClient,
      userData.company_id,
      userData.store_id,
      userData.name,
      attendance.work_date,
      correctionRequest.id
    );

    return NextResponse.json({
      success: true,
      message: '수정 요청이 접수되었습니다. 관리자 승인 후 반영됩니다.',
      data: correctionRequest,
    });
  } catch (error) {
    console.error('Attendance correction request error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// GET - 해당 출퇴근 기록의 수정 요청 상태 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const attendanceId = params.id;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await adminClient
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 해당 출퇴근의 수정 요청 조회
    const { data: requests, error } = await adminClient
      .from('attendance_correction_requests')
      .select('*')
      .eq('attendance_id', attendanceId)
      .eq('requested_by', userData.id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(requests || []);
  } catch (error) {
    console.error('Error fetching correction requests:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
