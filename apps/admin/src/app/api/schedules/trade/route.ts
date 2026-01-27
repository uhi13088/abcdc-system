/**
 * 스케줄 교환 API
 * POST /api/schedules/trade - 교환 요청
 * PUT /api/schedules/trade - 교환 응답
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { pushNotificationService } from '@abc/shared/server';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
}

// 교환 요청 생성
export async function POST(request: NextRequest) {
  const supabase = getSupabaseClient();
  try {
    const body = await request.json();
    const { requesterId, myScheduleId, targetScheduleId, reason } = body;

    if (!requesterId || !myScheduleId || !targetScheduleId) {
      return NextResponse.json(
        { error: '필수 정보가 누락되었습니다.' },
        { status: 400 }
      );
    }

    // 내 스케줄 조회
    const { data: mySchedule, error: myError } = await supabase
      .from('schedules')
      .select(`
        *,
        staff:users!staff_id (
          id,
          name
        )
      `)
      .eq('id', myScheduleId)
      .single();

    if (myError || !mySchedule) {
      return NextResponse.json(
        { error: '내 스케줄을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 내 스케줄인지 확인
    if (mySchedule.staff_id !== requesterId) {
      return NextResponse.json(
        { error: '본인 스케줄만 교환 요청할 수 있습니다.' },
        { status: 403 }
      );
    }

    // 상대방 스케줄 조회
    const { data: targetSchedule, error: targetError } = await supabase
      .from('schedules')
      .select(`
        *,
        staff:users!staff_id (
          id,
          name
        )
      `)
      .eq('id', targetScheduleId)
      .single();

    if (targetError || !targetSchedule) {
      return NextResponse.json(
        { error: '상대방 스케줄을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 같은 직원끼리 교환 불가
    if (mySchedule.staff_id === targetSchedule.staff_id) {
      return NextResponse.json(
        { error: '같은 직원의 스케줄끼리 교환할 수 없습니다.' },
        { status: 400 }
      );
    }

    // 이미 진행 중인 교환 요청이 있는지 확인
    const { data: existingRequest } = await supabase
      .from('schedule_trade_requests')
      .select('id')
      .eq('requester_schedule_id', myScheduleId)
      .eq('status', 'PENDING')
      .maybeSingle();

    if (existingRequest) {
      return NextResponse.json(
        { error: '이미 진행 중인 교환 요청이 있습니다.' },
        { status: 400 }
      );
    }

    // 교환 요청 생성
    const { data: tradeRequest, error: insertError } = await supabase
      .from('schedule_trade_requests')
      .insert({
        requester_id: requesterId,
        requester_schedule_id: myScheduleId,
        target_id: targetSchedule.staff_id,
        target_schedule_id: targetScheduleId,
        reason,
        status: 'PENDING',
        requires_manager_approval: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Trade request insert error:', insertError);
      return NextResponse.json(
        { error: '교환 요청 생성에 실패했습니다.' },
        { status: 500 }
      );
    }

    // 상대방에게 알림
    const { data: targetFcmTokens } = await supabase
      .from('user_fcm_tokens')
      .select('fcm_token')
      .eq('user_id', targetSchedule.staff_id)
      .eq('is_active', true);

    if (targetFcmTokens && targetFcmTokens.length > 0) {
      for (const tokenRecord of targetFcmTokens) {
        await pushNotificationService.send(tokenRecord.fcm_token, {
          title: '스케줄 교환 요청',
          body: `${mySchedule.staff?.name}님이 ${mySchedule.work_date} 스케줄 교환을 요청했습니다.`,
          category: 'SCHEDULE',
          deepLink: `/schedules/trade/${tradeRequest.id}`,
          actions: [
            { id: 'ACCEPT', title: '수락' },
            { id: 'REJECT', title: '거절' },
          ],
        });
      }
    }

    // 알림 저장
    await supabase.from('notifications').insert({
      user_id: targetSchedule.staff_id,
      category: 'SCHEDULE',
      priority: 'HIGH',
      title: '스케줄 교환 요청',
      body: `${mySchedule.staff?.name}님이 ${mySchedule.work_date} 스케줄 교환을 요청했습니다.`,
      deep_link: `/schedules/trade/${tradeRequest.id}`,
      sent: true,
      sent_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      tradeRequest,
      message: '스케줄 교환 요청이 전송되었습니다.',
    });
  } catch (error) {
    console.error('Schedule trade request error:', error);
    return NextResponse.json(
      { error: '스케줄 교환 요청 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 교환 요청 응답 (수락/거절)
export async function PUT(request: NextRequest) {
  const supabase = getSupabaseClient();
  try {
    const body = await request.json();
    const { tradeRequestId, userId, action, comment } = body;

    if (!tradeRequestId || !userId || !action) {
      return NextResponse.json(
        { error: '필수 정보가 누락되었습니다.' },
        { status: 400 }
      );
    }

    if (!['ACCEPT', 'REJECT'].includes(action)) {
      return NextResponse.json(
        { error: '유효하지 않은 액션입니다.' },
        { status: 400 }
      );
    }

    // 교환 요청 조회
    const { data: tradeRequest, error: fetchError } = await supabase
      .from('schedule_trade_requests')
      .select(`
        *,
        requester:users!requester_id (
          id,
          name
        ),
        target:users!target_id (
          id,
          name
        ),
        requester_schedule:schedules!requester_schedule_id (*),
        target_schedule:schedules!target_schedule_id (*)
      `)
      .eq('id', tradeRequestId)
      .single();

    if (fetchError || !tradeRequest) {
      return NextResponse.json(
        { error: '교환 요청을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 상태 확인
    if (tradeRequest.status !== 'PENDING') {
      return NextResponse.json(
        { error: '이미 처리된 교환 요청입니다.' },
        { status: 400 }
      );
    }

    // 권한 확인 (대상자 또는 관리자)
    if (tradeRequest.target_id !== userId) {
      return NextResponse.json(
        { error: '해당 요청에 응답할 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const now = new Date().toISOString();

    if (action === 'REJECT') {
      // 거절 처리
      await supabase
        .from('schedule_trade_requests')
        .update({
          status: 'REJECTED',
          responded_at: now,
          response_comment: comment,
        })
        .eq('id', tradeRequestId);

      // 요청자에게 알림
      await supabase.from('notifications').insert({
        user_id: tradeRequest.requester_id,
        category: 'SCHEDULE',
        priority: 'NORMAL',
        title: '스케줄 교환 거절',
        body: `${tradeRequest.target?.name}님이 스케줄 교환을 거절했습니다.`,
        sent: true,
        sent_at: now,
      });

      return NextResponse.json({
        success: true,
        status: 'REJECTED',
        message: '스케줄 교환을 거절했습니다.',
      });
    }

    // 수락 처리 - 관리자 승인이 필요한지 확인
    if (tradeRequest.requires_manager_approval) {
      // 관리자 승인 대기 상태로 변경
      await supabase
        .from('schedule_trade_requests')
        .update({
          status: 'AWAITING_APPROVAL',
          responded_at: now,
          response_comment: comment,
        })
        .eq('id', tradeRequestId);

      // TODO: 관리자에게 알림 발송

      return NextResponse.json({
        success: true,
        status: 'AWAITING_APPROVAL',
        message: '상대방이 수락했습니다. 관리자 승인을 기다리고 있습니다.',
      });
    }

    // 관리자 승인 불필요 시 바로 교환 처리
    await executeScheduleTrade(tradeRequest);

    // 상태 업데이트
    await supabase
      .from('schedule_trade_requests')
      .update({
        status: 'APPROVED',
        responded_at: now,
        response_comment: comment,
      })
      .eq('id', tradeRequestId);

    return NextResponse.json({
      success: true,
      status: 'APPROVED',
      message: '스케줄 교환이 완료되었습니다.',
    });
  } catch (error) {
    console.error('Schedule trade response error:', error);
    return NextResponse.json(
      { error: '스케줄 교환 응답 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 스케줄 교환 실행
interface TradeRequest {
  requester_id: string;
  target_id: string;
  requester_schedule: { id: string; staff_id: string };
  target_schedule: { id: string; staff_id: string };
  requester?: { name?: string };
  target?: { name?: string };
}

async function executeScheduleTrade(tradeRequest: TradeRequest): Promise<void> {
  const supabase = getSupabaseClient();
  const requesterSchedule = tradeRequest.requester_schedule;
  const targetSchedule = tradeRequest.target_schedule;

  // 스케줄 교환 (staff_id 교환)
  await supabase
    .from('schedules')
    .update({
      staff_id: targetSchedule.staff_id,
      traded_from_id: requesterSchedule.id,
      original_staff_id: requesterSchedule.staff_id,
    })
    .eq('id', requesterSchedule.id);

  await supabase
    .from('schedules')
    .update({
      staff_id: requesterSchedule.staff_id,
      traded_from_id: targetSchedule.id,
      original_staff_id: targetSchedule.staff_id,
    })
    .eq('id', targetSchedule.id);

  // 양쪽에 알림
  const now = new Date().toISOString();

  await supabase.from('notifications').insert([
    {
      user_id: tradeRequest.requester_id,
      category: 'SCHEDULE',
      priority: 'HIGH',
      title: '스케줄 교환 완료',
      body: `${tradeRequest.target?.name}님과의 스케줄 교환이 완료되었습니다.`,
      sent: true,
      sent_at: now,
    },
    {
      user_id: tradeRequest.target_id,
      category: 'SCHEDULE',
      priority: 'HIGH',
      title: '스케줄 교환 완료',
      body: `${tradeRequest.requester?.name}님과의 스케줄 교환이 완료되었습니다.`,
      sent: true,
      sent_at: now,
    },
  ]);
}

// 관리자 승인 (PATCH)
export async function PATCH(request: NextRequest) {
  const supabase = getSupabaseClient();
  try {
    const body = await request.json();
    const { tradeRequestId, managerId, action, comment } = body;

    if (!tradeRequestId || !managerId || !action) {
      return NextResponse.json(
        { error: '필수 정보가 누락되었습니다.' },
        { status: 400 }
      );
    }

    // 교환 요청 조회
    const { data: tradeRequest, error: fetchError } = await supabase
      .from('schedule_trade_requests')
      .select(`
        *,
        requester:users!requester_id (name),
        target:users!target_id (name),
        requester_schedule:schedules!requester_schedule_id (*),
        target_schedule:schedules!target_schedule_id (*)
      `)
      .eq('id', tradeRequestId)
      .eq('status', 'AWAITING_APPROVAL')
      .single();

    if (fetchError || !tradeRequest) {
      return NextResponse.json(
        { error: '승인 대기 중인 교환 요청을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();

    if (action === 'REJECT') {
      await supabase
        .from('schedule_trade_requests')
        .update({
          status: 'MANAGER_REJECTED',
          manager_approved: false,
          manager_id: managerId,
          manager_responded_at: now,
          manager_comment: comment,
        })
        .eq('id', tradeRequestId);

      return NextResponse.json({
        success: true,
        status: 'MANAGER_REJECTED',
        message: '스케줄 교환을 반려했습니다.',
      });
    }

    // 승인 처리
    await executeScheduleTrade(tradeRequest);

    await supabase
      .from('schedule_trade_requests')
      .update({
        status: 'APPROVED',
        manager_approved: true,
        manager_id: managerId,
        manager_responded_at: now,
        manager_comment: comment,
      })
      .eq('id', tradeRequestId);

    return NextResponse.json({
      success: true,
      status: 'APPROVED',
      message: '스케줄 교환을 승인했습니다.',
    });
  } catch (error) {
    console.error('Manager approval error:', error);
    return NextResponse.json(
      { error: '관리자 승인 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
