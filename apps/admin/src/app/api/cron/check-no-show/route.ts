/**
 * GET /api/cron/check-no-show - 미출근 직원 체크 및 알림
 * Cron job으로 10분마다 실행 권장
 *
 * 동작:
 * 1. 오늘 스케줄이 있는 직원 조회
 * 2. 출근 예정 시간이 지났는데 출근 기록이 없는 직원 확인
 * 3. 해당 직원의 관리자에게 알림 발송
 */

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
}

// 관리자들에게 알림 발송
async function notifyManagers(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminClient: ReturnType<typeof createClient<any>>,
  companyId: string,
  storeId: string | null,
  staffId: string,
  staffName: string,
  scheduledTime: string,
  workDate: string
) {
  try {
    // 이미 동일 알림이 오늘 발송되었는지 체크 (중복 방지)
    const { data: existingNotification } = await adminClient
      .from('notifications')
      .select('id')
      .eq('reference_type', 'NO_SHOW')
      .eq('reference_id', `${staffId}-${workDate}`)
      .single();

    if (existingNotification) {
      return; // 이미 알림 발송됨
    }

    // 관리자 조회
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
      const scheduledTimeStr = new Date(scheduledTime).toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
      });

      const notifications = managers.map((manager: { id: string }) => ({
        user_id: manager.id,
        category: 'ATTENDANCE',
        priority: 'URGENT',
        title: `[미출근] ${staffName}`,
        body: `${staffName}님이 예정 출근 시간(${scheduledTimeStr})이 지났는데 아직 출근하지 않았습니다.`,
        deep_link: `/staff/${staffId}`,
        reference_type: 'NO_SHOW',
        reference_id: `${staffId}-${workDate}`,
        data: {
          staff_id: staffId,
          staff_name: staffName,
          work_date: workDate,
          scheduled_time: scheduledTime,
        },
      }));

      await adminClient.from('notifications').insert(notifications);
    }
  } catch (error) {
    console.error('Failed to notify managers for no-show:', error);
  }
}

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (optional security)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = getAdminClient();
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    // 지각 판정 기준 시간 (분) - 출근 시간 + 10분 후부터 미출근 알림
    const NO_SHOW_THRESHOLD_MINUTES = 10;

    // 오늘 스케줄이 있는 직원들 조회
    const { data: todaySchedules, error: scheduleError } = await adminClient
      .from('schedules')
      .select(`
        id,
        staff_id,
        start_time,
        users!schedules_staff_id_fkey (
          id,
          name,
          company_id,
          store_id
        )
      `)
      .eq('work_date', today)
      .eq('status', 'SCHEDULED');

    if (scheduleError) {
      console.error('Schedule fetch error:', scheduleError);
      return NextResponse.json({ error: scheduleError.message }, { status: 500 });
    }

    if (!todaySchedules || todaySchedules.length === 0) {
      return NextResponse.json({ message: 'No schedules for today', checked: 0 });
    }

    let noShowCount = 0;
    const noShowStaff: string[] = [];

    for (const schedule of todaySchedules) {
      if (!schedule.start_time || !schedule.users) continue;

      const scheduledStart = new Date(schedule.start_time);
      const thresholdTime = new Date(scheduledStart.getTime() + NO_SHOW_THRESHOLD_MINUTES * 60 * 1000);

      // 아직 출근 시간 + threshold가 안 지났으면 스킵
      if (now < thresholdTime) continue;

      const staff = schedule.users as unknown as { id: string; name: string; company_id: string; store_id: string | null };

      // 오늘 출근 기록이 있는지 확인
      const { data: attendance } = await adminClient
        .from('attendances')
        .select('id, actual_check_in')
        .eq('staff_id', schedule.staff_id)
        .eq('work_date', today)
        .single();

      // 출근 기록이 없으면 미출근
      if (!attendance?.actual_check_in) {
        noShowCount++;
        noShowStaff.push(staff.name);

        // 관리자에게 알림
        await notifyManagers(
          adminClient,
          staff.company_id,
          staff.store_id,
          staff.id,
          staff.name,
          schedule.start_time,
          today
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: `Checked ${todaySchedules.length} schedules, found ${noShowCount} no-shows`,
      noShowCount,
      noShowStaff,
      checkedAt: now.toISOString(),
    });
  } catch (error) {
    console.error('No-show check error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
