/**
 * 긴급 근무 후보자 조회 API
 * GET /api/emergency-shifts/[id]/candidates - 관리자 대시보드용 추천 후보 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

interface StaffCandidate {
  id: string;
  name: string;
  position: string | null;
  phone: string | null;
  experience_score: number;
  same_store_count: number;
  same_position_count: number;
  total_shifts: number;
  avg_rating: number | null;
  is_available: boolean;
  has_responded: boolean;
  response_status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | null;
  last_emergency_date: string | null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const shiftId = id;

    // 인증 확인
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await adminClient
      .from('users')
      .select('id, role, company_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData || !['COMPANY_ADMIN', 'STORE_MANAGER', 'company_admin', 'store_manager', 'super_admin'].includes(userData.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 긴급 근무 정보 조회
    const { data: shift, error: shiftError } = await adminClient
      .from('emergency_shifts')
      .select(`
        *,
        stores (id, name, company_id, brand_id)
      `)
      .eq('id', shiftId)
      .single();

    if (shiftError || !shift) {
      return NextResponse.json({ error: '긴급 근무를 찾을 수 없습니다.' }, { status: 404 });
    }

    const companyId = shift.stores?.company_id || userData.company_id;
    const storeId = shift.store_id;
    const position = shift.position;
    const workDate = shift.work_date;

    const invitedIds = shift.invited_staff_ids || [];
    const assignedIds = shift.assigned_staff_ids || [];
    const declinedIds = shift.declined_staff_ids || [];

    // 같은 회사의 활성 직원 조회
    const { data: staffList } = await adminClient
      .from('users')
      .select('id, name, position, phone')
      .eq('company_id', companyId)
      .eq('status', 'ACTIVE')
      .in('role', ['STAFF', 'PART_TIME', 'staff', 'part_time']);

    if (!staffList || staffList.length === 0) {
      return NextResponse.json({
        candidates: [],
        shift: {
          id: shift.id,
          workDate: shift.work_date,
          startTime: shift.start_time,
          endTime: shift.end_time,
          requiredCount: shift.required_count,
          assignedCount: assignedIds.length,
          status: shift.status,
        },
      });
    }

    const candidates: StaffCandidate[] = [];

    for (const staff of staffList) {
      // 해당 날짜 스케줄 확인
      const { data: existingSchedule } = await adminClient
        .from('schedules')
        .select('id')
        .eq('staff_id', staff.id)
        .eq('work_date', workDate)
        .maybeSingle();

      const isAvailable = !existingSchedule;

      // 같은 매장 근무 횟수
      const { count: sameStoreCount } = await adminClient
        .from('attendances')
        .select('id', { count: 'exact', head: true })
        .eq('staff_id', staff.id)
        .eq('store_id', storeId)
        .not('actual_check_in', 'is', null);

      // 같은 포지션 근무 횟수
      const { count: samePositionCount } = await adminClient
        .from('schedules')
        .select('id', { count: 'exact', head: true })
        .eq('staff_id', staff.id)
        .eq('position', position);

      // 총 근무 횟수
      const { count: totalShifts } = await adminClient
        .from('attendances')
        .select('id', { count: 'exact', head: true })
        .eq('staff_id', staff.id)
        .not('actual_check_in', 'is', null);

      // 평균 평점
      const { data: ratings } = await adminClient
        .from('staff_ratings')
        .select('rating')
        .eq('staff_id', staff.id);

      const avgRating = ratings && ratings.length > 0
        ? ratings.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / ratings.length
        : null;

      // 마지막 긴급 근무 날짜
      const { data: lastEmergency } = await adminClient
        .from('schedules')
        .select('work_date')
        .eq('staff_id', staff.id)
        .eq('is_emergency', true)
        .order('work_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      // 경험 점수 계산
      const experienceScore =
        (sameStoreCount || 0) * 10 +
        (samePositionCount || 0) * 5 +
        (totalShifts || 0) * 1 +
        (avgRating || 0) * 20;

      // 응답 상태 확인
      let responseStatus: StaffCandidate['response_status'] = null;
      if (assignedIds.includes(staff.id)) {
        responseStatus = 'ACCEPTED';
      } else if (declinedIds.includes(staff.id)) {
        responseStatus = 'DECLINED';
      } else if (invitedIds.includes(staff.id)) {
        responseStatus = 'PENDING';
      }

      candidates.push({
        id: staff.id,
        name: staff.name,
        position: staff.position,
        phone: staff.phone,
        experience_score: Math.round(experienceScore),
        same_store_count: sameStoreCount || 0,
        same_position_count: samePositionCount || 0,
        total_shifts: totalShifts || 0,
        avg_rating: avgRating ? Math.round(avgRating * 10) / 10 : null,
        is_available: isAvailable,
        has_responded: responseStatus === 'ACCEPTED' || responseStatus === 'DECLINED',
        response_status: responseStatus,
        last_emergency_date: lastEmergency?.work_date || null,
      });
    }

    // 정렬: 가용 여부 > 미응답 > 경험 점수
    const sortedCandidates = candidates.sort((a, b) => {
      // 이미 수락한 사람 먼저
      if (a.response_status === 'ACCEPTED' && b.response_status !== 'ACCEPTED') return -1;
      if (a.response_status !== 'ACCEPTED' && b.response_status === 'ACCEPTED') return 1;
      // 거절한 사람은 나중에
      if (a.response_status === 'DECLINED' && b.response_status !== 'DECLINED') return 1;
      if (a.response_status !== 'DECLINED' && b.response_status === 'DECLINED') return -1;
      // 가용 여부
      if (a.is_available && !b.is_available) return -1;
      if (!a.is_available && b.is_available) return 1;
      // 경험 점수
      return b.experience_score - a.experience_score;
    });

    return NextResponse.json({
      candidates: sortedCandidates,
      shift: {
        id: shift.id,
        storeName: shift.stores?.name,
        workDate: shift.work_date,
        startTime: shift.start_time,
        endTime: shift.end_time,
        position: shift.position,
        bonus: shift.bonus,
        requiredCount: shift.required_count,
        assignedCount: assignedIds.length,
        invitedCount: invitedIds.length,
        status: shift.status,
      },
      stats: {
        total: candidates.length,
        available: candidates.filter((c) => c.is_available).length,
        invited: invitedIds.length,
        accepted: assignedIds.length,
        declined: declinedIds.length,
        pending: invitedIds.length - assignedIds.length - declinedIds.length,
      },
    });
  } catch (error) {
    console.error('Emergency shift candidates error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
