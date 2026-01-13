/**
 * HACCP 점검 리마인더 Cron Job
 * 일일/주간/월간 점검 알림 발송
 */

import { NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { format, subDays, startOfWeek, startOfMonth } from 'date-fns';
import { getPushNotificationService } from '@abc/shared/server';

let _supabaseClient: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!_supabaseClient) {
    _supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
  }
  return _supabaseClient;
}

export const dynamic = 'force-dynamic';

interface CheckReminder {
  type: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  checkName: string;
  targetRoles: string[];
  escalationEnabled: boolean;
  escalationDelayMinutes: number;
  escalationRole?: string;
}

const DAILY_CHECK_TIMES = [8, 14, 22]; // 08:00, 14:00, 22:00
const SHIFT_NAMES: Record<number, string> = {
  8: '오전',
  14: '오후',
  22: '야간',
};

export async function GET() {
  try {
    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay(); // 0 = Sunday
    const currentDate = now.getDate();

    console.log(`[HACCP Reminder] Running at ${format(now, 'yyyy-MM-dd HH:mm:ss')}`);

    const results: { type: string; sent: number; escalated: number }[] = [];

    // 1. 일일 점검 리마인더 (08:00, 14:00, 22:00)
    if (DAILY_CHECK_TIMES.includes(currentHour)) {
      const shift = SHIFT_NAMES[currentHour];
      const dailyResult = await sendDailyCheckReminders(shift);
      results.push({ type: 'DAILY', ...dailyResult });
    }

    // 2. 주간 점검 리마인더 (월요일 09:00)
    if (currentDay === 1 && currentHour === 9) {
      const weeklyResult = await sendWeeklyCheckReminders();
      results.push({ type: 'WEEKLY', ...weeklyResult });
    }

    // 3. 월간 검증 리마인더 (매월 1일 09:00)
    if (currentDate === 1 && currentHour === 9) {
      const monthlyResult = await sendMonthlyVerificationReminders();
      results.push({ type: 'MONTHLY', ...monthlyResult });
    }

    // 4. 에스컬레이션 처리 (매시간)
    const escalationResult = await processEscalations();
    if (escalationResult.escalated > 0) {
      results.push({ type: 'ESCALATION', sent: 0, escalated: escalationResult.escalated });
    }

    console.log(`[HACCP Reminder] Completed:`, results);

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      results,
    });
  } catch (error) {
    console.error('[HACCP Reminder] Error:', error);
    return NextResponse.json(
      { error: 'Reminder process failed' },
      { status: 500 }
    );
  }
}

async function sendDailyCheckReminders(shift: string): Promise<{ sent: number; escalated: number }> {
  const today = format(new Date(), 'yyyy-MM-dd');

  // 아직 점검 안 된 회사들 조회
  const { data: companies } = await getSupabase()
    .from('companies')
    .select('id, name')
    .eq('status', 'ACTIVE');

  let sent = 0;

  for (const company of companies || []) {
    // 해당 시프트 점검 상태 확인
    const { data: checkStatus } = await getSupabase()
      .from('haccp_check_status')
      .select('id, status')
      .eq('company_id', company.id)
      .eq('check_type', 'DAILY_HYGIENE')
      .eq('check_date', today)
      .eq('shift', shift)
      .maybeSingle();

    // 이미 완료되었거나 리마인더 전송됨
    if (checkStatus?.status === 'COMPLETED' || checkStatus?.status === 'REMINDED') {
      continue;
    }

    // HACCP 담당 직원 조회
    const { data: staff } = await getSupabase()
      .from('users')
      .select('id')
      .eq('company_id', company.id)
      .in('role', ['HACCP_STAFF', 'STORE_MANAGER']);

    for (const user of staff || []) {
      await getSupabase().from('notifications').insert({
        user_id: user.id,
        category: 'HACCP',
        priority: 'HIGH',
        title: '일일 위생 점검 필요',
        body: `${shift} 교대 위생 점검을 완료해주세요.`,
        deep_link: '/haccp/daily-check',
        sent: false,
      });
      sent++;
    }

    // 점검 상태 기록/업데이트
    await getSupabase().from('haccp_check_status').upsert(
      {
        company_id: company.id,
        check_type: 'DAILY_HYGIENE',
        check_date: today,
        shift,
        status: 'PENDING',
        reminder_sent: true,
        reminder_sent_at: new Date().toISOString(),
      },
      { onConflict: 'company_id,check_type,check_date,shift' }
    );
  }

  return { sent, escalated: 0 };
}

async function sendWeeklyCheckReminders(): Promise<{ sent: number; escalated: number }> {
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

  const { data: companies } = await getSupabase()
    .from('companies')
    .select('id')
    .eq('status', 'ACTIVE');

  let sent = 0;

  for (const company of companies || []) {
    // 주간 점검 목록
    const weeklyChecks = ['PEST_CONTROL', 'EQUIPMENT_CALIBRATION', 'CLEANING_SCHEDULE'];

    for (const checkType of weeklyChecks) {
      const { data: checkStatus } = await getSupabase()
        .from('haccp_check_status')
        .select('status')
        .eq('company_id', company.id)
        .eq('check_type', checkType)
        .gte('check_date', weekStart)
        .maybeSingle();

      if (checkStatus?.status === 'COMPLETED') continue;

      const { data: managers } = await getSupabase()
        .from('users')
        .select('id')
        .eq('company_id', company.id)
        .in('role', ['HACCP_MANAGER', 'STORE_MANAGER']);

      const checkName = {
        PEST_CONTROL: '방충/방서 점검',
        EQUIPMENT_CALIBRATION: '계측기 검교정',
        CLEANING_SCHEDULE: '주간 청소 점검',
      }[checkType];

      for (const manager of managers || []) {
        await getSupabase().from('notifications').insert({
          user_id: manager.id,
          category: 'HACCP',
          priority: 'NORMAL',
          title: '주간 점검 필요',
          body: `${checkName}을 완료해주세요.`,
          deep_link: `/haccp/weekly-check/${checkType.toLowerCase()}`,
        });
        sent++;
      }
    }
  }

  return { sent, escalated: 0 };
}

async function sendMonthlyVerificationReminders(): Promise<{ sent: number; escalated: number }> {
  const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');

  const { data: companies } = await getSupabase()
    .from('companies')
    .select('id')
    .eq('status', 'ACTIVE');

  let sent = 0;

  for (const company of companies || []) {
    // CCP 월간 검증 필요 여부 확인
    const { data: ccpDefs } = await getSupabase()
      .from('ccp_definitions')
      .select('id, process')
      .eq('company_id', company.id)
      .eq('is_active', true);

    for (const ccp of ccpDefs || []) {
      const { data: verification } = await getSupabase()
        .from('ccp_verifications')
        .select('id')
        .eq('ccp_id', ccp.id)
        .gte('verification_date', monthStart)
        .maybeSingle();

      if (verification) continue;

      const { data: managers } = await getSupabase()
        .from('users')
        .select('id')
        .eq('company_id', company.id)
        .in('role', ['HACCP_MANAGER', 'COMPANY_ADMIN']);

      for (const manager of managers || []) {
        await getSupabase().from('notifications').insert({
          user_id: manager.id,
          category: 'HACCP',
          priority: 'HIGH',
          title: 'CCP 월간 검증 필요',
          body: `${ccp.process}의 월간 검증을 완료해주세요.`,
          deep_link: `/haccp/verification/${ccp.id}`,
        });
        sent++;
      }
    }
  }

  return { sent, escalated: 0 };
}

async function processEscalations(): Promise<{ escalated: number }> {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

  // 2시간 전 리마인더 보냈는데 아직 미완료인 항목
  const { data: pendingChecks } = await getSupabase()
    .from('haccp_check_status')
    .select('*')
    .eq('status', 'PENDING')
    .eq('reminder_sent', true)
    .eq('escalation_sent', false)
    .lt('reminder_sent_at', twoHoursAgo.toISOString());

  let escalated = 0;

  for (const check of pendingChecks || []) {
    // 상위 관리자에게 에스컬레이션
    const { data: admins } = await getSupabase()
      .from('users')
      .select('id')
      .eq('company_id', check.company_id)
      .in('role', ['COMPANY_ADMIN', 'HACCP_MANAGER']);

    for (const admin of admins || []) {
      await getSupabase().from('notifications').insert({
        user_id: admin.id,
        category: 'HACCP',
        priority: 'HIGH',
        title: '점검 미완료 에스컬레이션',
        body: `${check.check_type} 점검이 2시간 이상 지연되고 있습니다.`,
        deep_link: '/haccp/pending-checks',
      });
    }

    // FCM 푸시 발송
    const { data: fcmTokens } = await getSupabase()
      .from('user_fcm_tokens')
      .select('fcm_token')
      .in('user_id', (admins || []).map(a => a.id))
      .eq('is_active', true);

    for (const token of fcmTokens || []) {
      try {
        await getPushNotificationService().send(token.fcm_token, {
          title: '긴급: 점검 미완료',
          body: `${check.check_type} 점검 지연`,
          category: 'HACCP',
          priority: 'HIGH',
        });
      } catch (e) {
        console.error('Push notification failed:', e);
      }
    }

    // 에스컬레이션 상태 업데이트
    await getSupabase()
      .from('haccp_check_status')
      .update({
        escalation_sent: true,
        escalation_sent_at: new Date().toISOString(),
      })
      .eq('id', check.id);

    escalated++;
  }

  return { escalated };
}
