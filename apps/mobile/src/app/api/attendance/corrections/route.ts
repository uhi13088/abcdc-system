/**
 * 근태 수정 요청 API
 * GET /api/attendance/corrections - 내 수정 요청 목록 조회
 * POST /api/attendance/corrections - 수정 요청 생성/업데이트
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 인증 확인
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 사용자 정보 조회
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', authUser.id)
      .single();

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // PENDING, APPROVED, REJECTED
    const limit = parseInt(searchParams.get('limit') || '20');

    // 수정 요청 목록 조회
    let query = supabase
      .from('attendance_correction_requests')
      .select(`
        id,
        attendance_id,
        request_type,
        original_check_in,
        original_check_out,
        requested_check_in,
        requested_check_out,
        reason,
        reason_category,
        overtime_hours,
        status,
        reviewed_at,
        review_comment,
        created_at,
        attendances!attendance_id (
          work_date,
          scheduled_check_in,
          scheduled_check_out
        )
      `)
      .eq('staff_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: corrections, error } = await query;

    if (error) {
      console.error('Corrections query error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 대기 중인 요청 수
    const { count: pendingCount } = await supabase
      .from('attendance_correction_requests')
      .select('*', { count: 'exact', head: true })
      .eq('staff_id', user.id)
      .eq('status', 'PENDING');

    return NextResponse.json({
      corrections,
      pendingCount: pendingCount || 0,
    });
  } catch (error) {
    console.error('Corrections API error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 인증 확인
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 사용자 정보 조회
    const { data: user } = await supabase
      .from('users')
      .select('id, company_id, store_id')
      .eq('auth_id', authUser.id)
      .single();

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      correctionId, // 기존 요청 업데이트 시
      attendanceId,
      requestType,
      reason,
      reasonCategory,
      requestedCheckIn,
      requestedCheckOut,
      overtimeHours,
    } = body;

    // 유효성 검사
    if (!reason || reason.trim().length < 2) {
      return NextResponse.json(
        { error: '사유를 입력해주세요.' },
        { status: 400 }
      );
    }

    // 기존 요청 업데이트
    if (correctionId) {
      const { data: existingRequest } = await supabase
        .from('attendance_correction_requests')
        .select('id, status')
        .eq('id', correctionId)
        .eq('staff_id', user.id)
        .single();

      if (!existingRequest) {
        return NextResponse.json(
          { error: '수정 요청을 찾을 수 없습니다.' },
          { status: 404 }
        );
      }

      if (existingRequest.status !== 'PENDING') {
        return NextResponse.json(
          { error: '이미 처리된 요청은 수정할 수 없습니다.' },
          { status: 400 }
        );
      }

      const { data: updatedRequest, error: updateError } = await supabase
        .from('attendance_correction_requests')
        .update({
          reason: reason.trim(),
          reason_category: reasonCategory,
          requested_check_in: requestedCheckIn,
          requested_check_out: requestedCheckOut,
          overtime_hours: overtimeHours,
          updated_at: new Date().toISOString(),
        })
        .eq('id', correctionId)
        .select()
        .single();

      if (updateError) {
        console.error('Update error:', updateError);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      // 관리자에게 알림
      await notifyManagers(supabase, user.company_id, user.id, requestType, 'update');

      return NextResponse.json({
        success: true,
        message: '수정 요청이 업데이트되었습니다.',
        correction: updatedRequest,
      });
    }

    // 새 요청 생성
    if (!attendanceId || !requestType) {
      return NextResponse.json(
        { error: 'attendanceId와 requestType이 필요합니다.' },
        { status: 400 }
      );
    }

    // 근태 기록 확인
    const { data: attendance } = await supabase
      .from('attendances')
      .select('id, scheduled_check_in, scheduled_check_out, actual_check_in, actual_check_out')
      .eq('id', attendanceId)
      .eq('staff_id', user.id)
      .single();

    if (!attendance) {
      return NextResponse.json(
        { error: '근태 기록을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 이미 동일 유형의 대기 중인 요청이 있는지 확인
    const { data: existingPending } = await supabase
      .from('attendance_correction_requests')
      .select('id')
      .eq('attendance_id', attendanceId)
      .eq('request_type', requestType)
      .eq('status', 'PENDING')
      .maybeSingle();

    if (existingPending) {
      return NextResponse.json(
        { error: '이미 대기 중인 동일한 요청이 있습니다.' },
        { status: 400 }
      );
    }

    const { data: newRequest, error: insertError } = await supabase
      .from('attendance_correction_requests')
      .insert({
        attendance_id: attendanceId,
        staff_id: user.id,
        company_id: user.company_id,
        store_id: user.store_id,
        request_type: requestType,
        original_check_in: attendance.scheduled_check_in,
        original_check_out: attendance.scheduled_check_out,
        requested_check_in: requestedCheckIn || attendance.actual_check_in,
        requested_check_out: requestedCheckOut || attendance.actual_check_out,
        reason: reason.trim(),
        reason_category: reasonCategory,
        overtime_hours: overtimeHours,
        auto_generated: false,
        notification_sent: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // 관리자에게 알림
    await notifyManagers(supabase, user.company_id, user.id, requestType, 'new');

    return NextResponse.json({
      success: true,
      message: '수정 요청이 제출되었습니다. 관리자 승인 후 적용됩니다.',
      correction: newRequest,
    });
  } catch (error) {
    console.error('Corrections POST error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

/**
 * 관리자에게 알림 발송
 */
async function notifyManagers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  staffId: string,
  requestType: string,
  action: 'new' | 'update'
) {
  try {
    // 직원 정보
    const { data: staff } = await supabase
      .from('users')
      .select('name')
      .eq('id', staffId)
      .single();

    // 관리자 조회
    const { data: managers } = await supabase
      .from('users')
      .select('id')
      .eq('company_id', companyId)
      .in('role', ['company_admin', 'COMPANY_ADMIN', 'store_manager', 'STORE_MANAGER']);

    if (managers && managers.length > 0) {
      const typeLabels: Record<string, string> = {
        LATE_CHECKIN: '지각',
        EARLY_CHECKOUT: '조퇴',
        OVERTIME: '연장근무',
        NO_SHOW_REASON: '미출근',
        TIME_CORRECTION: '시간수정',
      };

      const notifications = managers.map((manager) => ({
        user_id: manager.id,
        category: 'ATTENDANCE',
        priority: 'NORMAL',
        title: action === 'new' ? '근태 수정 요청' : '근태 수정 요청 업데이트',
        body: `${staff?.name || '직원'}님이 ${typeLabels[requestType] || requestType} 사유를 ${action === 'new' ? '제출' : '수정'}했습니다.`,
        deep_link: '/attendance?tab=corrections',
        data: {
          staffId,
          requestType,
          action,
        },
      }));

      await supabase.from('notifications').insert(notifications);
    }
  } catch (error) {
    console.error('Failed to notify managers:', error);
  }
}
