/**
 * 출근 알림 Cron Job
 * 출근 30분 전에 직원에게 푸시 알림 발송
 * Vercel Cron: 매 10분마다 실행
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { pushNotificationService } from '@abc/shared/server';
import { format, addMinutes, subMinutes } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
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

  // 30분 후 ~ 40분 후 사이에 출근 예정인 스케줄 조회
  // (10분마다 실행되므로 30-40분 범위로 중복 방지)
  const reminderStart = addMinutes(now, 30);
  const reminderEnd = addMinutes(now, 40);
  const startTimeStr = format(reminderStart, 'HH:mm:ss');
  const endTimeStr = format(reminderEnd, 'HH:mm:ss');

  try {
    // 오늘 스케줄 중 알림 대상 조회
    const { data: schedules, error: scheduleError } = await supabase
      .from('schedules')
      .select(`
        id,
        staff_id,
        start_time,
        store_id,
        users!staff_id (
          id,
          name,
          notification_settings
        ),
        stores!store_id (
          id,
          name
        )
      `)
      .eq('work_date', today)
      .eq('status', 'CONFIRMED')
      .gte('start_time', `${today}T${startTimeStr}`)
      .lt('start_time', `${today}T${endTimeStr}`);

    if (scheduleError) {
      console.error('Schedule query error:', scheduleError);
      return NextResponse.json(
        { error: 'Failed to query schedules' },
        { status: 500 }
      );
    }

    if (!schedules || schedules.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No schedules to remind',
        count: 0,
      });
    }

    let sentCount = 0;
    let skipCount = 0;

    for (const schedule of schedules) {
      const user = schedule.users as any;
      const store = schedule.stores as any;

      // 알림 설정 확인
      const settings = user?.notification_settings || {};
      if (settings.work_reminder === false) {
        skipCount++;
        continue;
      }

      // 이미 출근한 경우 건너뛰기
      const { data: existingAttendance } = await supabase
        .from('attendances')
        .select('id, actual_check_in')
        .eq('staff_id', schedule.staff_id)
        .eq('work_date', today)
        .maybeSingle();

      if (existingAttendance?.actual_check_in) {
        skipCount++;
        continue;
      }

      // 이미 오늘 알림을 보냈는지 확인
      const { data: existingNotification } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', schedule.staff_id)
        .eq('category', 'ATTENDANCE')
        .gte('created_at', `${today}T00:00:00`)
        .ilike('title', '%출근 알림%')
        .maybeSingle();

      if (existingNotification) {
        skipCount++;
        continue;
      }

      // FCM 토큰 조회
      const { data: fcmTokens } = await supabase
        .from('user_fcm_tokens')
        .select('fcm_token')
        .eq('user_id', schedule.staff_id)
        .eq('is_active', true);

      const startTime = new Date(schedule.start_time);
      const timeDisplay = format(startTime, 'HH:mm');

      // 푸시 알림 발송
      if (fcmTokens && fcmTokens.length > 0) {
        for (const tokenRecord of fcmTokens) {
          try {
            await pushNotificationService.send(tokenRecord.fcm_token, {
              title: '출근 알림',
              body: `${store?.name || '매장'} 출근 시간 30분 전입니다. (${timeDisplay})`,
              category: 'SCHEDULE',
              deepLink: '/qr-scan',
              actions: [
                { id: 'CHECKIN', title: '출근하기' },
              ],
            });
          } catch (err) {
            console.error('Push notification error:', err);
          }
        }
      }

      // 알림 기록 저장
      await supabase.from('notifications').insert({
        user_id: schedule.staff_id,
        category: 'ATTENDANCE',
        priority: 'NORMAL',
        title: '출근 알림',
        body: `${store?.name || '매장'} 출근 시간 30분 전입니다. (${timeDisplay})`,
        deep_link: '/qr-scan',
        data: {
          scheduleId: schedule.id,
          storeId: schedule.store_id,
          startTime: schedule.start_time,
        },
        sent: true,
        sent_at: new Date().toISOString(),
      });

      sentCount++;
    }

    return NextResponse.json({
      success: true,
      message: `Work reminders sent`,
      sent: sentCount,
      skipped: skipCount,
      total: schedules.length,
    });
  } catch (error) {
    console.error('Work reminder cron error:', error);
    return NextResponse.json(
      { error: 'Work reminder cron failed' },
      { status: 500 }
    );
  }
}
