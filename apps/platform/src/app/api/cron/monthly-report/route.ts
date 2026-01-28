/**
 * Cron: Monthly Report
 * 매월 1일 오전 9시 실행 - 월간 리포트 이메일 발송
 * Schedule: 0 9 1 * * (매월 1일 오전 9시)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
}

function getResendClient() {
  return new Resend(process.env.RESEND_API_KEY);
}

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseClient();
  const resend = getResendClient();
  console.log('[Cron] Starting monthly report generation...');

  try {
    const results = {
      companiesProcessed: 0,
      emailsSent: 0,
      errors: 0,
    };

    // 지난 달 날짜 계산
    const now = new Date();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    // 활성 구독이 있는 회사 조회
    const { data: subscriptions, error: subError } = await supabase
      .from('company_subscriptions')
      .select(`
        id,
        company_id,
        company:companies (
          id,
          name,
          business_number
        ),
        plan:subscription_plans (
          name
        )
      `)
      .eq('status', 'ACTIVE');

    if (subError) throw subError;

    for (const sub of subscriptions || []) {
      try {
        // Supabase returns relations as arrays, get first element
        const companyData = sub.company as unknown as Array<{ id: string; name: string; business_number: string }> | null;
        const planData = sub.plan as unknown as Array<{ name: string }> | null;
        const company = companyData?.[0] || null;
        const plan = planData?.[0] || null;
        if (!company) continue;

        // 회사 관리자 조회
        const { data: admins } = await supabase
          .from('users')
          .select('id, email, name')
          .eq('company_id', company.id)
          .in('role', ['COMPANY_ADMIN', 'company_admin'])
          .eq('status', 'ACTIVE');

        if (!admins || admins.length === 0) continue;

        // 월간 통계 수집
        const stats = await collectMonthlyStats(
          supabase,
          company.id,
          lastMonthStart.toISOString(),
          lastMonthEnd.toISOString()
        );

        // 이메일 발송
        for (const admin of admins) {
          if (!admin.email) continue;

          try {
            const emailHtml = generateMonthlyReportEmail(
              company.name,
              admin.name || '관리자',
              plan?.name || 'FREE',
              stats,
              lastMonthStart,
              lastMonthEnd
            );

            await resend.emails.send({
              from: process.env.EMAIL_FROM || 'ABCDC System <noreply@abcdc.com>',
              to: admin.email,
              subject: `[${company.name}] ${getMonthName(lastMonthStart)} 월간 리포트`,
              html: emailHtml,
            });

            results.emailsSent++;
          } catch (emailError) {
            console.error(`Failed to send email to ${admin.email}:`, emailError);
            results.errors++;
          }
        }

        // 알림 생성
        for (const admin of admins) {
          await supabase.from('notifications').insert({
            user_id: admin.id,
            category: 'REPORT',
            priority: 'NORMAL',
            title: '월간 리포트 발송 완료',
            body: `${getMonthName(lastMonthStart)} 월간 리포트가 이메일로 발송되었습니다.`,
            deep_link: '/reports/monthly',
          });
        }

        results.companiesProcessed++;
      } catch (companyError) {
        console.error(`Error processing company ${sub.company_id}:`, companyError);
        results.errors++;
      }
    }

    console.log('[Cron] Monthly report completed:', results);

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error('[Cron] Error in monthly report:', error);
    return NextResponse.json(
      { error: 'Failed to generate monthly reports' },
      { status: 500 }
    );
  }
}

// 월간 통계 수집
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function collectMonthlyStats(
  supabase: any,
  companyId: string,
  startDate: string,
  endDate: string
) {
  // 직원 통계
  const { count: totalEmployees } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('status', 'ACTIVE');

  const { count: newEmployees } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  const { count: resignedEmployees } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('status', 'RESIGNED')
    .gte('updated_at', startDate)
    .lte('updated_at', endDate);

  // 근태 통계
  const { data: attendanceData } = await supabase
    .from('attendance_records')
    .select('status, overtime_minutes')
    .eq('company_id', companyId)
    .gte('date', startDate.split('T')[0])
    .lte('date', endDate.split('T')[0]);

  type AttendanceRecord = { status?: string; overtime_minutes?: number };
  const totalOvertimeMinutes = attendanceData?.reduce((sum: number, a: AttendanceRecord) => sum + (a.overtime_minutes || 0), 0) || 0;
  const attendanceStats = {
    total: attendanceData?.length || 0,
    present: attendanceData?.filter((a: AttendanceRecord) => a.status === 'PRESENT').length || 0,
    late: attendanceData?.filter((a: AttendanceRecord) => a.status === 'LATE').length || 0,
    absent: attendanceData?.filter((a: AttendanceRecord) => a.status === 'ABSENT').length || 0,
    overtimeHours: Math.round(totalOvertimeMinutes / 60),
  };

  // 급여 통계
  const { data: payrollData } = await supabase
    .from('payroll_records')
    .select('total_amount, net_amount, tax_amount, status')
    .eq('company_id', companyId)
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  type PayrollRecord = { total_amount?: number; net_amount?: number; tax_amount?: number; status?: string };
  const payrollStats = {
    totalGross: payrollData?.reduce((sum: number, p: PayrollRecord) => sum + (p.total_amount || 0), 0) || 0,
    totalNet: payrollData?.reduce((sum: number, p: PayrollRecord) => sum + (p.net_amount || 0), 0) || 0,
    totalTax: payrollData?.reduce((sum: number, p: PayrollRecord) => sum + (p.tax_amount || 0), 0) || 0,
    recordCount: payrollData?.length || 0,
    completedCount: payrollData?.filter((p: PayrollRecord) => p.status === 'COMPLETED' || p.status === 'PAID').length || 0,
  };

  // 휴가 통계
  const { data: leaveData } = await supabase
    .from('leave_requests')
    .select('leave_type, status, duration_days')
    .eq('company_id', companyId)
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  type LeaveRecord = { leave_type?: string; status?: string; duration_days?: number };
  const leaveStats = {
    total: leaveData?.length || 0,
    approved: leaveData?.filter((l: LeaveRecord) => l.status === 'APPROVED').length || 0,
    totalDays: leaveData?.filter((l: LeaveRecord) => l.status === 'APPROVED')
      .reduce((sum: number, l: LeaveRecord) => sum + (l.duration_days || 0), 0) || 0,
    byType: {} as Record<string, number>,
  };

  // 휴가 유형별 집계
  leaveData?.filter((l: LeaveRecord) => l.status === 'APPROVED').forEach((l: LeaveRecord) => {
    const type = l.leave_type || 'OTHER';
    leaveStats.byType[type] = (leaveStats.byType[type] || 0) + 1;
  });

  // 결재 통계
  const { data: approvalData } = await supabase
    .from('approval_requests')
    .select('status, approval_type')
    .eq('company_id', companyId)
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  type ApprovalRecord = { status?: string; approval_type?: string };
  const approvalStats = {
    total: approvalData?.length || 0,
    approved: approvalData?.filter((a: ApprovalRecord) => a.status === 'APPROVED').length || 0,
    rejected: approvalData?.filter((a: ApprovalRecord) => a.status === 'REJECTED').length || 0,
    pending: approvalData?.filter((a: ApprovalRecord) => a.status === 'PENDING').length || 0,
  };

  // 계약서 통계
  const { data: contractData } = await supabase
    .from('contracts')
    .select('status')
    .eq('company_id', companyId)
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  type ContractRecord = { status?: string };
  const contractStats = {
    total: contractData?.length || 0,
    signed: contractData?.filter((c: ContractRecord) => c.status === 'SIGNED').length || 0,
    pending: contractData?.filter((c: ContractRecord) => c.status === 'PENDING').length || 0,
  };

  return {
    employees: {
      total: totalEmployees || 0,
      new: newEmployees || 0,
      resigned: resignedEmployees || 0,
    },
    attendance: attendanceStats,
    payroll: payrollStats,
    leave: leaveStats,
    approvals: approvalStats,
    contracts: contractStats,
  };
}

// 월 이름 가져오기
function getMonthName(date: Date): string {
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' });
}

// 날짜 포맷
function formatDate(date: Date): string {
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

// 금액 포맷
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
  }).format(amount);
}

// 이메일 HTML 생성
function generateMonthlyReportEmail(
  companyName: string,
  adminName: string,
  planName: string,
  stats: Awaited<ReturnType<typeof collectMonthlyStats>>,
  startDate: Date,
  endDate: Date
): string {
  const attendanceRate = stats.attendance.total > 0
    ? ((stats.attendance.present / stats.attendance.total) * 100).toFixed(1)
    : '0';

  const leaveTypeLabels: Record<string, string> = {
    'ANNUAL': '연차',
    'SICK': '병가',
    'PERSONAL': '경조사',
    'MATERNITY': '출산휴가',
    'PATERNITY': '육아휴직',
    'OTHER': '기타',
  };

  const leaveTypeHtml = Object.entries(stats.leave.byType)
    .map(([type, count]) => `<span style="margin-right: 15px;">${leaveTypeLabels[type] || type}: ${count}건</span>`)
    .join('') || '없음';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>월간 리포트</title>
  <style>
    body { font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 650px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: white; padding: 40px 30px; border-radius: 10px 10px 0 0; }
    .badge { display: inline-block; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 12px; margin-top: 10px; }
    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
    .section { margin-bottom: 30px; }
    .section-title { font-size: 18px; font-weight: bold; color: #1f2937; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #e5e7eb; }
    .stat-card { background: white; border-radius: 8px; padding: 20px; margin: 10px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .stat-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
    .stat-row:last-child { border-bottom: none; }
    .stat-label { color: #6b7280; }
    .stat-value { font-weight: bold; color: #1f2937; }
    .highlight-card { background: linear-gradient(135deg, #dbeafe 0%, #ede9fe 100%); border-radius: 8px; padding: 25px; margin: 15px 0; }
    .highlight-value { font-size: 36px; font-weight: bold; color: #1e40af; }
    .highlight-label { color: #4b5563; margin-top: 5px; }
    .grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
    .mini-stat { background: white; border-radius: 8px; padding: 15px; text-align: center; }
    .mini-value { font-size: 24px; font-weight: bold; color: #1f2937; }
    .mini-label { font-size: 12px; color: #6b7280; margin-top: 5px; }
    .positive { color: #10b981; }
    .negative { color: #ef4444; }
    .warning { color: #f59e0b; }
    .footer { background: #1f2937; color: #9ca3af; padding: 25px; text-align: center; font-size: 12px; border-radius: 0 0 10px 10px; }
    .summary-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px 20px; border-radius: 0 8px 8px 0; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 28px;">📈 월간 운영 리포트</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 16px;">${getMonthName(startDate)}</p>
      <span class="badge">${planName} 플랜</span>
    </div>

    <div class="content">
      <p style="font-size: 16px;">안녕하세요, <strong>${adminName}</strong>님!</p>
      <p><strong>${companyName}</strong>의 ${getMonthName(startDate)} 운영 현황을 종합 정리해드립니다.</p>

      <!-- 인원 현황 -->
      <div class="section">
        <div class="section-title">👥 인원 현황</div>
        <div class="highlight-card">
          <div class="highlight-value">${stats.employees.total}명</div>
          <div class="highlight-label">현재 재직 중인 직원</div>
        </div>
        <div class="grid-2">
          <div class="mini-stat">
            <div class="mini-value positive">+${stats.employees.new}</div>
            <div class="mini-label">신규 입사</div>
          </div>
          <div class="mini-stat">
            <div class="mini-value negative">-${stats.employees.resigned}</div>
            <div class="mini-label">퇴사</div>
          </div>
        </div>
      </div>

      <!-- 근태 현황 -->
      <div class="section">
        <div class="section-title">📅 근태 현황</div>
        <div class="stat-card">
          <div class="stat-row">
            <span class="stat-label">총 출근 기록</span>
            <span class="stat-value">${stats.attendance.total}건</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">출근율</span>
            <span class="stat-value">${attendanceRate}%</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">정상 출근</span>
            <span class="stat-value positive">${stats.attendance.present}건</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">지각</span>
            <span class="stat-value warning">${stats.attendance.late}건</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">결근</span>
            <span class="stat-value negative">${stats.attendance.absent}건</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">총 초과근무</span>
            <span class="stat-value">${stats.attendance.overtimeHours}시간</span>
          </div>
        </div>
      </div>

      <!-- 급여 현황 -->
      <div class="section">
        <div class="section-title">💰 급여 현황</div>
        <div class="highlight-card">
          <div class="highlight-value">${formatCurrency(stats.payroll.totalGross)}</div>
          <div class="highlight-label">총 급여 지급액</div>
        </div>
        <div class="stat-card">
          <div class="stat-row">
            <span class="stat-label">실지급액 합계</span>
            <span class="stat-value">${formatCurrency(stats.payroll.totalNet)}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">원천징수 세금</span>
            <span class="stat-value">${formatCurrency(stats.payroll.totalTax)}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">급여 처리 건수</span>
            <span class="stat-value">${stats.payroll.completedCount} / ${stats.payroll.recordCount}건</span>
          </div>
        </div>
      </div>

      <!-- 휴가 현황 -->
      <div class="section">
        <div class="section-title">🏖️ 휴가 현황</div>
        <div class="stat-card">
          <div class="stat-row">
            <span class="stat-label">휴가 신청</span>
            <span class="stat-value">${stats.leave.total}건</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">승인된 휴가</span>
            <span class="stat-value positive">${stats.leave.approved}건</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">사용된 휴가 일수</span>
            <span class="stat-value">${stats.leave.totalDays}일</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">휴가 유형별</span>
            <span class="stat-value" style="font-size: 12px;">${leaveTypeHtml}</span>
          </div>
        </div>
      </div>

      <!-- 결재/계약 현황 -->
      <div class="section">
        <div class="section-title">📝 결재 및 계약</div>
        <div class="grid-2">
          <div class="stat-card">
            <div style="font-weight: bold; margin-bottom: 10px;">결재 요청</div>
            <div class="stat-row">
              <span class="stat-label">총 요청</span>
              <span class="stat-value">${stats.approvals.total}건</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">승인</span>
              <span class="stat-value positive">${stats.approvals.approved}건</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">반려</span>
              <span class="stat-value negative">${stats.approvals.rejected}건</span>
            </div>
          </div>
          <div class="stat-card">
            <div style="font-weight: bold; margin-bottom: 10px;">계약서</div>
            <div class="stat-row">
              <span class="stat-label">생성</span>
              <span class="stat-value">${stats.contracts.total}건</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">서명 완료</span>
              <span class="stat-value positive">${stats.contracts.signed}건</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">대기 중</span>
              <span class="stat-value warning">${stats.contracts.pending}건</span>
            </div>
          </div>
        </div>
      </div>

      <div class="summary-box">
        <strong>📊 요약</strong>
        <p style="margin: 10px 0 0 0;">
          이번 달 ${companyName}은 ${stats.employees.total}명의 직원과 함께 ${attendanceRate}%의 출근율을 기록했습니다.
          총 ${formatCurrency(stats.payroll.totalGross)}의 급여가 지급되었으며, ${stats.leave.totalDays}일의 휴가가 사용되었습니다.
        </p>
      </div>

      <div style="margin-top: 30px; padding: 20px; background: #eff6ff; border-radius: 8px; text-align: center;">
        <p style="margin: 0; color: #1e40af;">더 자세한 분석은 <strong>ABCDC Platform</strong>에서 확인하세요</p>
      </div>
    </div>

    <div class="footer">
      <p style="font-size: 14px; color: white; margin: 0;">ABCDC System</p>
      <p style="margin: 5px 0;">스마트 인사관리 플랫폼</p>
      <p style="margin: 15px 0 0 0; font-size: 11px;">
        ${formatDate(startDate)} ~ ${formatDate(endDate)} 기간 데이터 기준<br>
        이 이메일은 자동 발송되었습니다.
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

export const dynamic = 'force-dynamic';
