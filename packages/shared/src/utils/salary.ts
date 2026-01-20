/**
 * 급여 계산 유틸리티
 * 근로기준법에 따른 정확한 계산
 */

// 2025년 기준 최저시급 (매년 업데이트 필요)
export const DEFAULT_MINIMUM_WAGE = 10030;

// 4대보험 요율 (2025년 기준)
export const INSURANCE_RATES = {
  nationalPension: 0.045,        // 국민연금 4.5%
  healthInsurance: 0.03545,      // 건강보험 3.545%
  longTermCare: 0.1281,          // 장기요양보험 (건보의 12.81%)
  employmentInsurance: 0.009,    // 고용보험 0.9%
};

// 수당 배율
export const ALLOWANCE_RATES = {
  overtime: 1.5,    // 연장근로 150%
  night: 0.5,       // 야간근로 50% 가산
  holiday: 1.5,     // 휴일근로 150%
};

/**
 * 시급으로 일급 계산
 */
export function calculateDailyPay(
  hourlyRate: number,
  workHours: number,
  breakHours: number = 0
): number {
  const actualWorkHours = workHours - breakHours;
  return Math.round(hourlyRate * actualWorkHours);
}

/**
 * 연장근로수당 계산
 * 1일 8시간 또는 주 40시간 초과 시 50% 가산
 */
export function calculateOvertimePay(
  hourlyRate: number,
  overtimeHours: number
): number {
  return Math.round(hourlyRate * ALLOWANCE_RATES.overtime * overtimeHours);
}

/**
 * 야간근로수당 계산
 * 22:00 ~ 06:00 근무 시 50% 가산
 */
export function calculateNightPay(
  hourlyRate: number,
  nightHours: number
): number {
  return Math.round(hourlyRate * ALLOWANCE_RATES.night * nightHours);
}

/**
 * 휴일근로수당 계산
 * 법정휴일 근무 시 50% 가산
 */
export function calculateHolidayPay(
  hourlyRate: number,
  holidayHours: number
): number {
  return Math.round(hourlyRate * ALLOWANCE_RATES.holiday * holidayHours);
}

/**
 * 주휴수당 계산
 * 주 15시간 이상 근무 시 1일분 급여 추가
 */
export function calculateWeeklyHolidayPay(
  hourlyRate: number,
  weeklyWorkHours: number,
  standardDailyHours: number = 8
): number {
  if (weeklyWorkHours < 15) {
    return 0;
  }
  // (주간 근무시간 / 40) * 8시간 * 시급
  const rate = Math.min(weeklyWorkHours / 40, 1);
  return Math.round(hourlyRate * standardDailyHours * rate);
}

/**
 * 4대보험 공제액 계산
 */
export function calculateInsuranceDeductions(grossPay: number): {
  nationalPension: number;
  healthInsurance: number;
  longTermCare: number;
  employmentInsurance: number;
  total: number;
} {
  const nationalPension = Math.round(grossPay * INSURANCE_RATES.nationalPension);
  const healthInsurance = Math.round(grossPay * INSURANCE_RATES.healthInsurance);
  const longTermCare = Math.round(healthInsurance * INSURANCE_RATES.longTermCare);
  const employmentInsurance = Math.round(grossPay * INSURANCE_RATES.employmentInsurance);

  return {
    nationalPension,
    healthInsurance,
    longTermCare,
    employmentInsurance,
    total: nationalPension + healthInsurance + longTermCare + employmentInsurance,
  };
}

/**
 * 간이세액표 기반 소득세 계산 (간략화된 버전)
 * 실제로는 국세청 간이세액표 참조 필요
 */
export function calculateIncomeTax(grossPay: number, dependents: number = 1): {
  incomeTax: number;
  localIncomeTax: number;
  total: number;
} {
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
  } else {
    taxRate = 0.35;
  }

  // 부양가족 공제 (간략화)
  const deductionPerDependent = 150000;
  const taxableIncome = Math.max(0, grossPay - (dependents * deductionPerDependent));

  const incomeTax = Math.round(taxableIncome * taxRate);
  const localIncomeTax = Math.round(incomeTax * 0.1); // 지방소득세 10%

  return {
    incomeTax,
    localIncomeTax,
    total: incomeTax + localIncomeTax,
  };
}

/**
 * 전체 공제액 계산
 */
export function calculateTotalDeductions(
  grossPay: number,
  options: {
    nationalPension?: boolean;
    healthInsurance?: boolean;
    employmentInsurance?: boolean;
    incomeTax?: boolean;
    dependents?: number;
    otherDeductions?: number;
  } = {}
): {
  nationalPension: number;
  healthInsurance: number;
  longTermCare: number;
  employmentInsurance: number;
  incomeTax: number;
  localIncomeTax: number;
  otherDeductions: number;
  total: number;
} {
  const {
    nationalPension = true,
    healthInsurance = true,
    employmentInsurance = true,
    incomeTax = true,
    dependents = 1,
    otherDeductions = 0,
  } = options;

  const insurance = calculateInsuranceDeductions(grossPay);
  const tax = calculateIncomeTax(grossPay, dependents);

  return {
    nationalPension: nationalPension ? insurance.nationalPension : 0,
    healthInsurance: healthInsurance ? insurance.healthInsurance : 0,
    longTermCare: healthInsurance ? insurance.longTermCare : 0,
    employmentInsurance: employmentInsurance ? insurance.employmentInsurance : 0,
    incomeTax: incomeTax ? tax.incomeTax : 0,
    localIncomeTax: incomeTax ? tax.localIncomeTax : 0,
    otherDeductions,
    total:
      (nationalPension ? insurance.nationalPension : 0) +
      (healthInsurance ? insurance.healthInsurance + insurance.longTermCare : 0) +
      (employmentInsurance ? insurance.employmentInsurance : 0) +
      (incomeTax ? tax.total : 0) +
      otherDeductions,
  };
}

/**
 * 월급여 총액 계산
 */
export function calculateMonthlySalary(params: {
  baseSalary: number;
  overtimePay?: number;
  nightPay?: number;
  holidayPay?: number;
  weeklyHolidayPay?: number;
  mealAllowance?: number;
  transportAllowance?: number;
  positionAllowance?: number;
  otherAllowances?: number;
}): number {
  const {
    baseSalary,
    overtimePay = 0,
    nightPay = 0,
    holidayPay = 0,
    weeklyHolidayPay = 0,
    mealAllowance = 0,
    transportAllowance = 0,
    positionAllowance = 0,
    otherAllowances = 0,
  } = params;

  return (
    baseSalary +
    overtimePay +
    nightPay +
    holidayPay +
    weeklyHolidayPay +
    mealAllowance +
    transportAllowance +
    positionAllowance +
    otherAllowances
  );
}

/**
 * 실수령액 계산
 */
export function calculateNetPay(
  grossPay: number,
  deductionOptions?: Parameters<typeof calculateTotalDeductions>[1]
): {
  grossPay: number;
  deductions: ReturnType<typeof calculateTotalDeductions>;
  netPay: number;
} {
  const deductions = calculateTotalDeductions(grossPay, deductionOptions);

  return {
    grossPay,
    deductions,
    netPay: grossPay - deductions.total,
  };
}

/**
 * 최저임금 준수 확인
 */
export function checkMinimumWage(
  hourlyRate: number,
  minimumWage: number = DEFAULT_MINIMUM_WAGE
): {
  isCompliant: boolean;
  difference: number;
  message: string;
} {
  const isCompliant = hourlyRate >= minimumWage;
  const difference = hourlyRate - minimumWage;

  return {
    isCompliant,
    difference,
    message: isCompliant
      ? `최저임금 준수 (${difference.toLocaleString()}원 초과)`
      : `최저임금 미달 (${Math.abs(difference).toLocaleString()}원 부족)`,
  };
}

/**
 * 퇴직금 계산
 * 1년 이상 근무 시 30일분 평균임금
 */
export function calculateSeverancePay(
  averageMonthlyPay: number,
  totalWorkDays: number
): number {
  // 1년 미만 근무 시 퇴직금 없음
  if (totalWorkDays < 365) {
    return 0;
  }

  // 퇴직금 = (평균임금 × 30일) × (총 근무일수 / 365)
  const dailyPay = averageMonthlyPay / 30;
  const yearsWorked = totalWorkDays / 365;

  return Math.round(dailyPay * 30 * yearsWorked);
}
