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

    // Get plan distribution and revenue (with error handling)
    const planCounts: Record<string, number> = { free: 0, starter: 0, pro: 0, enterprise: 0 };
    let monthlyRevenue = 0;
    const companyRevenues: Record<string, number> = {};
    try {
      const { data: subscriptions } = await adminClient
        .from('company_subscriptions')
        .select('plan_id, company_id, billing_cycle')
        .eq('status', 'ACTIVE');

      for (const sub of subscriptions || []) {
        const { data: plan } = await adminClient
          .from('subscription_plans')
          .select('name, price')
          .eq('id', sub.plan_id)
          .maybeSingle();
        const tier = plan?.name?.toLowerCase() || 'free';
        planCounts[tier] = (planCounts[tier] || 0) + 1;

        // Calculate monthly revenue
        const price = plan?.price || 0;
        const monthlyPrice = sub.billing_cycle === 'YEARLY' ? price / 12 : price;
        monthlyRevenue += monthlyPrice;

        // Track revenue by company
        if (sub.company_id) {
          companyRevenues[sub.company_id] = (companyRevenues[sub.company_id] || 0) + monthlyPrice;
        }
      }
    } catch {
      // Subscription tables might not exist
    }

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

    // Get metrics for this month
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const { count: newCompaniesCount } = await adminClient
      .from('companies')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', thisMonth.toISOString());

    const { count: newUsersCount } = await adminClient
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', thisMonth.toISOString());

    const { count: totalUsersCount } = await adminClient
      .from('users')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({
      metrics: {
        newCompanies: newCompaniesCount || 0,
        newUsers: newUsersCount || 0,
        mau: totalUsersCount || 0, // Simplified: using total users as MAU
        monthlyRevenue,
      },
      companyGrowth: monthlyGrowth,
      planDistribution: Object.entries(planCounts).map(([plan, count]) => {
        const total = Object.values(planCounts).reduce((a, b) => a + b, 0);
        return {
          plan: plan.charAt(0).toUpperCase() + plan.slice(1),
          count,
          percentage: total > 0 ? Math.round((count / total) * 100) : 0,
        };
      }),
      topCompanies: topCompanies.slice(0, 5).map(c => ({
        name: c.name,
        users: c.users_count,
        stores: c.stores_count,
        revenue: companyRevenues[c.id] || 0,
      })),
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
