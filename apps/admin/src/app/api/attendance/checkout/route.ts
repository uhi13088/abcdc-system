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
  const _regularHours = Math.min(workHours, 8);
  const overtimeHours = Math.max(0, workHours - 8);

  // 야간근로 시간 계산 (22:00 ~ 06:00)
  // 정확한 야간 시간 계산 로직
  let nightHours = 0;

  // Create date objects for night period boundaries on the same day
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);

  // Define night periods (22:00-24:00 and 00:00-06:00)
  // For the check-in day
  const nightStart1 = new Date(checkInDate);
  nightStart1.setHours(22, 0, 0, 0);
  const nightEnd1 = new Date(checkInDate);
  nightEnd1.setHours(24, 0, 0, 0); // Midnight

  const nightStart2 = new Date(checkInDate);
  nightStart2.setHours(0, 0, 0, 0);
  const nightEnd2 = new Date(checkInDate);
  nightEnd2.setHours(6, 0, 0, 0);

  // Calculate overlap with early morning period (00:00-06:00)
  if (checkInDate < nightEnd2) {
    const overlapStart = checkInDate > nightStart2 ? checkInDate : nightStart2;
    const overlapEnd = checkOutDate < nightEnd2 ? checkOutDate : nightEnd2;
    if (overlapEnd > overlapStart) {
      nightHours += differenceInHours(overlapEnd, overlapStart);
    }
  }

  // Calculate overlap with evening period (22:00-24:00)
  if (checkOutDate > nightStart1) {
    const overlapStart = checkInDate > nightStart1 ? checkInDate : nightStart1;
    const overlapEnd = checkOutDate < nightEnd1 ? checkOutDate : nightEnd1;
    if (overlapEnd > overlapStart) {
      nightHours += differenceInHours(overlapEnd, overlapStart);
    }
  }

  // If checkout is next day early morning
  if (checkOutDate.getDate() > checkInDate.getDate()) {
    const nextDayNightEnd = new Date(checkOutDate);
    nextDayNightEnd.setHours(6, 0, 0, 0);
    const nextDayMidnight = new Date(checkOutDate);
    nextDayMidnight.setHours(0, 0, 0, 0);

    if (checkOutDate <= nextDayNightEnd) {
      nightHours += differenceInHours(checkOutDate, nextDayMidnight);
    } else if (checkOutDate > nextDayNightEnd) {
      nightHours += 6; // Full early morning period
    }
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
      deviceInfo: _deviceInfo,
      photoUrl: _photoUrl,
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

    // 퇴근 기록 업데이트 (기본 스키마 필드만 사용)
    const { data: updatedAttendance, error: updateError } = await supabase
      .from('attendances')
      .update({
        actual_check_out: now.toISOString(),
        check_out_lat: latitude,
        check_out_lng: longitude,
        work_hours: workData.workHours,
        break_hours: breakMinutes / 60,
        overtime_hours: workData.overtimeHours,
        night_hours: workData.nightHours,
        status: isEarly && attendance.status === 'NORMAL' ? 'EARLY_LEAVE' : attendance.status,
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

    // 조기퇴근 이상 감지 시 anomalies JSONB에 저장
    if (isEarly && schedule?.end_time) {
      // attendance_anomalies 테이블은 008 마이그레이션에만 존재
      // 기본 스키마에서는 attendances.anomalies JSONB 필드 사용
      await supabase
        .from('attendances')
        .update({
          anomalies: {
            type: 'EARLY_CHECKOUT',
            severity: 'LOW',
            description: '예정 퇴근 시간보다 일찍 퇴근했습니다.',
            expected_time: schedule.end_time,
            actual_time: now.toISOString(),
            difference_minutes: differenceInMinutes(new Date(schedule.end_time), now),
          },
        })
        .eq('id', attendance.id);
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
export async function PUT(_request: NextRequest) {
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

          // 자동 퇴근 처리 (기본 스키마 필드만 사용)
          // auto_checkout, auto_checkout_reason은 008 마이그레이션에만 존재
          // extensions JSONB에 자동퇴근 정보 저장
          await supabase
            .from('attendances')
            .update({
              actual_check_out: scheduledEnd.toISOString(),
              work_hours: workData.workHours,
              overtime_hours: workData.overtimeHours,
              night_hours: workData.nightHours,
              status: 'NORMAL',
              extensions: {
                auto_checkout: true,
                auto_checkout_reason: 'SCHEDULE_END',
              },
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
