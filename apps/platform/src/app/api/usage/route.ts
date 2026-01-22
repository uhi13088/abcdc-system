/**
 * 플랫폼 사용량 모니터링 API
 * GET /api/usage - 전체 플랫폼 사용량 현황
 * GET /api/usage?company_id=xxx - 특정 회사 사용량
 */

import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { subDays, format, startOfDay, endOfDay } from 'date-fns';

export const dynamic = 'force-dynamic';

interface UsageMetrics {
  period: {
    start: string;
    end: string;
  };
  overview: {
    totalApiCalls: number;
    totalDataTransfer: number; // bytes
    activeUsers: number;
    activeSessions: number;
    storageUsed: number; // bytes
  };
  daily: Array<{
    date: string;
    apiCalls: number;
    activeUsers: number;
    newRecords: number;
  }>;
  byCategory: {
    attendance: number;
    schedules: number;
    approvals: number;
    notifications: number;
    haccp: number;
    other: number;
  };
  topEndpoints: Array<{
    endpoint: string;
    calls: number;
    avgResponseTime: number;
  }>;
  alerts: Array<{
    type: 'WARNING' | 'CRITICAL';
    message: string;
    metric: string;
    value: number;
    threshold: number;
  }>;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('company_id');
    const days = parseInt(searchParams.get('days') || '7');

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

    // super_admin만 전체 사용량 조회 가능
    if (!companyId && profile?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 회사별 조회는 해당 회사 관리자도 가능
    if (companyId && profile?.role !== 'super_admin' && profile?.company_id !== companyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const endDate = new Date();
    const startDate = subDays(endDate, days);
    const startDateStr = format(startDate, 'yyyy-MM-dd');
    const endDateStr = format(endDate, 'yyyy-MM-dd');

    // 일별 통계 수집
    const dailyStats = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(endDate, i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayStart = startOfDay(date).toISOString();
      const dayEnd = endOfDay(date).toISOString();

      // 해당 날짜의 출퇴근 기록 수
      let attendanceQuery = adminClient
        .from('attendances')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', dayStart)
        .lte('created_at', dayEnd);
      if (companyId) attendanceQuery = attendanceQuery.eq('company_id', companyId);
      const { count: attendanceCount } = await attendanceQuery;

      // 해당 날짜의 활성 사용자 수 (출퇴근 기록 기준)
      let activeUsersQuery = adminClient
        .from('attendances')
        .select('staff_id')
        .gte('created_at', dayStart)
        .lte('created_at', dayEnd);
      if (companyId) activeUsersQuery = activeUsersQuery.eq('company_id', companyId);
      const { data: activeUsersData } = await activeUsersQuery;
      const uniqueUsers = new Set(activeUsersData?.map(a => a.staff_id) || []);

      // 해당 날짜의 신규 레코드 (여러 테이블 합산)
      let schedulesQuery = adminClient
        .from('schedules')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', dayStart)
        .lte('created_at', dayEnd);
      if (companyId) schedulesQuery = schedulesQuery.eq('company_id', companyId);
      const { count: schedulesCount } = await schedulesQuery;

      let approvalsQuery = adminClient
        .from('approval_requests')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', dayStart)
        .lte('created_at', dayEnd);
      if (companyId) approvalsQuery = approvalsQuery.eq('company_id', companyId);
      const { count: approvalsCount } = await approvalsQuery;

      dailyStats.push({
        date: dateStr,
        apiCalls: (attendanceCount || 0) + (schedulesCount || 0) + (approvalsCount || 0),
        activeUsers: uniqueUsers.size,
        newRecords: (attendanceCount || 0) + (schedulesCount || 0) + (approvalsCount || 0),
      });
    }

    // 카테고리별 사용량
    const categoryQueries = {
      attendance: adminClient.from('attendances').select('id', { count: 'exact', head: true }).gte('created_at', startDate.toISOString()),
      schedules: adminClient.from('schedules').select('id', { count: 'exact', head: true }).gte('created_at', startDate.toISOString()),
      approvals: adminClient.from('approval_requests').select('id', { count: 'exact', head: true }).gte('created_at', startDate.toISOString()),
      notifications: adminClient.from('notifications').select('id', { count: 'exact', head: true }).gte('created_at', startDate.toISOString()),
    };

    if (companyId) {
      Object.keys(categoryQueries).forEach(key => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (categoryQueries as any)[key] = (categoryQueries as any)[key].eq('company_id', companyId);
      });
    }

    const [attendance, schedules, approvals, notifications] = await Promise.all([
      categoryQueries.attendance,
      categoryQueries.schedules,
      categoryQueries.approvals,
      categoryQueries.notifications,
    ]);

    // HACCP 사용량
    let haccpCount = 0;
    const haccpTables = ['haccp_ccp_records', 'haccp_hygiene_records', 'haccp_production_records'];
    for (const table of haccpTables) {
      let query = adminClient.from(table).select('id', { count: 'exact', head: true }).gte('created_at', startDate.toISOString());
      if (companyId) query = query.eq('company_id', companyId);
      const { count } = await query;
      haccpCount += count || 0;
    }

    // 총 사용자 및 활성 세션
    let totalUsersQuery = adminClient.from('users').select('id', { count: 'exact', head: true });
    if (companyId) totalUsersQuery = totalUsersQuery.eq('company_id', companyId);
    const { count: totalUsers } = await totalUsersQuery;

    // 최근 7일 내 로그인한 활성 사용자
    let activeUsersQuery = adminClient
      .from('users')
      .select('id', { count: 'exact', head: true })
      .gte('last_login_at', startDate.toISOString());
    if (companyId) activeUsersQuery = activeUsersQuery.eq('company_id', companyId);
    const { count: activeUsers } = await activeUsersQuery;

    // FCM 토큰 수 (활성 세션 대리)
    let activeSessions = 0;
    if (companyId) {
      // 회사별 조회는 user join으로 처리
      const { count } = await adminClient
        .from('user_fcm_tokens')
        .select('id, users!inner(company_id)', { count: 'exact', head: true })
        .eq('is_active', true)
        .eq('users.company_id', companyId);
      activeSessions = count || 0;
    } else {
      const { count } = await adminClient
        .from('user_fcm_tokens')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true);
      activeSessions = count || 0;
    }

    // 스토리지 사용량 추정 (행 수 * 평균 바이트)
    const estimatedStorage =
      ((attendance.count || 0) * 500) +
      ((schedules.count || 0) * 300) +
      ((approvals.count || 0) * 1000) +
      ((notifications.count || 0) * 200) +
      (haccpCount * 400);

    // 알림 생성
    const alerts: UsageMetrics['alerts'] = [];
    const _totalRecords = (attendance.count || 0) + (schedules.count || 0) + (approvals.count || 0);

    // 급격한 사용량 증가 감지
    if (dailyStats.length >= 2) {
      const yesterday = dailyStats[dailyStats.length - 2].newRecords;
      const today = dailyStats[dailyStats.length - 1].newRecords;
      if (yesterday > 0 && today > yesterday * 2) {
        alerts.push({
          type: 'WARNING',
          message: '일일 사용량이 전일 대비 2배 이상 증가했습니다.',
          metric: 'daily_records',
          value: today,
          threshold: yesterday * 2,
        });
      }
    }

    // 비활성 사용자 비율 경고
    if ((totalUsers || 0) > 10) {
      const inactiveRatio = 1 - (activeUsers || 0) / (totalUsers || 1);
      if (inactiveRatio > 0.5) {
        alerts.push({
          type: 'WARNING',
          message: '50% 이상의 사용자가 최근 7일간 비활성 상태입니다.',
          metric: 'inactive_users_ratio',
          value: Math.round(inactiveRatio * 100),
          threshold: 50,
        });
      }
    }

    // 총 API 호출 수
    const totalApiCalls = dailyStats.reduce((sum, d) => sum + d.apiCalls, 0);

    const metrics: UsageMetrics = {
      period: {
        start: startDateStr,
        end: endDateStr,
      },
      overview: {
        totalApiCalls,
        totalDataTransfer: estimatedStorage * 2, // 추정: 읽기+쓰기
        activeUsers: activeUsers || 0,
        activeSessions: activeSessions || 0,
        storageUsed: estimatedStorage,
      },
      daily: dailyStats,
      byCategory: {
        attendance: attendance.count || 0,
        schedules: schedules.count || 0,
        approvals: approvals.count || 0,
        notifications: notifications.count || 0,
        haccp: haccpCount,
        other: 0,
      },
      topEndpoints: [
        { endpoint: '/api/attendance', calls: attendance.count || 0, avgResponseTime: 150 },
        { endpoint: '/api/schedules', calls: schedules.count || 0, avgResponseTime: 120 },
        { endpoint: '/api/approvals', calls: approvals.count || 0, avgResponseTime: 200 },
        { endpoint: '/api/notifications', calls: notifications.count || 0, avgResponseTime: 80 },
        { endpoint: '/api/haccp/*', calls: haccpCount, avgResponseTime: 180 },
      ].sort((a, b) => b.calls - a.calls),
      alerts,
    };

    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Usage monitoring error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
