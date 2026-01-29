/**
 * Cron: Usage Limit Monitor
 * 매시간 실행되어 사용량 한도 초과 체크 및 알림
 * Schedule: 0 * * * * (매시간)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
}

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseClient();
  console.log('[Cron] Starting usage limit monitor...');

  try {
    const results = {
      companiesChecked: 0,
      warningsGenerated: 0,
      limitsExceeded: 0,
      errors: 0,
    };

    // Get all active subscriptions with their plans
    const { data: subscriptions, error: subError } = await supabase
      .from('company_subscriptions')
      .select(`
        id,
        company_id,
        plan:subscription_plans (
          id,
          name,
          max_employees,
          max_stores
        )
      `)
      .eq('status', 'ACTIVE');

    if (subError) throw subError;

    for (const sub of subscriptions || []) {
      try {
        // Supabase returns relations as arrays, get first element
        type PlanType = { id: string; name: string; max_employees: number; max_stores: number };
        const planData = sub.plan as unknown as PlanType[] | null;
        const plan = planData?.[0];
        if (!plan) continue;

        // Count active users for this company
        const { count: userCount } = await supabase
          .from('users')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', sub.company_id)
          .eq('status', 'ACTIVE');

        // Count stores for this company
        const { count: storeCount } = await supabase
          .from('stores')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', sub.company_id)
          .eq('is_active', true);

        const currentUsers = userCount || 0;
        const currentStores = storeCount || 0;
        const maxUsers = plan.max_employees || 999999;
        const maxStores = plan.max_stores || 999999;

        const userPercentage = (currentUsers / maxUsers) * 100;
        const storePercentage = (currentStores / maxStores) * 100;

        // Get company admins for notifications
        const { data: admins } = await supabase
          .from('users')
          .select('id')
          .eq('company_id', sub.company_id)
          .in('role', ['COMPANY_ADMIN', 'company_admin']);

        // Check for warnings (90% threshold)
        if (userPercentage >= 90 && userPercentage < 100) {
          for (const admin of admins || []) {
            // Check if warning was already sent today
            const { data: existingNotif } = await supabase
              .from('notifications')
              .select('id')
              .eq('user_id', admin.id)
              .eq('category', 'USAGE')
              .gte('created_at', new Date().toISOString().split('T')[0])
              .ilike('title', '%직원 수%경고%')
              .limit(1);

            if (!existingNotif || existingNotif.length === 0) {
              await supabase.from('notifications').insert({
                user_id: admin.id,
                category: 'USAGE',
                priority: 'HIGH',
                title: '직원 수 한도 경고',
                body: `현재 ${currentUsers}/${maxUsers}명 사용 중 (${userPercentage.toFixed(0)}%). 플랜 업그레이드를 고려해주세요.`,
                deep_link: '/settings/subscription',
              });
              results.warningsGenerated++;
            }
          }
        }

        if (storePercentage >= 90 && storePercentage < 100) {
          for (const admin of admins || []) {
            const { data: existingNotif } = await supabase
              .from('notifications')
              .select('id')
              .eq('user_id', admin.id)
              .eq('category', 'USAGE')
              .gte('created_at', new Date().toISOString().split('T')[0])
              .ilike('title', '%매장 수%경고%')
              .limit(1);

            if (!existingNotif || existingNotif.length === 0) {
              await supabase.from('notifications').insert({
                user_id: admin.id,
                category: 'USAGE',
                priority: 'HIGH',
                title: '매장 수 한도 경고',
                body: `현재 ${currentStores}/${maxStores}개 사용 중 (${storePercentage.toFixed(0)}%). 플랜 업그레이드를 고려해주세요.`,
                deep_link: '/settings/subscription',
              });
              results.warningsGenerated++;
            }
          }
        }

        // Check for limit exceeded (100%+)
        if (userPercentage >= 100) {
          for (const admin of admins || []) {
            const { data: existingNotif } = await supabase
              .from('notifications')
              .select('id')
              .eq('user_id', admin.id)
              .eq('category', 'USAGE')
              .gte('created_at', new Date().toISOString().split('T')[0])
              .ilike('title', '%직원 수%초과%')
              .limit(1);

            if (!existingNotif || existingNotif.length === 0) {
              await supabase.from('notifications').insert({
                user_id: admin.id,
                category: 'USAGE',
                priority: 'CRITICAL',
                title: '직원 수 한도 초과',
                body: `직원 수가 한도를 초과했습니다 (${currentUsers}/${maxUsers}명). 즉시 플랜을 업그레이드하거나 직원을 비활성화해주세요.`,
                deep_link: '/settings/subscription',
              });
              results.limitsExceeded++;
            }
          }
        }

        if (storePercentage >= 100) {
          for (const admin of admins || []) {
            const { data: existingNotif } = await supabase
              .from('notifications')
              .select('id')
              .eq('user_id', admin.id)
              .eq('category', 'USAGE')
              .gte('created_at', new Date().toISOString().split('T')[0])
              .ilike('title', '%매장 수%초과%')
              .limit(1);

            if (!existingNotif || existingNotif.length === 0) {
              await supabase.from('notifications').insert({
                user_id: admin.id,
                category: 'USAGE',
                priority: 'CRITICAL',
                title: '매장 수 한도 초과',
                body: `매장 수가 한도를 초과했습니다 (${currentStores}/${maxStores}개). 즉시 플랜을 업그레이드해주세요.`,
                deep_link: '/settings/subscription',
              });
              results.limitsExceeded++;
            }
          }
        }

        results.companiesChecked++;
      } catch (companyError) {
        console.error(`Error checking company ${sub.company_id}:`, companyError);
        results.errors++;
      }
    }

    console.log('[Cron] Usage limit monitor completed:', results);

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error('[Cron] Error in usage limit monitor:', error);
    return NextResponse.json(
      { error: 'Failed to check usage limits' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
