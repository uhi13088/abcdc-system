import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// 출근 상태 판단 함수
function determineCheckInStatus(
  checkInTime: Date,
  scheduledCheckIn: Date | null
): { status: string; isAbnormal: boolean; message: string } {
  if (!scheduledCheckIn) {
    return { status: 'NORMAL', isAbnormal: false, message: '' };
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

  return { status: 'NORMAL', isAbnormal: false, message: '' };
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

    const today = new Date().toISOString().split('T')[0];
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
      .select('scheduled_start, scheduled_end')
      .eq('staff_id', userData.id)
      .eq('date', today)
      .single();

    // 출근 상태 판단
    let scheduledCheckIn: Date | null = null;
    let scheduledCheckOut: Date | null = null;

    if (todaySchedule?.scheduled_start) {
      scheduledCheckIn = new Date(todaySchedule.scheduled_start);
    }
    if (todaySchedule?.scheduled_end) {
      scheduledCheckOut = new Date(todaySchedule.scheduled_end);
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
