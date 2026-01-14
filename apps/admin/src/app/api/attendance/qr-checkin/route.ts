/**
 * POST /api/attendance/qr-checkin - QR 코드 스캔 출퇴근
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { qrCodeService } from '@/lib/services/qr-code.service';
import { z } from 'zod';

const QRCheckinSchema = z.object({
  token: z.string().min(1, 'QR 토큰이 필요합니다'),
  action: z.enum(['CHECK_IN', 'CHECK_OUT']),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    // 인증 확인
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 사용자 정보 확인
    const { data: userData } = await adminClient
      .from('users')
      .select('id, name, role, company_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 요청 데이터 검증
    const body = await request.json();
    const validation = QRCheckinSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { token, action, latitude, longitude } = validation.data;

    // 좌표 유효성 검증
    if (latitude !== undefined && longitude !== undefined) {
      if (latitude < -90 || latitude > 90) {
        return NextResponse.json({ error: '유효하지 않은 위도입니다.' }, { status: 400 });
      }
      if (longitude < -180 || longitude > 180) {
        return NextResponse.json({ error: '유효하지 않은 경도입니다.' }, { status: 400 });
      }
    }

    // QR 코드 검증
    const verifyResult = await qrCodeService.verifyQR(token);

    if (!verifyResult.valid) {
      return NextResponse.json(
        { error: verifyResult.error || 'Invalid QR code' },
        { status: 400 }
      );
    }

    const storeId = verifyResult.storeId;

    // 매장 정보 조회
    const { data: store } = await adminClient
      .from('stores')
      .select('id, name, company_id, latitude, longitude, geofence_radius')
      .eq('id', storeId)
      .single();

    if (!store) {
      return NextResponse.json({ error: '매장을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 회사 일치 확인
    if (store.company_id !== userData.company_id) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    // Geofence 확인 (옵션)
    let withinGeofence = true;
    if (latitude && longitude && store.latitude && store.longitude && store.geofence_radius) {
      const distance = calculateDistance(
        latitude,
        longitude,
        store.latitude,
        store.longitude
      );
      withinGeofence = distance <= store.geofence_radius;
    }

    const now = new Date();
    const today = now.toISOString().split('T')[0];

    if (action === 'CHECK_IN') {
      // 체크인 처리

      // 먼저 기존 출근 기록 확인 (중복 체크인 방지)
      const { data: existingCheckin } = await adminClient
        .from('attendances')
        .select('id, actual_check_in')
        .eq('staff_id', userData.id)
        .eq('work_date', today)
        .not('actual_check_in', 'is', null)
        .maybeSingle();

      if (existingCheckin) {
        return NextResponse.json(
          { error: '이미 출근 처리되었습니다.' },
          { status: 400 }
        );
      }

      // 오늘 스케줄 조회
      const { data: schedule } = await adminClient
        .from('schedules')
        .select('id, scheduled_check_in, scheduled_check_out')
        .eq('staff_id', userData.id)
        .eq('work_date', today)
        .eq('status', 'CONFIRMED')
        .maybeSingle();

      // 원자적 upsert 작업으로 race condition 방지
      const { data, error } = await adminClient
        .from('attendances')
        .upsert({
          staff_id: userData.id,
          company_id: userData.company_id,
          store_id: storeId,
          work_date: today,
          schedule_id: schedule?.id,
          scheduled_check_in: schedule?.scheduled_check_in,
          scheduled_check_out: schedule?.scheduled_check_out,
          actual_check_in: now.toISOString(),
          check_in_location: latitude && longitude ? `POINT(${longitude} ${latitude})` : null,
          check_in_method: 'QR',
          within_geofence: withinGeofence,
          status: 'PRESENT',
        }, {
          onConflict: 'staff_id,work_date',
          ignoreDuplicates: false,
        })
        .select()
        .single();

      if (error) throw error;
      const attendanceId = data.id;

      return NextResponse.json({
        message: '출근 처리되었습니다.',
        data: {
          attendanceId,
          checkInTime: now.toISOString(),
          storeName: store.name,
          withinGeofence,
        },
      });
    } else {
      // 체크아웃 처리

      // 오늘 출근 기록 조회
      const { data: attendance } = await adminClient
        .from('attendances')
        .select('*')
        .eq('staff_id', userData.id)
        .eq('work_date', today)
        .single();

      if (!attendance) {
        return NextResponse.json(
          { error: '출근 기록이 없습니다. 먼저 출근 처리를 해주세요.' },
          { status: 400 }
        );
      }

      if (!attendance.actual_check_in) {
        return NextResponse.json(
          { error: '출근 처리가 되지 않았습니다.' },
          { status: 400 }
        );
      }

      if (attendance.actual_check_out) {
        return NextResponse.json(
          { error: '이미 퇴근 처리되었습니다.' },
          { status: 400 }
        );
      }

      // 근무 시간 계산
      const checkInTime = new Date(attendance.actual_check_in);
      const workMinutes = Math.floor((now.getTime() - checkInTime.getTime()) / (1000 * 60));
      const workHours = Math.floor(workMinutes / 60);
      const breakMinutes = attendance.break_minutes || 0;
      const actualWorkMinutes = Math.max(0, workMinutes - breakMinutes);
      const actualWorkHours = Math.round((actualWorkMinutes / 60) * 100) / 100;

      // 퇴근 처리
      const { error } = await adminClient
        .from('attendances')
        .update({
          actual_check_out: now.toISOString(),
          check_out_location: latitude && longitude ? `POINT(${longitude} ${latitude})` : null,
          check_out_method: 'QR',
          work_hours: actualWorkHours,
          work_minutes: actualWorkMinutes,
        })
        .eq('id', attendance.id);

      if (error) throw error;

      return NextResponse.json({
        message: '퇴근 처리되었습니다.',
        data: {
          attendanceId: attendance.id,
          checkInTime: attendance.actual_check_in,
          checkOutTime: now.toISOString(),
          workHours: actualWorkHours,
          storeName: store.name,
          withinGeofence,
        },
      });
    }
  } catch (error) {
    console.error('[POST /api/attendance/qr-checkin] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}

/**
 * Haversine 공식을 사용한 두 좌표 간 거리 계산 (미터)
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // 지구 반지름 (미터)
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
