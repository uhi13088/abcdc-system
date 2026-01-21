import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getTodayKorea } from '@/lib/date-utils';

export const dynamic = 'force-dynamic';

// 출근 상태 판단 함수
// 출근 시점에서는 WORKING(근무중), LATE(지각), EARLY_CHECK_IN(조기출근), UNSCHEDULED(미배정 출근) 상태를 반환
// 퇴근 시 check-out API에서 최종 상태(NORMAL, OVERTIME, EARLY_LEAVE 등)로 업데이트
function determineCheckInStatus(
  checkInTime: Date,
  scheduledCheckIn: Date | null,
  hasSchedule: boolean
): { status: string; isAbnormal: boolean; isUnscheduled: boolean; message: string } {
  // 스케줄이 없으면 미배정 출근
  if (!hasSchedule) {
    return {
      status: 'UNSCHEDULED',
      isAbnormal: true,
      isUnscheduled: true,
      message: '미배정 출근입니다. 관리자 승인 후 급여에 반영됩니다.'
    };
  }

  // 예정 출근 시간이 없으면 근무중 상태
  if (!scheduledCheckIn) {
    return { status: 'WORKING', isAbnormal: false, isUnscheduled: false, message: '' };
  }

  const diffMinutes = (checkInTime.getTime() - scheduledCheckIn.getTime()) / (1000 * 60);

  // 30분 이상 일찍 출근 = 조기출근
  if (diffMinutes <= -30) {
    const earlyMinutes = Math.abs(Math.round(diffMinutes));
    return {
      status: 'EARLY_CHECK_IN',
      isAbnormal: true,
      isUnscheduled: false,
      message: `예정 시간보다 ${earlyMinutes}분 일찍 출근했습니다.`,
    };
  }

  // 5분 이상 늦게 출근 = 지각
  if (diffMinutes >= 5) {
    const lateMinutes = Math.round(diffMinutes);
    return {
      status: 'LATE',
      isAbnormal: true,
      isUnscheduled: false,
      message: `예정 시간보다 ${lateMinutes}분 늦게 출근했습니다.`,
    };
  }

  // 정상 시간 출근 = 근무중 (퇴근 시 NORMAL로 변경됨)
  return { status: 'WORKING', isAbnormal: false, isUnscheduled: false, message: '' };
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

// 직원에게 알림 발송
async function notifyEmployee(
  adminClient: any,
  userId: string,
  title: string,
  body: string,
  category: string = 'ATTENDANCE',
  priority: string = 'HIGH',
  data?: Record<string, any>
) {
  try {
    await adminClient.from('notifications').insert({
      user_id: userId,
      category,
      priority,
      title,
      body,
      data,
    });
  } catch (error) {
    console.error('Failed to notify employee:', error);
  }
}

// 미출근(결근) 스케줄 조회 - 스케줄이 있었는데 출근하지 않은 날짜
async function getMissedShifts(
  adminClient: any,
  staffId: string,
  companyId: string,
  today: string
): Promise<Array<{ work_date: string; start_time: string; end_time: string }>> {
  try {
    // 최근 7일간의 스케줄 중 출근하지 않은 것 조회
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    // 스케줄 조회
    const { data: schedules } = await adminClient
      .from('schedules')
      .select('work_date, start_time, end_time')
      .eq('staff_id', staffId)
      .gte('work_date', sevenDaysAgoStr)
      .lt('work_date', today)
      .in('status', ['SCHEDULED', 'CONFIRMED']);

    if (!schedules || schedules.length === 0) {
      return [];
    }

    // 해당 기간 출퇴근 기록 조회
    const { data: attendances } = await adminClient
      .from('attendances')
      .select('work_date, status')
      .eq('staff_id', staffId)
      .gte('work_date', sevenDaysAgoStr)
      .lt('work_date', today);

    const attendedDates = new Set(
      (attendances || [])
        .filter((a: any) => a.status !== 'NO_SHOW' && a.status !== 'ABSENT')
        .map((a: any) => a.work_date)
    );

    // 이미 결근 사유 승인 요청이 있는 날짜 조회
    const { data: existingRequests } = await adminClient
      .from('approval_requests')
      .select('details')
      .eq('requester_id', staffId)
      .eq('type', 'ABSENCE_EXCUSE')
      .gte('created_at', sevenDaysAgoStr);

    const excusedDates = new Set(
      (existingRequests || []).map((r: any) => r.details?.work_date)
    );

    // 스케줄은 있었는데 출근하지 않고, 아직 사유 제출하지 않은 날짜
    const missedShifts = schedules.filter(
      (s: any) => !attendedDates.has(s.work_date) && !excusedDates.has(s.work_date)
    );

    return missedShifts;
  } catch (error) {
    console.error('Failed to get missed shifts:', error);
    return [];
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

    // 스케줄 존재 여부 확인 (schedules 테이블 또는 계약서의 work_schedules)
    const hasSchedule = !!(todaySchedule || scheduledCheckIn);

    const { status, isAbnormal, isUnscheduled, message } = determineCheckInStatus(now, scheduledCheckIn, hasSchedule);

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

    // 미배정 출근인 경우 승인 요청 생성 및 관리자/직원 알림
    if (isUnscheduled && userData.company_id) {
      // 매장 관리자 조회
      const { data: managers } = await adminClient
        .from('users')
        .select('id, name, role')
        .eq('company_id', userData.company_id)
        .in('role', ['store_manager', 'manager', 'company_admin'])
        .eq('status', 'ACTIVE');

      // 승인 라인 생성
      const approvalLine = (managers || []).map((manager: any, index: number) => ({
        step: index + 1,
        approver_id: manager.id,
        approver_name: manager.name,
        approver_role: manager.role,
        status: 'PENDING',
      }));

      // 승인 요청 생성
      if (approvalLine.length > 0) {
        await adminClient.from('approval_requests').insert({
          type: 'UNSCHEDULED_CHECKIN',
          requester_id: userData.id,
          requester_name: userData.name,
          company_id: userData.company_id,
          brand_id: userData.brand_id,
          store_id: userData.store_id,
          approval_line: approvalLine,
          current_step: 1,
          final_status: 'PENDING',
          details: {
            attendance_id: data.id,
            work_date: today,
            check_in_time: nowISO,
            reason: '사유 미입력',
          },
        });
      }

      // 관리자들에게 알림
      await notifyManagers(
        adminClient,
        userData.company_id,
        userData.store_id,
        userData.name,
        `[미배정 출근] ${userData.name}`,
        message,
        data.id,
        today
      );

      // 직원에게도 알림
      await notifyEmployee(
        adminClient,
        userData.id,
        '[미배정 출근] 승인 대기 중',
        '오늘은 배정된 스케줄이 없는 날입니다. 관리자 승인 후 급여에 반영됩니다.',
        'ATTENDANCE',
        'HIGH',
        {
          type: 'UNSCHEDULED_CHECKIN',
          attendance_id: data.id,
          work_date: today,
        }
      );
    }
    // 이상 상황 시 관리자에게 알림 (지각, 조기출근)
    else if (isAbnormal && userData.company_id) {
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

      // 직원에게도 알림
      await notifyEmployee(
        adminClient,
        userData.id,
        `[${statusLabel}] 출근 알림`,
        message,
        'ATTENDANCE',
        'NORMAL',
        {
          type: status,
          attendance_id: data.id,
          work_date: today,
        }
      );
    }

    // 미출근(결근) 스케줄 확인
    const missedShifts = await getMissedShifts(
      adminClient,
      userData.id,
      userData.company_id,
      today
    );

    return NextResponse.json({
      ...data,
      status_message: isAbnormal ? message : null,
      is_unscheduled: isUnscheduled,
      missed_shifts: missedShifts,
    });
  } catch (error) {
    console.error('Error checking in:', error);
    return NextResponse.json({ error: 'Failed to check in' }, { status: 500 });
  }
}
