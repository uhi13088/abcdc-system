/**
 * 긴급 근무 초대 API
 * POST /api/emergency-shifts/[id]/invite - 직원들에게 긴급 근무 푸시 초대 발송
 * 경험자 우선 정렬 및 매칭
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createAuthClient } from '@/lib/supabase/server';
import { pushNotificationService } from '@abc/shared/server';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
}

interface StaffCandidate {
  id: string;
  name: string;
  position: string | null;
  experience_score: number;
  same_store_count: number;
  same_position_count: number;
  total_shifts: number;
  avg_rating: number | null;
  is_available: boolean;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 인증 검사
  const authClient = await createAuthClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: userData } = await authClient
    .from('users')
    .select('id, role, company_id, store_id')
    .eq('auth_id', user.id)
    .single();

  if (!['super_admin', 'company_admin', 'manager', 'store_manager'].includes(userData?.role || '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = getSupabaseClient();

  try {
    const { id } = await params;
    const shiftId = id;
    const body = await request.json();
    const { staffIds, inviteAll = false, maxInvites = 20 } = body;

    // 긴급 근무 정보 조회
    const { data: shift, error: shiftError } = await supabase
      .from('emergency_shifts')
      .select(`
        *,
        stores (
          id,
          name,
          company_id,
          brand_id
        )
      `)
      .eq('id', shiftId)
      .single();

    if (shiftError || !shift) {
      return NextResponse.json(
        { error: '긴급 근무를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (shift.status !== 'OPEN') {
      return NextResponse.json(
        { error: '마감된 긴급 근무입니다.' },
        { status: 400 }
      );
    }

    let candidates: StaffCandidate[] = [];

    if (inviteAll || !staffIds || staffIds.length === 0) {
      // 경험자 우선 정렬로 후보 조회
      candidates = await getStaffCandidates(supabase, shift, maxInvites);
    } else {
      // 지정된 직원만 조회
      const { data: staffList } = await supabase
        .from('users')
        .select('id, name, position')
        .in('id', staffIds)
        .eq('status', 'ACTIVE');

      candidates = (staffList || []).map((s: { id: string; name: string; position: string | null }) => ({
        id: s.id,
        name: s.name,
        position: s.position,
        experience_score: 0,
        same_store_count: 0,
        same_position_count: 0,
        total_shifts: 0,
        avg_rating: null,
        is_available: true,
      }));
    }

    if (candidates.length === 0) {
      return NextResponse.json(
        { error: '초대 가능한 직원이 없습니다.' },
        { status: 400 }
      );
    }

    // 이미 초대된 직원 제외
    const existingInvites = shift.invited_staff_ids || [];
    const newCandidates = candidates.filter(
      (c) => !existingInvites.includes(c.id)
    );

    if (newCandidates.length === 0) {
      return NextResponse.json(
        { error: '모든 후보에게 이미 초대를 발송했습니다.' },
        { status: 400 }
      );
    }

    const workDate = format(new Date(shift.work_date), 'M월 d일');
    const startTime = format(new Date(shift.start_time), 'HH:mm');
    const endTime = format(new Date(shift.end_time), 'HH:mm');
    const bonusText = shift.bonus ? ` (+${shift.bonus.toLocaleString()}원 보너스)` : '';

    let invitedCount = 0;
    const invitedIds: string[] = [];

    for (const candidate of newCandidates) {
      // FCM 토큰 조회
      const { data: fcmTokens } = await supabase
        .from('user_fcm_tokens')
        .select('fcm_token')
        .eq('user_id', candidate.id)
        .eq('is_active', true);

      if (fcmTokens && fcmTokens.length > 0) {
        for (const tokenRecord of fcmTokens) {
          try {
            await pushNotificationService.send(tokenRecord.fcm_token, {
              title: '🚨 긴급 근무 요청',
              body: `${shift.stores?.name || '매장'}에서 ${workDate} ${startTime}~${endTime} 근무자를 찾고 있습니다.${bonusText}`,
              category: 'EMERGENCY',
              priority: 'HIGH',
              deepLink: `/emergency-shifts/${shiftId}`,
              actions: [
                { id: 'APPLY', title: '지원하기' },
                { id: 'DECLINE', title: '거절' },
              ],
            });
          } catch (err) {
            console.error('Push notification error:', err);
          }
        }
      }

      // 알림 기록 저장
      await supabase.from('notifications').insert({
        user_id: candidate.id,
        category: 'EMERGENCY_SHIFT',
        priority: 'URGENT',
        title: '긴급 근무 요청',
        body: `${shift.stores?.name || '매장'}에서 ${workDate} ${startTime}~${endTime} 근무자를 찾고 있습니다.${bonusText}`,
        deep_link: `/emergency-shifts/${shiftId}`,
        data: {
          shiftId,
          storeId: shift.store_id,
          workDate: shift.work_date,
          bonus: shift.bonus,
          experienceScore: candidate.experience_score,
        },
        sent: true,
        sent_at: new Date().toISOString(),
      });

      invitedIds.push(candidate.id);
      invitedCount++;
    }

    // 초대된 직원 ID 업데이트
    await supabase
      .from('emergency_shifts')
      .update({
        invited_staff_ids: [...existingInvites, ...invitedIds],
      })
      .eq('id', shiftId);

    return NextResponse.json({
      success: true,
      message: `${invitedCount}명에게 긴급 근무 초대를 발송했습니다.`,
      invitedCount,
      candidates: newCandidates.map((c) => ({
        id: c.id,
        name: c.name,
        experienceScore: c.experience_score,
        sameStoreCount: c.same_store_count,
      })),
    });
  } catch (error) {
    console.error('Emergency shift invite error:', error);
    return NextResponse.json(
      { error: '긴급 근무 초대 발송에 실패했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * 경험자 우선 정렬로 직원 후보 조회
 */
async function getStaffCandidates(
  supabase: ReturnType<typeof getSupabaseClient>,
  shift: { stores?: { company_id?: string }; store_id: string; position: string; work_date: string },
  maxInvites: number
): Promise<StaffCandidate[]> {
  const companyId = shift.stores?.company_id;
  const storeId = shift.store_id;
  const position = shift.position;
  const workDate = shift.work_date;

  // 같은 회사의 활성 직원 조회
  const { data: staffList, error } = await supabase
    .from('users')
    .select('id, name, position')
    .eq('company_id', companyId)
    .eq('status', 'ACTIVE')
    .in('role', ['staff', 'part_time']);

  if (error || !staffList) {
    return [];
  }

  // 각 직원의 경험 점수 계산
  const candidates: StaffCandidate[] = [];

  for (const staff of staffList) {
    // 해당 날짜에 이미 스케줄이 있는지 확인
    const { data: existingSchedule } = await supabase
      .from('schedules')
      .select('id')
      .eq('staff_id', staff.id)
      .eq('work_date', workDate)
      .maybeSingle();

    const isAvailable = !existingSchedule;

    // 같은 매장 근무 횟수
    const { count: sameStoreCount } = await supabase
      .from('attendances')
      .select('id', { count: 'exact', head: true })
      .eq('staff_id', staff.id)
      .eq('store_id', storeId)
      .not('actual_check_in', 'is', null);

    // 같은 포지션 근무 횟수
    const { count: samePositionCount } = await supabase
      .from('schedules')
      .select('id', { count: 'exact', head: true })
      .eq('staff_id', staff.id)
      .eq('position', position);

    // 총 근무 횟수
    const { count: totalShifts } = await supabase
      .from('attendances')
      .select('id', { count: 'exact', head: true })
      .eq('staff_id', staff.id)
      .not('actual_check_in', 'is', null);

    // 평균 평점 (있는 경우)
    const { data: ratings } = await supabase
      .from('staff_ratings')
      .select('rating')
      .eq('staff_id', staff.id);

    const avgRating = ratings && ratings.length > 0
      ? ratings.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / ratings.length
      : null;

    // 경험 점수 계산 (가중치 적용)
    const experienceScore =
      (sameStoreCount || 0) * 10 +  // 같은 매장 경험 (가장 높은 가중치)
      (samePositionCount || 0) * 5 + // 같은 포지션 경험
      (totalShifts || 0) * 1 +       // 총 근무 경험
      (avgRating || 0) * 20;         // 평점

    candidates.push({
      id: staff.id,
      name: staff.name,
      position: staff.position,
      experience_score: Math.round(experienceScore),
      same_store_count: sameStoreCount || 0,
      same_position_count: samePositionCount || 0,
      total_shifts: totalShifts || 0,
      avg_rating: avgRating,
      is_available: isAvailable,
    });
  }

  // 경험 점수 내림차순 정렬, 가용 여부 우선
  return candidates
    .sort((a, b) => {
      // 가용 여부 먼저
      if (a.is_available && !b.is_available) return -1;
      if (!a.is_available && b.is_available) return 1;
      // 경험 점수 내림차순
      return b.experience_score - a.experience_score;
    })
    .slice(0, maxInvites);
}
