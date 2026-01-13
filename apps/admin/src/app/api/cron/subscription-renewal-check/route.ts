/**
 * Cron: Subscription Renewal Check
 * 매일 자정에 실행되어 갱신 예정 구독 체크 및 알림
 * Schedule: 0 0 * * *
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { addDays, format } from 'date-fns';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
}

export async function GET() {
  const supabase = getSupabaseClient();
  console.log('[Cron] Starting subscription renewal check...');

  try {
    const today = new Date();
    const in3Days = addDays(today, 3);
    const in7Days = addDays(today, 7);

    const results = {
      expiring3Days: 0,
      expiring7Days: 0,
      expired: 0,
      errors: 0,
    };

    // Find subscriptions expiring in 3 days
    const { data: expiring3Days } = await supabase
      .from('company_subscriptions')
      .select('*, company:companies(name)')
      .eq('status', 'ACTIVE')
      .eq('cancel_at_period_end', false)
      .gte('current_period_end', format(today, 'yyyy-MM-dd'))
      .lte('current_period_end', format(in3Days, 'yyyy-MM-dd'));

    for (const sub of expiring3Days || []) {
      // Send notification to company admins
      const { data: admins } = await supabase
        .from('users')
        .select('id')
        .eq('company_id', sub.company_id)
        .eq('role', 'COMPANY_ADMIN');

      for (const admin of admins || []) {
        await supabase.from('notifications').insert({
          user_id: admin.id,
          category: 'BILLING',
          priority: 'HIGH',
          title: '구독 갱신 안내',
          body: `구독이 3일 후 갱신됩니다. 결제 수단을 확인해주세요.`,
          deep_link: '/settings/subscription',
        });
      }
      results.expiring3Days++;
    }

    // Find subscriptions expiring in 7 days
    const { data: expiring7Days } = await supabase
      .from('company_subscriptions')
      .select('*, company:companies(name)')
      .eq('status', 'ACTIVE')
      .eq('cancel_at_period_end', false)
      .gte('current_period_end', format(in3Days, 'yyyy-MM-dd'))
      .lte('current_period_end', format(in7Days, 'yyyy-MM-dd'));

    for (const sub of expiring7Days || []) {
      const { data: admins } = await supabase
        .from('users')
        .select('id')
        .eq('company_id', sub.company_id)
        .eq('role', 'COMPANY_ADMIN');

      for (const admin of admins || []) {
        await supabase.from('notifications').insert({
          user_id: admin.id,
          category: 'BILLING',
          priority: 'NORMAL',
          title: '구독 갱신 예정',
          body: `구독이 7일 후 갱신됩니다.`,
          deep_link: '/settings/subscription',
        });
      }
      results.expiring7Days++;
    }

    // Handle expired subscriptions that weren't renewed
    const { data: expired } = await supabase
      .from('company_subscriptions')
      .select('*')
      .eq('status', 'ACTIVE')
      .lt('current_period_end', format(today, 'yyyy-MM-dd'));

    for (const sub of expired || []) {
      // Check if there's a Stripe subscription that's still active
      // If not, downgrade to free plan
      const { data: freePlan } = await supabase
        .from('subscription_plans')
        .select('id')
        .eq('name', 'FREE')
        .single();

      if (freePlan) {
        // Update to expired status
        await supabase
          .from('company_subscriptions')
          .update({ status: 'EXPIRED' })
          .eq('id', sub.id);

        // Create new free subscription
        await supabase.from('company_subscriptions').insert({
          company_id: sub.company_id,
          plan_id: freePlan.id,
          status: 'ACTIVE',
          billing_cycle: 'MONTHLY',
          current_period_start: format(today, 'yyyy-MM-dd'),
          current_period_end: format(addDays(today, 365), 'yyyy-MM-dd'),
        });

        // Notify company admins
        const { data: admins } = await supabase
          .from('users')
          .select('id')
          .eq('company_id', sub.company_id)
          .eq('role', 'COMPANY_ADMIN');

        for (const admin of admins || []) {
          await supabase.from('notifications').insert({
            user_id: admin.id,
            category: 'BILLING',
            priority: 'HIGH',
            title: '구독 만료',
            body: '구독이 만료되어 무료 플랜으로 변경되었습니다.',
            deep_link: '/settings/subscription',
          });
        }

        results.expired++;
      }
    }

    console.log('[Cron] Subscription renewal check completed:', results);

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error('[Cron] Error in subscription renewal check:', error);
    return NextResponse.json(
      { error: 'Failed to check subscription renewals' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
