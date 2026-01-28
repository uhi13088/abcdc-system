/**
 * Cron: Labor Law Auto Apply
 * 매일 실행되어 새로 활성화된 근로기준법을 전 회사에 적용 및 알림
 * Schedule: 0 1 * * * (매일 오전 1시)
 *
 * 또는 labor_law_versions 테이블에서 status가 ACTIVE로 변경될 때 호출
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

  return await applyLaborLaw();
}

// POST로도 호출 가능 (트리거 또는 수동 실행 시)
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const versionId = body.version_id;

  return await applyLaborLaw(versionId);
}

async function applyLaborLaw(specificVersionId?: string) {
  const supabase = getSupabaseClient();
  console.log('[Cron] Starting labor law auto apply...');

  try {
    const results = {
      versionsProcessed: 0,
      companiesNotified: 0,
      errors: 0,
      changes: [] as Array<{ field: string; oldValue: string; newValue: string }>,
    };

    // Get the currently active labor law version
    let currentVersion: Record<string, unknown> | null = null;
    let versionError: Error | null = null;

    if (specificVersionId) {
      const { data, error } = await supabase
        .from('labor_law_versions')
        .select('*')
        .eq('id', specificVersionId)
        .single();
      currentVersion = data;
      versionError = error;
    } else {
      const { data, error } = await supabase
        .from('labor_law_versions')
        .select('*')
        .eq('status', 'ACTIVE')
        .order('effective_date', { ascending: false })
        .limit(1);
      currentVersion = data?.[0] || null;
      versionError = error;
    }

    if (versionError || !currentVersion) {
      console.log('[Cron] No active labor law version found');
      return NextResponse.json({ success: true, message: 'No active version found' });
    }

    // Get the previous version to compare changes
    const { data: previousVersion } = await supabase
      .from('labor_law_versions')
      .select('*')
      .neq('id', currentVersion.id)
      .in('status', ['ACTIVE', 'ARCHIVED'])
      .order('effective_date', { ascending: false })
      .limit(1);

    // Calculate changes
    if (previousVersion && previousVersion[0]) {
      const prev = previousVersion[0];
      const curr = currentVersion;

      if (prev.minimum_wage !== curr.minimum_wage) {
        results.changes.push({
          field: '최저임금',
          oldValue: `${prev.minimum_wage?.toLocaleString()}원`,
          newValue: `${curr.minimum_wage?.toLocaleString()}원`,
        });
      }
      if (prev.national_pension_rate !== curr.national_pension_rate) {
        results.changes.push({
          field: '국민연금 요율',
          oldValue: `${prev.national_pension_rate}%`,
          newValue: `${curr.national_pension_rate}%`,
        });
      }
      if (prev.health_insurance_rate !== curr.health_insurance_rate) {
        results.changes.push({
          field: '건강보험 요율',
          oldValue: `${prev.health_insurance_rate}%`,
          newValue: `${curr.health_insurance_rate}%`,
        });
      }
      if (prev.employment_insurance_rate !== curr.employment_insurance_rate) {
        results.changes.push({
          field: '고용보험 요율',
          oldValue: `${prev.employment_insurance_rate}%`,
          newValue: `${curr.employment_insurance_rate}%`,
        });
      }
    }

    results.versionsProcessed = 1;

    // Get all active companies
    const { data: companies } = await supabase
      .from('companies')
      .select('id, name')
      .eq('is_active', true);

    // Notify all company admins about the new labor law
    for (const company of companies || []) {
      try {
        const { data: admins } = await supabase
          .from('users')
          .select('id')
          .eq('company_id', company.id)
          .in('role', ['COMPANY_ADMIN', 'company_admin']);

        for (const admin of admins || []) {
          // Check if already notified for this version
          const { data: existingNotif } = await supabase
            .from('notifications')
            .select('id')
            .eq('user_id', admin.id)
            .eq('category', 'LEGAL')
            .ilike('title', '%근로기준법%')
            .eq('data->>version_id', currentVersion.id)
            .limit(1);

          if (!existingNotif || existingNotif.length === 0) {
            let bodyText = `${currentVersion.year}년 근로기준법이 적용되었습니다.\n`;
            bodyText += `시행일: ${currentVersion.effective_date}\n\n`;

            if (results.changes.length > 0) {
              bodyText += '주요 변경사항:\n';
              for (const change of results.changes) {
                bodyText += `• ${change.field}: ${change.oldValue} → ${change.newValue}\n`;
              }
            }

            bodyText += '\n급여 계산에 자동 반영됩니다.';

            await supabase.from('notifications').insert({
              user_id: admin.id,
              category: 'LEGAL',
              priority: 'HIGH',
              title: '근로기준법 변경 알림',
              body: bodyText.trim(),
              deep_link: '/settings/payroll',
              data: {
                version_id: currentVersion.id,
                year: currentVersion.year,
                effective_date: currentVersion.effective_date,
                changes: results.changes,
                minimum_wage: currentVersion.minimum_wage,
                auto_applied: true,
              },
            });
            results.companiesNotified++;
          }
        }
      } catch (companyError) {
        console.error(`Error notifying company ${company.id}:`, companyError);
        results.errors++;
      }
    }

    // Mark version as notified (optional: add a notified_at column)
    await supabase
      .from('labor_law_versions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', currentVersion.id);

    console.log('[Cron] Labor law auto apply completed:', results);

    return NextResponse.json({
      success: true,
      ...results,
      version: {
        id: currentVersion.id,
        year: currentVersion.year,
        effective_date: currentVersion.effective_date,
      },
    });
  } catch (error) {
    console.error('[Cron] Error in labor law auto apply:', error);
    return NextResponse.json(
      { error: 'Failed to apply labor law' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
