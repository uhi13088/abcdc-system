/**
 * 출근 체크인 API
 * POST /api/attendance/checkin
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createAuthClient } from '@/lib/supabase/server';
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

    // 인증 검증
    const authClient = await createAuthClient();
    const { data: { user: authUser } } = await authClient.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 사용자 정보 조회
    const { data: userData } = await supabase
      .from('users')
      .select('id, store_id')
      .eq('auth_id', authUser.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      qrToken,
      beaconId,  // 비콘 ID 추가
      latitude,
      longitude,
      deviceInfo,
      photoUrl,
      unscheduledReason, // 미배정 출근 사유
    } = body;

    // 인증된 사용자 ID 사용 (보안: body에서 받지 않음)
    const userId = userData.id;

    let storeId: string;
    let checkInMethod: 'QR' | 'BEACON' | 'GEOFENCE' = 'GEOFENCE';

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
      checkInMethod = 'QR';
    } else if (beaconId) {
      // 비콘 ID로 매장 검증
      const { data: beaconStore, error: beaconError } = await supabase
        .from('stores')
        .select('id, name, beacon_id')
        .eq('beacon_id', beaconId)
        .single();

      if (beaconError || !beaconStore) {
        return NextResponse.json(
          { error: '유효하지 않은 비콘입니다.' },
          { status: 400 }
        );
      }

      storeId = beaconStore.id;
      checkInMethod = 'BEACON';
    } else {
      // QR, 비콘 없이 위치 기반 출근 (위치 필수)
      if (!latitude || !longitude) {
        return NextResponse.json(
          { error: '위치 정보가 필요합니다.' },
          { status: 400 }
        );
      }

      // 이미 인증에서 조회한 store_id 사용
      if (!userData.store_id) {
        return NextResponse.json(
          { error: '배정된 매장이 없습니다.' },
          { status: 400 }
        );
      }

      storeId = userData.store_id;
      checkInMethod = 'GEOFENCE';
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

      if (distanceFromStore > allowedRadius) {
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

    // 출근 상태 판단
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
    } else {
      // 스케줄 없이 출근한 경우 미배정 출근으로 처리
      status = 'UNSCHEDULED';
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
    const attendanceData: Record<string, unknown> = {
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
      check_in_method: checkInMethod,
      status,
    };

    // 미배정 출근인 경우 사유 저장
    if (status === 'UNSCHEDULED' && unscheduledReason) {
      attendanceData.unscheduled_reason = unscheduledReason;
    }

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

    // 미배정 출근인 경우 승인 요청 생성 및 관리자 알림
    if (status === 'UNSCHEDULED') {
      // 사용자 이름 조회
      const { data: staffInfo } = await supabase
        .from('users')
        .select('name, role')
        .eq('id', userId)
        .single();

      // 매장 관리자 조회 (store_manager, manager, company_admin)
      const { data: managers } = await supabase
        .from('users')
        .select('id, name, role')
        .eq('store_id', storeId)
        .in('role', ['store_manager', 'manager', 'company_admin'])
        .eq('status', 'ACTIVE');

      // 승인 라인 생성
      const approvalLine = (managers || []).map((manager, index) => ({
        step: index + 1,
        approver_id: manager.id,
        approver_name: manager.name,
        approver_role: manager.role,
        status: 'PENDING',
      }));

      // 승인 요청이 가능한 경우에만 생성 (승인자가 있는 경우)
      if (approvalLine.length > 0) {
        await supabase.from('approval_requests').insert({
          type: 'UNSCHEDULED_CHECKIN',
          requester_id: userId,
          requester_name: staffInfo?.name,
          requester_role: staffInfo?.role,
          company_id: store.company_id,
          brand_id: store.brand_id,
          store_id: storeId,
          approval_line: approvalLine,
          current_step: 1,
          final_status: 'PENDING',
          details: {
            attendance_id: attendance.id,
            work_date: today,
            check_in_time: now.toISOString(),
            reason: unscheduledReason || '사유 미입력',
          },
        });

        // 관리자들에게 알림 전송
        const notifications = (managers || []).map((manager) => ({
          user_id: manager.id,
          category: 'ATTENDANCE',
          priority: 'HIGH',
          title: '미배정 출근 승인 요청',
          body: `${staffInfo?.name || '직원'}님이 미배정 출근을 했습니다. 사유: ${unscheduledReason || '미입력'}`,
          data: {
            type: 'UNSCHEDULED_CHECKIN',
            attendance_id: attendance.id,
            staff_id: userId,
          },
          deep_link: '/attendance',
        }));

        if (notifications.length > 0) {
          await supabase.from('notifications').insert(notifications);
        }
      }
    }

    // 위치 이상 감지 시 anomaly 기록 (extensions JSONB에 저장)
    if (!locationValid && distanceFromStore !== null) {
      // attendance_anomalies 테이블이 008_attendance_extensions 마이그레이션에만 존재
      // 기본 스키마에서는 attendances.anomalies JSONB 필드 사용
      await supabase
        .from('attendances')
        .update({
          anomalies: {
            type: 'LOCATION_OUTSIDE_GEOFENCE',
            severity: 'MEDIUM',
            description: '출근 위치가 허용 범위를 벗어났습니다.',
            expected: { lat: store.latitude, lng: store.longitude },
            actual: { lat: latitude, lng: longitude },
            distance_meters: Math.round(distanceFromStore),
          },
        })
        .eq('id', attendance.id);
    }

    // 응답 메시지 결정
    let message = '출근 처리되었습니다.';
    if (status === 'UNSCHEDULED') {
      message = '미배정 출근으로 처리되었습니다. 관리자 승인 후 급여에 반영됩니다.';
    } else if (isLate) {
      message = '지각으로 출근 처리되었습니다.';
    }

    return NextResponse.json({
      success: true,
      attendance: {
        id: attendance.id,
        checkInTime: attendance.actual_check_in,
        status,
        isLate,
        isUnscheduled: status === 'UNSCHEDULED',
        locationValid,
        distanceFromStore: distanceFromStore
          ? Math.round(distanceFromStore)
          : null,
      },
      message,
    });
  } catch (error) {
    console.error('Check-in error:', error);
    return NextResponse.json(
      { error: '출근 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
