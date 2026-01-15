import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await adminClient
      .from('users')
      .select('role')
      .eq('auth_id', user.id)
      .single();

    if (profile?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get monthly company registrations for last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const { data: companies } = await adminClient
      .from('companies')
      .select('id, created_at')
      .gte('created_at', sixMonthsAgo.toISOString());

    // Group by month
    const monthlyGrowth = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthStr = date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short' });
      const count = (companies || []).filter(c => {
        const cDate = new Date(c.created_at);
        return cDate.getMonth() === date.getMonth() && cDate.getFullYear() === date.getFullYear();
      }).length;
      monthlyGrowth.push({ month: monthStr, count });
    }

    // Get plan distribution
    const { data: subscriptions } = await adminClient
      .from('company_subscriptions')
      .select('subscription_plans(tier)')
      .eq('status', 'ACTIVE');

    const planCounts: Record<string, number> = { free: 0, starter: 0, pro: 0, enterprise: 0 };
    (subscriptions || []).forEach((s: any) => {
      const planData = Array.isArray(s.subscription_plans) ? s.subscription_plans[0] : s.subscription_plans;
      const tier = planData?.tier?.toLowerCase() || 'free';
      planCounts[tier] = (planCounts[tier] || 0) + 1;
    });

    // Get total companies without active subscriptions (free tier)
    const { count: totalCompanies } = await adminClient
      .from('companies')
      .select('*', { count: 'exact', head: true });

    const activeSubCount = Object.values(planCounts).reduce((a, b) => a + b, 0);
    planCounts.free = (totalCompanies || 0) - activeSubCount + planCounts.free;

    // Get top companies by user count
    const { data: allCompanies } = await adminClient
      .from('companies')
      .select('id, name');

    const topCompanies = await Promise.all(
      (allCompanies || []).slice(0, 10).map(async (company) => {
        const { count: userCount } = await adminClient
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', company.id);

        const { count: storeCount } = await adminClient
          .from('stores')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', company.id);

        return {
          ...company,
          users_count: userCount || 0,
          stores_count: storeCount || 0,
        };
      })
    );

    // Sort by user count and take top 5
    topCompanies.sort((a, b) => b.users_count - a.users_count);

    return NextResponse.json({
      monthlyGrowth,
      planDistribution: Object.entries(planCounts).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value,
      })),
      topCompanies: topCompanies.slice(0, 5),
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
