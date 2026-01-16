/**
 * Cron: Apply Labor Law Updates
 * 매일 자정에 실행되어 예정된 근로기준법 업데이트 적용
 * Schedule: 0 0 * * *
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
  console.log('[Cron] Starting labor law update check...');

  try {
    const today = new Date().toISOString().split('T')[0];

    // Find any VERIFIED versions that should become ACTIVE today
    const { data: versionsToActivate, error: fetchError } = await supabase
      .from('labor_law_versions')
      .select('*')
      .eq('status', 'VERIFIED')
      .lte('effective_date', today);

    if (fetchError) {
      throw fetchError;
    }

    if (!versionsToActivate || versionsToActivate.length === 0) {
      console.log('[Cron] No labor law updates to apply');
      return NextResponse.json({
        success: true,
        message: 'No updates to apply',
        updatedVersions: 0,
      });
    }

    // Archive current ACTIVE version(s)
    await supabase
      .from('labor_law_versions')
      .update({ status: 'ARCHIVED' })
      .eq('status', 'ACTIVE');

    // Activate the new version(s)
    // If multiple versions, activate the one with the latest effective date
    const latestVersion = versionsToActivate.sort(
      (a, b) => new Date(b.effective_date).getTime() - new Date(a.effective_date).getTime()
    )[0];

    const { error: updateError } = await supabase
      .from('labor_law_versions')
      .update({ status: 'ACTIVE' })
      .eq('id', latestVersion.id);

    if (updateError) {
      throw updateError;
    }

    // Notify platform admins
    const { data: admins } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'PLATFORM_ADMIN');

    for (const admin of admins || []) {
      await supabase.from('notifications').insert({
        user_id: admin.id,
        category: 'SYSTEM',
        priority: 'HIGH',
        title: '근로기준법 업데이트 적용',
        body: `버전 ${latestVersion.version}이 활성화되었습니다. 최저시급: ${latestVersion.minimum_wage_hourly.toLocaleString()}원`,
        deep_link: '/labor-law',
      });
    }

    console.log(`[Cron] Applied labor law version: ${latestVersion.version}`);

    return NextResponse.json({
      success: true,
      message: `Labor law version ${latestVersion.version} activated`,
      updatedVersions: 1,
      newMinimumWage: latestVersion.minimum_wage_hourly,
    });
  } catch (error) {
    console.error('[Cron] Error applying labor law updates:', error);
    return NextResponse.json(
      { error: 'Failed to apply labor law updates' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
