/**
 * 급여대장 엑셀 생성 API
 * GET /api/tax/payroll-report
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ExcelGenerator, PayrollReportData } from '@abcdc/shared';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const year = parseInt(searchParams.get('year') || '');
    const month = parseInt(searchParams.get('month') || '');

    if (!companyId || !year || !month) {
      return NextResponse.json(
        { error: 'companyId, year, month가 필요합니다.' },
        { status: 400 }
      );
    }

    // 회사 정보 조회
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('name')
      .eq('id', companyId)
      .single();

    if (companyError || !company) {
      return NextResponse.json(
        { error: '회사 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 해당 월 급여 데이터 조회
    const { data: salaries, error: salariesError } = await supabase
      .from('salaries')
      .select(`
        *,
        staff:users!staff_id (
          id,
          name,
          department,
          position
        )
      `)
      .eq('company_id', companyId)
      .eq('year', year)
      .eq('month', month);

    if (salariesError) {
      return NextResponse.json(
        { error: '급여 데이터 조회에 실패했습니다.' },
        { status: 500 }
      );
    }

    if (!salaries || salaries.length === 0) {
      return NextResponse.json(
        { error: '해당 월의 급여 데이터가 없습니다.' },
        { status: 404 }
      );
    }

    // 데이터 변환
    const reportData: PayrollReportData[] = salaries.map((salary) => ({
      staffId: salary.staff_id,
      staffName: salary.staff?.name || 'Unknown',
      department: salary.staff?.department,
      position: salary.staff?.position,
      baseSalary: salary.base_salary || 0,
      overtimePay: salary.overtime_pay || 0,
      nightPay: salary.night_pay || 0,
      holidayPay: salary.holiday_pay || 0,
      weeklyHolidayPay: salary.weekly_holiday_pay || 0,
      mealAllowance: salary.meal_allowance || 0,
      transportAllowance: salary.transport_allowance || 0,
      positionAllowance: salary.position_allowance || 0,
      otherAllowances: Object.values(salary.other_allowances || {}).reduce(
        (sum: number, val: any) => sum + (val || 0),
        0
      ) as number,
      totalGrossPay: salary.total_gross_pay || 0,
      nationalPension: salary.national_pension || 0,
      healthInsurance: salary.health_insurance || 0,
      longTermCare: salary.long_term_care || 0,
      employmentInsurance: salary.employment_insurance || 0,
      incomeTax: salary.income_tax || 0,
      localIncomeTax: salary.local_income_tax || 0,
      otherDeductions: Object.values(salary.other_deductions || {}).reduce(
        (sum: number, val: any) => sum + (val || 0),
        0
      ) as number,
      totalDeductions: salary.total_deductions || 0,
      netPay: salary.net_pay || 0,
      workDays: salary.work_days || 0,
      totalHours: salary.total_hours || 0,
    }));

    // 엑셀 생성
    const excel = await ExcelGenerator.generatePayrollReport(reportData, {
      companyName: company.name,
      year,
      month,
    });

    // 파일명 생성
    const fileName = `급여대장_${company.name}_${year}년${month}월.xlsx`;
    const encodedFileName = encodeURIComponent(fileName);

    return new NextResponse(excel, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`,
        'Content-Length': String(excel.length),
      },
    });
  } catch (error) {
    console.error('Payroll report generation error:', error);
    return NextResponse.json(
      { error: '급여대장 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}

// 세무대리인에게 전송
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, year, month } = body;

    if (!companyId || !year || !month) {
      return NextResponse.json(
        { error: 'companyId, year, month가 필요합니다.' },
        { status: 400 }
      );
    }

    // 세무대리인 정보 조회
    const { data: taxAccountant, error: taError } = await supabase
      .from('tax_accountants')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (taError || !taxAccountant) {
      return NextResponse.json(
        { error: '세무대리인 정보가 등록되지 않았습니다.' },
        { status: 404 }
      );
    }

    // 급여대장 생성 (GET API 재사용)
    const reportUrl = new URL(
      '/api/tax/payroll-report',
      process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    );
    reportUrl.searchParams.set('companyId', companyId);
    reportUrl.searchParams.set('year', String(year));
    reportUrl.searchParams.set('month', String(month));

    const reportResponse = await fetch(reportUrl.toString());

    if (!reportResponse.ok) {
      const error = await reportResponse.json();
      return NextResponse.json(error, { status: reportResponse.status });
    }

    const excelBuffer = Buffer.from(await reportResponse.arrayBuffer());

    // 전송 방법에 따른 처리
    let transmissionStatus = 'SUCCESS';
    let fileUrl = '';

    if (taxAccountant.transmission_method === 'EMAIL' && taxAccountant.email) {
      // 이메일로 전송
      const { emailService } = await import('@abcdc/shared');

      // 회사 정보 조회
      const { data: company } = await supabase
        .from('companies')
        .select('name')
        .eq('id', companyId)
        .single();

      // 급여 총액 계산
      const { data: salaries } = await supabase
        .from('salaries')
        .select('total_gross_pay, total_deductions, income_tax, local_income_tax, national_pension, health_insurance, employment_insurance')
        .eq('company_id', companyId)
        .eq('year', year)
        .eq('month', month);

      const totalPayroll = salaries?.reduce(
        (sum, s) => sum + (s.total_gross_pay || 0),
        0
      ) || 0;
      const totalInsurance = salaries?.reduce(
        (sum, s) =>
          sum +
          (s.national_pension || 0) +
          (s.health_insurance || 0) +
          (s.employment_insurance || 0),
        0
      ) || 0;
      const totalTax = salaries?.reduce(
        (sum, s) => sum + (s.income_tax || 0) + (s.local_income_tax || 0),
        0
      ) || 0;

      const emailResult = await emailService.sendTaxReport(
        taxAccountant.email,
        excelBuffer,
        {
          companyName: company?.name || '',
          year: String(year),
          month: String(month),
          employeeCount: String(salaries?.length || 0),
          totalPayroll: totalPayroll.toLocaleString('ko-KR'),
          totalInsurance: totalInsurance.toLocaleString('ko-KR'),
          totalTax: totalTax.toLocaleString('ko-KR'),
        }
      );

      if (!emailResult.success) {
        transmissionStatus = 'FAILED';
      }
    } else if (taxAccountant.transmission_method === 'MANUAL') {
      // 수동 - Storage에 저장하고 URL 제공
      const fileName = `tax-reports/${companyId}/${year}-${month}.xlsx`;
      const { error: uploadError } = await supabase.storage
        .from('tax-reports')
        .upload(fileName, excelBuffer, {
          contentType:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          upsert: true,
        });

      if (uploadError) {
        transmissionStatus = 'FAILED';
      } else {
        const { data: urlData } = supabase.storage
          .from('tax-reports')
          .getPublicUrl(fileName);
        fileUrl = urlData.publicUrl;
      }
    }

    // 전송 이력 저장
    await supabase.from('tax_transmissions').insert({
      company_id: companyId,
      year,
      month,
      method: taxAccountant.transmission_method,
      file_url: fileUrl || null,
      status: transmissionStatus,
      transmitted_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: transmissionStatus === 'SUCCESS',
      status: transmissionStatus,
      method: taxAccountant.transmission_method,
      fileUrl: fileUrl || undefined,
    });
  } catch (error) {
    console.error('Tax report send error:', error);
    return NextResponse.json(
      { error: '급여대장 전송에 실패했습니다.' },
      { status: 500 }
    );
  }
}
