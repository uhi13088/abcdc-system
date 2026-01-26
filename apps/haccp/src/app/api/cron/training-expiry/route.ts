/**
 * Training Expiry Alerts Cron Job
 * 교육 만료 관리 자동화
 *
 * 기능:
 * 1. 교육 만료 30일 전 알림 생성
 * 2. 만료된 교육 자동 상태 업데이트
 * 3. 필수 교육 미이수자 알림
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface AlertResult {
  expiringSoon: number;
  expired: number;
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
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
    const thirtyDaysLaterStr = thirtyDaysLater.toISOString().split('T')[0];

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
        expiringSoon: 0,
        expired: 0,
        notifications: 0,
      };

      // ========================================
      // 1. 만료 예정 교육 조회 (30일 이내)
      // ========================================
      const { data: expiringRecords } = await supabase
        .from('training_records')
        .select(`
          id,
          user_id,
          training_id,
          expires_at,
          users:user_id (name),
          trainings:training_id (title, category)
        `)
        .eq('company_id', company.id)
        .eq('status', 'COMPLETED')
        .not('expires_at', 'is', null)
        .lte('expires_at', thirtyDaysLaterStr)
        .gt('expires_at', todayStr);

      result.expiringSoon = expiringRecords?.length || 0;

      // ========================================
      // 2. 만료된 교육 상태 업데이트
      // ========================================
      const { data: expiredRecords } = await supabase
        .from('training_records')
        .select(`
          id,
          user_id,
          training_id,
          expires_at,
          users:user_id (name),
          trainings:training_id (title, category, is_mandatory)
        `)
        .eq('company_id', company.id)
        .eq('status', 'COMPLETED')
        .not('expires_at', 'is', null)
        .lt('expires_at', todayStr);

      if (expiredRecords && expiredRecords.length > 0) {
        result.expired = expiredRecords.length;

        // 만료된 교육 상태를 EXPIRED로 업데이트
        const expiredIds = expiredRecords.map(r => r.id);
        await supabase
          .from('training_records')
          .update({
            status: 'EXPIRED',
            updated_at: new Date().toISOString(),
          })
          .in('id', expiredIds);

        logger.log(`[Training] Updated ${expiredIds.length} expired training records for company ${company.name}`);
      }

      // ========================================
      // 3. 관리자에게 알림 생성
      // ========================================
      const { data: managers } = await supabase
        .from('users')
        .select('id')
        .eq('company_id', company.id)
        .in('role', ['HACCP_MANAGER', 'COMPANY_ADMIN']);

      // 만료 예정 교육 알림
      if (expiringRecords && expiringRecords.length > 0) {
        // 사용자별로 그룹핑
        const byUser = new Map<string, Array<{ training: string; expires: string }>>();
        for (const record of expiringRecords) {
          const _userId = record.user_id; // used for grouping, but we use userName as key
          const userName = (record.users as unknown as { name?: string } | null)?.name || '알 수 없음';
          const trainingTitle = (record.trainings as unknown as { title?: string } | null)?.title || '교육';

          if (!byUser.has(userName)) {
            byUser.set(userName, []);
          }
          byUser.get(userName)?.push({
            training: trainingTitle,
            expires: record.expires_at || '',
          });
        }

        const userList = Array.from(byUser.entries())
          .slice(0, 3)
          .map(([name, trainings]) => `${name} (${trainings.length}건)`)
          .join(', ');

        for (const manager of managers || []) {
          await supabase.from('notifications').insert({
            user_id: manager.id,
            category: 'TRAINING',
            priority: 'MEDIUM',
            title: `교육 만료 예정 (${expiringRecords.length}건)`,
            message: `교육 만료가 임박한 직원이 있습니다: ${userList}${byUser.size > 3 ? ` 외 ${byUser.size - 3}명` : ''}`,
            action_url: '/training',
            is_read: false,
          });
          result.notifications++;
        }
      }

      // 만료된 교육 알림 (긴급)
      if (expiredRecords && expiredRecords.length > 0) {
        // 필수 교육 만료건 필터
        const mandatoryExpired = expiredRecords.filter(
          r => (r.trainings as unknown as { is_mandatory?: boolean } | null)?.is_mandatory
        );

        if (mandatoryExpired.length > 0) {
          for (const manager of managers || []) {
            await supabase.from('notifications').insert({
              user_id: manager.id,
              category: 'TRAINING',
              priority: 'HIGH',
              title: `⚠️ 필수 교육 만료 (${mandatoryExpired.length}건)`,
              message: `필수 교육이 만료된 직원이 있습니다. 즉시 재교육을 진행해주세요.`,
              action_url: '/training',
              is_read: false,
            });
            result.notifications++;
          }
        }
      }

      // ========================================
      // 4. 만료된 사용자에게 직접 알림
      // ========================================
      if (expiringRecords && expiringRecords.length > 0) {
        // 사용자별로 알림 발송
        const notifiedUsers = new Set<string>();
        for (const record of expiringRecords) {
          if (!notifiedUsers.has(record.user_id)) {
            const trainingTitle = (record.trainings as unknown as { title?: string } | null)?.title || '교육';
            const daysLeft = Math.ceil(
              (new Date(record.expires_at || '').getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
            );

            await supabase.from('notifications').insert({
              user_id: record.user_id,
              category: 'TRAINING',
              priority: daysLeft <= 7 ? 'HIGH' : 'MEDIUM',
              title: `교육 갱신 필요: ${trainingTitle}`,
              message: `${trainingTitle} 교육이 ${daysLeft}일 후 만료됩니다. 재교육을 받아주세요.`,
              action_url: '/training',
              is_read: false,
            });
            result.notifications++;
            notifiedUsers.add(record.user_id);
          }
        }
      }

      results[company.id] = result;
    }

    const duration = Date.now() - startTime;
    logger.log(`[Training Expiry] Completed in ${duration}ms`);

    return NextResponse.json({
      success: true,
      duration_ms: duration,
      results,
    });
  } catch (error) {
    logger.error('[Training Expiry] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
