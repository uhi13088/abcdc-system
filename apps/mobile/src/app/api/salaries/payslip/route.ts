/**
 * GET /api/salaries/payslip - 급여명세서 PDF 생성 및 다운로드 (Mobile)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { PDFGenerator } from '@abc/shared/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
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
      .select('id, name, email, position, department, company_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 쿼리 파라미터
    const searchParams = request.nextUrl.searchParams;
    const year = searchParams.get('year');
    const month = searchParams.get('month');

    if (!year || !month) {
      return NextResponse.json({ error: 'year and month are required' }, { status: 400 });
    }

    // 급여 데이터 조회
    const { data: salary, error } = await adminClient
      .from('salaries')
      .select(`
        *,
        company:companies!company_id (
          id,
          name
        )
      `)
      .eq('staff_id', userData.id)
      .eq('year', parseInt(year))
      .eq('month', parseInt(month))
      .single();

    if (error || !salary) {
      return NextResponse.json({ error: '급여 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 회사 정보 검증
    if (!salary.company) {
      return NextResponse.json({ error: '급여 데이터가 불완전합니다.' }, { status: 500 });
    }

    // PDF 생성
    const pdfData = {
      ...salary,
      staffName: userData.name,
      staffEmail: userData.email,
      companyName: salary.company.name,
      position: userData.position,
      department: userData.department,
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
    const fileName = `급여명세서_${salary.year}년${salary.month}월_${userData.name}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('[GET /api/salaries/payslip] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
