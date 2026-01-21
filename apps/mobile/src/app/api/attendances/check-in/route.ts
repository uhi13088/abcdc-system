import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getTodayKorea } from '@/lib/date-utils';

export const dynamic = 'force-dynamic';

// 출근 상태 판단 함수
// 출근 시점에서는 WORKING(근무중), LATE(지각), EARLY_CHECK_IN(조기출근) 상태를 반환
// 퇴근 시 check-out API에서 최종 상태(NORMAL, OVERTIME, EARLY_LEAVE 등)로 업데이트
function determineCheckInStatus(
  checkInTime: Date,
  scheduledCheckIn: Date | null
): { status: string; isAbnormal: boolean; message: string } {
  // 예정 출근 시간이 없으면 근무중 상태
  if (!scheduledCheckIn) {
    return { status: 'WORKING', isAbnormal: false, message: '' };
  }

  const diffMinutes = (checkInTime.getTime() - scheduledCheckIn.getTime()) / (1000 * 60);

  // 30분 이상 일찍 출근 = 조기출근
  if (diffMinutes <= -30) {
    const earlyMinutes = Math.abs(Math.round(diffMinutes));
    return {
      status: 'EARLY_CHECK_IN',
      isAbnormal: true,
      message: `예정 시간보다 ${earlyMinutes}분 일찍 출근했습니다.`,
    };
  }

  // 5분 이상 늦게 출근 = 지각
  if (diffMinutes >= 5) {
    const lateMinutes = Math.round(diffMinutes);
    return {
      status: 'LATE',
      isAbnormal: true,
      message: `예정 시간보다 ${lateMinutes}분 늦게 출근했습니다.`,
    };
  }

  // 정상 시간 출근 = 근무중 (퇴근 시 NORMAL로 변경됨)
  return { status: 'WORKING', isAbnormal: false, message: '' };
}

// 관리자들에게 알림 발송
async function notifyManagers(
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
    // 매장 관리자 및 회사 관리자 조회
    let managerQuery = adminClient
      .from('users')
      .select('id')
      .eq('company_id', companyId)
      .in('role', ['company_admin', 'manager', 'store_manager']);

    if (storeId) {
      // 해당 매장 관리자 또는 회사 전체 관리자
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

export async function POST() {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile from auth_id
    const { data: userData } = await adminClient
      .from('users')
      .select('id, name, company_id, brand_id, store_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const today = getTodayKorea();
    const now = new Date();
    const nowISO = now.toISOString();

    // Check if already checked in
    const { data: existingAttendance } = await adminClient
      .from('attendances')
      .select('id, actual_check_in')
      .eq('staff_id', userData.id)
      .eq('work_date', today)
      .single();

    if (existingAttendance?.actual_check_in) {
      return NextResponse.json({ error: 'Already checked in' }, { status: 400 });
    }

    // 오늘 스케줄 조회
    const { data: todaySchedule } = await adminClient
      .from('schedules')
      .select('start_time, end_time')
      .eq('staff_id', userData.id)
      .eq('work_date', today)
      .maybeSingle();

    // 출근 상태 판단
    let scheduledCheckIn: Date | null = null;
    let scheduledCheckOut: Date | null = null;

    if (todaySchedule?.start_time) {
      scheduledCheckIn = new Date(todaySchedule.start_time);
    }
    if (todaySchedule?.end_time) {
      scheduledCheckOut = new Date(todaySchedule.end_time);
    }

    // 스케줄이 없으면 계약서의 work_schedules에서 해당 요일 시간 가져오기
    if (!scheduledCheckIn || !scheduledCheckOut) {
      const dayOfWeek = now.getDay(); // 0=일, 1=월, ..., 6=토

      const { data: contract } = await adminClient
        .from('contracts')
        .select('work_schedules')
        .eq('staff_id', userData.id)
        .eq('status', 'SIGNED')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (contract?.work_schedules && Array.isArray(contract.work_schedules)) {
        // work_schedules 형식: { daysOfWeek: number[], startTime: string, endTime: string }
        const todayWorkSchedule = contract.work_schedules.find(
          (ws: { daysOfWeek: number[] }) => ws.daysOfWeek?.includes(dayOfWeek)
        );
        if (todayWorkSchedule) {
          // work_schedules의 시간을 오늘 날짜에 적용
          if (todayWorkSchedule.startTime && !scheduledCheckIn) {
            const [hours, minutes] = todayWorkSchedule.startTime.split(':');
            const checkInTime = new Date(today);
            checkInTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
            scheduledCheckIn = checkInTime;
          }
          if (todayWorkSchedule.endTime && !scheduledCheckOut) {
            const [hours, minutes] = todayWorkSchedule.endTime.split(':');
            const checkOutTime = new Date(today);
            checkOutTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
            scheduledCheckOut = checkOutTime;
          }
        }
      }
    }

    const { status, isAbnormal, message } = determineCheckInStatus(now, scheduledCheckIn);

    // Create or update attendance record using adminClient to bypass RLS
    const { data, error } = await adminClient
      .from('attendances')
      .upsert({
        staff_id: userData.id,
        company_id: userData.company_id,
        brand_id: userData.brand_id,
        store_id: userData.store_id,
        work_date: today,
        actual_check_in: nowISO,
        scheduled_check_in: scheduledCheckIn?.toISOString() || null,
        scheduled_check_out: scheduledCheckOut?.toISOString() || null,
        status,
        check_in_method: 'MANUAL',
      })
      .select()
      .single();

    if (error) throw error;

    // 이상 상황 시 관리자에게 알림
    if (isAbnormal && userData.company_id) {
      const statusLabel = status === 'LATE' ? '지각' : '조기출근';
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
    console.error('Error checking in:', error);
    return NextResponse.json({ error: 'Failed to check in' }, { status: 500 });
  }
}
