import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// GET /api/company-subscriptions/[id] - Get a specific company subscription
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const { data, error } = await adminClient
      .from('company_subscriptions')
      .select(`
        *,
        companies (id, name, email, ceo_name),
        subscription_plans (id, name, display_name, price_monthly)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching company subscription:', error);
    return NextResponse.json({ error: 'Failed to fetch subscription' }, { status: 500 });
  }
}

// PUT /api/company-subscriptions/[id] - Update a company subscription
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const body = await request.json();

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.plan_id !== undefined) {
      updateData.plan_id = body.plan_id;
    }
    if (body.status !== undefined) {
      updateData.status = body.status;
    }
    if (body.billing_cycle !== undefined) {
      updateData.billing_cycle = body.billing_cycle;
    }
    if (body.current_period_end !== undefined) {
      updateData.current_period_end = body.current_period_end;
    }
    if (body.cancel_at_period_end !== undefined) {
      updateData.cancel_at_period_end = body.cancel_at_period_end;
    }

    // HACCP addon
    if (body.haccp_addon_enabled !== undefined) {
      updateData.haccp_addon_enabled = body.haccp_addon_enabled;
      if (body.haccp_addon_enabled && !body.haccp_addon_started_at) {
        updateData.haccp_addon_started_at = new Date().toISOString();
      }
    }

    // Roasting addon
    if (body.roasting_addon_enabled !== undefined) {
      updateData.roasting_addon_enabled = body.roasting_addon_enabled;
      if (body.roasting_addon_enabled && !body.roasting_addon_started_at) {
        updateData.roasting_addon_started_at = new Date().toISOString();
      }
    }

    const { data, error } = await adminClient
      .from('company_subscriptions')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        companies (id, name, email, ceo_name),
        subscription_plans (id, name, display_name, price_monthly)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating company subscription:', error);
    return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });
  }
}
