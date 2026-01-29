/**
 * Cron: Weekly Report
 * 매주 월요일 오전 9시 실행 - 주간 리포트 이메일 발송
 * Schedule: 0 9 * * 1 (매주 월요일 오전 9시)
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
  console.log('[Cron] Starting weekly report generation...');

  try {
    const results = {
      companiesProcessed: 0,
      emailsSent: 0,
      errors: 0,
    };

    // 지난 주 날짜 계산
    const now = new Date();
    const lastWeekStart = new Date(now);
    lastWeekStart.setDate(now.getDate() - 7);
    lastWeekStart.setHours(0, 0, 0, 0);

    const lastWeekEnd = new Date(now);
    lastWeekEnd.setDate(now.getDate() - 1);
    lastWeekEnd.setHours(23, 59, 59, 999);

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
        )
      `)
      .eq('status', 'ACTIVE');

    if (subError) throw subError;

    for (const sub of subscriptions || []) {
      try {
        // Supabase returns relations as arrays, get first element
        const companyData = sub.company as unknown as Array<{ id: string; name: string; business_number: string }> | null;
        const company = companyData?.[0] || null;
        if (!company) continue;

        // 회사 관리자 조회
        const { data: admins } = await supabase
          .from('users')
          .select('id, email, name')
          .eq('company_id', company.id)
          .in('role', ['COMPANY_ADMIN', 'company_admin'])
          .eq('status', 'ACTIVE');

        if (!admins || admins.length === 0) continue;

        // 주간 통계 수집
        const stats = await collectWeeklyStats(
          supabase,
          company.id,
          lastWeekStart.toISOString(),
          lastWeekEnd.toISOString()
        );

        // 이메일 발송
        for (const admin of admins) {
          if (!admin.email) continue;

          try {
            const emailHtml = generateWeeklyReportEmail(
              company.name,
              admin.name || '관리자',
              stats,
              lastWeekStart,
              lastWeekEnd
            );

            await resend.emails.send({
              from: process.env.EMAIL_FROM || 'ABCDC System <noreply@abcdc.com>',
              to: admin.email,
              subject: `[${company.name}] 주간 리포트 (${formatDate(lastWeekStart)} ~ ${formatDate(lastWeekEnd)})`,
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
            title: '주간 리포트 발송 완료',
            body: `${formatDate(lastWeekStart)} ~ ${formatDate(lastWeekEnd)} 주간 리포트가 이메일로 발송되었습니다.`,
            deep_link: '/reports/weekly',
          });
        }

        results.companiesProcessed++;
      } catch (companyError) {
        console.error(`Error processing company ${sub.company_id}:`, companyError);
        results.errors++;
      }
    }

    console.log('[Cron] Weekly report completed:', results);

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error('[Cron] Error in weekly report:', error);
    return NextResponse.json(
      { error: 'Failed to generate weekly reports' },
      { status: 500 }
    );
  }
}

// 주간 통계 수집
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function collectWeeklyStats(
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

  // 근태 통계
  const { data: attendanceData } = await supabase
    .from('attendance_records')
    .select('status')
    .eq('company_id', companyId)
    .gte('date', startDate.split('T')[0])
    .lte('date', endDate.split('T')[0]);

  type AttendanceRecord = { status?: string };
  const attendanceStats = {
    total: attendanceData?.length || 0,
    present: attendanceData?.filter((a: AttendanceRecord) => a.status === 'PRESENT').length || 0,
    late: attendanceData?.filter((a: AttendanceRecord) => a.status === 'LATE').length || 0,
    absent: attendanceData?.filter((a: AttendanceRecord) => a.status === 'ABSENT').length || 0,
  };

  // 급여 통계
  const { data: payrollData } = await supabase
    .from('payroll_records')
    .select('total_amount, status')
    .eq('company_id', companyId)
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  type PayrollRecord = { total_amount?: number; status?: string };
  const payrollStats = {
    totalAmount: payrollData?.reduce((sum: number, p: PayrollRecord) => sum + (p.total_amount || 0), 0) || 0,
    recordCount: payrollData?.length || 0,
    pendingCount: payrollData?.filter((p: PayrollRecord) => p.status === 'PENDING').length || 0,
  };

  // 결재 통계
  const { data: approvalData } = await supabase
    .from('approval_requests')
    .select('status')
    .eq('company_id', companyId)
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  type ApprovalRecord = { status?: string };
  const approvalStats = {
    total: approvalData?.length || 0,
    approved: approvalData?.filter((a: ApprovalRecord) => a.status === 'APPROVED').length || 0,
    rejected: approvalData?.filter((a: ApprovalRecord) => a.status === 'REJECTED').length || 0,
    pending: approvalData?.filter((a: ApprovalRecord) => a.status === 'PENDING').length || 0,
  };

  return {
    employees: {
      total: totalEmployees || 0,
      new: newEmployees || 0,
    },
    attendance: attendanceStats,
    payroll: payrollStats,
    approvals: approvalStats,
  };
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
function generateWeeklyReportEmail(
  companyName: string,
  adminName: string,
  stats: Awaited<ReturnType<typeof collectWeeklyStats>>,
  startDate: Date,
  endDate: Date
): string {
  const attendanceRate = stats.attendance.total > 0
    ? ((stats.attendance.present / stats.attendance.total) * 100).toFixed(1)
    : '0';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>주간 리포트</title>
  <style>
    body { font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; }
    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
    .stat-card { background: white; border-radius: 8px; padding: 20px; margin: 10px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .stat-title { font-size: 14px; color: #6b7280; margin-bottom: 8px; }
    .stat-value { font-size: 28px; font-weight: bold; color: #1f2937; }
    .stat-subtitle { font-size: 12px; color: #9ca3af; }
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
    .footer { background: #1f2937; color: #9ca3af; padding: 20px; text-align: center; font-size: 12px; border-radius: 0 0 10px 10px; }
    .highlight { color: #667eea; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 24px;">📊 주간 리포트</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">${formatDate(startDate)} ~ ${formatDate(endDate)}</p>
    </div>

    <div class="content">
      <p>안녕하세요, <strong>${adminName}</strong>님!</p>
      <p><strong>${companyName}</strong>의 지난 주 운영 현황을 알려드립니다.</p>

      <h3 style="margin-top: 30px; color: #374151;">👥 직원 현황</h3>
      <div class="grid">
        <div class="stat-card">
          <div class="stat-title">총 직원 수</div>
          <div class="stat-value">${stats.employees.total}<span style="font-size: 16px; color: #6b7280;">명</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-title">신규 입사</div>
          <div class="stat-value highlight">+${stats.employees.new}<span style="font-size: 16px; color: #6b7280;">명</span></div>
        </div>
      </div>

      <h3 style="margin-top: 30px; color: #374151;">📅 근태 현황</h3>
      <div class="stat-card">
        <div class="stat-title">출근율</div>
        <div class="stat-value">${attendanceRate}<span style="font-size: 16px; color: #6b7280;">%</span></div>
        <div class="stat-subtitle">정상출근 ${stats.attendance.present}건 / 지각 ${stats.attendance.late}건 / 결근 ${stats.attendance.absent}건</div>
      </div>

      <h3 style="margin-top: 30px; color: #374151;">💰 급여 현황</h3>
      <div class="stat-card">
        <div class="stat-title">총 급여 지급액</div>
        <div class="stat-value">${formatCurrency(stats.payroll.totalAmount)}</div>
        <div class="stat-subtitle">처리 ${stats.payroll.recordCount}건 / 대기 ${stats.payroll.pendingCount}건</div>
      </div>

      <h3 style="margin-top: 30px; color: #374151;">📝 결재 현황</h3>
      <div class="grid">
        <div class="stat-card">
          <div class="stat-title">총 결재 요청</div>
          <div class="stat-value">${stats.approvals.total}<span style="font-size: 16px; color: #6b7280;">건</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-title">승인 / 반려 / 대기</div>
          <div class="stat-value" style="font-size: 20px;">
            <span style="color: #10b981;">${stats.approvals.approved}</span> /
            <span style="color: #ef4444;">${stats.approvals.rejected}</span> /
            <span style="color: #f59e0b;">${stats.approvals.pending}</span>
          </div>
        </div>
      </div>

      <div style="margin-top: 30px; padding: 20px; background: #eff6ff; border-radius: 8px; border-left: 4px solid #3b82f6;">
        <p style="margin: 0; color: #1e40af;">💡 <strong>Tip:</strong> 더 자세한 분석은 플랫폼의 리포트 메뉴에서 확인하실 수 있습니다.</p>
      </div>
    </div>

    <div class="footer">
      <p>ABCDC System - 스마트 인사관리 플랫폼</p>
      <p style="margin: 5px 0 0 0;">이 이메일은 자동 발송되었습니다.</p>
    </div>
  </div>
</body>
</html>
  `;
}

export const dynamic = 'force-dynamic';
