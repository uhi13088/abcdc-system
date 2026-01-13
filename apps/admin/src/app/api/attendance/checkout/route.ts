/**
 * 퇴근 체크아웃 API
 * POST /api/attendance/checkout
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createAuthClient } from '@/lib/supabase/server';
import { format, differenceInMinutes, differenceInHours } from 'date-fns';
import { QRCodeService } from '@/lib/services/qr-code.service';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
}

/**
 * 근무시간 계산 (휴게시간 제외)
 */
function calculateWorkHours(
  checkIn: Date,
  checkOut: Date,
  breakMinutes: number = 0
): {
  totalMinutes: number;
  workHours: number;
  overtimeHours: number;
  nightHours: number;
} {
  const totalMinutes = differenceInMinutes(checkOut, checkIn) - breakMinutes;
  const workHours = Math.max(0, totalMinutes / 60);

  // 8시간 초과분 = 연장근로
  const regularHours = Math.min(workHours, 8);
  const overtimeHours = Math.max(0, workHours - 8);

  // 야간근로 시간 계산 (22:00 ~ 06:00)
  let nightHours = 0;
  const checkInHour = checkIn.getHours();
  const checkOutHour = checkOut.getHours();

  // 간단한 야간근로 계산 (정확한 계산은 더 복잡함)
  if (checkOutHour >= 22 || checkOutHour < 6) {
    // 퇴근이 야간 시간대
    const nightEnd = checkOutHour < 6 ? checkOutHour + 6 : Math.max(0, checkOutHour - 22);
    nightHours = nightEnd;
  }
  if (checkInHour < 6) {
    // 출근이 새벽
    nightHours += 6 - checkInHour;
  }

  return {
    totalMinutes,
    workHours: parseFloat(workHours.toFixed(2)),
    overtimeHours: parseFloat(overtimeHours.toFixed(2)),
    nightHours: parseFloat(nightHours.toFixed(2)),
  };
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const qrService = new QRCodeService();

    // 인증 검증
    const authClient = await createAuthClient();
    const { data: { user: authUser } } = await authClient.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 사용자 정보 조회
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', authUser.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      qrToken,
      latitude,
      longitude,
      deviceInfo,
      photoUrl,
    } = body;

    // 인증된 사용자 ID 사용 (보안: body에서 받지 않음)
    const userId = userData.id;

    const today = format(new Date(), 'yyyy-MM-dd');
    const now = new Date();

    // 오늘 출근 기록 조회
    const { data: attendance, error: attendanceError } = await supabase
      .from('attendances')
      .select('*')
      .eq('staff_id', userId)
      .eq('work_date', today)
      .single();

    if (attendanceError || !attendance) {
      return NextResponse.json(
        { error: '오늘 출근 기록이 없습니다.' },
        { status: 400 }
      );
    }

    if (!attendance.actual_check_in) {
      return NextResponse.json(
        { error: '출근 기록이 없습니다. 먼저 출근해주세요.' },
        { status: 400 }
      );
    }

    if (attendance.actual_check_out) {
      return NextResponse.json(
        { error: '이미 퇴근 처리되었습니다.' },
        { status: 400 }
      );
    }

    // QR 검증 (있는 경우)
    if (qrToken) {
      const qrResult = await qrService.verifyQR(qrToken);
      if (!qrResult.valid) {
        return NextResponse.json(
          { error: qrResult.error || 'QR 코드가 유효하지 않습니다.' },
          { status: 400 }
        );
      }

      // 같은 매장인지 확인
      if (qrResult.storeId !== attendance.store_id) {
        return NextResponse.json(
          { error: '출근한 매장에서 퇴근해야 합니다.' },
          { status: 400 }
        );
      }
    }

    // 매장 정보 조회
    const { data: store } = await supabase
      .from('stores')
      .select('*')
      .eq('id', attendance.store_id)
      .single();

    // 스케줄 조회 (휴게시간 정보)
    const { data: schedule } = await supabase
      .from('schedules')
      .select('*')
      .eq('staff_id', userId)
      .eq('work_date', today)
      .maybeSingle();

    const breakMinutes = schedule?.break_minutes || 0;

    // 근무시간 계산
    const checkInTime = new Date(attendance.actual_check_in);
    const workData = calculateWorkHours(checkInTime, now, breakMinutes);

    // 조기퇴근 체크
    let isEarly = false;
    if (schedule?.end_time) {
      const scheduledEnd = new Date(schedule.end_time);
      const earlyMinutes = store?.early_checkout_minutes || 30;

      if (
        now < new Date(scheduledEnd.getTime() - earlyMinutes * 60 * 1000)
      ) {
        isEarly = true;
        // 조기퇴근 상태 업데이트
        if (attendance.status === 'NORMAL') {
          attendance.status = 'EARLY_OUT';
        }
      }
    }

    // 퇴근 기록 업데이트
    const { data: updatedAttendance, error: updateError } = await supabase
      .from('attendances')
      .update({
        actual_check_out: now.toISOString(),
        check_out_lat: latitude,
        check_out_lng: longitude,
        check_out_photo_url: photoUrl,
        work_hours: workData.workHours,
        break_hours: breakMinutes / 60,
        overtime_hours: workData.overtimeHours,
        night_hours: workData.nightHours,
        status: isEarly && attendance.status === 'NORMAL' ? 'EARLY_OUT' : attendance.status,
      })
      .eq('id', attendance.id)
      .select()
      .single();

    if (updateError) {
      console.error('Checkout update error:', updateError);
      return NextResponse.json(
        { error: '퇴근 기록 저장에 실패했습니다.' },
        { status: 500 }
      );
    }

    // 조기퇴근 이상 감지
    if (isEarly) {
      await supabase.from('attendance_anomalies').insert({
        attendance_id: attendance.id,
        anomaly_type: 'EARLY_CHECKOUT',
        severity: 'LOW',
        description: '예정 퇴근 시간보다 일찍 퇴근했습니다.',
        expected_time: schedule?.end_time,
        actual_time: now.toISOString(),
        difference_minutes: schedule?.end_time
          ? differenceInMinutes(new Date(schedule.end_time), now)
          : null,
      });
    }

    return NextResponse.json({
      success: true,
      attendance: {
        id: updatedAttendance.id,
        checkInTime: updatedAttendance.actual_check_in,
        checkOutTime: updatedAttendance.actual_check_out,
        workHours: workData.workHours,
        overtimeHours: workData.overtimeHours,
        nightHours: workData.nightHours,
        breakHours: breakMinutes / 60,
        status: updatedAttendance.status,
        isEarly,
      },
      message: isEarly
        ? '조기 퇴근 처리되었습니다.'
        : '퇴근 처리되었습니다.',
    });
  } catch (error) {
    console.error('Check-out error:', error);
    return NextResponse.json(
      { error: '퇴근 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 자동 퇴근 처리 (Cron용)
export async function PUT(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const today = format(new Date(), 'yyyy-MM-dd');
    const now = new Date();

    // 출근했지만 퇴근하지 않은 기록 조회
    const { data: pendingAttendances, error } = await supabase
      .from('attendances')
      .select('*')
      .eq('work_date', today)
      .not('actual_check_in', 'is', null)
      .is('actual_check_out', null);

    if (error || !pendingAttendances) {
      return NextResponse.json({ error: 'Query failed' }, { status: 500 });
    }

    let processed = 0;

    for (const attendance of pendingAttendances) {
      // 스케줄 종료 후 2시간이 지났으면 자동 퇴근
      const { data: schedule } = await supabase
        .from('schedules')
        .select('end_time')
        .eq('staff_id', attendance.staff_id)
        .eq('work_date', today)
        .maybeSingle();

      if (schedule?.end_time) {
        const scheduledEnd = new Date(schedule.end_time);
        const autoCheckoutTime = new Date(
          scheduledEnd.getTime() + 2 * 60 * 60 * 1000
        ); // 2시간 후

        if (now >= autoCheckoutTime) {
          // 예정 퇴근 시간으로 자동 퇴근 처리
          const checkInTime = new Date(attendance.actual_check_in);
          const workData = calculateWorkHours(checkInTime, scheduledEnd, 60);

          await supabase
            .from('attendances')
            .update({
              actual_check_out: scheduledEnd.toISOString(),
              work_hours: workData.workHours,
              overtime_hours: workData.overtimeHours,
              night_hours: workData.nightHours,
              auto_checkout: true,
              auto_checkout_reason: 'SCHEDULE_END',
              status: 'AUTO_CHECKOUT',
            })
            .eq('id', attendance.id);

          processed++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      message: `${processed}건의 자동 퇴근 처리 완료`,
    });
  } catch (error) {
    console.error('Auto checkout error:', error);
    return NextResponse.json(
      { error: 'Auto checkout failed' },
      { status: 500 }
    );
  }
}
