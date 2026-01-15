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

    // Get subscription plans
    const { data: plans } = await adminClient
      .from('subscription_plans')
      .select('*')
      .order('price', { ascending: true });

    // Get company subscriptions with company info
    const { data: subscriptions } = await adminClient
      .from('company_subscriptions')
      .select(`
        *,
        companies(id, name, email),
        subscription_plans(id, name, tier, price)
      `)
      .order('created_at', { ascending: false });

    // Calculate stats
    const planStats = (plans || []).map(plan => {
      const count = (subscriptions || []).filter(
        s => s.plan_id === plan.id && s.status === 'ACTIVE'
      ).length;
      return { ...plan, subscriber_count: count };
    });

    const totalRevenue = (subscriptions || [])
      .filter(s => s.status === 'ACTIVE')
      .reduce((sum, s) => sum + (s.subscription_plans?.price || 0), 0);

    return NextResponse.json({
      plans: planStats,
      subscriptions: subscriptions || [],
      stats: {
        totalSubscriptions: (subscriptions || []).filter(s => s.status === 'ACTIVE').length,
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
