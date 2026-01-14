/**
 * GET /api/salaries/[id]/payslip - 급여명세서 PDF 생성 및 다운로드
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { PDFGenerator } from '@abc/shared/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    // 인증 확인
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 사용자 정보 확인
    const { data: userData } = await adminClient
      .from('users')
      .select('id, role, company_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 급여 데이터 조회 (staff 정보 포함)
    const { data: salary, error } = await adminClient
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
      .eq('id', params.id)
      .single();

    if (error || !salary) {
      return NextResponse.json({ error: '급여 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 권한 확인: 본인 또는 관리자만 열람 가능
    const isOwner = userData.id === salary.staff_id;
    const isAdmin = ['super_admin', 'company_admin', 'manager'].includes(userData.role);
    const isSameCompany = userData.company_id === salary.company_id;

    if (!isOwner && !(isAdmin && isSameCompany)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // PDF 생성
    const pdfData = {
      ...salary,
      staffName: salary.staff.name,
      staffEmail: salary.staff.email,
      companyName: salary.company.name,
      position: salary.staff.position,
      department: salary.staff.department,
      baseSalary: salary.base_salary,
      overtimePay: salary.overtime_pay,
      nightPay: salary.night_pay,
      holidayPay: salary.holiday_pay,
      weeklyHolidayPay: salary.weekly_holiday_pay,
      mealAllowance: salary.meal_allowance,
      transportAllowance: salary.transport_allowance,
      positionAllowance: salary.position_allowance,
      otherAllowances: salary.other_allowances || {},
      totalGrossPay: salary.total_gross_pay,
      nationalPension: salary.national_pension,
      healthInsurance: salary.health_insurance,
      longTermCare: salary.long_term_care,
      employmentInsurance: salary.employment_insurance,
      incomeTax: salary.income_tax,
      localIncomeTax: salary.local_income_tax,
      otherDeductions: salary.other_deductions || {},
      totalDeductions: salary.total_deductions,
      netPay: salary.net_pay,
      workDays: salary.work_days,
      totalHours: salary.total_hours,
      confirmedAt: salary.confirmed_at ? new Date(salary.confirmed_at) : undefined,
      paidAt: salary.paid_at ? new Date(salary.paid_at) : undefined,
    };

    const pdfBuffer = await PDFGenerator.generatePayslip(pdfData);

    // PDF 반환
    const fileName = `급여명세서_${salary.year}년${salary.month}월_${salary.staff.name}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('[GET /api/salaries/[id]/payslip] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
