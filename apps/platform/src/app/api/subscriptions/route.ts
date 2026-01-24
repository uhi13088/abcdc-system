import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// GET /api/subscriptions - Get all subscription plans and company subscriptions
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

    // Get subscription plans (with error handling for missing table)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let plans: any[] = [];
    try {
      const { data } = await adminClient
        .from('subscription_plans')
        .select('*')
        .order('price_monthly', { ascending: true });
      plans = data || [];
    } catch {
      // Table might not exist
    }

    // Get company subscriptions (with error handling)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let subscriptions: any[] = [];
    try {
      const { data } = await adminClient
        .from('company_subscriptions')
        .select('*')
        .order('created_at', { ascending: false });

      // Get company, plan, and admin user info separately
      subscriptions = await Promise.all(
        (data || []).map(async (sub) => {
          const [companyResult, planResult, adminUserResult] = await Promise.all([
            adminClient.from('companies').select('id, name, email, ceo_name').eq('id', sub.company_id).maybeSingle(),
            adminClient.from('subscription_plans').select('id, name, display_name, price_monthly').eq('id', sub.plan_id).maybeSingle(),
            adminClient.from('users').select('email, name').eq('company_id', sub.company_id).eq('role', 'company_admin').maybeSingle(),
          ]);
          return {
            ...sub,
            companies: companyResult.data,
            subscription_plans: planResult.data,
            admin_user: adminUserResult.data,
          };
        })
      );
    } catch {
      // Tables might not exist
    }

    // Calculate stats
    const planStats = plans.map(plan => {
      const count = subscriptions.filter(
        s => s.plan_id === plan.id && s.status === 'ACTIVE'
      ).length;
      return { ...plan, subscriber_count: count };
    });

    const totalRevenue = subscriptions
      .filter(s => s.status === 'ACTIVE')
      .reduce((sum, s) => sum + (s.subscription_plans?.price_monthly || 0), 0);

    return NextResponse.json({
      plans: planStats,
      subscriptions,
      stats: {
        totalSubscriptions: subscriptions.filter(s => s.status === 'ACTIVE').length,
        totalRevenue,
      }
    });
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscriptions' },
      { status: 500 }
    );
  }
}
