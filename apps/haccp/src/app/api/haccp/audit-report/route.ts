/**
 * HACCP 심사 준비 리포트 API
 * GET /api/haccp/audit-report - 심사용 종합 리포트 생성
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { parseISO, differenceInDays } from 'date-fns';

let _supabaseClient: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!_supabaseClient) {
    _supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
  }
  return _supabaseClient;
}

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
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await getSupabase().auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await getSupabase()
      .from('users')
      .select('company_id, role')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 권한 확인
    if (!['COMPANY_ADMIN', 'HACCP_MANAGER', 'ADMIN'].includes(userData.role)) {
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

    const companyId = userData.company_id;
    const totalDays = differenceInDays(parseISO(endDate), parseISO(startDate)) + 1;

    // 1. 일일 위생 점검 통계
    const dailyHygieneChecks = await getDailyHygieneStats(companyId, startDate, endDate, totalDays);

    // 2. CCP 모니터링 통계
    const ccpMonitoring = await getCCPMonitoringStats(companyId, startDate, endDate);

    // 3. 개선조치 통계
    const correctiveActions = await getCorrectiveActionStats(companyId, startDate, endDate);

    // 4. 입고 검사 통계
    const materialInspections = await getMaterialInspectionStats(companyId, startDate, endDate);

    // 5. 생산 기록 통계
    const productionRecords = await getProductionStats(companyId, startDate, endDate);

    // 6. CCP 검증 통계
    const ccpVerifications = await getCCPVerificationStats(companyId, startDate, endDate);

    // 7. 교육 기록 통계
    const trainingRecords = await getTrainingStats(companyId, startDate, endDate);

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

async function getDailyHygieneStats(
  companyId: string,
  startDate: string,
  endDate: string,
  totalDays: number
) {
  const { data: checks } = await getSupabase()
    .from('haccp_check_status')
    .select('check_date, status')
    .eq('company_id', companyId)
    .eq('check_type', 'DAILY_HYGIENE')
    .gte('check_date', startDate)
    .lte('check_date', endDate);

  const completed = (checks || []).filter(c => c.status === 'COMPLETED').length;
  const totalRequired = totalDays * 3; // 3 shifts per day
  const missedDates = (checks || [])
    .filter(c => c.status !== 'COMPLETED')
    .map(c => c.check_date);

  return {
    totalRequired,
    totalCompleted: completed,
    completionRate: totalRequired > 0 ? (completed / totalRequired) * 100 : 0,
    missedDates: [...new Set(missedDates)],
  };
}

async function getCCPMonitoringStats(companyId: string, startDate: string, endDate: string) {
  const { data: records } = await getSupabase()
    .from('ccp_records')
    .select('*, ccp:ccp_definitions(process, critical_limit)')
    .eq('company_id', companyId)
    .gte('record_date', startDate)
    .lte('record_date', endDate);

  const total = (records || []).length;
  const passed = (records || []).filter(r => r.measurement?.result === 'PASS').length;
  const failed = total - passed;

  const failureDetails = (records || [])
    .filter(r => r.measurement?.result !== 'PASS')
    .map(r => ({
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

async function getCorrectiveActionStats(companyId: string, startDate: string, endDate: string) {
  const { data: actions } = await getSupabase()
    .from('corrective_actions')
    .select('*')
    .eq('company_id', companyId)
    .gte('issue_date', startDate)
    .lte('issue_date', endDate);

  const total = (actions || []).length;
  const closed = (actions || []).filter(a => a.status === 'CLOSED').length;
  const open = total - closed;

  // 평균 종결 시간 계산
  const closedActions = (actions || []).filter(a => a.closed_at);
  const avgClosureTime = closedActions.length > 0
    ? closedActions.reduce((sum, a) => {
        const issueDate = new Date(a.issue_date);
        const closedDate = new Date(a.closed_at);
        return sum + differenceInDays(closedDate, issueDate);
      }, 0) / closedActions.length
    : 0;

  // 상태별 집계
  const byStatus: Record<string, number> = {};
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

async function getMaterialInspectionStats(companyId: string, startDate: string, endDate: string) {
  const { data: inspections } = await getSupabase()
    .from('material_inspections')
    .select('result')
    .eq('company_id', companyId)
    .gte('inspection_date', startDate)
    .lte('inspection_date', endDate);

  const total = (inspections || []).length;
  const passed = (inspections || []).filter(i => i.result === 'PASS').length;
  const rejected = total - passed;

  return {
    total,
    passed,
    rejected,
    rejectionRate: total > 0 ? (rejected / total) * 100 : 0,
  };
}

async function getProductionStats(companyId: string, startDate: string, endDate: string) {
  const { data: records } = await getSupabase()
    .from('production_records')
    .select('quantity, quality')
    .eq('company_id', companyId)
    .gte('production_date', startDate)
    .lte('production_date', endDate);

  const totalBatches = (records || []).length;
  const totalQuantity = (records || []).reduce((sum, r) => sum + (r.quantity || 0), 0);
  const defectRates = (records || [])
    .map(r => r.quality?.defect_rate)
    .filter(r => r !== undefined && r !== null);

  const avgDefectRate = defectRates.length > 0
    ? defectRates.reduce((a, b) => a + b, 0) / defectRates.length
    : 0;

  return {
    totalBatches,
    totalQuantity,
    averageDefectRate: Math.round(avgDefectRate * 100) / 100,
  };
}

async function getCCPVerificationStats(companyId: string, startDate: string, endDate: string) {
  // CCP 정의 수 조회
  const { data: ccpDefs } = await getSupabase()
    .from('ccp_definitions')
    .select('id')
    .eq('company_id', companyId)
    .eq('is_active', true);

  // 검증 기록 조회
  const { data: verifications } = await getSupabase()
    .from('ccp_verifications')
    .select('ccp_id')
    .eq('company_id', companyId)
    .gte('verification_date', startDate)
    .lte('verification_date', endDate);

  const totalRequired = (ccpDefs || []).length;
  const completedCCPIds = new Set((verifications || []).map(v => v.ccp_id));
  const completed = completedCCPIds.size;

  return {
    totalRequired,
    completed,
    completionRate: totalRequired > 0 ? (completed / totalRequired) * 100 : 0,
  };
}

async function getTrainingStats(companyId: string, startDate: string, endDate: string) {
  const { data: trainings } = await getSupabase()
    .from('trainings')
    .select('title, attendee_count')
    .eq('company_id', companyId)
    .gte('training_date', startDate)
    .lte('training_date', endDate);

  const totalSessions = (trainings || []).length;
  const totalAttendees = (trainings || []).reduce((sum, t) => sum + (t.attendee_count || 0), 0);
  const topics = [...new Set((trainings || []).map(t => t.title))];

  return {
    totalSessions,
    totalAttendees,
    topics,
  };
}
