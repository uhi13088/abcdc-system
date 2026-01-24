import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { clearPlatformSettingsCache } from '@abc/shared';

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

    const { data: settings } = await adminClient
      .from('platform_settings')
      .select('*')
      .single();

    return NextResponse.json(settings || {});
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
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

    const body = await request.json();

    // Check if settings exist
    const { data: existing } = await adminClient
      .from('platform_settings')
      .select('id')
      .single();

    let result;
    if (existing) {
      // Update existing
      const { data, error } = await adminClient
        .from('platform_settings')
        .update({
          platform_name: body.platformName,
          support_email: body.supportEmail,
          max_users_per_company: body.maxUsersPerCompany,
          max_stores_per_company: body.maxStoresPerCompany,
          enable_registration: body.enableRegistration,
          require_email_verification: body.requireEmailVerification,
          enable_two_factor: body.enableTwoFactor,
          maintenance_mode: body.maintenanceMode,
          backup_enabled: body.backupEnabled,
          backup_frequency: body.backupFrequency,
          email_notifications: body.emailNotifications,
          slack_notifications: body.slackNotifications,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Insert new
      const { data, error } = await adminClient
        .from('platform_settings')
        .insert([{
          platform_name: body.platformName,
          support_email: body.supportEmail,
          max_users_per_company: body.maxUsersPerCompany,
          max_stores_per_company: body.maxStoresPerCompany,
          enable_registration: body.enableRegistration,
          require_email_verification: body.requireEmailVerification,
          enable_two_factor: body.enableTwoFactor,
          maintenance_mode: body.maintenanceMode,
          backup_enabled: body.backupEnabled,
          backup_frequency: body.backupFrequency,
          email_notifications: body.emailNotifications,
          slack_notifications: body.slackNotifications,
        }])
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    // Clear cache so changes take effect immediately
    clearPlatformSettingsCache();

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error saving settings:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
