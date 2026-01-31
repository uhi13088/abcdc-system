/**
 * HACCP 심사 준비 리포트 API
 * GET /api/haccp/audit-report - 심사용 종합 리포트 생성
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient, createAdminClient } from '@/lib/supabase/server';
import { parseISO, differenceInDays } from 'date-fns';

export const dynamic = 'force-dynamic';

interface AuditReportSummary {
  period: {
    startDate: string;
    endDate: string;
    totalDays: number;
  };
  dailyHygieneChecks: {
    totalRequired: number;
    totalCompleted: number;
    completionRate: number;
    missedDates: string[];
  };
  ccpMonitoring: {
    totalRecords: number;
    passCount: number;
    failCount: number;
    passRate: number;
    failureDetails: {
      date: string;
      ccpName: string;
      value: number;
      limit: string;
    }[];
  };
  correctiveActions: {
    total: number;
    closed: number;
    open: number;
    averageClosureTime: number;
    byStatus: Record<string, number>;
  };
  materialInspections: {
    total: number;
    passed: number;
    rejected: number;
    rejectionRate: number;
  };
  productionRecords: {
    totalBatches: number;
    totalQuantity: number;
    averageDefectRate: number;
  };
  ccpVerifications: {
    totalRequired: number;
    completed: number;
    completionRate: number;
  };
  trainingRecords: {
    totalSessions: number;
    totalAttendees: number;
    topics: string[];
  };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await adminClient
      .from('users')
      .select('company_id, role')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 권한 확인
    if (!['COMPANY_ADMIN', 'HACCP_MANAGER', 'ADMIN', 'company_admin', 'super_admin'].includes(userProfile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      );
    }

    const companyId = userProfile.company_id;
    const totalDays = differenceInDays(parseISO(endDate), parseISO(startDate)) + 1;

    // 1. 일일 위생 점검 통계
    const dailyHygieneChecks = await getDailyHygieneStats(adminClient, companyId, startDate, endDate, totalDays);

    // 2. CCP 모니터링 통계
    const ccpMonitoring = await getCCPMonitoringStats(adminClient, companyId, startDate, endDate);

    // 3. 개선조치 통계
    const correctiveActions = await getCorrectiveActionStats(adminClient, companyId, startDate, endDate);

    // 4. 입고 검사 통계
    const materialInspections = await getMaterialInspectionStats(adminClient, companyId, startDate, endDate);

    // 5. 생산 기록 통계
    const productionRecords = await getProductionStats(adminClient, companyId, startDate, endDate);

    // 6. CCP 검증 통계
    const ccpVerifications = await getCCPVerificationStats(adminClient, companyId, startDate, endDate);

    // 7. 교육 기록 통계
    const trainingRecords = await getTrainingStats(adminClient, companyId, startDate, endDate);

    const report: AuditReportSummary = {
      period: {
        startDate,
        endDate,
        totalDays,
      },
      dailyHygieneChecks,
      ccpMonitoring,
      correctiveActions,
      materialInspections,
      productionRecords,
      ccpVerifications,
      trainingRecords,
    };

    return NextResponse.json(report);
  } catch (error) {
    console.error('Audit report error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getDailyHygieneStats(
  adminClient: any,
  companyId: string,
  startDate: string,
  endDate: string,
  totalDays: number
) {
  const { data: checks } = await adminClient
    .from('haccp_check_status')
    .select('check_date, status')
    .eq('company_id', companyId)
    .eq('check_type', 'DAILY_HYGIENE')
    .gte('check_date', startDate)
    .lte('check_date', endDate);

  const completed = (checks || []).filter((c: { status: string }) => c.status === 'COMPLETED').length;
  const totalRequired = totalDays * 3; // 3 shifts per day
  const missedDates = (checks || [])
    .filter((c: { status: string }) => c.status !== 'COMPLETED')
    .map((c: { check_date: string }) => c.check_date);

  return {
    totalRequired,
    totalCompleted: completed,
    completionRate: totalRequired > 0 ? (completed / totalRequired) * 100 : 0,
    missedDates: [...new Set(missedDates)],
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getCCPMonitoringStats(adminClient: any, companyId: string, startDate: string, endDate: string) {
  const { data: records } = await adminClient
    .from('ccp_records')
    .select('*, ccp:ccp_definitions(process, critical_limit)')
    .eq('company_id', companyId)
    .gte('record_date', startDate)
    .lte('record_date', endDate);

  const total = (records || []).length;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const passed = (records || []).filter((r: any) => r.measurement?.result === 'PASS').length;
  const failed = total - passed;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const failureDetails = (records || [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((r: any) => r.measurement?.result !== 'PASS')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((r: any) => ({
      date: r.record_date,
      ccpName: r.ccp?.process || 'Unknown',
      value: r.measurement?.value || 0,
      limit: r.ccp?.critical_limit
        ? `${r.ccp.critical_limit.min || ''}~${r.ccp.critical_limit.max || ''}${r.ccp.critical_limit.unit || ''}`
        : '',
    }));

  return {
    totalRecords: total,
    passCount: passed,
    failCount: failed,
    passRate: total > 0 ? (passed / total) * 100 : 0,
    failureDetails,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getCorrectiveActionStats(adminClient: any, companyId: string, startDate: string, endDate: string) {
  const { data: actions } = await adminClient
    .from('corrective_actions')
    .select('*')
    .eq('company_id', companyId)
    .gte('issue_date', startDate)
    .lte('issue_date', endDate);

  const total = (actions || []).length;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const closed = (actions || []).filter((a: any) => a.status === 'CLOSED').length;
  const open = total - closed;

  // 평균 종결 시간 계산
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const closedActions = (actions || []).filter((a: any) => a.closed_at);
  const avgClosureTime = closedActions.length > 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? closedActions.reduce((sum: number, a: any) => {
        const issueDate = new Date(a.issue_date);
        const closedDate = new Date(a.closed_at);
        return sum + differenceInDays(closedDate, issueDate);
      }, 0) / closedActions.length
    : 0;

  // 상태별 집계
  const byStatus: Record<string, number> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const action of actions || []) {
    byStatus[action.status] = (byStatus[action.status] || 0) + 1;
  }

  return {
    total,
    closed,
    open,
    averageClosureTime: Math.round(avgClosureTime * 10) / 10,
    byStatus,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getMaterialInspectionStats(adminClient: any, companyId: string, startDate: string, endDate: string) {
  const { data: inspections } = await adminClient
    .from('material_inspections')
    .select('result')
    .eq('company_id', companyId)
    .gte('inspection_date', startDate)
    .lte('inspection_date', endDate);

  const total = (inspections || []).length;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const passed = (inspections || []).filter((i: any) => i.result === 'PASS').length;
  const rejected = total - passed;

  return {
    total,
    passed,
    rejected,
    rejectionRate: total > 0 ? (rejected / total) * 100 : 0,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getProductionStats(adminClient: any, companyId: string, startDate: string, endDate: string) {
  const { data: records } = await adminClient
    .from('production_records')
    .select('quantity, quality')
    .eq('company_id', companyId)
    .gte('production_date', startDate)
    .lte('production_date', endDate);

  const totalBatches = (records || []).length;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalQuantity = (records || []).reduce((sum: number, r: any) => sum + (r.quantity || 0), 0);
  const defectRates = (records || [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((r: any) => r.quality?.defect_rate)
    .filter((r: number | undefined | null) => r !== undefined && r !== null);

  const avgDefectRate = defectRates.length > 0
    ? defectRates.reduce((a: number, b: number) => a + b, 0) / defectRates.length
    : 0;

  return {
    totalBatches,
    totalQuantity,
    averageDefectRate: Math.round(avgDefectRate * 100) / 100,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getCCPVerificationStats(adminClient: any, companyId: string, startDate: string, endDate: string) {
  // CCP 정의 수 조회
  const { data: ccpDefs } = await adminClient
    .from('ccp_definitions')
    .select('id')
    .eq('company_id', companyId)
    .eq('is_active', true);

  // 검증 기록 조회
  const { data: verifications } = await adminClient
    .from('ccp_verifications')
    .select('ccp_id')
    .eq('company_id', companyId)
    .gte('verification_date', startDate)
    .lte('verification_date', endDate);

  const totalRequired = (ccpDefs || []).length;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const completedCCPIds = new Set((verifications || []).map((v: any) => v.ccp_id));
  const completed = completedCCPIds.size;

  return {
    totalRequired,
    completed,
    completionRate: totalRequired > 0 ? (completed / totalRequired) * 100 : 0,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getTrainingStats(adminClient: any, companyId: string, startDate: string, endDate: string) {
  const { data: trainings } = await adminClient
    .from('trainings')
    .select('title, attendee_count')
    .eq('company_id', companyId)
    .gte('training_date', startDate)
    .lte('training_date', endDate);

  const totalSessions = (trainings || []).length;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalAttendees = (trainings || []).reduce((sum: number, t: any) => sum + (t.attendee_count || 0), 0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const topics = [...new Set((trainings || []).map((t: any) => t.title))];

  return {
    totalSessions,
    totalAttendees,
    topics,
  };
}
