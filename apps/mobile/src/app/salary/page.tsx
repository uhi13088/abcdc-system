'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { BottomNav } from '@/components/bottom-nav';

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

  const fetchSalary = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch salary via API
      const response = await fetch(`/api/salaries?year=${selectedYear}&month=${selectedMonth}`);
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/auth/login');
          return;
        }
        throw new Error('Failed to fetch salary');
      }

      const salaryData = await response.json();
      setSalary(salaryData);
    } catch (error) {
      console.error('Failed to fetch salary:', error);
      setSalary(null);
    } finally {
      setLoading(false);
    }
  }, [router, selectedYear, selectedMonth]);

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
          <button
            onClick={() => {
              if (!salary) return;

              const formatCurrency = (amount: number) => amount.toLocaleString() + '원';

              const content = `
                <!DOCTYPE html>
                <html>
                <head>
                  <meta charset="UTF-8">
                  <title>급여명세서 - ${selectedYear}년 ${selectedMonth}월</title>
                  <style>
                    @page { size: A4; margin: 15mm; }
                    body {
                      font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif;
                      padding: 20px;
                      font-size: 12px;
                      line-height: 1.6;
                    }
                    h1 { text-align: center; margin-bottom: 20px; font-size: 22px; }
                    .header { text-align: center; margin-bottom: 20px; color: #666; }
                    .summary { text-align: center; margin-bottom: 24px; padding: 16px; background: #f0f9ff; border-radius: 8px; }
                    .summary-amount { font-size: 28px; font-weight: bold; color: #2563eb; }
                    .summary-info { font-size: 12px; color: #666; margin-top: 8px; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                    th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                    th { background-color: #f5f5f5; font-weight: 600; width: 40%; }
                    td { text-align: right; }
                    .section-title { font-size: 14px; font-weight: bold; margin: 20px 0 10px 0; padding-bottom: 8px; border-bottom: 2px solid #333; }
                    .total-row { background-color: #f9f9f9; font-weight: bold; }
                    .negative { color: #dc2626; }
                    .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #999; }
                    @media print { body { padding: 0; } }
                  </style>
                </head>
                <body>
                  <h1>급 여 명 세 서</h1>
                  <p class="header">${selectedYear}년 ${selectedMonth}월 | 생성일: ${new Date().toLocaleDateString('ko-KR')}</p>

                  <div class="summary">
                    <div class="summary-amount">${formatCurrency(salary.net_pay)}</div>
                    <div class="summary-info">실수령액 | 근무일 ${salary.work_days}일 | 총 ${salary.total_hours}시간</div>
                  </div>

                  <div class="section-title">지급 내역</div>
                  <table>
                    <tr><th>기본급</th><td>${formatCurrency(salary.base_salary)}</td></tr>
                    ${salary.overtime_pay > 0 ? `<tr><th>연장근로수당</th><td>${formatCurrency(salary.overtime_pay)}</td></tr>` : ''}
                    ${salary.night_pay > 0 ? `<tr><th>야간근로수당</th><td>${formatCurrency(salary.night_pay)}</td></tr>` : ''}
                    ${salary.holiday_pay > 0 ? `<tr><th>휴일근로수당</th><td>${formatCurrency(salary.holiday_pay)}</td></tr>` : ''}
                    ${salary.weekly_holiday_pay > 0 ? `<tr><th>주휴수당</th><td>${formatCurrency(salary.weekly_holiday_pay)}</td></tr>` : ''}
                    ${salary.meal_allowance > 0 ? `<tr><th>식대</th><td>${formatCurrency(salary.meal_allowance)}</td></tr>` : ''}
                    <tr class="total-row"><th>총 지급액</th><td>${formatCurrency(salary.total_gross_pay)}</td></tr>
                  </table>

                  <div class="section-title">공제 내역</div>
                  <table>
                    <tr><th>국민연금</th><td class="negative">-${formatCurrency(salary.national_pension)}</td></tr>
                    <tr><th>건강보험</th><td class="negative">-${formatCurrency(salary.health_insurance)}</td></tr>
                    <tr><th>장기요양보험</th><td class="negative">-${formatCurrency(salary.long_term_care)}</td></tr>
                    <tr><th>고용보험</th><td class="negative">-${formatCurrency(salary.employment_insurance)}</td></tr>
                    <tr><th>소득세</th><td class="negative">-${formatCurrency(salary.income_tax)}</td></tr>
                    <tr><th>지방소득세</th><td class="negative">-${formatCurrency(salary.local_income_tax)}</td></tr>
                    <tr class="total-row"><th>총 공제액</th><td class="negative">-${formatCurrency(salary.total_deductions)}</td></tr>
                  </table>

                  <div class="footer">
                    본 명세서는 「근로기준법」제48조에 의거하여 발급되었습니다.
                  </div>
                </body>
                </html>
              `;

              const printWindow = window.open('', '_blank');
              if (printWindow) {
                printWindow.document.write(content);
                printWindow.document.close();
                printWindow.print();
              } else {
                alert('팝업이 차단되었습니다. 팝업을 허용해주세요.');
              }
            }}
            className="w-full py-4 bg-white border border-gray-200 rounded-2xl flex items-center justify-center gap-2 text-gray-700 font-medium shadow-sm"
          >
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
