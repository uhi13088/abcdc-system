import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { ResignationService } from '@/lib/services/resignation.service';
import { pushNotificationService } from '@abc/shared/server';
import { logger } from '@abc/shared';

// POST /api/approvals/[id]/process - 승인/거부 처리
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const approvalId = id;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('id, name, role, company_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { decision, comment } = body;

    if (!['APPROVED', 'REJECTED'].includes(decision)) {
      return NextResponse.json({ error: '유효하지 않은 결정입니다.' }, { status: 400 });
    }

    // Get approval request
    const { data: approval } = await supabase
      .from('approval_requests')
      .select('*')
      .eq('id', approvalId)
      .single();

    if (!approval) {
      return NextResponse.json({ error: '승인 요청을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (approval.final_status !== 'PENDING') {
      return NextResponse.json({ error: '이미 처리된 요청입니다.' }, { status: 400 });
    }

    // Update approval line
    const approvalLine = approval.approval_line as Array<{
      order: number;
      approverId: string | null;
      approverName?: string;
      approverRole: string;
      status: string;
      comment?: string;
      decidedAt?: string;
    }>;

    const currentStep = approval.current_step;
    const currentApprover = approvalLine.find((a) => a.order === currentStep);

    // Check if user has permission (by role or by specific ID)
    const hasPermission =
      currentApprover &&
      (currentApprover.approverId === userData.id ||
        currentApprover.approverId === null ||
        ['company_admin', 'super_admin', 'COMPANY_ADMIN', 'SUPER_ADMIN'].includes(userData.role));

    if (!hasPermission) {
      return NextResponse.json({ error: '현재 승인 권한이 없습니다.' }, { status: 403 });
    }

    // Update current step
    if (currentApprover) {
      currentApprover.status = decision;
      currentApprover.comment = comment;
      currentApprover.decidedAt = new Date().toISOString();
      currentApprover.approverId = userData.id;
      currentApprover.approverName = userData.name;
    }

    let finalStatus = 'PENDING';
    let nextStep = currentStep;

    if (decision === 'REJECTED') {
      finalStatus = 'REJECTED';
    } else if (currentStep >= approvalLine.length) {
      finalStatus = 'APPROVED';
    } else {
      nextStep = currentStep + 1;
    }

    const { data, error } = await supabase
      .from('approval_requests')
      .update({
        approval_line: approvalLine,
        current_step: nextStep,
        final_status: finalStatus,
        finalized_at: finalStatus !== 'PENDING' ? new Date().toISOString() : null,
      })
      .eq('id', approvalId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Handle type-specific post-approval actions
    if (finalStatus === 'APPROVED') {
      await handleApprovalActions(adminClient, approval, approvalId, userData.company_id);
    }

    // Create notification for requester
    const typeLabels: Record<string, string> = {
      LEAVE: '휴가',
      OVERTIME: '초과근무',
      SCHEDULE_CHANGE: '근무조정',
      PURCHASE: '구매',
      DISPOSAL: '폐기',
      RESIGNATION: '사직서',
    };

    if (finalStatus !== 'PENDING') {
      // Notification to requester
      await adminClient.from('notifications').insert({
        user_id: approval.requester_id,
        category: 'APPROVAL',
        priority: 'HIGH',
        title: finalStatus === 'APPROVED' ? '승인 완료' : '승인 거부',
        body: `${typeLabels[approval.type] || approval.type} 요청이 ${finalStatus === 'APPROVED' ? '승인' : '거부'}되었습니다.`,
        deep_link: `/approvals/${approvalId}`,
      });

      // Send push notification
      try {
        const { data: fcmTokens } = await adminClient
          .from('user_fcm_tokens')
          .select('fcm_token')
          .eq('user_id', approval.requester_id)
          .eq('is_active', true);

        if (fcmTokens && fcmTokens.length > 0) {
          await pushNotificationService.sendToMultiple(
            fcmTokens.map((t) => t.fcm_token),
            {
              title: finalStatus === 'APPROVED' ? '✅ 승인 완료' : '❌ 승인 거부',
              body: `${typeLabels[approval.type] || approval.type} 요청이 ${finalStatus === 'APPROVED' ? '승인' : '거부'}되었습니다.`,
              data: { approvalId, type: approval.type, status: finalStatus },
            }
          );
        }
      } catch (pushError) {
        console.error('Push notification error:', pushError);
      }
    }

    return NextResponse.json({
      ...data,
      message:
        finalStatus === 'APPROVED'
          ? approval.type === 'RESIGNATION'
            ? '사직서가 승인되었습니다. 개인정보 삭제 및 퇴직 처리가 완료되었습니다.'
            : '승인이 완료되었습니다.'
          : finalStatus === 'REJECTED'
          ? '거부되었습니다.'
          : '다음 승인자에게 전달되었습니다.',
    });
  } catch (error) {
    console.error('Approval process error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

/**
 * 승인 유형별 후속 처리
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleApprovalActions(
  supabase: ReturnType<typeof createAdminClient>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  approval: any,
  approvalId: string,
  companyId: string
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const details = approval.details as Record<string, any>;

  switch (approval.type) {
    case 'RESIGNATION':
      // 사직서 승인 → 개인정보 삭제 및 퇴직 처리
      const resignationService = new ResignationService(supabase);
      const result = await resignationService.processResignation(
        approval.requester_id,
        approvalId,
        approval.company_id || companyId
      );
      logger.log('Resignation processed:', result);
      break;

    case 'LEAVE':
      // 휴가 승인 → 스케줄에 반영 (해당 날짜 휴가로 표시)
      if (details.start_date && details.end_date) {
        const start = new Date(details.start_date);
        const end = new Date(details.end_date);

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dateStr = d.toISOString().split('T')[0];
          await supabase.from('schedules').upsert({
            staff_id: approval.requester_id,
            company_id: approval.company_id,
            brand_id: approval.brand_id,
            store_id: approval.store_id,
            work_date: dateStr,
            is_day_off: true,
            day_off_type: details.leave_type || 'LEAVE',
            notes: `${details.leave_type_name || '휴가'} - ${details.reason || ''}`,
          }, { onConflict: 'staff_id,work_date' });
        }
      }
      break;

    case 'PURCHASE':
      // 구매 승인 → 구매 요청 상태 업데이트
      if (details.purchase_request_id) {
        await supabase
          .from('purchase_requests')
          .update({ status: 'APPROVED', approved_at: new Date().toISOString() })
          .eq('id', details.purchase_request_id);
      }
      break;

    case 'DISPOSAL':
      // 폐기 승인 → 폐기 기록 생성
      if (details.material_id && details.quantity) {
        await supabase.from('haccp_disposal_records').insert({
          company_id: approval.company_id,
          material_id: details.material_id,
          quantity: details.quantity,
          reason: details.reason,
          disposal_date: new Date().toISOString(),
          approved_by: approvalId,
        });

        // 재고 차감
        const { data: material } = await supabase
          .from('haccp_materials')
          .select('current_stock')
          .eq('id', details.material_id)
          .single();

        if (material) {
          await supabase
            .from('haccp_materials')
            .update({
              current_stock: Math.max(0, (material.current_stock || 0) - details.quantity),
            })
            .eq('id', details.material_id);
        }
      }
      break;

    case 'SCHEDULE_CHANGE':
      // 근무조정 승인 → 스케줄 변경
      if (details.original_date && details.requested_date) {
        // 기존 스케줄 조회
        const { data: originalSchedule } = await supabase
          .from('schedules')
          .select('*')
          .eq('staff_id', approval.requester_id)
          .eq('work_date', details.original_date)
          .single();

        if (originalSchedule) {
          // 기존 날짜 휴무 처리
          await supabase
            .from('schedules')
            .update({ is_day_off: true, notes: '근무조정으로 변경됨' })
            .eq('id', originalSchedule.id);

          // 새 날짜에 스케줄 생성
          await supabase.from('schedules').upsert({
            staff_id: approval.requester_id,
            company_id: approval.company_id,
            brand_id: approval.brand_id,
            store_id: approval.store_id,
            work_date: details.requested_date,
            start_time: originalSchedule.start_time,
            end_time: originalSchedule.end_time,
            is_day_off: false,
            notes: `${details.original_date}에서 변경됨`,
          }, { onConflict: 'staff_id,work_date' });
        }
      }
      break;
  }
}
