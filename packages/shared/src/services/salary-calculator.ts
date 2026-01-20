/**
 * 급여 자동 계산 서비스
 * 출퇴근 기록 기반으로 급여 자동 계산 (4대보험, 세금 포함)
 */

import { Database } from '@abc/database';
import { MONTHLY_WORK_HOURS, DAILY_WORK_HOURS } from '../utils/salary';

type Attendance = Database['public']['Tables']['attendances']['Row'];
type Contract = Database['public']['Tables']['contracts']['Row'];
type LaborLaw = Database['public']['Tables']['labor_law_versions']['Row'];

// 급여 계산 입력 데이터
export interface SalaryCalculationInput {
  staffId: string;
  year: number;
  month: number;
}

// 급여 계산 결과
export interface SalaryCalculationOutput {
  staffId: string;
  year: number;
  month: number;

  // 지급 항목
  baseSalary: number; // 기본급
  overtimePay: number; // 연장근무 수당
  nightPay: number; // 야간근무 수당
  holidayPay: number; // 휴일근무 수당
  weeklyHolidayPay: number; // 주휴수당
  mealAllowance: number; // 식대
  transportAllowance: number; // 교통비
  otherAllowances: Record<string, number>; // 기타 수당
  totalGrossPay: number; // 총 지급액

  // 공제 항목
  nationalPension: number; // 국민연금 (4.5%)
  healthInsurance: number; // 건강보험 (3.545%)
  longTermCare: number; // 장기요양보험 (건강보험의 12.81%)
  employmentInsurance: number; // 고용보험 (0.9%)
  incomeTax: number; // 소득세
  localIncomeTax: number; // 지방소득세 (소득세의 10%)
  otherDeductions: Record<string, number>; // 기타 공제
  totalDeductions: number; // 총 공제액

  // 실수령액
  netPay: number;

  // 근무 정보
  workDays: number; // 근무 일수
  totalHours: number; // 총 근무 시간
  overtimeHours: number; // 연장 근무 시간
  nightHours: number; // 야간 근무 시간
  holidayHours: number; // 휴일 근무 시간
}

/**
 * 시간이 야간 시간대인지 확인 (22:00 ~ 06:00)
 */
function isNightTime(hour: number): boolean {
  return hour >= 22 || hour < 6;
}

/**
 * 두 시간 사이의 야간 근무 시간 계산
 */
function calculateNightHours(startTime: Date, endTime: Date): number {
  let nightHours = 0;
  const current = new Date(startTime);

  while (current < endTime) {
    const hour = current.getHours();
    if (isNightTime(hour)) {
      const nextHour = new Date(current);
      nextHour.setHours(nextHour.getHours() + 1);
      const end = nextHour > endTime ? endTime : nextHour;
      nightHours += (end.getTime() - current.getTime()) / (1000 * 60 * 60);
    }
    current.setHours(current.getHours() + 1);
  }

  return Math.round(nightHours * 100) / 100;
}

/**
 * 근무 시간 계산 (분 단위 → 시간)
 */
function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

/**
 * 시간급 계산
 */
function calculateHourlyRate(contract: Contract, laborLaw: LaborLaw): number {
  const salaryConfig = contract.salary_config as any;

  if (salaryConfig.baseSalaryType === 'hourly') {
    // 시급제
    return salaryConfig.baseSalaryAmount;
  } else if (salaryConfig.baseSalaryType === 'monthly') {
    // 월급제 → 시급 환산 (월급 / 209시간)
    return Math.round(salaryConfig.baseSalaryAmount / MONTHLY_WORK_HOURS);
  } else if (salaryConfig.baseSalaryType === 'daily') {
    // 일급제 → 시급 환산 (일급 / 8시간)
    return Math.round(salaryConfig.baseSalaryAmount / DAILY_WORK_HOURS);
  }

  // 기본값: 최저시급
  return laborLaw.minimum_wage_hourly;
}

/**
 * 주휴수당 계산
 * - 주 15시간 이상 근무 시 지급
 * - 1주일 만근 시 1일치 임금 지급
 */
function calculateWeeklyHolidayPay(
  attendances: Attendance[],
  hourlyRate: number
): number {
  // 주 단위로 그룹핑
  const weeklyGroups = new Map<string, Attendance[]>();

  attendances.forEach((att) => {
    const date = new Date(att.work_date);
    // ISO 주 번호 계산 (YYYY-WW 형식)
    const weekYear = date.getFullYear();
    const weekNum = getWeekNumber(date);
    const weekKey = `${weekYear}-W${weekNum.toString().padStart(2, '0')}`;

    if (!weeklyGroups.has(weekKey)) {
      weeklyGroups.set(weekKey, []);
    }
    weeklyGroups.get(weekKey)!.push(att);
  });

  let totalWeeklyHolidayPay = 0;

  // 각 주별로 계산
  weeklyGroups.forEach((weekAttendances) => {
    // 주간 총 근무 시간
    const weeklyHours = weekAttendances.reduce(
      (sum, att) => sum + (att.work_hours || 0),
      0
    );

    // 근무 일수
    const workDays = weekAttendances.length;

    // 주 15시간 이상 && 주 5일 이상 근무 시 주휴수당 지급
    if (weeklyHours >= 15 && workDays >= 5) {
      // 1일 평균 근무시간
      const avgDailyHours = weeklyHours / workDays;
      totalWeeklyHolidayPay += avgDailyHours * hourlyRate;
    }
  });

  return Math.round(totalWeeklyHolidayPay);
}

/**
 * ISO 주 번호 계산
 */
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * 소득세 계산 (간이세액표 기준)
 */
function calculateIncomeTax(monthlyGross: number): number {
  // 간이세액표 (2026년 기준 - 부양가족 1명 가정)
  if (monthlyGross < 1060000) return 0;
  if (monthlyGross < 1450000) return Math.round(monthlyGross * 0.04 - 42360);
  if (monthlyGross < 2000000) return Math.round(monthlyGross * 0.05 - 56860);
  if (monthlyGross < 3000000) return Math.round(monthlyGross * 0.07 - 96860);
  if (monthlyGross < 5000000) return Math.round(monthlyGross * 0.10 - 186860);
  return Math.round(monthlyGross * 0.15 - 436860);
}

/**
 * 급여 자동 계산 (메인 함수)
 */
export async function calculateSalary(
  input: SalaryCalculationInput,
  getAttendances: (staffId: string, year: number, month: number) => Promise<Attendance[]>,
  getContract: (staffId: string) => Promise<Contract | null>,
  getCurrentLaborLaw: () => Promise<LaborLaw>
): Promise<SalaryCalculationOutput> {
  // 1. 계약서 조회
  const contract = await getContract(input.staffId);
  if (!contract) {
    throw new Error('계약서를 찾을 수 없습니다.');
  }

  // 2. 출퇴근 기록 조회
  const attendances = await getAttendances(input.staffId, input.year, input.month);

  // 3. 현재 근로기준법 조회
  const laborLaw = await getCurrentLaborLaw();

  // 4. 시급 계산
  const hourlyRate = calculateHourlyRate(contract, laborLaw);

  // 5. 근무 시간 집계
  let totalHours = 0;
  let overtimeHours = 0;
  let nightHours = 0;
  let holidayHours = 0;

  attendances.forEach((att) => {
    const hours = att.work_hours || 0;
    totalHours += hours;

    // 연장 근무 (하루 8시간 초과)
    if (hours > 8) {
      overtimeHours += hours - 8;
    }

    // 야간 근무 (22:00 ~ 06:00)
    if (att.actual_check_in && att.actual_check_out) {
      const nightHrs = calculateNightHours(
        new Date(att.actual_check_in),
        new Date(att.actual_check_out)
      );
      nightHours += nightHrs;
    }

    // 휴일 근무 (토요일, 일요일)
    const date = new Date(att.work_date);
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      holidayHours += hours;
    }
  });

  // 6. 기본급 계산
  const salaryConfig = contract.salary_config as any;
  let baseSalary = 0;

  if (salaryConfig.baseSalaryType === 'hourly') {
    // 시급제: 시급 × 근무시간
    baseSalary = Math.round(hourlyRate * totalHours);
  } else if (salaryConfig.baseSalaryType === 'monthly') {
    // 월급제: 고정 월급
    baseSalary = salaryConfig.baseSalaryAmount;
  } else if (salaryConfig.baseSalaryType === 'daily') {
    // 일급제: 일급 × 근무일수
    baseSalary = salaryConfig.baseSalaryAmount * attendances.length;
  }

  // 7. 수당 계산
  const overtimePay = Math.round(
    hourlyRate * overtimeHours * (laborLaw.overtime_rate || 1.5)
  );
  const nightPay = Math.round(
    hourlyRate * nightHours * (1 + (laborLaw.night_rate || 0.5))
  );
  const holidayPay = Math.round(
    hourlyRate * holidayHours * (laborLaw.holiday_rate || 1.5)
  );
  const weeklyHolidayPay = calculateWeeklyHolidayPay(attendances, hourlyRate);

  // 수당 추가 (계약서에 정의된 수당)
  const mealAllowance = salaryConfig.allowances?.meal || 0;
  const transportAllowance = salaryConfig.allowances?.transport || 0;
  const otherAllowances = salaryConfig.allowances?.other || {};

  const totalGrossPay =
    baseSalary +
    overtimePay +
    nightPay +
    holidayPay +
    weeklyHolidayPay +
    mealAllowance +
    transportAllowance +
    Object.values(otherAllowances).reduce((sum: number, val: any) => sum + val, 0);

  // 8. 공제 계산
  const deductionConfig = contract.deduction_config as any;

  // 4대보험 (과세 대상 금액만)
  const taxableIncome = totalGrossPay - mealAllowance - transportAllowance; // 비과세 제외

  let nationalPension = 0;
  let healthInsurance = 0;
  let longTermCare = 0;
  let employmentInsurance = 0;

  // 월급 370만원 이하인 경우만 4대보험 공제 (건강보험 제외 기준)
  if (deductionConfig.nationalPension !== false && taxableIncome <= 5530000) {
    nationalPension = Math.round(
      taxableIncome * (laborLaw.national_pension_rate / 100)
    );
  }

  if (deductionConfig.healthInsurance !== false && taxableIncome <= 5530000) {
    healthInsurance = Math.round(
      taxableIncome * (laborLaw.health_insurance_rate / 100)
    );
    longTermCare = Math.round(
      healthInsurance * (laborLaw.long_term_care_rate / 100)
    );
  }

  if (deductionConfig.employmentInsurance !== false) {
    employmentInsurance = Math.round(
      taxableIncome * (laborLaw.employment_insurance_rate / 100)
    );
  }

  // 소득세
  const incomeTax = calculateIncomeTax(taxableIncome);
  const localIncomeTax = Math.round(incomeTax * 0.1);

  // 기타 공제
  const otherDeductions = deductionConfig.other || {};

  const totalDeductions =
    nationalPension +
    healthInsurance +
    longTermCare +
    employmentInsurance +
    incomeTax +
    localIncomeTax +
    Object.values(otherDeductions).reduce((sum: number, val: any) => sum + val, 0);

  // 9. 실수령액
  const netPay = totalGrossPay - totalDeductions;

  return {
    staffId: input.staffId,
    year: input.year,
    month: input.month,
    baseSalary,
    overtimePay,
    nightPay,
    holidayPay,
    weeklyHolidayPay,
    mealAllowance,
    transportAllowance,
    otherAllowances,
    totalGrossPay,
    nationalPension,
    healthInsurance,
    longTermCare,
    employmentInsurance,
    incomeTax,
    localIncomeTax,
    otherDeductions,
    totalDeductions,
    netPay,
    workDays: attendances.length,
    totalHours: Math.round(totalHours * 100) / 100,
    overtimeHours: Math.round(overtimeHours * 100) / 100,
    nightHours: Math.round(nightHours * 100) / 100,
    holidayHours: Math.round(holidayHours * 100) / 100,
  };
}
