/**
 * 급여명세서 PDF 생성 API
 * GET /api/salaries/[id]/pdf
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PDFGenerator } from '@abc/shared/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const salaryId = params.id;

    // 급여 정보 조회
    const { data: salary, error: salaryError } = await supabase
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
