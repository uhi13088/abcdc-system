/**
 * 급여 계산 API
 * POST /api/salaries/calculate
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SalaryCalculationService } from '@/lib/services/salary-calculation.service';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { staffId, staffIds, companyId, year, month } = body;

    if (!year || !month) {
      return NextResponse.json(
        { error: '연도와 월을 입력해주세요.' },
        { status: 400 }
      );
    }

    const service = new SalaryCalculationService();

    // 단일 직원 급여 계산
    if (staffId) {
      const calculation = await service.calculateMonthlySalary(
        staffId,
        year,
        month
      );

      // 급여 테이블에 저장
      const { data, error } = await supabase
        .from('salaries')
        .upsert(
          {
            staff_id: staffId,
            company_id: companyId,
            year,
            month,
            base_salary: calculation.baseSalary,
            overtime_pay: calculation.overtimePay,
            night_pay: calculation.nightPay,
            holiday_pay: calculation.holidayPay,
            weekly_holiday_pay: calculation.weeklyHolidayPay,
            meal_allowance: calculation.mealAllowance,
            transport_allowance: calculation.transportAllowance,
            position_allowance: calculation.positionAllowance,
            other_allowances: calculation.otherAllowances,
            total_gross_pay: calculation.totalGrossPay,
            national_pension: calculation.nationalPension,
            health_insurance: calculation.healthInsurance,
            long_term_care: calculation.longTermCare,
            employment_insurance: calculation.employmentInsurance,
            income_tax: calculation.incomeTax,
            local_income_tax: calculation.localIncomeTax,
            other_deductions: calculation.otherDeductions,
            total_deductions: calculation.totalDeductions,
            net_pay: calculation.netPay,
            work_days: calculation.workDays,
            total_hours: calculation.totalHours,
            status: 'DRAFT',
          },
          {
            onConflict: 'staff_id,year,month',
          }
        )
        .select()
        .single();

      if (error) {
        console.error('Failed to save salary:', error);
        return NextResponse.json(
          { error: '급여 저장에 실패했습니다.' },
          { status: 500 }
        );
      }

      return NextResponse.json({ salary: data, calculation });
    }

    // 여러 직원 급여 계산
    if (staffIds && Array.isArray(staffIds)) {
      const calculations = [];

      for (const id of staffIds) {
        try {
          const calculation = await service.calculateMonthlySalary(
            id,
            year,
            month
          );
          calculations.push({ staffId: id, ...calculation });

          // 저장
          await supabase.from('salaries').upsert(
            {
              staff_id: id,
              company_id: companyId,
              year,
              month,
              base_salary: calculation.baseSalary,
              overtime_pay: calculation.overtimePay,
              night_pay: calculation.nightPay,
              holiday_pay: calculation.holidayPay,
              weekly_holiday_pay: calculation.weeklyHolidayPay,
              meal_allowance: calculation.mealAllowance,
              transport_allowance: calculation.transportAllowance,
              position_allowance: calculation.positionAllowance,
              other_allowances: calculation.otherAllowances,
              total_gross_pay: calculation.totalGrossPay,
              national_pension: calculation.nationalPension,
              health_insurance: calculation.healthInsurance,
              long_term_care: calculation.longTermCare,
              employment_insurance: calculation.employmentInsurance,
              income_tax: calculation.incomeTax,
              local_income_tax: calculation.localIncomeTax,
              other_deductions: calculation.otherDeductions,
              total_deductions: calculation.totalDeductions,
              net_pay: calculation.netPay,
              work_days: calculation.workDays,
              total_hours: calculation.totalHours,
              status: 'DRAFT',
            },
            {
              onConflict: 'staff_id,year,month',
            }
          );
        } catch (err) {
          console.error(`Failed to calculate salary for ${id}:`, err);
          calculations.push({
            staffId: id,
            error: (err as Error).message,
          });
        }
      }

      return NextResponse.json({
        calculations,
        total: calculations.length,
        success: calculations.filter((c) => !('error' in c)).length,
        failed: calculations.filter((c) => 'error' in c).length,
      });
    }

    // 회사 전체 일괄 계산
    if (companyId) {
      const calculations = await service.calculateBulkSalaries(
        companyId,
        year,
        month
      );

      // 일괄 저장
      for (const calculation of calculations) {
        await supabase.from('salaries').upsert(
          {
            staff_id: calculation.staffId,
            company_id: companyId,
            year,
            month,
            base_salary: calculation.baseSalary,
            overtime_pay: calculation.overtimePay,
            night_pay: calculation.nightPay,
            holiday_pay: calculation.holidayPay,
            weekly_holiday_pay: calculation.weeklyHolidayPay,
            meal_allowance: calculation.mealAllowance,
            transport_allowance: calculation.transportAllowance,
            position_allowance: calculation.positionAllowance,
            other_allowances: calculation.otherAllowances,
            total_gross_pay: calculation.totalGrossPay,
            national_pension: calculation.nationalPension,
            health_insurance: calculation.healthInsurance,
            long_term_care: calculation.longTermCare,
            employment_insurance: calculation.employmentInsurance,
            income_tax: calculation.incomeTax,
            local_income_tax: calculation.localIncomeTax,
            other_deductions: calculation.otherDeductions,
            total_deductions: calculation.totalDeductions,
            net_pay: calculation.netPay,
            work_days: calculation.workDays,
            total_hours: calculation.totalHours,
            status: 'DRAFT',
          },
          {
            onConflict: 'staff_id,year,month',
          }
        );
      }

      return NextResponse.json({
        calculations,
        total: calculations.length,
      });
    }

    return NextResponse.json(
      { error: 'staffId, staffIds, 또는 companyId를 입력해주세요.' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Salary calculation error:', error);
    return NextResponse.json(
      { error: '급여 계산 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
