'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Download, TrendingUp, TrendingDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface SalaryDetail {
  id: string;
  year: number;
  month: number;
  base_salary: number;
  overtime_pay: number;
  night_pay: number;
  holiday_pay: number;
  weekly_holiday_pay: number;
  meal_allowance: number;
  transport_allowance: number;
  total_gross_pay: number;
  national_pension: number;
  health_insurance: number;
  long_term_care: number;
  employment_insurance: number;
  income_tax: number;
  local_income_tax: number;
  total_deductions: number;
  net_pay: number;
  work_days: number;
  total_hours: number;
  status: string;
  pay_date?: string;
}

export default function SalaryPage() {
  const router = useRouter();
  const [salaries, setSalaries] = useState<SalaryDetail[]>([]);
  const [selectedSalary, setSelectedSalary] = useState<SalaryDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const fetchSalaries = useCallback(async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        router.push('/auth/login');
        return;
      }

      // Fetch all salary records for this user, ordered by year/month descending
      const { data: salaryData } = await supabase
        .from('salaries')
        .select('*')
        .eq('user_id', authUser.id)
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      if (salaryData && salaryData.length > 0) {
        setSalaries(salaryData);
        setSelectedSalary(salaryData[0]);
      }
    } catch (error) {
      console.error('Failed to fetch salaries:', error);
    } finally {
      setLoading(false);
    }
  }, [supabase, router]);

  useEffect(() => {
    fetchSalaries();
  }, [fetchSalaries]);

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('ko-KR') + '원';
  };

  const getMonthName = (year: number, month: number) => {
    return `${year}년 ${month}월`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 safe-top">
        <div className="flex items-center">
          <button onClick={() => router.back()} className="p-2 -ml-2 mr-2">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">급여 명세서</h1>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : salaries.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
          <p>급여 정보가 없습니다.</p>
        </div>
      ) : (
        <div className="p-4 space-y-4">
          {/* Month Selector */}
          <div className="flex overflow-x-auto gap-2 pb-2 -mx-4 px-4">
            {salaries.map((salary) => (
              <button
                key={salary.id}
                onClick={() => setSelectedSalary(salary)}
                className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-colors ${
                  selectedSalary?.id === salary.id
                    ? 'bg-primary text-white'
                    : 'bg-white text-gray-600 border'
                }`}
              >
                {getMonthName(salary.year, salary.month)}
              </button>
            ))}
          </div>

          {selectedSalary && (
            <>
              {/* Net Pay Card */}
              <div className="bg-primary rounded-2xl p-5 text-white">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-primary-100">실수령액</p>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    selectedSalary.status === 'PAID'
                      ? 'bg-white/20'
                      : 'bg-yellow-400/20 text-yellow-200'
                  }`}>
                    {selectedSalary.status === 'PAID' ? '지급완료' : selectedSalary.status === 'CONFIRMED' ? '확정됨' : '계산중'}
                  </span>
                </div>
                <p className="text-3xl font-bold mb-1">{formatCurrency(selectedSalary.net_pay)}</p>
                <p className="text-sm text-primary-100">
                  {selectedSalary.pay_date && `${new Date(selectedSalary.pay_date).getMonth() + 1}월 ${new Date(selectedSalary.pay_date).getDate()}일 지급`}
                </p>
              </div>

              {/* Work Summary */}
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <h3 className="font-bold text-gray-900 mb-3">근무 현황</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-gray-900">{selectedSalary.work_days}일</p>
                    <p className="text-sm text-gray-500">근무일</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-gray-900">{selectedSalary.total_hours}시간</p>
                    <p className="text-sm text-gray-500">총 근무시간</p>
                  </div>
                </div>
              </div>

              {/* Earnings */}
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-gray-900 flex items-center">
                    <TrendingUp className="w-5 h-5 mr-2 text-green-500" />
                    지급 내역
                  </h3>
                  <span className="text-green-600 font-bold">{formatCurrency(selectedSalary.total_gross_pay)}</span>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">기본급</span>
                    <span className="text-gray-900">{formatCurrency(selectedSalary.base_salary)}</span>
                  </div>
                  {selectedSalary.overtime_pay > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">연장근로수당</span>
                      <span className="text-gray-900">{formatCurrency(selectedSalary.overtime_pay)}</span>
                    </div>
                  )}
                  {selectedSalary.night_pay > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">야간근로수당</span>
                      <span className="text-gray-900">{formatCurrency(selectedSalary.night_pay)}</span>
                    </div>
                  )}
                  {selectedSalary.holiday_pay > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">휴일근로수당</span>
                      <span className="text-gray-900">{formatCurrency(selectedSalary.holiday_pay)}</span>
                    </div>
                  )}
                  {selectedSalary.weekly_holiday_pay > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">주휴수당</span>
                      <span className="text-gray-900">{formatCurrency(selectedSalary.weekly_holiday_pay)}</span>
                    </div>
                  )}
                  {selectedSalary.meal_allowance > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">식대</span>
                      <span className="text-gray-900">{formatCurrency(selectedSalary.meal_allowance)}</span>
                    </div>
                  )}
                  {selectedSalary.transport_allowance > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">교통비</span>
                      <span className="text-gray-900">{formatCurrency(selectedSalary.transport_allowance)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Deductions */}
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-gray-900 flex items-center">
                    <TrendingDown className="w-5 h-5 mr-2 text-red-500" />
                    공제 내역
                  </h3>
                  <span className="text-red-600 font-bold">-{formatCurrency(selectedSalary.total_deductions)}</span>
                </div>
                <div className="space-y-3">
                  {selectedSalary.national_pension > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">국민연금</span>
                      <span className="text-gray-900">{formatCurrency(selectedSalary.national_pension)}</span>
                    </div>
                  )}
                  {selectedSalary.health_insurance > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">건강보험</span>
                      <span className="text-gray-900">{formatCurrency(selectedSalary.health_insurance)}</span>
                    </div>
                  )}
                  {selectedSalary.long_term_care > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">장기요양보험</span>
                      <span className="text-gray-900">{formatCurrency(selectedSalary.long_term_care)}</span>
                    </div>
                  )}
                  {selectedSalary.employment_insurance > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">고용보험</span>
                      <span className="text-gray-900">{formatCurrency(selectedSalary.employment_insurance)}</span>
                    </div>
                  )}
                  {selectedSalary.income_tax > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">소득세</span>
                      <span className="text-gray-900">{formatCurrency(selectedSalary.income_tax)}</span>
                    </div>
                  )}
                  {selectedSalary.local_income_tax > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">지방소득세</span>
                      <span className="text-gray-900">{formatCurrency(selectedSalary.local_income_tax)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Download Button */}
              <button className="w-full bg-gray-100 text-gray-700 rounded-xl py-4 font-medium flex items-center justify-center">
                <Download className="w-5 h-5 mr-2" />
                급여명세서 다운로드
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
