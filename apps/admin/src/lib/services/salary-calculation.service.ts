/**
 * 급여 계산 서비스
 * 근로기준법에 따른 정확한 급여 계산
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_MINIMUM_WAGE, INSURANCE_RATES, ALLOWANCE_RATES, MONTHLY_WORK_HOURS } from '@abc/shared';

// Types
export interface LaborLawVersion {
  id: string;
  version: string;
  effectiveDate: Date;
  minimumWageHourly: number;
  overtimeRate: number;
  nightRate: number;
  holidayRate: number;
  nationalPensionRate: number;
  healthInsuranceRate: number;
  longTermCareRate: number;
  employmentInsuranceRate: number;
  status: string;
}

export interface InsuranceRates {
  nationalPension: number;
  healthInsurance: number;
  longTermCare: number;
  employmentInsurance: number;
}

export interface InsuranceDeductions {
  nationalPension: number;
  healthInsurance: number;
  longTermCare: number;
  employmentInsurance: number;
  total: number;
}

export interface TaxDeductions {
  incomeTax: number;
  localIncomeTax: number;
  total: number;
}

export interface AttendanceSummary {
  workDays: number;
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  nightHours: number;
  holidayHours: number;
  weeklyHoursBreakdown: Array<{
    weekNumber: number;
    hours: number;
    hasWeeklyHolidayPay: boolean;
  }>;
}

export interface SalaryCalculation {
  staffId: string;
  year: number;
  month: number;

  // 기본급
  baseSalary: number;

  // 수당
  overtimePay: number;
  nightPay: number;
  holidayPay: number;
  weeklyHolidayPay: number;

  // 추가 수당
  mealAllowance: number;
  transportAllowance: number;
  positionAllowance: number;
  otherAllowances: Record<string, number>;

  // 총 지급액
  totalGrossPay: number;

  // 공제
  nationalPension: number;
  healthInsurance: number;
  longTermCare: number;
  employmentInsurance: number;
  incomeTax: number;
  localIncomeTax: number;
  otherDeductions: Record<string, number>;

  // 총 공제액
  totalDeductions: number;

  // 실수령액
  netPay: number;

  // 근무 정보
  workDays: number;
  totalHours: number;
}

export interface Contract {
  id: string;
  staffId: string;
  contractType: 'HOURLY' | 'DAILY' | 'MONTHLY' | 'FULL_TIME' | 'PART_TIME';
  salaryConfig: {
    baseSalaryType: 'HOURLY' | 'DAILY' | 'MONTHLY';
    baseSalaryAmount: number;
    allowances: {
      overtimeAllowance: boolean;
      nightAllowance: boolean;
      holidayAllowance: boolean;
      weeklyHolidayPay: boolean;
      mealAllowance?: number;
      transportAllowance?: number;
      positionAllowance?: number;
    };
    paymentDate: number;
  };
  deductionConfig: {
    nationalPension: boolean;
    healthInsurance: boolean;
    employmentInsurance: boolean;
    incomeTax: boolean;
  };
  standardHoursPerWeek: number;
  standardHoursPerDay: number;
}

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

// Lazy-loaded supabase client accessor
const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (getSupabase() as any)[prop];
  }
});

export class SalaryCalculationService {
  private laborLawCache: LaborLawVersion | null = null;
  private laborLawCacheTime: number = 0;
  private CACHE_DURATION = 1000 * 60 * 60; // 1 hour

  /**
   * 현재 유효한 근로기준법 데이터 로드
   */
  async getLaborLaw(): Promise<LaborLawVersion> {
    // 캐시 체크
    if (
      this.laborLawCache &&
      Date.now() - this.laborLawCacheTime < this.CACHE_DURATION
    ) {
      return this.laborLawCache;
    }

    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('labor_law_versions')
      .select('*')
      .lte('effective_date', today)
      .eq('status', 'ACTIVE')
      .order('effective_date', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      // 기본값 반환 (2026년 기준)
      return {
        id: 'default',
        version: '2025.01',
        effectiveDate: new Date('2025-01-01'),
        minimumWageHourly: DEFAULT_MINIMUM_WAGE,
        overtimeRate: ALLOWANCE_RATES.overtime,
        nightRate: ALLOWANCE_RATES.night,
        holidayRate: ALLOWANCE_RATES.holiday,
        nationalPensionRate: INSURANCE_RATES.nationalPension,
        healthInsuranceRate: INSURANCE_RATES.healthInsurance,
        longTermCareRate: INSURANCE_RATES.longTermCare,
        employmentInsuranceRate: INSURANCE_RATES.employmentInsurance,
        status: 'ACTIVE',
      };
    }

    this.laborLawCache = {
      id: data.id,
      version: data.version,
      effectiveDate: new Date(data.effective_date),
      minimumWageHourly: data.minimum_wage_hourly,
      overtimeRate: parseFloat(data.overtime_rate),
      nightRate: parseFloat(data.night_rate),
      holidayRate: parseFloat(data.holiday_rate),
      nationalPensionRate: parseFloat(data.national_pension_rate),
      healthInsuranceRate: parseFloat(data.health_insurance_rate),
      longTermCareRate: parseFloat(data.long_term_care_rate),
      employmentInsuranceRate: parseFloat(data.employment_insurance_rate),
      status: data.status,
    };
    this.laborLawCacheTime = Date.now();

    return this.laborLawCache;
  }

  /**
   * 시급 계산 (계약 유형에 따라)
   */
  calculateHourlyRate(contract: Contract): number {
    const { baseSalaryType, baseSalaryAmount } = contract.salaryConfig;

    switch (baseSalaryType) {
      case 'HOURLY':
        return baseSalaryAmount;
      case 'DAILY':
        return baseSalaryAmount / contract.standardHoursPerDay;
      case 'MONTHLY':
        // 월급의 경우 (209시간 기준: 주 40시간 x 4.345주)
        return baseSalaryAmount / MONTHLY_WORK_HOURS;
      default:
        return baseSalaryAmount;
    }
  }

  /**
   * 기본급 계산
   */
  calculateBaseSalary(contract: Contract, workHours: number): number {
    const { baseSalaryType, baseSalaryAmount } = contract.salaryConfig;

    switch (baseSalaryType) {
      case 'MONTHLY':
        return baseSalaryAmount;
      case 'HOURLY':
        return Math.round(baseSalaryAmount * workHours);
      case 'DAILY':
        const daysWorked = workHours / contract.standardHoursPerDay;
        return Math.round(baseSalaryAmount * daysWorked);
      default:
        return baseSalaryAmount;
    }
  }

  /**
   * 연장근로수당 계산 (1.5배)
   */
  calculateOvertimePay(
    hours: number,
    hourlyRate: number,
    rate: number = 1.5
  ): number {
    if (hours <= 0) return 0;
    return Math.round(hourlyRate * rate * hours);
  }

  /**
   * 야간근로수당 계산 (0.5배 가산)
   */
  calculateNightPay(hours: number, hourlyRate: number, rate: number = 0.5): number {
    if (hours <= 0) return 0;
    return Math.round(hourlyRate * rate * hours);
  }

  /**
   * 휴일근로수당 계산 (1.5배)
   */
  calculateHolidayPay(
    hours: number,
    hourlyRate: number,
    rate: number = 1.5
  ): number {
    if (hours <= 0) return 0;
    return Math.round(hourlyRate * rate * hours);
  }

  /**
   * 주휴수당 계산
   * 주 15시간 이상 근무 시 1일분 급여 추가
   */
  calculateWeeklyHolidayPay(
    weeklyHours: number,
    hourlyRate: number,
    standardDailyHours: number = 8
  ): number {
    if (weeklyHours < 15) {
      return 0;
    }
    // (주간 근무시간 / 40) * 8시간 * 시급
    const rate = Math.min(weeklyHours / 40, 1);
    return Math.round(hourlyRate * standardDailyHours * rate);
  }

  /**
   * 4대보험 계산
   */
  calculateInsurance(
    grossPay: number,
    rates: InsuranceRates
  ): InsuranceDeductions {
    const nationalPension = Math.round(grossPay * rates.nationalPension);
    const healthInsurance = Math.round(grossPay * rates.healthInsurance);
    const longTermCare = Math.round(healthInsurance * rates.longTermCare);
    const employmentInsurance = Math.round(grossPay * rates.employmentInsurance);

    return {
      nationalPension,
      healthInsurance,
      longTermCare,
      employmentInsurance,
      total: nationalPension + healthInsurance + longTermCare + employmentInsurance,
    };
  }

  /**
   * 소득세 계산 (간이세액표 기반)
   */
  calculateIncomeTax(grossPay: number, dependents: number = 1): TaxDeductions {
    // 간이세액표 근사치 (실제 구현 시 정확한 테이블 참조)
    let taxRate = 0;

    if (grossPay <= 1060000) {
      taxRate = 0;
    } else if (grossPay <= 1500000) {
      taxRate = 0.06;
    } else if (grossPay <= 3000000) {
      taxRate = 0.15;
    } else if (grossPay <= 4500000) {
      taxRate = 0.24;
    } else if (grossPay <= 8800000) {
      taxRate = 0.35;
    } else {
      taxRate = 0.38;
    }

    // 부양가족 공제
    const deductionPerDependent = 150000;
    const taxableIncome = Math.max(
      0,
      grossPay - dependents * deductionPerDependent
    );

    const incomeTax = Math.round(taxableIncome * taxRate);
    const localIncomeTax = Math.round(incomeTax * 0.1); // 지방소득세 10%

    return {
      incomeTax,
      localIncomeTax,
      total: incomeTax + localIncomeTax,
    };
  }

  /**
   * 출퇴근 기록에서 근무시간 집계
   */
  async getAttendanceSummary(
    staffId: string,
    year: number,
    month: number
  ): Promise<AttendanceSummary> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    // ABSENT, UNSCHEDULED 상태는 급여 계산에서 제외
    // UNSCHEDULED는 관리자 승인 후 OVERTIME으로 변경되어야 급여에 포함됨
    const { data: attendances, error } = await supabase
      .from('attendances')
      .select('*')
      .eq('staff_id', staffId)
      .gte('work_date', startDate.toISOString().split('T')[0])
      .lte('work_date', endDate.toISOString().split('T')[0])
      .not('status', 'in', '("ABSENT","UNSCHEDULED")');

    if (error || !attendances) {
      return {
        workDays: 0,
        totalHours: 0,
        regularHours: 0,
        overtimeHours: 0,
        nightHours: 0,
        holidayHours: 0,
        weeklyHoursBreakdown: [],
      };
    }

    let totalHours = 0;
    let regularHours = 0;
    let overtimeHours = 0;
    let nightHours = 0;
    let holidayHours = 0;

    // 주별 근무시간 집계
    const weeklyHours: Map<number, number> = new Map();

    for (const att of attendances) {
      const workHours = att.work_hours || 0;
      totalHours += workHours;
      regularHours += Math.min(workHours, 8);
      overtimeHours += att.overtime_hours || 0;
      nightHours += att.night_hours || 0;
      holidayHours += att.holiday_hours || 0;

      // 주 번호 계산
      const workDate = new Date(att.work_date);
      const weekNumber = this.getWeekNumber(workDate);
      weeklyHours.set(weekNumber, (weeklyHours.get(weekNumber) || 0) + workHours);
    }

    const weeklyHoursBreakdown = Array.from(weeklyHours.entries()).map(
      ([weekNumber, hours]) => ({
        weekNumber,
        hours,
        hasWeeklyHolidayPay: hours >= 15,
      })
    );

    return {
      workDays: attendances.length,
      totalHours,
      regularHours,
      overtimeHours,
      nightHours,
      holidayHours,
      weeklyHoursBreakdown,
    };
  }

  private getWeekNumber(date: Date): number {
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    const dayOfMonth = date.getDate();
    const dayOfWeek = firstDay.getDay();
    return Math.ceil((dayOfMonth + dayOfWeek) / 7);
  }

  /**
   * 전체 급여 계산
   */
  async calculateMonthlySalary(
    staffId: string,
    year: number,
    month: number
  ): Promise<SalaryCalculation> {
    // 근로기준법 데이터 로드
    const laborLaw = await this.getLaborLaw();

    // 계약 정보 조회
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select('*')
      .eq('staff_id', staffId)
      .eq('status', 'ACTIVE')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (contractError || !contract) {
      throw new Error('Active contract not found for staff');
    }

    // 출퇴근 기록 집계
    const attendance = await this.getAttendanceSummary(staffId, year, month);

    // 시급 계산
    const salaryConfig = contract.salary_config || {};
    const hourlyRate = this.calculateHourlyRate({
      ...contract,
      salaryConfig: {
        baseSalaryType: salaryConfig.base_salary_type || 'HOURLY',
        baseSalaryAmount: salaryConfig.base_salary_amount || laborLaw.minimumWageHourly,
        allowances: salaryConfig.allowances || {},
        paymentDate: salaryConfig.payment_date || 10,
      },
      standardHoursPerWeek: contract.standard_hours_per_week || 40,
      standardHoursPerDay: contract.standard_hours_per_day || 8,
    });

    // 기본급 계산
    const baseSalary = this.calculateBaseSalary(
      {
        ...contract,
        salaryConfig: {
          baseSalaryType: salaryConfig.base_salary_type || 'HOURLY',
          baseSalaryAmount: salaryConfig.base_salary_amount || laborLaw.minimumWageHourly,
          allowances: salaryConfig.allowances || {},
          paymentDate: salaryConfig.payment_date || 10,
        },
        standardHoursPerWeek: contract.standard_hours_per_week || 40,
        standardHoursPerDay: contract.standard_hours_per_day || 8,
      },
      attendance.regularHours
    );

    // 수당 계산
    const allowances = salaryConfig.allowances || {};

    const overtimePay = allowances.overtime_allowance !== false
      ? this.calculateOvertimePay(
          attendance.overtimeHours,
          hourlyRate,
          laborLaw.overtimeRate
        )
      : 0;

    const nightPay = allowances.night_allowance !== false
      ? this.calculateNightPay(
          attendance.nightHours,
          hourlyRate,
          laborLaw.nightRate
        )
      : 0;

    const holidayPay = allowances.holiday_allowance !== false
      ? this.calculateHolidayPay(
          attendance.holidayHours,
          hourlyRate,
          laborLaw.holidayRate
        )
      : 0;

    // 주휴수당 계산
    let weeklyHolidayPay = 0;
    if (allowances.weekly_holiday_pay !== false) {
      for (const week of attendance.weeklyHoursBreakdown) {
        if (week.hasWeeklyHolidayPay) {
          weeklyHolidayPay += this.calculateWeeklyHolidayPay(
            week.hours,
            hourlyRate,
            contract.standard_hours_per_day || 8
          );
        }
      }
    }

    // 추가 수당
    const mealAllowance = allowances.meal_allowance || 0;
    const transportAllowance = allowances.transport_allowance || 0;
    const positionAllowance = allowances.position_allowance || 0;
    const otherAllowances: Record<string, number> = {};

    // 총 지급액
    const totalGrossPay =
      baseSalary +
      overtimePay +
      nightPay +
      holidayPay +
      weeklyHolidayPay +
      mealAllowance +
      transportAllowance +
      positionAllowance;

    // 공제 계산
    const deductionConfig = contract.deduction_config || {};
    const insuranceRates: InsuranceRates = {
      nationalPension: laborLaw.nationalPensionRate,
      healthInsurance: laborLaw.healthInsuranceRate,
      longTermCare: laborLaw.longTermCareRate,
      employmentInsurance: laborLaw.employmentInsuranceRate,
    };

    const insurance = this.calculateInsurance(totalGrossPay, insuranceRates);
    const tax = this.calculateIncomeTax(totalGrossPay, 1);

    const nationalPension = deductionConfig.national_pension !== false
      ? insurance.nationalPension
      : 0;
    const healthInsurance = deductionConfig.health_insurance !== false
      ? insurance.healthInsurance
      : 0;
    const longTermCare = deductionConfig.health_insurance !== false
      ? insurance.longTermCare
      : 0;
    const employmentInsurance = deductionConfig.employment_insurance !== false
      ? insurance.employmentInsurance
      : 0;
    const incomeTax = deductionConfig.income_tax !== false
      ? tax.incomeTax
      : 0;
    const localIncomeTax = deductionConfig.income_tax !== false
      ? tax.localIncomeTax
      : 0;

    const totalDeductions =
      nationalPension +
      healthInsurance +
      longTermCare +
      employmentInsurance +
      incomeTax +
      localIncomeTax;

    // 실수령액
    const netPay = totalGrossPay - totalDeductions;

    return {
      staffId,
      year,
      month,
      baseSalary,
      overtimePay,
      nightPay,
      holidayPay,
      weeklyHolidayPay,
      mealAllowance,
      transportAllowance,
      positionAllowance,
      otherAllowances,
      totalGrossPay,
      nationalPension,
      healthInsurance,
      longTermCare,
      employmentInsurance,
      incomeTax,
      localIncomeTax,
      otherDeductions: {},
      totalDeductions,
      netPay,
      workDays: attendance.workDays,
      totalHours: attendance.totalHours,
    };
  }

  /**
   * 일괄 급여 계산
   */
  async calculateBulkSalaries(
    companyId: string,
    year: number,
    month: number
  ): Promise<SalaryCalculation[]> {
    // 활성 직원 목록 조회
    const { data: staffList, error } = await supabase
      .from('users')
      .select('id')
      .eq('company_id', companyId)
      .eq('status', 'ACTIVE')
      .in('role', ['staff', 'manager', 'store_manager', 'team_leader']);

    if (error || !staffList) {
      throw new Error('Failed to fetch staff list');
    }

    const results: SalaryCalculation[] = [];

    for (const staff of staffList) {
      try {
        const calculation = await this.calculateMonthlySalary(
          staff.id,
          year,
          month
        );
        results.push(calculation);
      } catch (err) {
        console.error(`Failed to calculate salary for staff ${staff.id}:`, err);
      }
    }

    return results;
  }

  /**
   * 급여 확정
   */
  async confirmSalary(salaryId: string, confirmedBy: string): Promise<void> {
    await supabase
      .from('salaries')
      .update({
        status: 'CONFIRMED',
        confirmed_at: new Date().toISOString(),
        confirmed_by: confirmedBy,
      })
      .eq('id', salaryId);
  }

  /**
   * 급여 지급 처리
   */
  async markAsPaid(salaryId: string): Promise<void> {
    await supabase
      .from('salaries')
      .update({
        status: 'PAID',
        paid_at: new Date().toISOString(),
      })
      .eq('id', salaryId);
  }
}

export const salaryCalculationService = new SalaryCalculationService();

export default SalaryCalculationService;
