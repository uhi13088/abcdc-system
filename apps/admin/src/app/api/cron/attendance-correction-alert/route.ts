/**
 * 근태 수정 알림 Cron Job
 * GET /api/cron/attendance-correction-alert
 *
 * 지각, 조퇴, 연장근무 감지 시 직원에게 알림 발송
 * - 지각: 예정 출근 시간보다 늦게 출근한 경우
 * - 조퇴: 예정 퇴근 시간보다 일찍 퇴근한 경우
 * - 연장근무: 예정 퇴근 시간보다 30분 이상 늦게 근무 중인 경우
 *
 * 권장 실행 주기: 매 10분 (Vercel Cron)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { format, differenceInMinutes } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { pushNotificationService } from '@abc/shared/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// 임계값 설정 (분)
const LATE_THRESHOLD_MINUTES = 5; // 5분 이상 지각
const EARLY_CHECKOUT_THRESHOLD_MINUTES = 10; // 10분 이상 조퇴
const OVERTIME_THRESHOLD_MINUTES = 30; // 30분 이상 연장근무

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
}

interface AlertResult {
  type: 'LATE_CHECKIN' | 'EARLY_CHECKOUT' | 'OVERTIME';
  staffId: string;
  staffName: string;
  attendanceId: string;
  minutesDiff: number;
}

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseClient();
  const timezone = 'Asia/Seoul';
  const now = toZonedTime(new Date(), timezone);
  const today = format(now, 'yyyy-MM-dd');

  const alerts: AlertResult[] = [];
  const errors: string[] = [];

  try {
    // ============================================
    // 1. 지각 감지 (늦은 출근)
    // ============================================
    const { data: lateCheckins, error: lateError } = await supabase
      .from('attendances')
      .select(`
        id,
        staff_id,
        work_date,
        scheduled_check_in,
        actual_check_in,
        users!staff_id (
          id,
          name,
          company_id,
          store_id
        )
      `)
      .eq('work_date', today)
      .not('actual_check_in', 'is', null)
      .not('scheduled_check_in', 'is', null);

    if (lateError) {
      errors.push(`Late checkin query error: ${lateError.message}`);
    }

    if (lateCheckins) {
      for (const attendance of lateCheckins) {
        const scheduledIn = new Date(attendance.scheduled_check_in);
        const actualIn = new Date(attendance.actual_check_in);
        const minutesLate = differenceInMinutes(actualIn, scheduledIn);

        if (minutesLate >= LATE_THRESHOLD_MINUTES) {
          // 이미 수정 요청이 있는지 확인
          const { data: existingRequest } = await supabase
            .from('attendance_correction_requests')
            .select('id')
            .eq('attendance_id', attendance.id)
            .eq('request_type', 'LATE_CHECKIN')
            .maybeSingle();

          if (!existingRequest) {
            const staff = attendance.users as unknown as { id: string; name: string; company_id: string; store_id: string | null } | null;
            if (!staff) continue;

            // 수정 요청 자동 생성
            const { data: newRequest } = await supabase
              .from('attendance_correction_requests')
              .insert({
                attendance_id: attendance.id,
                staff_id: staff.id,
                company_id: staff.company_id,
                store_id: staff.store_id,
                request_type: 'LATE_CHECKIN',
                original_check_in: attendance.scheduled_check_in,
                requested_check_in: attendance.actual_check_in,
                reason: '', // 직원이 입력 필요
                auto_generated: true,
                notification_sent: false,
              })
              .select('id')
              .single();

            // 직원에게 알림 발송
            await sendStaffNotification(supabase, {
              staffId: staff.id,
              type: 'LATE_CHECKIN',
              title: '지각 사유를 입력해주세요',
              body: `예정 출근 시간(${format(scheduledIn, 'HH:mm')})보다 ${minutesLate}분 늦게 출근하셨습니다. 사유를 입력해주세요.`,
              deepLink: `/attendance/correction/${newRequest?.id || attendance.id}`,
              requestId: newRequest?.id,
            });

            alerts.push({
              type: 'LATE_CHECKIN',
              staffId: staff.id,
              staffName: staff.name,
              attendanceId: attendance.id,
              minutesDiff: minutesLate,
            });
          }
        }
      }
    }

    // ============================================
    // 2. 조퇴 감지 (일찍 퇴근)
    // ============================================
    const { data: earlyCheckouts, error: earlyError } = await supabase
      .from('attendances')
      .select(`
        id,
        staff_id,
        work_date,
        scheduled_check_out,
        actual_check_out,
        users!staff_id (
          id,
          name,
          company_id,
          store_id
        )
      `)
      .eq('work_date', today)
      .not('actual_check_out', 'is', null)
      .not('scheduled_check_out', 'is', null);

    if (earlyError) {
      errors.push(`Early checkout query error: ${earlyError.message}`);
    }

    if (earlyCheckouts) {
      for (const attendance of earlyCheckouts) {
        const scheduledOut = new Date(attendance.scheduled_check_out);
        const actualOut = new Date(attendance.actual_check_out);
        const minutesEarly = differenceInMinutes(scheduledOut, actualOut);

        if (minutesEarly >= EARLY_CHECKOUT_THRESHOLD_MINUTES) {
          // 이미 수정 요청이 있는지 확인
          const { data: existingRequest } = await supabase
            .from('attendance_correction_requests')
            .select('id')
            .eq('attendance_id', attendance.id)
            .eq('request_type', 'EARLY_CHECKOUT')
            .maybeSingle();

          if (!existingRequest) {
            const staff = attendance.users as unknown as { id: string; name: string; company_id: string; store_id: string | null } | null;
            if (!staff) continue;

            // 수정 요청 자동 생성
            const { data: newRequest } = await supabase
              .from('attendance_correction_requests')
              .insert({
                attendance_id: attendance.id,
                staff_id: staff.id,
                company_id: staff.company_id,
                store_id: staff.store_id,
                request_type: 'EARLY_CHECKOUT',
                original_check_out: attendance.scheduled_check_out,
                requested_check_out: attendance.actual_check_out,
                reason: '', // 직원이 입력 필요
                auto_generated: true,
                notification_sent: false,
              })
              .select('id')
              .single();

            // 직원에게 알림 발송
            await sendStaffNotification(supabase, {
              staffId: staff.id,
              type: 'EARLY_CHECKOUT',
              title: '조퇴 사유를 입력해주세요',
              body: `예정 퇴근 시간(${format(scheduledOut, 'HH:mm')})보다 ${minutesEarly}분 일찍 퇴근하셨습니다. 사유를 입력해주세요.`,
              deepLink: `/attendance/correction/${newRequest?.id || attendance.id}`,
              requestId: newRequest?.id,
            });

            alerts.push({
              type: 'EARLY_CHECKOUT',
              staffId: staff.id,
              staffName: staff.name,
              attendanceId: attendance.id,
              minutesDiff: minutesEarly,
            });
          }
        }
      }
    }

    // ============================================
    // 3. 연장근무 감지 (늦은 퇴근 예정)
    // ============================================
    const { data: potentialOvertime, error: overtimeError } = await supabase
      .from('attendances')
      .select(`
        id,
        staff_id,
        work_date,
        scheduled_check_out,
        actual_check_in,
        users!staff_id (
          id,
          name,
          company_id,
          store_id
        )
      `)
      .eq('work_date', today)
      .not('actual_check_in', 'is', null)
      .is('actual_check_out', null) // 아직 퇴근 안 함
      .not('scheduled_check_out', 'is', null);

    if (overtimeError) {
      errors.push(`Overtime query error: ${overtimeError.message}`);
    }

    if (potentialOvertime) {
      for (const attendance of potentialOvertime) {
        const scheduledOut = new Date(attendance.scheduled_check_out);
        const minutesOvertime = differenceInMinutes(now, scheduledOut);

        // 예정 퇴근 시간 + 30분 경과 && 아직 퇴근 안 함
        if (minutesOvertime >= OVERTIME_THRESHOLD_MINUTES && minutesOvertime < OVERTIME_THRESHOLD_MINUTES + 10) {
          // 이미 알림을 보냈는지 확인 (오늘)
          const { data: existingNotification } = await supabase
            .from('notifications')
            .select('id')
            .eq('user_id', attendance.staff_id)
            .eq('category', 'ATTENDANCE')
            .gte('created_at', `${today}T00:00:00`)
            .ilike('title', '%연장근무%')
            .maybeSingle();

          if (!existingNotification) {
            const staff = attendance.users as unknown as { id: string; name: string; company_id: string; store_id: string | null } | null;
            if (!staff) continue;

            // 직원에게 연장근무 알림 발송
            await sendStaffNotification(supabase, {
              staffId: staff.id,
              type: 'OVERTIME',
              title: '연장근무 신청하시겠어요?',
              body: `예정 퇴근 시간(${format(scheduledOut, 'HH:mm')})이 ${minutesOvertime}분 지났습니다. 연장근무를 신청하시겠어요?`,
              deepLink: `/attendance/overtime/${attendance.id}`,
            });

            alerts.push({
              type: 'OVERTIME',
              staffId: staff.id,
              staffName: staff.name,
              attendanceId: attendance.id,
              minutesDiff: minutesOvertime,
            });
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed attendance correction alerts`,
      alerts,
      summary: {
        lateCheckins: alerts.filter(a => a.type === 'LATE_CHECKIN').length,
        earlyCheckouts: alerts.filter(a => a.type === 'EARLY_CHECKOUT').length,
        overtime: alerts.filter(a => a.type === 'OVERTIME').length,
      },
      errors: errors.length > 0 ? errors : undefined,
      executedAt: now.toISOString(),
    });
  } catch (error) {
    console.error('Attendance correction alert cron error:', error);
    return NextResponse.json(
      { error: 'Attendance correction alert processing failed' },
      { status: 500 }
    );
  }
}

/**
 * 직원에게 알림 발송
 */
async function sendStaffNotification(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: ReturnType<typeof createClient<any>>,
  params: {
    staffId: string;
    type: 'LATE_CHECKIN' | 'EARLY_CHECKOUT' | 'OVERTIME';
    title: string;
    body: string;
    deepLink: string;
    requestId?: string;
  }
) {
  const { staffId, type, title, body, deepLink, requestId } = params;

  try {
    // FCM 토큰 조회
    const { data: fcmTokens } = await supabase
      .from('user_fcm_tokens')
      .select('fcm_token')
      .eq('user_id', staffId)
      .eq('is_active', true);

    // 푸시 알림 발송
    if (fcmTokens && fcmTokens.length > 0) {
      for (const tokenRecord of fcmTokens) {
        try {
          await pushNotificationService.send(tokenRecord.fcm_token, {
            title,
            body,
            category: 'APPROVAL',
            deepLink,
            priority: 'HIGH',
            actions: type === 'OVERTIME'
              ? [
                  { id: 'REQUEST_OVERTIME', title: '연장근무 신청' },
                  { id: 'CHECKOUT_NOW', title: '퇴근하기' },
                ]
              : [
                  { id: 'ENTER_REASON', title: '사유 입력' },
                ],
          });
        } catch (err) {
          console.error('Push notification error:', err);
        }
      }
    }

    // 알림 기록 저장
    await supabase.from('notifications').insert({
      user_id: staffId,
      category: 'ATTENDANCE',
      priority: 'HIGH',
      title,
      body,
      deep_link: deepLink,
      data: {
        type,
        requestId,
        requiresAction: true,
      },
      sent: true,
      sent_at: new Date().toISOString(),
    });

    // 수정 요청 알림 발송 상태 업데이트
    if (requestId) {
      await supabase
        .from('attendance_correction_requests')
        .update({
          notification_sent: true,
          notification_sent_at: new Date().toISOString(),
        })
        .eq('id', requestId);
    }
  } catch (error) {
    console.error('Failed to send staff notification:', error);
  }
}
