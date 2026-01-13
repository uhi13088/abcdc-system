/**
 * 출근 체크인 API
 * POST /api/attendance/checkin
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { format } from 'date-fns';
import { QRCodeService } from '@/lib/services/qr-code.service';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
}

/**
 * 두 좌표 간의 거리 계산 (미터)
 */
function calculateDistance(
  coord1: { lat: number; lng: number },
  coord2: { lat: number; lng: number }
): number {
  const R = 6371e3; // 지구 반지름 (미터)
  const lat1Rad = (coord1.lat * Math.PI) / 180;
  const lat2Rad = (coord2.lat * Math.PI) / 180;
  const deltaLat = ((coord2.lat - coord1.lat) * Math.PI) / 180;
  const deltaLng = ((coord2.lng - coord1.lng) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const qrService = new QRCodeService();

    const body = await request.json();
    const {
      userId,
      qrToken,
      latitude,
      longitude,
      deviceInfo,
      photoUrl,
    } = body;

    if (!userId) {
      return NextResponse.json(
        { error: '사용자 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    let storeId: string;

    // QR 토큰이 있으면 검증
    if (qrToken) {
      const qrResult = await qrService.verifyQR(qrToken);

      if (!qrResult.valid) {
        return NextResponse.json(
          { error: qrResult.error || 'QR 코드가 유효하지 않습니다.' },
          { status: 400 }
        );
      }

      storeId = qrResult.storeId;
    } else {
      // QR 없이 위치 기반 출근 (위치 필수)
      if (!latitude || !longitude) {
        return NextResponse.json(
          { error: '위치 정보가 필요합니다.' },
          { status: 400 }
        );
      }

      // 사용자의 배정 매장 조회
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('store_id')
        .eq('id', userId)
        .single();

      if (userError || !user?.store_id) {
        return NextResponse.json(
          { error: '배정된 매장이 없습니다.' },
          { status: 400 }
        );
      }

      storeId = user.store_id;
    }

    // 매장 정보 조회
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .single();

    if (storeError || !store) {
      return NextResponse.json(
        { error: '매장을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 위치 검증 (지오펜스)
    let locationValid = true;
    let distanceFromStore: number | null = null;

    if (latitude && longitude && store.latitude && store.longitude) {
      distanceFromStore = calculateDistance(
        { lat: latitude, lng: longitude },
        { lat: store.latitude, lng: store.longitude }
      );

      const allowedRadius = store.allowed_radius || 100; // 기본 100m

      if (store.geofence_enabled !== false && distanceFromStore > allowedRadius) {
        // 위치 이탈 기록 (하지만 출근은 허용할 수도 있음)
        locationValid = false;
      }
    }

    const today = format(new Date(), 'yyyy-MM-dd');
    const now = new Date();

    // 오늘 스케줄 조회
    const { data: schedule } = await supabase
      .from('schedules')
      .select('*')
      .eq('staff_id', userId)
      .eq('work_date', today)
      .maybeSingle();

    // 지각 여부 판단
    let status = 'NORMAL';
    let isLate = false;

    if (schedule) {
      const scheduledStart = new Date(schedule.start_time);
      const earlyMinutes = store.early_checkin_minutes || 30;

      // 예정 출근 시간보다 늦으면 지각
      if (now > scheduledStart) {
        status = 'LATE';
        isLate = true;
      }
      // 너무 일찍 출근 (이상 출근)
      else if (
        now < new Date(scheduledStart.getTime() - earlyMinutes * 60 * 1000)
      ) {
        status = 'EARLY';
      }
    }

    // 이미 출근한 기록이 있는지 확인
    const { data: existingAttendance } = await supabase
      .from('attendances')
      .select('id, actual_check_in')
      .eq('staff_id', userId)
      .eq('work_date', today)
      .maybeSingle();

    if (existingAttendance?.actual_check_in) {
      return NextResponse.json(
        { error: '이미 출근 처리되었습니다.' },
        { status: 400 }
      );
    }

    // 출근 기록 저장 (upsert)
    const attendanceData = {
      staff_id: userId,
      company_id: store.company_id,
      brand_id: store.brand_id,
      store_id: storeId,
      work_date: today,
      scheduled_check_in: schedule?.start_time,
      scheduled_check_out: schedule?.end_time,
      actual_check_in: now.toISOString(),
      check_in_lat: latitude,
      check_in_lng: longitude,
      check_in_method: qrToken ? 'QR' : 'LOCATION',
      check_in_photo_url: photoUrl,
      device_info: deviceInfo,
      status,
    };

    const { data: attendance, error: attendanceError } = await supabase
      .from('attendances')
      .upsert(attendanceData, {
        onConflict: 'staff_id,work_date',
      })
      .select()
      .single();

    if (attendanceError) {
      console.error('Attendance save error:', attendanceError);
      return NextResponse.json(
        { error: '출근 기록 저장에 실패했습니다.' },
        { status: 500 }
      );
    }

    // 위치 이상 감지 시 anomaly 기록
    if (!locationValid && distanceFromStore !== null) {
      await supabase.from('attendance_anomalies').insert({
        attendance_id: attendance.id,
        anomaly_type: 'LOCATION_OUTSIDE_GEOFENCE',
        severity: 'MEDIUM',
        description: '출근 위치가 허용 범위를 벗어났습니다.',
        expected_lat: store.latitude,
        expected_lng: store.longitude,
        actual_lat: latitude,
        actual_lng: longitude,
        distance_meters: Math.round(distanceFromStore),
      });
    }

    return NextResponse.json({
      success: true,
      attendance: {
        id: attendance.id,
        checkInTime: attendance.actual_check_in,
        status,
        isLate,
        locationValid,
        distanceFromStore: distanceFromStore
          ? Math.round(distanceFromStore)
          : null,
      },
      message: isLate
        ? '지각으로 출근 처리되었습니다.'
        : '출근 처리되었습니다.',
    });
  } catch (error) {
    console.error('Check-in error:', error);
    return NextResponse.json(
      { error: '출근 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
