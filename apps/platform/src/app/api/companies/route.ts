import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    // Verify super_admin
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

    // Get companies
    const { data: companies, error } = await adminClient
      .from('companies')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Get counts for each company
    const companiesWithCounts = await Promise.all(
      (companies || []).map(async (company) => {
        const [storesResult, usersResult] = await Promise.all([
          adminClient
            .from('stores')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', company.id),
          adminClient
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', company.id)
            .neq('role', 'super_admin'),
        ]);

        // Get subscription plan (with error handling)
        let planTier = 'free';
        try {
          const { data: subscription } = await adminClient
            .from('company_subscriptions')
            .select('plan_id')
            .eq('company_id', company.id)
            .eq('status', 'ACTIVE')
            .maybeSingle();

          if (subscription?.plan_id) {
            const { data: plan } = await adminClient
              .from('subscription_plans')
              .select('name')
              .eq('id', subscription.plan_id)
              .single();
            planTier = plan?.name?.toLowerCase() || 'free';
          }
        } catch {
          // Subscription tables might not exist, use default
        }

        return {
          ...company,
          owner_name: company.ceo_name || null,
          stores_count: storesResult.count || 0,
          users_count: usersResult.count || 0,
          plan: planTier,
        };
      })
    );

    return NextResponse.json(companiesWithCounts);
  } catch (error) {
    console.error('Error fetching companies:', error);
    return NextResponse.json(
      { error: 'Failed to fetch companies' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    // Verify super_admin
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

    const body = await request.json();

    const { data, error } = await adminClient
      .from('companies')
      .insert([{
        name: body.name,
        business_number: body.business_number,
        ceo_name: body.owner_name,
        email: body.email,
        phone: body.phone,
        address: body.address,
        status: 'ACTIVE',
      }])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error creating company:', error);
    return NextResponse.json(
      { error: 'Failed to create company' },
      { status: 500 }
    );
  }
}
