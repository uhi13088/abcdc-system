/**
 * 긴급 근무 응답 API
 * POST /api/emergency-shifts/[id]/respond - 직원의 수락/거절 응답 처리
 * 수락 시 스케줄 자동 생성
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { PushNotificationService } from '@shared/services/push-notification.service';
import { format } from 'date-fns';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const shiftId = params.id;

    // 인증 확인
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await adminClient
      .from('users')
      .select('id, name, position, company_id, brand_id, store_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { response } = body; // 'ACCEPT' or 'DECLINE'

    if (!['ACCEPT', 'DECLINE'].includes(response)) {
      return NextResponse.json({ error: '유효하지 않은 응답입니다.' }, { status: 400 });
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

    // 이미 마감된 경우
    if (shift.status !== 'OPEN') {
      return NextResponse.json({ error: '이미 마감된 긴급 근무입니다.' }, { status: 400 });
    }

    // 초대받은 직원인지 확인
    const invitedIds = shift.invited_staff_ids || [];
    if (!invitedIds.includes(userData.id)) {
      return NextResponse.json({ error: '초대받지 않은 긴급 근무입니다.' }, { status: 403 });
    }

    // 이미 응답한 경우
    const respondedIds = shift.responded_staff_ids || [];
    if (respondedIds.includes(userData.id)) {
      return NextResponse.json({ error: '이미 응답한 긴급 근무입니다.' }, { status: 400 });
    }

    const pushService = new PushNotificationService();
    const workDate = format(new Date(shift.work_date), 'M월 d일');

    if (response === 'ACCEPT') {
      // 정원 확인
      const currentAssigned = shift.assigned_staff_ids?.length || 0;
      if (currentAssigned >= shift.required_count) {
        return NextResponse.json({
          error: '이미 정원이 마감되었습니다.',
          status: 'FILLED',
        }, { status: 400 });
      }

      // 스케줄 자동 생성
      const { error: scheduleError } = await adminClient.from('schedules').insert({
        staff_id: userData.id,
        company_id: shift.stores?.company_id || userData.company_id,
        brand_id: shift.stores?.brand_id || userData.brand_id,
        store_id: shift.store_id,
        work_date: shift.work_date,
        start_time: shift.start_time,
        end_time: shift.end_time,
        position: shift.position,
        is_emergency: true,
        emergency_shift_id: shiftId,
        notes: `긴급 근무 (보너스: ${shift.bonus?.toLocaleString() || 0}원)`,
      });

      if (scheduleError) {
        console.error('Schedule creation error:', scheduleError);
        return NextResponse.json({ error: '스케줄 생성에 실패했습니다.' }, { status: 500 });
      }

      // 배정된 직원 목록 업데이트
      const assignedIds = [...(shift.assigned_staff_ids || []), userData.id];

      // 정원 달성 여부 확인
      const isFilled = assignedIds.length >= shift.required_count;

      await adminClient
        .from('emergency_shifts')
        .update({
          assigned_staff_ids: assignedIds,
          responded_staff_ids: [...respondedIds, userData.id],
          status: isFilled ? 'FILLED' : 'OPEN',
          filled_at: isFilled ? new Date().toISOString() : null,
        })
        .eq('id', shiftId);

      // 관리자에게 알림
      const { data: managers } = await adminClient
        .from('users')
        .select('id')
        .eq('company_id', shift.stores?.company_id)
        .in('role', ['COMPANY_ADMIN', 'STORE_MANAGER', 'company_admin', 'store_manager']);

      for (const manager of managers || []) {
        await adminClient.from('notifications').insert({
          user_id: manager.id,
          category: 'EMERGENCY_SHIFT',
          priority: 'HIGH',
          title: '✅ 긴급 근무 수락',
          body: `${userData.name}님이 ${workDate} 긴급 근무를 수락했습니다.${isFilled ? ' (정원 마감)' : ''}`,
          deep_link: `/emergency-shifts/${shiftId}`,
        });

        // 푸시 알림
        const { data: fcmTokens } = await adminClient
          .from('user_fcm_tokens')
          .select('fcm_token')
          .eq('user_id', manager.id)
          .eq('is_active', true);

        if (fcmTokens && fcmTokens.length > 0) {
          await pushService.sendToMultiple(
            fcmTokens.map((t) => t.fcm_token),
            {
              title: '✅ 긴급 근무 수락',
              body: `${userData.name}님이 ${workDate} 긴급 근무를 수락했습니다.`,
              data: { shiftId, type: 'EMERGENCY_ACCEPT', staffName: userData.name },
            }
          );
        }
      }

      // 직원에게 확인 알림
      await adminClient.from('notifications').insert({
        user_id: userData.id,
        category: 'SCHEDULE',
        priority: 'HIGH',
        title: '📅 긴급 근무 스케줄 등록',
        body: `${workDate} ${shift.stores?.name || '매장'} 긴급 근무가 스케줄에 등록되었습니다.`,
        deep_link: `/schedule`,
      });

      return NextResponse.json({
        success: true,
        message: '긴급 근무를 수락했습니다. 스케줄이 자동으로 등록되었습니다.',
        scheduleCreated: true,
        shiftStatus: isFilled ? 'FILLED' : 'OPEN',
      });
    } else {
      // 거절 처리
      await adminClient
        .from('emergency_shifts')
        .update({
          responded_staff_ids: [...respondedIds, userData.id],
          declined_staff_ids: [...(shift.declined_staff_ids || []), userData.id],
        })
        .eq('id', shiftId);

      return NextResponse.json({
        success: true,
        message: '긴급 근무를 거절했습니다.',
        scheduleCreated: false,
      });
    }
  } catch (error) {
    console.error('Emergency shift respond error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
