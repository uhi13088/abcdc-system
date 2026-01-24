/**
 * 미배정 출근 승인/거절 API
 * POST /api/attendances/[id]/approve-unscheduled
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createAuthClient } from '@/lib/supabase/server';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseClient();

    // 인증 검증
    const authClient = await createAuthClient();
    const { data: { user: authUser } } = await authClient.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 현재 사용자 정보 조회
    const { data: currentUser } = await supabase
      .from('users')
      .select('id, name, role, store_id, company_id')
      .eq('auth_id', authUser.id)
      .single();

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 권한 확인 (store_manager, manager, company_admin만 승인 가능)
    if (!['store_manager', 'manager', 'company_admin', 'super_admin'].includes(currentUser.role)) {
      return NextResponse.json(
        { error: '승인 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action, rejectionReason } = body;

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: '유효하지 않은 액션입니다.' },
        { status: 400 }
      );
    }

    // 출퇴근 기록 조회
    const { data: attendance, error: attendanceError } = await supabase
      .from('attendances')
      .select('*, staff:users!attendances_staff_id_fkey(id, name)')
      .eq('id', id)
      .single();

    if (attendanceError || !attendance) {
      return NextResponse.json(
        { error: '출퇴근 기록을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 미배정 출근 상태인지 확인
    if (attendance.status !== 'UNSCHEDULED') {
      return NextResponse.json(
        { error: '미배정 출근 상태가 아닙니다.' },
        { status: 400 }
      );
    }

    // 이미 승인된 경우 확인
    if (attendance.unscheduled_approved_at) {
      return NextResponse.json(
        { error: '이미 처리된 요청입니다.' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    if (action === 'approve') {
      // 승인: 상태를 ADDITIONAL_WORK(추가근무)으로 변경
      const { error: updateError } = await supabase
        .from('attendances')
        .update({
          status: 'ADDITIONAL_WORK',
          unscheduled_approved_at: now,
          unscheduled_approved_by: currentUser.id,
        })
        .eq('id', id);

      if (updateError) {
        console.error('Attendance update error:', updateError);
        return NextResponse.json(
          { error: '승인 처리에 실패했습니다.' },
          { status: 500 }
        );
      }

      // 관련 승인 요청 상태 업데이트
      await supabase
        .from('approval_requests')
        .update({
          final_status: 'APPROVED',
          finalized_at: now,
        })
        .eq('type', 'UNSCHEDULED_CHECKIN')
        .contains('details', { attendance_id: id });

      // 직원에게 승인 알림 전송
      await supabase.from('notifications').insert({
        user_id: attendance.staff_id,
        category: 'ATTENDANCE',
        priority: 'NORMAL',
        title: '미배정 출근 승인됨',
        body: `${attendance.work_date} 미배정 출근이 승인되어 추가근무로 처리되었습니다.`,
        data: {
          type: 'UNSCHEDULED_APPROVED',
          attendance_id: id,
        },
        deep_link: '/attendance',
      });

      return NextResponse.json({
        success: true,
        message: '미배정 출근이 승인되어 추가근무로 처리되었습니다.',
        newStatus: 'ADDITIONAL_WORK',
      });
    } else {
      // 거절: 상태 유지, 승인 거절 기록
      const { error: updateError } = await supabase
        .from('attendances')
        .update({
          unscheduled_approved_at: now,
          unscheduled_approved_by: currentUser.id,
          anomalies: {
            type: 'UNSCHEDULED_REJECTED',
            reason: rejectionReason || '관리자 거절',
            rejected_at: now,
            rejected_by: currentUser.id,
          },
        })
        .eq('id', id);

      if (updateError) {
        console.error('Attendance update error:', updateError);
        return NextResponse.json(
          { error: '거절 처리에 실패했습니다.' },
          { status: 500 }
        );
      }

      // 관련 승인 요청 상태 업데이트
      await supabase
        .from('approval_requests')
        .update({
          final_status: 'REJECTED',
          finalized_at: now,
        })
        .eq('type', 'UNSCHEDULED_CHECKIN')
        .contains('details', { attendance_id: id });

      // 직원에게 거절 알림 전송
      await supabase.from('notifications').insert({
        user_id: attendance.staff_id,
        category: 'ATTENDANCE',
        priority: 'HIGH',
        title: '미배정 출근 거절됨',
        body: `${attendance.work_date} 미배정 출근이 거절되었습니다. 사유: ${rejectionReason || '미입력'}`,
        data: {
          type: 'UNSCHEDULED_REJECTED',
          attendance_id: id,
          reason: rejectionReason,
        },
        deep_link: '/attendance',
      });

      return NextResponse.json({
        success: true,
        message: '미배정 출근이 거절되었습니다.',
        newStatus: 'UNSCHEDULED',
      });
    }
  } catch (error) {
    console.error('Approve unscheduled error:', error);
    return NextResponse.json(
      { error: '처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
