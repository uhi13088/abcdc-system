import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/roasting/access
// Check if the current user has access to the roasting system
// This endpoint can be called by external roasting app
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user info
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, company_id, store_id, roasting_access')
      .eq('auth_id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json({
        hasAccess: false,
        companyHasAddon: false,
        storeEnabled: false,
        userAccess: false,
        error: 'User not found',
      });
    }

    // Check company subscription for roasting addon
    const { data: subscription } = await supabase
      .from('company_subscriptions')
      .select('roasting_addon_enabled')
      .eq('company_id', userData.company_id)
      .single();

    const companyHasAddon = subscription?.roasting_addon_enabled || false;

    // Check store-level roasting enabled
    let storeEnabled = false;
    if (userData.store_id) {
      const { data: store } = await supabase
        .from('stores')
        .select('roasting_enabled')
        .eq('id', userData.store_id)
        .single();

      storeEnabled = store?.roasting_enabled || false;
    }

    // User-level override access
    const userAccess = userData.roasting_access || false;

    // Final access determination:
    // Company must have addon AND (user has direct access OR store is enabled)
    const hasAccess = companyHasAddon && (userAccess || storeEnabled);

    return NextResponse.json({
      hasAccess,
      companyHasAddon,
      storeEnabled,
      userAccess,
    });
  } catch (error) {
    console.error('Failed to check roasting access:', error);
    return NextResponse.json(
      {
        hasAccess: false,
        companyHasAddon: false,
        storeEnabled: false,
        userAccess: false,
        error: 'Internal Server Error',
      },
      { status: 500 }
    );
  }
}
