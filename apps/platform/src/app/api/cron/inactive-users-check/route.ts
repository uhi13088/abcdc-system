/**
 * Cron: Inactive Users Check
 * 매주 월요일 실행되어 비활성 사용자 체크 및 관리자 알림
 * Schedule: 0 9 * * 1 (매주 월요일 오전 9시)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { subDays, format } from 'date-fns';

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
  console.log('[Cron] Starting inactive users check...');

  try {
    const today = new Date();
    const thirtyDaysAgo = subDays(today, 30);
    const sixtyDaysAgo = subDays(today, 60);

    const results = {
      companiesNotified: 0,
      usersWarned30Days: 0,
      usersDeactivated60Days: 0,
      errors: 0,
    };

    // Get all companies
    const { data: companies } = await supabase
      .from('companies')
      .select('id, name')
      .eq('is_active', true);

    for (const company of companies || []) {
      try {
        // Find 30-day inactive users (warning)
        const { data: inactive30Users } = await supabase
          .from('users')
          .select('id, name, email, last_login_at')
          .eq('company_id', company.id)
          .eq('status', 'ACTIVE')
          .or(`last_login_at.is.null,last_login_at.lt.${format(thirtyDaysAgo, 'yyyy-MM-dd')}`);

        // Find 60-day inactive users (auto-deactivate)
        const { data: inactive60Users } = await supabase
          .from('users')
          .select('id, name, email, last_login_at')
          .eq('company_id', company.id)
          .eq('status', 'ACTIVE')
          .or(`last_login_at.is.null,last_login_at.lt.${format(sixtyDaysAgo, 'yyyy-MM-dd')}`);

        // Auto-deactivate 60+ day inactive users
        for (const user of inactive60Users || []) {
          await supabase
            .from('users')
            .update({
              status: 'INACTIVE',
              updated_at: new Date().toISOString(),
            })
            .eq('id', user.id);

          results.usersDeactivated60Days++;
        }

        // Get company admins
        const { data: admins } = await supabase
          .from('users')
          .select('id')
          .eq('company_id', company.id)
          .in('role', ['COMPANY_ADMIN', 'company_admin']);

        // Count users for notification
        const inactiveCount30 = (inactive30Users?.length || 0) - (inactive60Users?.length || 0);
        const inactiveCount60 = inactive60Users?.length || 0;

        if (inactiveCount30 > 0 || inactiveCount60 > 0) {
          for (const admin of admins || []) {
            // Create notification with inactive user report
            let body = '';
            if (inactiveCount30 > 0) {
              body += `30일 이상 미접속 직원: ${inactiveCount30}명\n`;
            }
            if (inactiveCount60 > 0) {
              body += `60일 이상 미접속으로 자동 비활성화됨: ${inactiveCount60}명`;
            }

            await supabase.from('notifications').insert({
              user_id: admin.id,
              category: 'SYSTEM',
              priority: inactiveCount60 > 0 ? 'HIGH' : 'NORMAL',
              title: '비활성 직원 현황 리포트',
              body: body.trim(),
              deep_link: '/employees?status=inactive',
              data: {
                inactive_30_days: inactiveCount30,
                deactivated_60_days: inactiveCount60,
                users_30: inactive30Users?.filter(u => !inactive60Users?.find(i => i.id === u.id)).map(u => ({
                  id: u.id,
                  name: u.name,
                  last_login: u.last_login_at,
                })),
                users_60: inactive60Users?.map(u => ({
                  id: u.id,
                  name: u.name,
                  last_login: u.last_login_at,
                })),
              },
            });
          }
          results.companiesNotified++;
        }

        results.usersWarned30Days += inactiveCount30;
      } catch (companyError) {
        console.error(`Error checking company ${company.id}:`, companyError);
        results.errors++;
      }
    }

    console.log('[Cron] Inactive users check completed:', results);

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error('[Cron] Error in inactive users check:', error);
    return NextResponse.json(
      { error: 'Failed to check inactive users' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
