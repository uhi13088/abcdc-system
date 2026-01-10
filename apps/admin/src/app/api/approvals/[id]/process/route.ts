import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/approvals/[id]/process - 승인/거부 처리
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const approvalId = params.id;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('id, name, role')
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
      approverId: string;
      approverName: string;
      approverRole: string;
      status: string;
      comment?: string;
      decidedAt?: string;
    }>;

    const currentStep = approval.current_step;
    const currentApprover = approvalLine.find((a) => a.order === currentStep);

    if (!currentApprover || currentApprover.approverId !== userData.id) {
      return NextResponse.json({ error: '현재 승인 권한이 없습니다.' }, { status: 403 });
    }

    // Update current step
    currentApprover.status = decision;
    currentApprover.comment = comment;
    currentApprover.decidedAt = new Date().toISOString();

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

    // Create notification for requester if finalized
    if (finalStatus !== 'PENDING') {
      await supabase.from('notifications').insert({
        user_id: approval.requester_id,
        category: 'APPROVAL',
        priority: 'HIGH',
        title: finalStatus === 'APPROVED' ? '승인 완료' : '승인 거부',
        body: `${approval.type} 요청이 ${finalStatus === 'APPROVED' ? '승인' : '거부'}되었습니다.`,
        deep_link: `/approvals/${approvalId}`,
      });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
