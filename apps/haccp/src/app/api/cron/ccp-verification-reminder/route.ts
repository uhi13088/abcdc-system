/**
 * CCP Verification Reminder Cron Job
 * CCP 검증 미완료 추적 및 알림
 *
 * 기능:
 * 1. 월간 CCP 검증 미완료 항목 조회
 * 2. 월말 검증 미완료 알림
 * 3. 연간 검증 통계 집계
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface AlertResult {
  total_ccps: number;
  verified_this_month: number;
  pending_verification: number;
  notifications: number;
}

const logger = {
  // eslint-disable-next-line no-console
  log: (message: string) => console.log(`[${new Date().toISOString()}] ${message}`),
  // eslint-disable-next-line no-console
  error: (message: string, error?: unknown) => console.error(`[${new Date().toISOString()}] ${message}`, error),
};

export async function GET() {
  const startTime = Date.now();

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const dayOfMonth = today.getDate();
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const daysRemaining = daysInMonth - dayOfMonth;

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
        total_ccps: 0,
        verified_this_month: 0,
        pending_verification: 0,
        notifications: 0,
      };

      // ========================================
      // 1. 활성화된 CCP 목록 조회
      // ========================================
      const { data: ccpDefinitions } = await supabase
        .from('ccp_definitions')
        .select('id, ccp_number, process')
        .eq('company_id', company.id)
        .eq('status', 'ACTIVE');

      if (!ccpDefinitions || ccpDefinitions.length === 0) {
        results[company.id] = result;
        continue;
      }

      result.total_ccps = ccpDefinitions.length;

      // ========================================
      // 2. 이번 달 검증 완료 CCP 조회
      // ========================================
      const { data: verifications } = await supabase
        .from('ccp_verifications')
        .select('ccp_id')
        .eq('company_id', company.id)
        .eq('verification_year', currentYear)
        .eq('verification_month', currentMonth)
        .eq('status', 'COMPLETED');

      const verifiedCcpIds = new Set((verifications || []).map(v => v.ccp_id));
      result.verified_this_month = verifiedCcpIds.size;

      // 미검증 CCP 목록
      const pendingCcps = ccpDefinitions.filter(ccp => !verifiedCcpIds.has(ccp.id));
      result.pending_verification = pendingCcps.length;

      // ========================================
      // 3. 관리자에게 알림 생성
      // ========================================
      const { data: managers } = await supabase
        .from('users')
        .select('id')
        .eq('company_id', company.id)
        .in('role', ['HACCP_MANAGER', 'COMPANY_ADMIN']);

      // 월말 5일 이내인 경우 미검증 CCP 알림
      if (daysRemaining <= 5 && pendingCcps.length > 0) {
        const ccpList = pendingCcps
          .slice(0, 5)
          .map(c => `${c.ccp_number} (${c.process})`)
          .join(', ');

        const priority = daysRemaining <= 2 ? 'HIGH' : 'MEDIUM';

        for (const manager of managers || []) {
          await supabase.from('notifications').insert({
            user_id: manager.id,
            category: 'CCP_VERIFICATION',
            priority: priority,
            title: `${daysRemaining <= 2 ? '⚠️ ' : ''}CCP 월간 검증 미완료 (${pendingCcps.length}건)`,
            message: `이번 달 검증이 완료되지 않은 CCP가 있습니다: ${ccpList}${pendingCcps.length > 5 ? ` 외 ${pendingCcps.length - 5}건` : ''}. 월말까지 ${daysRemaining}일 남았습니다.`,
            action_url: '/ccp/verification',
            is_read: false,
          });
          result.notifications++;
        }

        logger.log(
          `[CCP Verification] Company ${company.name}: ` +
          `${result.pending_verification}/${result.total_ccps} CCPs pending verification ` +
          `(${daysRemaining} days remaining)`
        );
      }

      // 매월 1일에 전월 검증 현황 요약 알림
      if (dayOfMonth === 1) {
        const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
        const lastYear = currentMonth === 1 ? currentYear - 1 : currentYear;

        const { data: lastMonthVerifications } = await supabase
          .from('ccp_verifications')
          .select('ccp_id, status')
          .eq('company_id', company.id)
          .eq('verification_year', lastYear)
          .eq('verification_month', lastMonth);

        const completedCount = (lastMonthVerifications || []).filter(v => v.status === 'COMPLETED').length;
        const completionRate = result.total_ccps > 0
          ? Math.round((completedCount / result.total_ccps) * 100)
          : 0;

        for (const manager of managers || []) {
          await supabase.from('notifications').insert({
            user_id: manager.id,
            category: 'CCP_VERIFICATION',
            priority: completionRate < 100 ? 'HIGH' : 'LOW',
            title: `${lastYear}년 ${lastMonth}월 CCP 검증 현황`,
            message: `지난 달 CCP 검증 완료율: ${completionRate}% (${completedCount}/${result.total_ccps})${completionRate < 100 ? '. 미완료 건에 대한 후속 조치가 필요합니다.' : ''}`,
            action_url: '/ccp/verification',
            is_read: false,
          });
          result.notifications++;
        }
      }

      results[company.id] = result;
    }

    const duration = Date.now() - startTime;
    logger.log(`[CCP Verification Reminder] Completed in ${duration}ms`);

    return NextResponse.json({
      success: true,
      duration_ms: duration,
      current_period: { year: currentYear, month: currentMonth },
      days_remaining: daysRemaining,
      results,
    });
  } catch (error) {
    logger.error('[CCP Verification Reminder] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
