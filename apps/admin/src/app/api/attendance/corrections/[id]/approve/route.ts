/**
 * 근태 수정 요청 승인/거절 API
 * POST /api/attendance/corrections/[id]/approve - 승인
 * POST /api/attendance/corrections/[id]/reject - 거절 (별도 route)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // 인증 확인
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 관리자 정보 조회
    const { data: admin } = await supabase
      .from('users')
      .select('id, role, company_id')
      .eq('auth_id', authUser.id)
      .single();

    if (!admin) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 권한 확인
    const allowedRoles = ['company_admin', 'COMPANY_ADMIN', 'store_manager', 'STORE_MANAGER', 'manager', 'MANAGER'];
    if (!allowedRoles.includes(admin.role)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const body = await request.json();
    const { comment } = body;

    // 수정 요청 조회
    const { data: correction } = await supabase
      .from('attendance_correction_requests')
      .select('*')
      .eq('id', id)
      .eq('company_id', admin.company_id)
      .eq('status', 'PENDING')
      .single();

    if (!correction) {
      return NextResponse.json(
        { error: '수정 요청을 찾을 수 없거나 이미 처리되었습니다.' },
        { status: 404 }
      );
    }

    // 사유가 입력되지 않은 경우
    if (!correction.reason || correction.reason.trim() === '') {
      return NextResponse.json(
        { error: '직원이 아직 사유를 입력하지 않았습니다.' },
        { status: 400 }
      );
    }

    // 승인 처리 (DB 함수 호출)
    const { data: result, error: approveError } = await supabase
      .rpc('approve_attendance_correction', {
        p_request_id: id,
        p_reviewer_id: admin.id,
        p_comment: comment || null,
      });

    if (approveError) {
      console.error('Approve error:', approveError);
      return NextResponse.json({ error: approveError.message }, { status: 500 });
    }

    if (!result?.success) {
      return NextResponse.json(
        { error: result?.error || '승인 처리 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    // 직원에게 승인 알림 발송
    await supabase.from('notifications').insert({
      user_id: correction.staff_id,
      category: 'ATTENDANCE',
      priority: 'NORMAL',
      title: '근태 수정 요청 승인',
      body: '제출하신 근태 수정 요청이 승인되어 반영되었습니다.',
      deep_link: `/attendance/correction/${id}`,
      data: {
        correctionId: id,
        status: 'APPROVED',
      },
    });

    return NextResponse.json({
      success: true,
      message: '수정 요청이 승인되었습니다.',
    });
  } catch (error) {
    console.error('Correction approve error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
