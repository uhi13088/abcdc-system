'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { BottomNav } from '@/components/bottom-nav';
import { createClient } from '@/lib/supabase/client';

interface SalaryData {
  id: string;
  year: number;
  month: number;
  status: string;
  base_salary: number;
  overtime_pay: number;
  night_pay: number;
  holiday_pay: number;
  weekly_holiday_pay: number;
  meal_allowance: number;
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
  pay_date?: string;
}

export default function SalaryPage() {
  const router = useRouter();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [salary, setSalary] = useState<SalaryData | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const fetchSalary = useCallback(async () => {
    try {
      setLoading(true);

      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        router.push('/auth/login');
        return;
      }

      const { data: salaryData } = await supabase
        .from('salaries')
        .select('*')
        .eq('staff_id', authUser.id)
        .eq('year', selectedYear)
        .eq('month', selectedMonth)
        .single();

      setSalary(salaryData);
    } catch (error) {
      console.error('Failed to fetch salary:', error);
      setSalary(null);
    } finally {
      setLoading(false);
    }
  }, [supabase, router, selectedYear, selectedMonth]);

  useEffect(() => {
    fetchSalary();
  }, [fetchSalary]);

  const prevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedYear(selectedYear - 1);
      setSelectedMonth(12);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const nextMonth = () => {
    const now = new Date();
    const nextDate = new Date(selectedYear, selectedMonth, 1);
    if (nextDate <= now) {
      if (selectedMonth === 12) {
        setSelectedYear(selectedYear + 1);
        setSelectedMonth(1);
      } else {
        setSelectedMonth(selectedMonth + 1);
      }
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { bg: string; text: string; label: string }> = {
      CALCULATED: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: '계산 중' },
      CONFIRMED: { bg: 'bg-blue-100', text: 'text-blue-700', label: '확정됨' },
      PAID: { bg: 'bg-green-100', text: 'text-green-700', label: '지급 완료' },
    };
    const { bg, text, label } = config[status] || config.CALCULATED;
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${bg} ${text}`}>
        {label}
      </span>
    );
  };

  const DetailRow = ({
    label,
    value,
    negative = false,
    bold = false,
  }: {
    label: string;
    value: number;
    negative?: boolean;
    bold?: boolean;
  }) => (
    <div className={`flex justify-between py-2 ${bold ? 'font-semibold' : ''}`}>
      <span className="text-gray-600">{label}</span>
      <span className={negative ? 'text-red-500' : 'text-gray-900'}>
        {negative ? '-' : ''}
        {value.toLocaleString()}원
      </span>
    </div>
  );

  return (
    <div className="min-h-screen pb-20 bg-gray-50">
      {/* Header */}
      <div className="bg-primary text-white p-6 safe-top">
        <h1 className="text-xl font-bold mb-4">급여 조회</h1>

        {/* Month Selector */}
        <div className="flex items-center justify-center gap-4 bg-white/10 rounded-xl p-3">
          <button onClick={prevMonth} className="p-2">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-lg font-medium min-w-[120px] text-center">
            {selectedYear}년 {selectedMonth}월
          </span>
          <button onClick={nextMonth} className="p-2">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : salary ? (
        <div className="p-4 space-y-4 -mt-4">
          {/* Summary Card */}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-500">실수령액</span>
              {getStatusBadge(salary.status)}
            </div>
            <p className="text-3xl font-bold text-primary mb-2">
              {salary.net_pay.toLocaleString()}원
            </p>
            <div className="flex gap-4 text-sm text-gray-500">
              <span>근무일 {salary.work_days}일</span>
              <span>총 {salary.total_hours}시간</span>
            </div>
          </div>

          {/* 지급 내역 */}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h2 className="font-semibold text-gray-900 mb-3">지급 내역</h2>
            <div className="divide-y">
              <DetailRow label="기본급" value={salary.base_salary} />
              <DetailRow label="연장근로수당" value={salary.overtime_pay} />
              <DetailRow label="야간근로수당" value={salary.night_pay} />
              {salary.holiday_pay > 0 && <DetailRow label="휴일근로수당" value={salary.holiday_pay} />}
              <DetailRow label="주휴수당" value={salary.weekly_holiday_pay} />
              <DetailRow label="식대" value={salary.meal_allowance} />
              <div className="pt-2 mt-2 border-t">
                <DetailRow label="총 지급액" value={salary.total_gross_pay} bold />
              </div>
            </div>
          </div>

          {/* 공제 내역 */}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h2 className="font-semibold text-gray-900 mb-3">공제 내역</h2>
            <div className="divide-y">
              <DetailRow label="국민연금" value={salary.national_pension} negative />
              <DetailRow label="건강보험" value={salary.health_insurance} negative />
              <DetailRow label="장기요양보험" value={salary.long_term_care} negative />
              <DetailRow label="고용보험" value={salary.employment_insurance} negative />
              <DetailRow label="소득세" value={salary.income_tax} negative />
              <DetailRow label="지방소득세" value={salary.local_income_tax} negative />
              <div className="pt-2 mt-2 border-t">
                <DetailRow label="총 공제액" value={salary.total_deductions} negative bold />
              </div>
            </div>
          </div>

          {/* Download Button */}
          <button className="w-full py-4 bg-white border border-gray-200 rounded-2xl flex items-center justify-center gap-2 text-gray-700 font-medium shadow-sm">
            <FileText className="w-5 h-5" />
            급여명세서 다운로드
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
          <p>해당 월의 급여 정보가 없습니다.</p>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
