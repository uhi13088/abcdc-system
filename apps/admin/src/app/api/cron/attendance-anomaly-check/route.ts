/**
 * 출퇴근 이상 감지 Cron Job
 * 미출근, 미퇴근, 이상 출퇴근 패턴 감지 및 관리자 알림
 * Vercel Cron: 매 30분마다 실행
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { pushNotificationService, emailService } from '@abc/shared/server';
import { format, addMinutes, subMinutes, isAfter, isBefore } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
}

interface AnomalyResult {
  type: string;
  staffId: string;
  staffName: string;
  scheduleId: string;
  storeId: string;
  storeName: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseClient();
  const timezone = 'Asia/Seoul';
  const now = toZonedTime(new Date(), timezone);
  const today = format(now, 'yyyy-MM-dd');

  const anomalies: AnomalyResult[] = [];

  try {
    // 1. 미출근 감지 (예정 시간 15분 초과)
    await detectNoShowAnomalies(supabase, today, now, anomalies);

    // 2. 미퇴근 감지 (예정 퇴근 시간 30분 초과)
    await detectMissingCheckoutAnomalies(supabase, today, now, anomalies);

    // 3. 위치 이탈 감지 (이미 기록된 것 중 미처리)
    await detectLocationAnomalies(supabase, anomalies);

    if (anomalies.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No anomalies detected',
        count: 0,
      });
    }

    // 관리자에게 알림 발송
    await notifyManagersOfAnomalies(supabase, anomalies);

    return NextResponse.json({
      success: true,
      message: `Detected ${anomalies.length} anomalies`,
      anomalies: anomalies.map((a) => ({
        type: a.type,
        staffName: a.staffName,
        severity: a.severity,
        description: a.description,
      })),
    });
  } catch (error) {
    console.error('Attendance anomaly check error:', error);
    return NextResponse.json(
      { error: 'Anomaly check failed' },
      { status: 500 }
    );
  }
}

/**
 * 미출근 감지
 */
async function detectNoShowAnomalies(
  supabase: ReturnType<typeof getSupabaseClient>,
  today: string,
  now: Date,
  anomalies: AnomalyResult[]
): Promise<void> {
  // 출근 예정 시간이 15분 이상 지났지만 출근하지 않은 스케줄
  const cutoffTime = subMinutes(now, 15);

  const { data: schedules, error } = await supabase
    .from('schedules')
    .select(`
      id,
      staff_id,
      store_id,
      start_time,
      users!staff_id (
        id,
        name
      ),
      stores!store_id (
        id,
        name
      )
    `)
    .eq('work_date', today)
    .eq('status', 'CONFIRMED')
    .lt('start_time', cutoffTime.toISOString())
    .gt('start_time', `${today}T00:00:00`);

  if (error || !schedules) return;

  for (const schedule of schedules) {
    // 출근 기록 확인
    const { data: attendance } = await supabase
      .from('attendances')
      .select('id, actual_check_in')
      .eq('staff_id', schedule.staff_id)
      .eq('work_date', today)
      .maybeSingle();

    if (!attendance?.actual_check_in) {
      // 이미 anomaly 기록이 있는지 확인
      const { data: existingAnomaly } = await supabase
        .from('attendance_anomalies')
        .select('id')
        .eq('anomaly_type', 'NO_SHOW')
        .gte('created_at', `${today}T00:00:00`)
        .maybeSingle();

      if (!existingAnomaly) {
        const staff = schedule.users as any;
        const store = schedule.stores as any;

        anomalies.push({
          type: 'NO_SHOW',
          staffId: schedule.staff_id,
          staffName: staff?.name || 'Unknown',
          scheduleId: schedule.id,
          storeId: schedule.store_id,
          storeName: store?.name || 'Unknown',
          description: `${staff?.name}님이 예정 출근 시간(${format(new Date(schedule.start_time), 'HH:mm')})을 15분 이상 초과해도 출근하지 않았습니다.`,
          severity: 'HIGH',
        });
      }
    }
  }
}

/**
 * 미퇴근 감지
 */
async function detectMissingCheckoutAnomalies(
  supabase: ReturnType<typeof getSupabaseClient>,
  today: string,
  now: Date,
  anomalies: AnomalyResult[]
): Promise<void> {
  // 퇴근 예정 시간이 30분 이상 지났지만 퇴근하지 않은 출근 기록
  const cutoffTime = subMinutes(now, 30);

  const { data: attendances, error } = await supabase
    .from('attendances')
    .select(`
      id,
      staff_id,
      store_id,
      scheduled_check_out,
      actual_check_in,
      actual_check_out,
      users!staff_id (
        id,
        name
      ),
      stores!store_id (
        id,
        name
      )
    `)
    .eq('work_date', today)
    .not('actual_check_in', 'is', null)
    .is('actual_check_out', null)
    .lt('scheduled_check_out', cutoffTime.toISOString());

  if (error || !attendances) return;

  for (const attendance of attendances) {
    const staff = attendance.users as any;
    const store = attendance.stores as any;

    anomalies.push({
      type: 'MISSING_CHECKOUT',
      staffId: attendance.staff_id,
      staffName: staff?.name || 'Unknown',
      scheduleId: attendance.id,
      storeId: attendance.store_id,
      storeName: store?.name || 'Unknown',
      description: `${staff?.name}님이 예정 퇴근 시간(${format(new Date(attendance.scheduled_check_out), 'HH:mm')})을 30분 이상 초과해도 퇴근 처리하지 않았습니다.`,
      severity: 'MEDIUM',
    });
  }
}

/**
 * 위치 이탈 감지 (미해결)
 */
async function detectLocationAnomalies(
  supabase: ReturnType<typeof getSupabaseClient>,
  anomalies: AnomalyResult[]
): Promise<void> {
  // 오늘 발생한 미해결 위치 이탈
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: unresolvedAnomalies, error } = await supabase
    .from('attendance_anomalies')
    .select(`
      *,
      attendances!attendance_id (
        staff_id,
        store_id,
        users!staff_id (
          id,
          name
        ),
        stores!store_id (
          id,
          name
        )
      )
    `)
    .eq('anomaly_type', 'LOCATION_OUTSIDE_GEOFENCE')
    .eq('resolved', false)
    .gte('created_at', `${today}T00:00:00`);

  if (error || !unresolvedAnomalies) return;

  for (const anomaly of unresolvedAnomalies) {
    const attendance = anomaly.attendances as any;
    const staff = attendance?.users as any;
    const store = attendance?.stores as any;

    if (staff && store) {
      anomalies.push({
        type: 'LOCATION_OUTSIDE_GEOFENCE',
        staffId: attendance.staff_id,
        staffName: staff.name,
        scheduleId: anomaly.attendance_id,
        storeId: attendance.store_id,
        storeName: store.name,
        description: `${staff.name}님이 매장 허용 범위 외에서 출근했습니다. (${anomaly.distance_meters}m 이탈)`,
        severity: anomaly.severity || 'MEDIUM',
      });
    }
  }
}

/**
 * 관리자에게 이상 알림 발송
 */
async function notifyManagersOfAnomalies(
  supabase: ReturnType<typeof getSupabaseClient>,
  anomalies: AnomalyResult[]
): Promise<void> {
  // 매장별로 그룹화
  const byStore = new Map<string, AnomalyResult[]>();
  for (const anomaly of anomalies) {
    const existing = byStore.get(anomaly.storeId) || [];
    existing.push(anomaly);
    byStore.set(anomaly.storeId, existing);
  }

  for (const [storeId, storeAnomalies] of byStore) {
    // 해당 매장의 관리자 조회 (use uppercase role names)
    const { data: managers } = await supabase
      .from('users')
      .select('id, name, email')
      .or(`store_id.eq.${storeId},role.eq.COMPANY_ADMIN,role.eq.STORE_MANAGER`)
      .in('role', ['STORE_MANAGER', 'COMPANY_ADMIN', 'HACCP_MANAGER']);

    if (!managers || managers.length === 0) continue;

    const storeName = storeAnomalies[0]?.storeName || '매장';
    const highSeverity = storeAnomalies.filter(
      (a) => a.severity === 'HIGH' || a.severity === 'CRITICAL'
    );

    // 심각도가 높은 경우 즉시 알림
    if (highSeverity.length > 0) {
      for (const manager of managers) {
        // 푸시 알림
        const { data: fcmTokens } = await supabase
          .from('user_fcm_tokens')
          .select('fcm_token')
          .eq('user_id', manager.id)
          .eq('is_active', true);

        if (fcmTokens && fcmTokens.length > 0) {
          for (const tokenRecord of fcmTokens) {
            await pushNotificationService.send(tokenRecord.fcm_token, {
              title: '⚠️ 출퇴근 이상 감지',
              body: `${storeName}에서 ${highSeverity.length}건의 출퇴근 이상이 감지되었습니다.`,
              category: 'ATTENDANCE_ANOMALY',
              priority: 'HIGH',
              deepLink: '/attendance/anomalies',
            });
          }
        }

        // 알림 기록 저장
        await supabase.from('notifications').insert({
          user_id: manager.id,
          category: 'ATTENDANCE',
          priority: 'HIGH',
          title: '출퇴근 이상 감지',
          body: `${storeName}에서 ${highSeverity.length}건의 출퇴근 이상이 감지되었습니다.`,
          deep_link: '/attendance/anomalies',
          data: {
            storeId,
            anomalies: highSeverity.map((a) => ({
              type: a.type,
              staffName: a.staffName,
              description: a.description,
            })),
          },
          sent: true,
          sent_at: new Date().toISOString(),
        });
      }
    }
  }
}
