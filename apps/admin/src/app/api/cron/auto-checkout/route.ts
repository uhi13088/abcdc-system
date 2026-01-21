/**
 * 자동 퇴근 처리 Cron Job
 * GET /api/cron/auto-checkout
 *
 * 퇴근 기록 없이 근무중 상태로 남아있는 기록을 자동으로 퇴근 처리합니다.
 *
 * 처리 기준:
 * 1. 어제 이전의 미퇴근 기록: 예정 퇴근 시간 또는 출근 후 8시간으로 자동 처리
 * 2. 오늘 기록 중 스케줄 종료 2시간 초과: 예정 퇴근 시간으로 자동 처리
 *
 * 권장 실행 주기: 매일 새벽 2시 + 오후 11시
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { format, differenceInMinutes, subDays, addHours } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
}

interface ProcessedRecord {
  id: string;
  staffName: string;
  workDate: string;
  checkInTime: string;
  autoCheckoutTime: string;
  reason: string;
}

/**
 * 근무시간 계산 (휴게시간 제외)
 */
function calculateWorkHours(
  checkIn: Date,
  checkOut: Date,
  breakMinutes: number = 0
): {
  workHours: number;
  overtimeHours: number;
  nightHours: number;
} {
  const totalMinutes = differenceInMinutes(checkOut, checkIn) - breakMinutes;
  const workHours = Math.max(0, totalMinutes / 60);

  const regularHours = Math.min(workHours, 8);
  const overtimeHours = Math.max(0, workHours - 8);

  // 야간근로 시간 계산 (22:00 ~ 06:00)
  let nightHours = 0;
  const checkInHour = checkIn.getHours();
  const checkOutHour = checkOut.getHours();

  // 간단한 야간 시간 계산
  if (checkOutHour >= 22 || checkOutHour < 6) {
    nightHours = Math.min(workHours, 2);
  }
  if (checkInHour >= 22 || checkInHour < 6) {
    nightHours = Math.max(nightHours, Math.min(workHours, 2));
  }

  return {
    workHours: parseFloat(workHours.toFixed(2)),
    overtimeHours: parseFloat(overtimeHours.toFixed(2)),
    nightHours: parseFloat(nightHours.toFixed(2)),
  };
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
  const yesterday = format(subDays(now, 1), 'yyyy-MM-dd');

  const processed: ProcessedRecord[] = [];
  const errors: string[] = [];

  try {
    // 1. 어제 이전의 미퇴근 기록 조회 (과거 기록 정리)
    const { data: pastPendingAttendances, error: pastError } = await supabase
      .from('attendances')
      .select(`
        id,
        staff_id,
        work_date,
        actual_check_in,
        scheduled_check_out,
        users!staff_id (
          id,
          name
        )
      `)
      .lt('work_date', today)
      .not('actual_check_in', 'is', null)
      .is('actual_check_out', null)
      .order('work_date', { ascending: true });

    if (pastError) {
      errors.push(`Past records query failed: ${pastError.message}`);
    }

    // 과거 기록 처리
    if (pastPendingAttendances) {
      for (const attendance of pastPendingAttendances) {
        try {
          const checkInTime = new Date(attendance.actual_check_in);
          let autoCheckoutTime: Date;
          let reason: string;

          if (attendance.scheduled_check_out) {
            // 예정 퇴근 시간이 있으면 그 시간으로 처리
            autoCheckoutTime = new Date(attendance.scheduled_check_out);
            reason = '예정 퇴근 시간 기준 자동 처리';
          } else {
            // 예정 퇴근 시간이 없으면 출근 후 8시간으로 처리
            autoCheckoutTime = addHours(checkInTime, 8);
            reason = '출근 후 8시간 기준 자동 처리';
          }

          // 체크아웃 시간이 체크인보다 이전이면 조정
          if (autoCheckoutTime <= checkInTime) {
            autoCheckoutTime = addHours(checkInTime, 8);
            reason = '출근 후 8시간 기준 자동 처리 (시간 조정)';
          }

          const workData = calculateWorkHours(checkInTime, autoCheckoutTime, 60);
          const staff = attendance.users as any;

          await supabase
            .from('attendances')
            .update({
              actual_check_out: autoCheckoutTime.toISOString(),
              work_hours: workData.workHours,
              overtime_hours: workData.overtimeHours,
              night_hours: workData.nightHours,
              status: 'NORMAL',
              extensions: {
                auto_checkout: true,
                auto_checkout_reason: reason,
                auto_checkout_at: now.toISOString(),
              },
            })
            .eq('id', attendance.id);

          processed.push({
            id: attendance.id,
            staffName: staff?.name || 'Unknown',
            workDate: attendance.work_date,
            checkInTime: attendance.actual_check_in,
            autoCheckoutTime: autoCheckoutTime.toISOString(),
            reason,
          });
        } catch (err) {
          errors.push(`Failed to process attendance ${attendance.id}: ${err}`);
        }
      }
    }

    // 2. 오늘 기록 중 스케줄 종료 2시간 초과한 것 처리
    const { data: todayPendingAttendances, error: todayError } = await supabase
      .from('attendances')
      .select(`
        id,
        staff_id,
        work_date,
        actual_check_in,
        scheduled_check_out,
        users!staff_id (
          id,
          name
        )
      `)
      .eq('work_date', today)
      .not('actual_check_in', 'is', null)
      .is('actual_check_out', null)
      .not('scheduled_check_out', 'is', null);

    if (todayError) {
      errors.push(`Today records query failed: ${todayError.message}`);
    }

    if (todayPendingAttendances) {
      for (const attendance of todayPendingAttendances) {
        try {
          const scheduledEnd = new Date(attendance.scheduled_check_out);
          const autoCheckoutThreshold = addHours(scheduledEnd, 2);

          // 예정 퇴근 시간 + 2시간이 지났으면 자동 퇴근
          if (now >= autoCheckoutThreshold) {
            const checkInTime = new Date(attendance.actual_check_in);
            const autoCheckoutTime = scheduledEnd; // 예정 퇴근 시간으로 처리
            const workData = calculateWorkHours(checkInTime, autoCheckoutTime, 60);
            const staff = attendance.users as any;

            await supabase
              .from('attendances')
              .update({
                actual_check_out: autoCheckoutTime.toISOString(),
                work_hours: workData.workHours,
                overtime_hours: workData.overtimeHours,
                night_hours: workData.nightHours,
                status: 'NORMAL',
                extensions: {
                  auto_checkout: true,
                  auto_checkout_reason: '스케줄 종료 2시간 초과 자동 처리',
                  auto_checkout_at: now.toISOString(),
                },
              })
              .eq('id', attendance.id);

            processed.push({
              id: attendance.id,
              staffName: staff?.name || 'Unknown',
              workDate: attendance.work_date,
              checkInTime: attendance.actual_check_in,
              autoCheckoutTime: autoCheckoutTime.toISOString(),
              reason: '스케줄 종료 2시간 초과 자동 처리',
            });
          }
        } catch (err) {
          errors.push(`Failed to process today attendance ${attendance.id}: ${err}`);
        }
      }
    }

    // 3. 관리자에게 자동 처리 결과 알림 (처리된 기록이 있을 경우)
    if (processed.length > 0) {
      // 회사별로 그룹화하여 관리자에게 알림
      const companyIds = new Set<string>();
      for (const record of processed) {
        const { data: staff } = await supabase
          .from('users')
          .select('company_id')
          .eq('name', record.staffName)
          .single();
        if (staff?.company_id) {
          companyIds.add(staff.company_id);
        }
      }

      for (const companyId of companyIds) {
        const { data: managers } = await supabase
          .from('users')
          .select('id')
          .eq('company_id', companyId)
          .in('role', ['COMPANY_ADMIN', 'company_admin']);

        if (managers && managers.length > 0) {
          const notifications = managers.map((manager) => ({
            user_id: manager.id,
            category: 'ATTENDANCE',
            priority: 'NORMAL',
            title: '자동 퇴근 처리 완료',
            body: `${processed.length}건의 미퇴근 기록이 자동으로 퇴근 처리되었습니다.`,
            deep_link: '/attendance',
            data: {
              processed_count: processed.length,
              processed_at: now.toISOString(),
            },
          }));

          await supabase.from('notifications').insert(notifications);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${processed.length} auto-checkout records`,
      processedCount: processed.length,
      processed,
      errors: errors.length > 0 ? errors : undefined,
      executedAt: now.toISOString(),
    });
  } catch (error) {
    console.error('Auto-checkout cron error:', error);
    return NextResponse.json(
      { error: 'Auto-checkout processing failed' },
      { status: 500 }
    );
  }
}

/**
 * 수동으로 특정 기간의 미퇴근 기록 일괄 처리
 * POST /api/cron/auto-checkout
 * body: { startDate?: string, endDate?: string }
 */
export async function POST(request: NextRequest) {
  const supabase = getSupabaseClient();

  // 관리자 인증 확인
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { startDate, endDate } = body;

    const timezone = 'Asia/Seoul';
    const now = toZonedTime(new Date(), timezone);
    const today = format(now, 'yyyy-MM-dd');

    // 기본값: 최근 30일
    const queryStartDate = startDate || format(subDays(now, 30), 'yyyy-MM-dd');
    const queryEndDate = endDate || format(subDays(now, 1), 'yyyy-MM-dd');

    // 미퇴근 기록 조회
    const { data: pendingAttendances, error } = await supabase
      .from('attendances')
      .select(`
        id,
        staff_id,
        work_date,
        actual_check_in,
        scheduled_check_out,
        users!staff_id (
          id,
          name
        )
      `)
      .gte('work_date', queryStartDate)
      .lte('work_date', queryEndDate)
      .not('actual_check_in', 'is', null)
      .is('actual_check_out', null)
      .order('work_date', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const processed: ProcessedRecord[] = [];
    const errors: string[] = [];

    for (const attendance of pendingAttendances || []) {
      try {
        const checkInTime = new Date(attendance.actual_check_in);
        let autoCheckoutTime: Date;
        let reason: string;

        if (attendance.scheduled_check_out) {
          autoCheckoutTime = new Date(attendance.scheduled_check_out);
          reason = '예정 퇴근 시간 기준 일괄 처리';
        } else {
          autoCheckoutTime = addHours(checkInTime, 8);
          reason = '출근 후 8시간 기준 일괄 처리';
        }

        if (autoCheckoutTime <= checkInTime) {
          autoCheckoutTime = addHours(checkInTime, 8);
        }

        const workData = calculateWorkHours(checkInTime, autoCheckoutTime, 60);
        const staff = attendance.users as any;

        await supabase
          .from('attendances')
          .update({
            actual_check_out: autoCheckoutTime.toISOString(),
            work_hours: workData.workHours,
            overtime_hours: workData.overtimeHours,
            night_hours: workData.nightHours,
            status: 'NORMAL',
            extensions: {
              auto_checkout: true,
              auto_checkout_reason: reason,
              auto_checkout_at: now.toISOString(),
              manual_batch_process: true,
            },
          })
          .eq('id', attendance.id);

        processed.push({
          id: attendance.id,
          staffName: staff?.name || 'Unknown',
          workDate: attendance.work_date,
          checkInTime: attendance.actual_check_in,
          autoCheckoutTime: autoCheckoutTime.toISOString(),
          reason,
        });
      } catch (err) {
        errors.push(`Failed to process ${attendance.id}: ${err}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Batch processed ${processed.length} records`,
      dateRange: { startDate: queryStartDate, endDate: queryEndDate },
      processedCount: processed.length,
      processed,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Batch auto-checkout error:', error);
    return NextResponse.json(
      { error: 'Batch processing failed' },
      { status: 500 }
    );
  }
}
