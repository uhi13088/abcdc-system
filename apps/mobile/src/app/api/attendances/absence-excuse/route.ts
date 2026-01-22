/**
 * 결근 사유 제출 API
 * POST /api/attendances/absence-excuse
 *
 * 직원이 이전 결근에 대한 사유를 제출하면 관리자 승인 요청을 생성
 */

import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile from auth_id
    const { data: userData } = await adminClient
      .from('users')
      .select('id, name, company_id, brand_id, store_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { work_date, reason, category } = body;

    // Validate required fields
    if (!work_date || !reason) {
      return NextResponse.json(
        { error: '날짜와 사유는 필수입니다.' },
        { status: 400 }
      );
    }

    // Check if excuse already submitted for this date
    const { data: existingRequest } = await adminClient
      .from('approval_requests')
      .select('id')
      .eq('requester_id', userData.id)
      .eq('type', 'ABSENCE_EXCUSE')
      .contains('details', { work_date })
      .maybeSingle();

    if (existingRequest) {
      return NextResponse.json(
        { error: '이미 해당 날짜에 대한 사유가 제출되었습니다.' },
        { status: 400 }
      );
    }

    // Get schedule for that date to verify it was a scheduled day
    const { data: schedule } = await adminClient
      .from('schedules')
      .select('start_time, end_time')
      .eq('staff_id', userData.id)
      .eq('work_date', work_date)
      .maybeSingle();

    // Check attendance record for that date
    const { data: attendance } = await adminClient
      .from('attendances')
      .select('id, status')
      .eq('staff_id', userData.id)
      .eq('work_date', work_date)
      .maybeSingle();

    // 매장 관리자 조회
    const { data: managers } = await adminClient
      .from('users')
      .select('id, name, role')
      .eq('company_id', userData.company_id)
      .in('role', ['store_manager', 'manager', 'company_admin'])
      .eq('status', 'ACTIVE');

    // 승인 라인 생성
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const approvalLine = (managers || []).map((manager: any, index: number) => ({
      step: index + 1,
      approver_id: manager.id,
      approver_name: manager.name,
      approver_role: manager.role,
      status: 'PENDING',
    }));

    if (approvalLine.length === 0) {
      return NextResponse.json(
        { error: '승인 가능한 관리자가 없습니다.' },
        { status: 400 }
      );
    }

    // Create approval request
    const { data: approvalRequest, error: insertError } = await adminClient
      .from('approval_requests')
      .insert({
        type: 'ABSENCE_EXCUSE',
        requester_id: userData.id,
        requester_name: userData.name,
        company_id: userData.company_id,
        brand_id: userData.brand_id,
        store_id: userData.store_id,
        approval_line: approvalLine,
        current_step: 1,
        final_status: 'PENDING',
        details: {
          work_date,
          reason,
          category: category || 'OTHER', // SICK, FAMILY, PERSONAL, OTHER
          scheduled_start: schedule?.start_time || null,
          scheduled_end: schedule?.end_time || null,
          attendance_id: attendance?.id || null,
        },
      })
      .select()
      .single();

    if (insertError) {
      console.error('Absence excuse insert error:', insertError);
      return NextResponse.json(
        { error: '사유 제출에 실패했습니다.' },
        { status: 500 }
      );
    }

    // If there's an existing attendance record with NO_SHOW or ABSENT, link it
    if (attendance && ['NO_SHOW', 'ABSENT'].includes(attendance.status)) {
      await adminClient
        .from('attendances')
        .update({
          anomalies: {
            type: 'ABSENCE_EXCUSE_PENDING',
            reason,
            category: category || 'OTHER',
            approval_request_id: approvalRequest.id,
          },
        })
        .eq('id', attendance.id);
    }

    // 관리자들에게 알림 전송
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const notifications = managers?.map((manager: any) => ({
      user_id: manager.id,
      category: 'APPROVAL',
      priority: 'NORMAL',
      title: `[결근 사유] ${userData.name}`,
      body: `${work_date} 결근 사유: ${reason.substring(0, 50)}${reason.length > 50 ? '...' : ''}`,
      deep_link: '/approvals',
      reference_type: 'APPROVAL_REQUEST',
      reference_id: approvalRequest.id,
      data: {
        type: 'ABSENCE_EXCUSE',
        approval_request_id: approvalRequest.id,
        work_date,
        staff_name: userData.name,
      },
    })) || [];

    if (notifications.length > 0) {
      await adminClient.from('notifications').insert(notifications);
    }

    return NextResponse.json({
      success: true,
      message: '결근 사유가 제출되었습니다. 관리자 승인을 기다려주세요.',
      approval_request_id: approvalRequest.id,
    });
  } catch (error) {
    console.error('Error submitting absence excuse:', error);
    return NextResponse.json(
      { error: '사유 제출 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
