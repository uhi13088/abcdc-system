/**
 * 회사별 상세 통계 API
 * GET /api/companies/[id]/stats - 특정 회사의 상세 사용 통계
 */

import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { subDays, subMonths, format } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const companyId = params.id;

    // 인증 확인
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await adminClient
      .from('users')
      .select('role, company_id')
      .eq('auth_id', user.id)
      .single();

    // super_admin이거나 해당 회사 관리자만 조회 가능
    if (profile?.role !== 'super_admin' && profile?.company_id !== companyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 회사 정보
    const { data: company } = await adminClient
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single();

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30);
    const sixMonthsAgo = subMonths(now, 6);

    // 사용자 통계
    const { data: users } = await adminClient
      .from('users')
      .select('id, role, status, created_at, last_login_at')
      .eq('company_id', companyId);

    const userStats = {
      total: users?.length || 0,
      byRole: {
        admin: users?.filter(u => ['COMPANY_ADMIN', 'company_admin'].includes(u.role)).length || 0,
        manager: users?.filter(u => ['STORE_MANAGER', 'store_manager'].includes(u.role)).length || 0,
        staff: users?.filter(u => ['STAFF', 'staff', 'PART_TIME', 'part_time'].includes(u.role)).length || 0,
      },
      byStatus: {
        active: users?.filter(u => u.status === 'ACTIVE').length || 0,
        inactive: users?.filter(u => u.status === 'INACTIVE').length || 0,
        resigned: users?.filter(u => u.status === 'RESIGNED').length || 0,
      },
      activeInLast30Days: users?.filter(u =>
        u.last_login_at && new Date(u.last_login_at) >= thirtyDaysAgo
      ).length || 0,
      newInLast30Days: users?.filter(u =>
        new Date(u.created_at) >= thirtyDaysAgo
      ).length || 0,
    };

    // 매장 통계
    const { data: stores } = await adminClient
      .from('stores')
      .select('id, name, status')
      .eq('company_id', companyId);

    const storeStats = {
      total: stores?.length || 0,
      active: stores?.filter(s => s.status === 'ACTIVE').length || 0,
      inactive: stores?.filter(s => s.status !== 'ACTIVE').length || 0,
    };

    // 출퇴근 통계 (최근 30일)
    const { data: attendances } = await adminClient
      .from('attendances')
      .select('id, work_date, actual_check_in, actual_check_out, status')
      .eq('company_id', companyId)
      .gte('work_date', format(thirtyDaysAgo, 'yyyy-MM-dd'));

    const attendanceStats = {
      totalRecords: attendances?.length || 0,
      completedShifts: attendances?.filter(a => a.actual_check_in && a.actual_check_out).length || 0,
      lateCount: attendances?.filter(a => a.status === 'LATE').length || 0,
      earlyLeaveCount: attendances?.filter(a => a.status === 'EARLY_LEAVE').length || 0,
      attendanceRate: attendances?.length
        ? Math.round((attendances.filter(a => a.actual_check_in).length / attendances.length) * 100)
        : 0,
    };

    // 승인 통계 (최근 30일)
    const { data: approvals } = await adminClient
      .from('approval_requests')
      .select('id, type, final_status, created_at, processed_at')
      .eq('company_id', companyId)
      .gte('created_at', thirtyDaysAgo.toISOString());

    const approvalStats = {
      total: approvals?.length || 0,
      byStatus: {
        pending: approvals?.filter(a => a.final_status === 'PENDING').length || 0,
        approved: approvals?.filter(a => a.final_status === 'APPROVED').length || 0,
        rejected: approvals?.filter(a => a.final_status === 'REJECTED').length || 0,
      },
      byType: {} as Record<string, number>,
      avgProcessingTimeHours: 0,
    };

    // 승인 유형별 집계
    approvals?.forEach(a => {
      approvalStats.byType[a.type] = (approvalStats.byType[a.type] || 0) + 1;
    });

    // 평균 처리 시간
    const processedApprovals = approvals?.filter(a => a.processed_at && a.final_status !== 'PENDING') || [];
    if (processedApprovals.length > 0) {
      const totalHours = processedApprovals.reduce((sum, a) => {
        const created = new Date(a.created_at);
        const processed = new Date(a.processed_at!);
        return sum + (processed.getTime() - created.getTime()) / (1000 * 60 * 60);
      }, 0);
      approvalStats.avgProcessingTimeHours = Math.round(totalHours / processedApprovals.length * 10) / 10;
    }

    // 스케줄 통계
    const { count: schedulesThisMonth } = await adminClient
      .from('schedules')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .gte('work_date', format(thirtyDaysAgo, 'yyyy-MM-dd'));

    const { count: emergencyShiftsThisMonth } = await adminClient
      .from('emergency_shifts')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .gte('created_at', thirtyDaysAgo.toISOString());

    // HACCP 통계 (있는 경우)
    const { count: haccpRecords } = await adminClient
      .from('haccp_ccp_records')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .gte('recorded_at', thirtyDaysAgo.toISOString());

    // 월별 성장 추이 (6개월)
    const monthlyGrowth = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = subMonths(now, i);
      const monthEnd = subMonths(now, i - 1);
      const monthStr = format(monthStart, 'yyyy-MM');

      const newUsersCount = users?.filter(u => {
        const created = new Date(u.created_at);
        return created >= monthStart && created < monthEnd;
      }).length || 0;

      monthlyGrowth.push({
        month: format(monthStart, 'yyyy년 M월'),
        newUsers: newUsersCount,
      });
    }

    // 구독 정보
    const { data: subscription } = await adminClient
      .from('company_subscriptions')
      .select(`
        *,
        subscription_plans (name, tier, max_users, max_stores, features)
      `)
      .eq('company_id', companyId)
      .eq('status', 'ACTIVE')
      .single();

    const planData = Array.isArray(subscription?.subscription_plans)
      ? subscription?.subscription_plans[0]
      : subscription?.subscription_plans;

    const subscriptionInfo = subscription ? {
      plan: planData?.name || 'Free',
      tier: planData?.tier || 'free',
      maxUsers: planData?.max_users || 5,
      maxStores: planData?.max_stores || 1,
      usersUsed: userStats.total,
      storesUsed: storeStats.total,
      usersUsagePercent: planData?.max_users
        ? Math.round((userStats.total / planData.max_users) * 100)
        : 0,
      storesUsagePercent: planData?.max_stores
        ? Math.round((storeStats.total / planData.max_stores) * 100)
        : 0,
      expiresAt: subscription.end_date,
    } : {
      plan: 'Free',
      tier: 'free',
      maxUsers: 5,
      maxStores: 1,
      usersUsed: userStats.total,
      storesUsed: storeStats.total,
      usersUsagePercent: Math.round((userStats.total / 5) * 100),
      storesUsagePercent: Math.round((storeStats.total / 1) * 100),
      expiresAt: null,
    };

    // 건강 점수 계산
    let healthScore = 100;
    const healthIssues: string[] = [];

    // 비활성 사용자 비율
    if (userStats.total > 0) {
      const activeRatio = userStats.activeInLast30Days / userStats.total;
      if (activeRatio < 0.5) {
        healthScore -= 20;
        healthIssues.push('50% 이상의 사용자가 30일간 비활성 상태입니다.');
      }
    }

    // 지각률
    if (attendanceStats.totalRecords > 0) {
      const lateRatio = attendanceStats.lateCount / attendanceStats.totalRecords;
      if (lateRatio > 0.1) {
        healthScore -= 15;
        healthIssues.push(`지각률이 ${Math.round(lateRatio * 100)}%로 높습니다.`);
      }
    }

    // 미처리 승인
    if (approvalStats.byStatus.pending > 5) {
      healthScore -= 10;
      healthIssues.push(`${approvalStats.byStatus.pending}건의 승인 요청이 대기 중입니다.`);
    }

    // 구독 한도 초과 임박
    if (subscriptionInfo.usersUsagePercent > 90) {
      healthScore -= 10;
      healthIssues.push('사용자 수가 구독 한도의 90%를 초과했습니다.');
    }

    return NextResponse.json({
      company: {
        id: company.id,
        name: company.name,
        createdAt: company.created_at,
        status: company.status,
      },
      period: {
        start: format(thirtyDaysAgo, 'yyyy-MM-dd'),
        end: format(now, 'yyyy-MM-dd'),
      },
      users: userStats,
      stores: storeStats,
      attendance: attendanceStats,
      approvals: approvalStats,
      schedules: {
        totalThisMonth: schedulesThisMonth || 0,
        emergencyShifts: emergencyShiftsThisMonth || 0,
      },
      haccp: {
        recordsThisMonth: haccpRecords || 0,
      },
      monthlyGrowth,
      subscription: subscriptionInfo,
      health: {
        score: Math.max(0, healthScore),
        status: healthScore >= 80 ? 'HEALTHY' : healthScore >= 60 ? 'WARNING' : 'CRITICAL',
        issues: healthIssues,
      },
    });
  } catch (error) {
    console.error('Company stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
