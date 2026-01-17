import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/subscription/addon/roasting
// Toggle roasting addon for the company
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user info and check if company_admin or super_admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, company_id, role')
      .eq('auth_id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check permission: only company_admin or super_admin can toggle addon
    if (!['company_admin', 'super_admin'].includes(userData.role)) {
      return NextResponse.json(
        { error: '애드온 설정을 변경할 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { enabled } = body;

    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'enabled 값이 필요합니다.' },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // Update company subscription
    const updateData: Record<string, unknown> = {
      roasting_addon_enabled: enabled,
    };

    // Set started_at timestamp when enabling
    if (enabled) {
      updateData.roasting_addon_started_at = new Date().toISOString();
    }

    const { data, error } = await adminClient
      .from('company_subscriptions')
      .update(updateData)
      .eq('company_id', userData.company_id)
      .select()
      .single();

    if (error) {
      // If no subscription record exists, create one
      if (error.code === 'PGRST116') {
        const { data: newData, error: insertError } = await adminClient
          .from('company_subscriptions')
          .insert({
            company_id: userData.company_id,
            roasting_addon_enabled: enabled,
            roasting_addon_started_at: enabled ? new Date().toISOString() : null,
          })
          .select()
          .single();

        if (insertError) {
          return NextResponse.json({ error: insertError.message }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          roasting_addon_enabled: newData.roasting_addon_enabled,
        });
      }

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      roasting_addon_enabled: data.roasting_addon_enabled,
    });
  } catch (error) {
    console.error('Failed to toggle roasting addon:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// GET /api/subscription/addon/roasting
// Get current roasting addon status
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's company
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('company_id')
      .eq('auth_id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get subscription info
    const { data: subscription } = await supabase
      .from('company_subscriptions')
      .select('roasting_addon_enabled, roasting_addon_started_at, roasting_addon_price')
      .eq('company_id', userData.company_id)
      .single();

    return NextResponse.json({
      roasting_addon_enabled: subscription?.roasting_addon_enabled || false,
      roasting_addon_started_at: subscription?.roasting_addon_started_at || null,
      roasting_addon_price: subscription?.roasting_addon_price || 99000,
    });
  } catch (error) {
    console.error('Failed to get roasting addon status:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
