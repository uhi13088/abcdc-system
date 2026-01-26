/**
 * Corrective Action Escalation Cron Job
 * 개선조치 에스컬레이션 자동화
 *
 * 기능:
 * 1. 기한 초과 개선조치 에스컬레이션
 * 2. 기한 임박 (3일 이내) 알림
 * 3. 효과 검증 미완료 알림
 * 4. 장기 미해결 건 상위 보고
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface AlertResult {
  overdue: number;
  dueSoon: number;
  pendingVerification: number;
  escalated: number;
  notifications: number;
}

const logger = {
  log: (message: string) => console.log(`[${new Date().toISOString()}] ${message}`),
  error: (message: string, error?: unknown) => console.error(`[${new Date().toISOString()}] ${message}`, error),
};

export async function GET() {
  const startTime = Date.now();

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const threeDaysLater = new Date();
    threeDaysLater.setDate(threeDaysLater.getDate() + 3);
    const threeDaysLaterStr = threeDaysLater.toISOString().split('T')[0];

    // 모든 회사 조회
    const { data: companies } = await supabase
      .from('companies')
      .select('id, name');

    if (!companies || companies.length === 0) {
      return NextResponse.json({ message: 'No companies found' });
    }

    const results: Record<string, AlertResult> = {};

    for (const company of companies) {
      const result: AlertResult = {
        overdue: 0,
        dueSoon: 0,
        pendingVerification: 0,
        escalated: 0,
        notifications: 0,
      };

      // ========================================
      // 1. 기한 초과 개선조치 조회
      // ========================================
      const { data: overdueActions } = await supabase
        .from('corrective_actions')
        .select('id, action_number, problem_description, due_date, severity, assigned_to, escalation_level')
        .eq('company_id', company.id)
        .in('status', ['OPEN', 'IN_PROGRESS'])
        .not('due_date', 'is', null)
        .lt('due_date', todayStr);

      result.overdue = overdueActions?.length || 0;

      // 기한 초과 건 에스컬레이션 레벨 증가
      if (overdueActions && overdueActions.length > 0) {
        for (const action of overdueActions) {
          const currentLevel = action.escalation_level || 0;

          // 이미 최대 에스컬레이션 레벨(3)이면 스킵
          if (currentLevel >= 3) continue;

          // 에스컬레이션 레벨 증가
          await supabase
            .from('corrective_actions')
            .update({
              escalation_level: currentLevel + 1,
              updated_at: new Date().toISOString(),
            })
            .eq('id', action.id);

          result.escalated++;
        }

        logger.log(`[Corrective Action] Escalated ${result.escalated} overdue actions for company ${company.name}`);
      }

      // ========================================
      // 2. 기한 임박 개선조치 조회 (3일 이내)
      // ========================================
      const { data: dueSoonActions } = await supabase
        .from('corrective_actions')
        .select('id, action_number, problem_description, due_date, severity, assigned_to')
        .eq('company_id', company.id)
        .in('status', ['OPEN', 'IN_PROGRESS'])
        .not('due_date', 'is', null)
        .gte('due_date', todayStr)
        .lte('due_date', threeDaysLaterStr);

      result.dueSoon = dueSoonActions?.length || 0;

      // ========================================
      // 3. 효과 검증 미완료 건 조회
      // ========================================
      const { data: pendingVerification } = await supabase
        .from('corrective_actions')
        .select('id, action_number, completed_at, assigned_to')
        .eq('company_id', company.id)
        .eq('status', 'COMPLETED')
        .eq('effectiveness_verified', false)
        .not('completed_at', 'is', null);

      // 완료 후 7일이 지난 건만 필터
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const needsVerification = (pendingVerification || []).filter(a => {
        if (!a.completed_at) return false;
        return new Date(a.completed_at) < sevenDaysAgo;
      });

      result.pendingVerification = needsVerification.length;

      // ========================================
      // 4. 관리자에게 알림 생성
      // ========================================
      const { data: managers } = await supabase
        .from('users')
        .select('id')
        .eq('company_id', company.id)
        .in('role', ['HACCP_MANAGER', 'COMPANY_ADMIN']);

      // 기한 초과 알림 (긴급)
      if (overdueActions && overdueActions.length > 0) {
        const criticalCount = overdueActions.filter(a => a.severity === 'CRITICAL').length;
        const actionList = overdueActions
          .slice(0, 3)
          .map(a => a.action_number)
          .join(', ');

        for (const manager of managers || []) {
          await supabase.from('notifications').insert({
            user_id: manager.id,
            category: 'CORRECTIVE_ACTION',
            priority: criticalCount > 0 ? 'CRITICAL' : 'HIGH',
            title: `⚠️ 개선조치 기한 초과 (${overdueActions.length}건)`,
            message: `기한이 초과된 개선조치가 있습니다: ${actionList}${overdueActions.length > 3 ? ` 외 ${overdueActions.length - 3}건` : ''}${criticalCount > 0 ? ` (CRITICAL ${criticalCount}건)` : ''}`,
            action_url: '/corrective-actions',
            is_read: false,
          });
          result.notifications++;
        }
      }

      // 기한 임박 알림
      if (dueSoonActions && dueSoonActions.length > 0) {
        const actionList = dueSoonActions
          .slice(0, 3)
          .map(a => `${a.action_number} (${a.due_date})`)
          .join(', ');

        for (const manager of managers || []) {
          await supabase.from('notifications').insert({
            user_id: manager.id,
            category: 'CORRECTIVE_ACTION',
            priority: 'MEDIUM',
            title: `개선조치 기한 임박 (${dueSoonActions.length}건)`,
            message: `3일 이내 기한 도래 개선조치: ${actionList}${dueSoonActions.length > 3 ? ` 외 ${dueSoonActions.length - 3}건` : ''}`,
            action_url: '/corrective-actions',
            is_read: false,
          });
          result.notifications++;
        }
      }

      // 효과 검증 미완료 알림
      if (needsVerification.length > 0) {
        for (const manager of managers || []) {
          await supabase.from('notifications').insert({
            user_id: manager.id,
            category: 'CORRECTIVE_ACTION',
            priority: 'MEDIUM',
            title: `효과 검증 필요 (${needsVerification.length}건)`,
            message: `완료된 개선조치 중 효과 검증이 필요한 건이 있습니다. (완료 후 7일 경과)`,
            action_url: '/corrective-actions',
            is_read: false,
          });
          result.notifications++;
        }
      }

      // ========================================
      // 5. 담당자에게 직접 알림
      // ========================================
      // 기한 임박 건 담당자 알림
      if (dueSoonActions && dueSoonActions.length > 0) {
        const notifiedUsers = new Set<string>();
        for (const action of dueSoonActions) {
          if (action.assigned_to && !notifiedUsers.has(action.assigned_to)) {
            const daysLeft = Math.ceil(
              (new Date(action.due_date || '').getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
            );

            await supabase.from('notifications').insert({
              user_id: action.assigned_to,
              category: 'CORRECTIVE_ACTION',
              priority: daysLeft <= 1 ? 'HIGH' : 'MEDIUM',
              title: `개선조치 기한 ${daysLeft}일 남음: ${action.action_number}`,
              message: `담당하신 개선조치(${action.action_number})의 기한이 ${daysLeft}일 후입니다. 조치를 완료해주세요.`,
              action_url: '/corrective-actions',
              is_read: false,
            });
            result.notifications++;
            notifiedUsers.add(action.assigned_to);
          }
        }
      }

      results[company.id] = result;
    }

    const duration = Date.now() - startTime;
    logger.log(`[Corrective Action Escalation] Completed in ${duration}ms`);

    return NextResponse.json({
      success: true,
      duration_ms: duration,
      results,
    });
  } catch (error) {
    logger.error('[Corrective Action Escalation] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
