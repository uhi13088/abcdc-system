/**
 * 승인 에스컬레이션 Cron
 * - 24시간 이상 대기 중인 승인 요청을 상위 결재자에게 에스컬레이션
 * - 48시간 이상 대기 시 회사 관리자에게 알림
 * Vercel Cron: 0 9 * * * (매일 오전 9시)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { pushNotificationService } from '@abc/shared/server';
import { subHours } from 'date-fns';

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const now = new Date();
    const hours24Ago = subHours(now, 24);
    const hours48Ago = subHours(now, 48);

    // 대기 중인 승인 요청 조회
    const { data: pendingApprovals, error } = await supabase
      .from('approval_requests')
      .select(`
        *,
        requester:users!approval_requests_requester_id_fkey(name)
      `)
      .eq('final_status', 'PENDING')
      .lt('created_at', hours24Ago.toISOString());

    if (error) {
      console.error('Error fetching pending approvals:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let escalatedCount = 0;
    let alertedCount = 0;

    for (const approval of pendingApprovals || []) {
      const createdAt = new Date(approval.created_at);
      const hoursWaiting = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

      const approvalLine = approval.approval_line as Array<{
        order: number;
        approverId: string | null;
        approverRole: string;
        status: string;
      }>;

      const currentStep = approval.current_step;
      const currentApprover = approvalLine.find((a) => a.order === currentStep);

      if (!currentApprover) continue;

      // 48시간 이상 → 회사 관리자에게 알림
      if (hoursWaiting >= 48) {
        const { data: admins } = await supabase
          .from('users')
          .select('id, name')
          .eq('company_id', approval.company_id)
          .in('role', ['COMPANY_ADMIN', 'company_admin']);

        for (const admin of admins || []) {
          // 알림 생성
          await supabase.from('notifications').insert({
            user_id: admin.id,
            category: 'ESCALATION',
            priority: 'CRITICAL',
            title: '⚠️ 장기 미처리 승인 요청',
            body: `${approval.requester?.name || '직원'}의 ${approval.type} 요청이 ${Math.floor(hoursWaiting)}시간째 대기 중입니다.`,
            deep_link: `/approvals/${approval.id}`,
          });

          // 푸시 알림
          const { data: fcmTokens } = await supabase
            .from('user_fcm_tokens')
            .select('fcm_token')
            .eq('user_id', admin.id)
            .eq('is_active', true);

          if (fcmTokens && fcmTokens.length > 0) {
            await pushNotificationService.sendToMultiple(
              fcmTokens.map((t) => t.fcm_token),
              {
                title: '⚠️ 장기 미처리 승인 요청',
                body: `${approval.requester?.name || '직원'}의 ${approval.type} 요청이 ${Math.floor(hoursWaiting)}시간째 대기 중입니다.`,
                data: { approvalId: approval.id, type: 'ESCALATION' },
              }
            );
          }
        }
        alertedCount++;
      }
      // 24시간 이상 48시간 미만 → 현재 승인자에게 리마인더
      else if (hoursWaiting >= 24) {
        // 현재 승인자에게 리마인더 발송
        if (currentApprover.approverId) {
          await supabase.from('notifications').insert({
            user_id: currentApprover.approverId,
            category: 'REMINDER',
            priority: 'HIGH',
            title: '⏰ 승인 대기 리마인더',
            body: `${approval.requester?.name || '직원'}의 ${approval.type} 요청이 24시간 이상 대기 중입니다.`,
            deep_link: `/approvals/${approval.id}`,
          });

          const { data: fcmTokens } = await supabase
            .from('user_fcm_tokens')
            .select('fcm_token')
            .eq('user_id', currentApprover.approverId)
            .eq('is_active', true);

          if (fcmTokens && fcmTokens.length > 0) {
            await pushNotificationService.sendToMultiple(
              fcmTokens.map((t) => t.fcm_token),
              {
                title: '⏰ 승인 대기 리마인더',
                body: `${approval.requester?.name || '직원'}의 요청이 24시간 이상 대기 중입니다.`,
                data: { approvalId: approval.id, type: 'REMINDER' },
              }
            );
          }
        }

        // 에스컬레이션: 다음 승인자가 있으면 병렬로 승인 요청
        const nextApprover = approvalLine.find((a) => a.order === currentStep + 1);
        if (nextApprover && nextApprover.approverId) {
          await supabase.from('notifications').insert({
            user_id: nextApprover.approverId,
            category: 'ESCALATION',
            priority: 'HIGH',
            title: '📤 에스컬레이션 승인 요청',
            body: `${approval.requester?.name || '직원'}의 ${approval.type} 요청이 에스컬레이션되었습니다. 직접 승인 가능합니다.`,
            deep_link: `/approvals/${approval.id}`,
          });
        }

        escalatedCount++;
      }

      // 에스컬레이션 기록 업데이트
      await supabase
        .from('approval_requests')
        .update({
          escalated_at: now.toISOString(),
          escalation_count: (approval.escalation_count || 0) + 1,
        })
        .eq('id', approval.id);
    }

    return NextResponse.json({
      success: true,
      message: `에스컬레이션 처리 완료`,
      stats: {
        totalPending: pendingApprovals?.length || 0,
        escalated: escalatedCount,
        criticalAlerted: alertedCount,
      },
    });
  } catch (error) {
    console.error('Approval escalation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
