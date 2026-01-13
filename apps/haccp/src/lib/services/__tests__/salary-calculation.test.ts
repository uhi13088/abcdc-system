/**
 * Salary Calculation Service Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Mock salary calculation service for testing
class MockSalaryCalculationService {
  private laborLaw = {
    minimumWageHourly: 10030,
    overtimeRate: 1.5,
    nightRate: 0.5,
    holidayRate: 1.5,
    nationalPensionRate: 0.045,
    healthInsuranceRate: 0.03545,
    longTermCareRate: 0.1281,
    employmentInsuranceRate: 0.009,
  };

  /**
   * Calculate overtime pay at 1.5x rate
   */
  calculateOvertimePay(hours: number, hourlyRate: number, rate: number = 1.5): number {
    return Math.round(hours * hourlyRate * rate);
  }

  /**
   * Calculate night pay (additional 0.5x for night hours)
   */
  calculateNightPay(hours: number, hourlyRate: number): number {
    return Math.round(hours * hourlyRate * this.laborLaw.nightRate);
  }

  /**
   * Calculate holiday pay at 1.5x rate
   */
  calculateHolidayPay(hours: number, hourlyRate: number): number {
    return Math.round(hours * hourlyRate * this.laborLaw.holidayRate);
  }

  /**
   * Calculate weekly holiday pay (주휴수당)
   * Only applicable for 15+ hours per week
   */
  calculateWeeklyHolidayPay(weeklyHours: number, hourlyRate: number): number {
    if (weeklyHours < 15) {
      return 0;
    }
    // 8 hours of pay for full-time (40+ hours)
    const eligibleHours = Math.min((weeklyHours / 40) * 8, 8);
    return Math.round(eligibleHours * hourlyRate);
  }

  /**
   * Calculate national pension deduction
   */
  calculateNationalPension(grossPay: number): number {
    // National pension is 4.5% of gross pay (employee portion)
    // Only applies to income between 350,000 and 5,530,000 KRW monthly
    const minIncome = 350000;
    const maxIncome = 5530000;
    const applicableIncome = Math.max(minIncome, Math.min(grossPay, maxIncome));
    return Math.round(applicableIncome * this.laborLaw.nationalPensionRate);
  }

  /**
   * Calculate health insurance deduction
   */
  calculateHealthInsurance(grossPay: number): number {
    return Math.round(grossPay * this.laborLaw.healthInsuranceRate);
  }

  /**
   * Calculate long-term care insurance
   */
  calculateLongTermCare(healthInsurance: number): number {
    return Math.round(healthInsurance * this.laborLaw.longTermCareRate);
  }

  /**
   * Calculate employment insurance deduction
   */
  calculateEmploymentInsurance(grossPay: number): number {
    return Math.round(grossPay * this.laborLaw.employmentInsuranceRate);
  }

  /**
   * Calculate total insurance deductions
   */
  calculateInsuranceDeductions(grossPay: number): {
    nationalPension: number;
    healthInsurance: number;
    longTermCare: number;
    employmentInsurance: number;
    total: number;
  } {
    const nationalPension = this.calculateNationalPension(grossPay);
    const healthInsurance = this.calculateHealthInsurance(grossPay);
    const longTermCare = this.calculateLongTermCare(healthInsurance);
    const employmentInsurance = this.calculateEmploymentInsurance(grossPay);

    return {
      nationalPension,
      healthInsurance,
      longTermCare,
      employmentInsurance,
      total: nationalPension + healthInsurance + longTermCare + employmentInsurance,
    };
  }

  /**
   * Validate minimum wage
   */
  validateMinimumWage(hourlyRate: number): boolean {
    return hourlyRate >= this.laborLaw.minimumWageHourly;
  }
}

describe('SalaryCalculationService', () => {
  let service: MockSalaryCalculationService;

  beforeEach(() => {
    service = new MockSalaryCalculationService();
  });

  describe('calculateOvertimePay', () => {
    it('should calculate overtime pay at 1.5x rate', () => {
      const result = service.calculateOvertimePay(10, 10000, 1.5);
      expect(result).toBe(150000); // 10시간 * 10000원 * 1.5
    });

    it('should calculate overtime pay with custom rate', () => {
      const result = service.calculateOvertimePay(5, 12000, 2.0);
      expect(result).toBe(120000); // 5시간 * 12000원 * 2.0
    });

    it('should return 0 for 0 hours', () => {
      const result = service.calculateOvertimePay(0, 10000, 1.5);
      expect(result).toBe(0);
    });
  });

  describe('calculateNightPay', () => {
    it('should calculate night pay at 0.5x additional rate', () => {
      const result = service.calculateNightPay(4, 10000);
      expect(result).toBe(20000); // 4시간 * 10000원 * 0.5
    });
  });

  describe('calculateHolidayPay', () => {
    it('should calculate holiday pay at 1.5x rate', () => {
      const result = service.calculateHolidayPay(8, 10000);
      expect(result).toBe(120000); // 8시간 * 10000원 * 1.5
    });
  });

  describe('calculateWeeklyHolidayPay', () => {
    it('should return 0 for less than 15 hours per week', () => {
      const result = service.calculateWeeklyHolidayPay(14, 10000);
      expect(result).toBe(0);
    });

    it('should return 0 for exactly 0 hours', () => {
      const result = service.calculateWeeklyHolidayPay(0, 10000);
      expect(result).toBe(0);
    });

    it('should calculate weekly holiday pay for 15+ hours', () => {
      const result = service.calculateWeeklyHolidayPay(15, 10000);
      expect(result).toBe(30000); // (15/40) * 8 * 10000 = 3시간 * 10000원
    });

    it('should calculate full weekly holiday pay for 40 hours', () => {
      const result = service.calculateWeeklyHolidayPay(40, 10000);
      expect(result).toBe(80000); // 8시간 * 10000원
    });

    it('should cap weekly holiday pay at 8 hours for 40+ hours', () => {
      const result = service.calculateWeeklyHolidayPay(50, 10000);
      expect(result).toBe(80000); // Capped at 8시간 * 10000원
    });
  });

  describe('calculateNationalPension', () => {
    it('should calculate national pension at 4.5% rate', () => {
      const result = service.calculateNationalPension(3000000);
      expect(result).toBe(135000); // 3000000 * 0.045
    });

    it('should use minimum income floor of 350,000', () => {
      const result = service.calculateNationalPension(200000);
      expect(result).toBe(15750); // 350000 * 0.045 (uses minimum)
    });

    it('should use maximum income ceiling', () => {
      const result = service.calculateNationalPension(10000000);
      expect(result).toBe(248850); // 5530000 * 0.045 (uses maximum)
    });
  });

  describe('calculateHealthInsurance', () => {
    it('should calculate health insurance at 3.545% rate', () => {
      const result = service.calculateHealthInsurance(3000000);
      expect(result).toBe(106350); // 3000000 * 0.03545
    });
  });

  describe('calculateLongTermCare', () => {
    it('should calculate long-term care at 12.81% of health insurance', () => {
      const healthInsurance = 100000;
      const result = service.calculateLongTermCare(healthInsurance);
      expect(result).toBe(12810); // 100000 * 0.1281
    });
  });

  describe('calculateEmploymentInsurance', () => {
    it('should calculate employment insurance at 0.9% rate', () => {
      const result = service.calculateEmploymentInsurance(3000000);
      expect(result).toBe(27000); // 3000000 * 0.009
    });
  });

  describe('calculateInsuranceDeductions', () => {
    it('should calculate all insurance deductions correctly', () => {
      const result = service.calculateInsuranceDeductions(3000000);

      expect(result.nationalPension).toBe(135000);
      expect(result.healthInsurance).toBe(106350);
      expect(result.longTermCare).toBe(13623); // 106350 * 0.1281
      expect(result.employmentInsurance).toBe(27000);
      expect(result.total).toBe(result.nationalPension + result.healthInsurance + result.longTermCare + result.employmentInsurance);
    });
  });

  describe('validateMinimumWage', () => {
    it('should return true for hourly rate >= minimum wage', () => {
      expect(service.validateMinimumWage(10030)).toBe(true);
      expect(service.validateMinimumWage(15000)).toBe(true);
    });

    it('should return false for hourly rate < minimum wage', () => {
      expect(service.validateMinimumWage(9000)).toBe(false);
      expect(service.validateMinimumWage(10029)).toBe(false);
    });
  });
});
