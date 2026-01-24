import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { DEFAULT_MINIMUM_WAGE, ALLOWANCE_RATES, DAILY_WORK_HOURS } from '@abc/shared';
import { getTodayKorea } from '@/lib/date-utils';

export const dynamic = 'force-dynamic';

// 퇴근 상태 판단 함수
// 출근 시 상태(currentStatus)와 퇴근 시간을 바탕으로 최종 상태 결정
function determineCheckOutStatus(
  checkOutTime: Date,
  scheduledCheckOut: Date | null,
  currentStatus: string
): { status: string; isAbnormal: boolean; message: string } {
  // 지각 상태인 경우
  if (currentStatus === 'LATE') {
    if (scheduledCheckOut) {
      const diffMinutes = (checkOutTime.getTime() - scheduledCheckOut.getTime()) / (1000 * 60);
      // 지각 + 조퇴
      if (diffMinutes <= -30) {
        const earlyMinutes = Math.abs(Math.round(diffMinutes));
        return {
          status: 'LATE_AND_EARLY_LEAVE',
          isAbnormal: true,
          message: `지각 후 예정 시간보다 ${earlyMinutes}분 일찍 퇴근했습니다.`,
        };
      }
      // 지각 + 연장근무 → 지각 유지 (연장근무로 만회)
      if (diffMinutes >= 15) {
        return { status: 'LATE', isAbnormal: false, message: '' };
      }
    }
    return { status: 'LATE', isAbnormal: false, message: '' };
  }

  // 예정 퇴근 시간이 없으면 정상 처리
  if (!scheduledCheckOut) {
    return { status: 'NORMAL', isAbnormal: false, message: '' };
  }

  const diffMinutes = (checkOutTime.getTime() - scheduledCheckOut.getTime()) / (1000 * 60);

  // 30분 이상 일찍 퇴근 = 조퇴
  if (diffMinutes <= -30) {
    const earlyMinutes = Math.abs(Math.round(diffMinutes));
    return {
      status: 'EARLY_LEAVE',
      isAbnormal: true,
      message: `예정 시간보다 ${earlyMinutes}분 일찍 퇴근했습니다.`,
    };
  }

  // 15분 이상 늦게 퇴근 = 연장근무
  if (diffMinutes >= 15) {
    const overtimeMinutes = Math.round(diffMinutes);
    const hours = Math.floor(overtimeMinutes / 60);
    const mins = overtimeMinutes % 60;
    const timeDisplay = hours > 0 ? `${hours}시간 ${mins}분` : `${mins}분`;
    return {
      status: 'OVERTIME',
      isAbnormal: true,
      message: `예정 시간보다 ${timeDisplay} 연장 근무했습니다.`,
    };
  }

  // WORKING, EARLY_CHECK_IN 등 → 정상 퇴근
  return { status: 'NORMAL', isAbnormal: false, message: '' };
}

// 관리자들에게 알림 발송
async function notifyManagers(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminClient: any,
  companyId: string,
  storeId: string | null,
  staffName: string,
  title: string,
  body: string,
  attendanceId: string,
  workDate: string
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
        title,
        body,
        deep_link: `/attendances/${attendanceId}`,
        reference_type: 'ATTENDANCE',
        reference_id: attendanceId,
        data: {
          attendance_id: attendanceId,
          work_date: workDate,
          staff_name: staffName,
        },
      }));

      await adminClient.from('notifications').insert(notifications);
    }
  } catch (error) {
    console.error('Failed to notify managers:', error);
  }
}

// 근무 시간 및 급여 계산
function calculateWorkHoursAndPay(
  checkIn: Date,
  checkOut: Date,
  hourlyRate: number = DEFAULT_MINIMUM_WAGE
) {
  const diffMs = checkOut.getTime() - checkIn.getTime();
  const rawHours = diffMs / (1000 * 60 * 60);

  // 휴게시간 계산 (4시간 초과: 30분, 8시간 초과: 1시간)
  const breakHours = rawHours >= DAILY_WORK_HOURS ? 1 : rawHours >= 4 ? 0.5 : 0;
  const workHours = Math.max(0, rawHours - breakHours);

  // 연장근무 계산 (8시간 초과분)
  const overtimeHours = Math.max(0, workHours - DAILY_WORK_HOURS);
  const regularHours = Math.min(workHours, DAILY_WORK_HOURS);

  // 야간근무 계산 (22시-06시)
  const checkOutHour = checkOut.getHours();
  let nightHours = 0;
  if (checkOutHour >= 22 || checkOutHour < 6) {
    nightHours = Math.min(overtimeHours, 2);
  }

  const basePay = Math.round(regularHours * hourlyRate);
  const overtimePay = Math.round(overtimeHours * hourlyRate * ALLOWANCE_RATES.overtime);
  const nightPay = Math.round(nightHours * hourlyRate * ALLOWANCE_RATES.night);

  return {
    workHours: Math.round(workHours * 100) / 100,
    breakHours,
    overtimeHours: Math.round(overtimeHours * 100) / 100,
    nightHours,
    basePay,
    overtimePay,
    nightPay,
    dailyTotal: basePay + overtimePay + nightPay,
  };
}

export async function POST() {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile ID from auth_id
    const { data: userData } = await adminClient
      .from('users')
      .select('id, name, company_id, store_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const today = getTodayKorea();
    const now = new Date();
    const nowISO = now.toISOString();

    // Get today's attendance record
    const { data: existingAttendance } = await adminClient
      .from('attendances')
      .select('id, actual_check_in, actual_check_out, scheduled_check_out, status')
      .eq('staff_id', userData.id)
      .eq('work_date', today)
      .single();

    if (!existingAttendance?.actual_check_in) {
      return NextResponse.json({ error: 'Not checked in yet' }, { status: 400 });
    }

    if (existingAttendance?.actual_check_out) {
      return NextResponse.json({ error: 'Already checked out' }, { status: 400 });
    }

    // 퇴근 상태 판단
    const scheduledCheckOut = existingAttendance.scheduled_check_out
      ? new Date(existingAttendance.scheduled_check_out)
      : null;

    const { status, isAbnormal, message } = determineCheckOutStatus(
      now,
      scheduledCheckOut,
      existingAttendance.status
    );

    // 근무 시간 및 급여 계산
    const checkInTime = new Date(existingAttendance.actual_check_in);
    const payData = calculateWorkHoursAndPay(checkInTime, now);

    // Update attendance record with check-out time using adminClient
    const { data, error } = await adminClient
      .from('attendances')
      .update({
        actual_check_out: nowISO,
        status,
        work_hours: payData.workHours,
        break_hours: payData.breakHours,
        overtime_hours: payData.overtimeHours,
        night_hours: payData.nightHours,
        base_pay: payData.basePay,
        overtime_pay: payData.overtimePay,
        night_pay: payData.nightPay,
        daily_total: payData.dailyTotal,
      })
      .eq('id', existingAttendance.id)
      .select()
      .single();

    if (error) throw error;

    // 이상 상황 시 관리자에게 알림
    if (isAbnormal && userData.company_id) {
      let statusLabel = '조퇴';
      if (status === 'OVERTIME') statusLabel = '연장근무';
      if (status === 'LATE_AND_EARLY_LEAVE') statusLabel = '지각+조퇴';

      await notifyManagers(
        adminClient,
        userData.company_id,
        userData.store_id,
        userData.name,
        `[${statusLabel}] ${userData.name}`,
        message,
        data.id,
        today
      );
    }

    return NextResponse.json({
      ...data,
      status_message: isAbnormal ? message : null,
    });
  } catch (error) {
    console.error('Error checking out:', error);
    return NextResponse.json({ error: 'Failed to check out' }, { status: 500 });
  }
}
