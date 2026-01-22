/**
 * 급여명세서 PDF 생성 API
 * GET /api/salaries/[id]/pdf
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { PDFGenerator } from '@abc/shared/server';

// Helper: 급여 접근 권한 체크
async function checkSalaryAccess(
  adminClient: ReturnType<typeof createAdminClient>,
  requesterId: string,
  salaryId: string
) {
  // 1. 요청자 정보 조회
  const { data: requester, error: requesterError } = await adminClient
    .from('users')
    .select('id, role, company_id, store_id')
    .eq('auth_id', requesterId)
    .single();

  if (requesterError || !requester) {
    return { error: 'Requester not found', status: 404 };
  }

  // 2. 급여 정보 조회
  const { data: salary, error: salaryError } = await adminClient
    .from('salaries')
    .select('id, staff_id, company_id, store_id')
    .eq('id', salaryId)
    .single();

  if (salaryError || !salary) {
    return { error: '급여 정보를 찾을 수 없습니다.', status: 404 };
  }

  // 3. 회사/매장 격리 체크
  if (requester.role === 'super_admin') {
    return { requester, salary };
  }

  // 본인 급여는 항상 조회 가능
  if (requester.id === salary.staff_id) {
    return { requester, salary };
  }

  if (requester.role === 'store_manager') {
    if (salary.store_id !== requester.store_id) {
      return { error: '자신의 매장 급여만 접근 가능합니다.', status: 403 };
    }
  } else if (['company_admin', 'manager'].includes(requester.role)) {
    if (salary.company_id !== requester.company_id) {
      return { error: '자신의 회사 급여만 접근 가능합니다.', status: 403 };
    }
  } else {
    return { error: '접근 권한이 없습니다.', status: 403 };
  }

  return { requester, salary };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const salaryId = id;

    // 인증 체크
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 권한 체크
    const accessCheck = await checkSalaryAccess(adminClient, user.id, salaryId);
    if ('error' in accessCheck && !('salary' in accessCheck)) {
      return NextResponse.json({ error: accessCheck.error }, { status: accessCheck.status });
    }

    // 급여 정보 조회
    const { data: salary, error: salaryError } = await adminClient
      .from('salaries')
      .select(`
        *,
        staff:users!staff_id (
          id,
          name,
          email,
          department,
          position
        ),
        company:companies!company_id (
          id,
          name
        )
      `)
      .eq('id', salaryId)
      .single();

    if (salaryError || !salary) {
      return NextResponse.json(
        { error: '급여 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // PDF 생성
    const pdfData = {
      ...salary,
      staffName: salary.staff?.name || 'Unknown',
      staffEmail: salary.staff?.email,
      companyName: salary.company?.name || 'Unknown',
      department: salary.staff?.department,
      position: salary.staff?.position,
      baseSalary: salary.base_salary,
      overtimePay: salary.overtime_pay,
      nightPay: salary.night_pay,
      holidayPay: salary.holiday_pay,
      weeklyHolidayPay: salary.weekly_holiday_pay,
      mealAllowance: salary.meal_allowance,
      transportAllowance: salary.transport_allowance,
      positionAllowance: salary.position_allowance,
      otherAllowances: salary.other_allowances,
      totalGrossPay: salary.total_gross_pay,
      nationalPension: salary.national_pension,
      healthInsurance: salary.health_insurance,
      longTermCare: salary.long_term_care,
      employmentInsurance: salary.employment_insurance,
      incomeTax: salary.income_tax,
      localIncomeTax: salary.local_income_tax,
      otherDeductions: salary.other_deductions,
      totalDeductions: salary.total_deductions,
      netPay: salary.net_pay,
      workDays: salary.work_days,
      totalHours: salary.total_hours,
      confirmedAt: salary.confirmed_at ? new Date(salary.confirmed_at) : undefined,
      paidAt: salary.paid_at ? new Date(salary.paid_at) : undefined,
      createdAt: new Date(salary.created_at),
      updatedAt: new Date(salary.updated_at),
    };

    const pdf = await PDFGenerator.generatePayslip(pdfData);

    // 파일명 생성
    const fileName = `급여명세서_${salary.year}년${salary.month}월_${salary.staff?.name || 'unknown'}.pdf`;
    const encodedFileName = encodeURIComponent(fileName);

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`,
        'Content-Length': String(pdf.length),
      },
    });
  } catch (error) {
    console.error('Payslip PDF generation error:', error);
    return NextResponse.json(
      { error: '급여명세서 PDF 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}
