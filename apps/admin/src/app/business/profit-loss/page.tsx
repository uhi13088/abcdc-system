'use client';

import { useState, useEffect, useCallback } from 'react';
import { FileText, TrendingUp, TrendingDown, Download, ChevronDown, ChevronUp } from 'lucide-react';

interface ProfitLossStatement {
  id: string;
  period_type: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  period_year: number;
  period_month?: number;
  period_quarter?: number;
  total_revenue: number;
  revenue_breakdown: Record<string, number>;
  total_expense: number;
  expense_breakdown: Record<string, number>;
  payroll_expense: number;
  net_profit: number;
  profit_margin: number;
  revenue_change: number;
  expense_change: number;
  profit_change: number;
  is_finalized: boolean;
}

export default function ProfitLossPage() {
  const [statements, setStatements] = useState<ProfitLossStatement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [periodType, setPeriodType] = useState<'MONTHLY' | 'QUARTERLY' | 'YEARLY'>('MONTHLY');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchStatements = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/business/profit-loss?year=${selectedYear}&type=${periodType}`);
      if (response.ok) {
        const data = await response.json();
        setStatements(data);
      } else {
        setStatements([]);
      }
    } catch (error) {
      console.error('Failed to fetch statements:', error);
      setStatements([]);
    } finally {
      setLoading(false);
    }
  }, [selectedYear, periodType]);

  useEffect(() => {
    fetchStatements();
  }, [fetchStatements]);

  const handleDownloadPDF = async () => {
    if (statements.length === 0) {
      alert('다운로드할 손익계산서가 없습니다.');
      return;
    }

    // Generate simple HTML-based print/PDF
    const periodLabel = periodType === 'MONTHLY' ? '월간' : periodType === 'QUARTERLY' ? '분기' : '연간';

    const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>손익계산서 - ${selectedYear}년 ${periodLabel}</title>
        <style>
          body { font-family: 'Malgun Gothic', sans-serif; padding: 40px; }
          h1 { text-align: center; margin-bottom: 30px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          th, td { border: 1px solid #ddd; padding: 12px; text-align: right; }
          th { background-color: #f5f5f5; text-align: center; }
          .text-left { text-align: left; }
          .total { font-weight: bold; background-color: #f9f9f9; }
          .positive { color: green; }
          .negative { color: red; }
          .header { margin-bottom: 20px; text-align: center; color: #666; }
        </style>
      </head>
      <body>
        <h1>손익계산서</h1>
        <p class="header">${selectedYear}년 ${periodLabel} | 생성일: ${new Date().toLocaleDateString('ko-KR')}</p>
        ${statements.map(stmt => `
          <h3>${getPeriodLabel(stmt)} ${stmt.is_finalized ? '(확정)' : ''}</h3>
          <table>
            <tr><th colspan="2">수익</th></tr>
            ${stmt.revenue_breakdown ? Object.entries(stmt.revenue_breakdown).map(([k, v]) =>
              `<tr><td class="text-left">${k}</td><td>${formatCurrency(v as number)}</td></tr>`
            ).join('') : ''}
            <tr class="total"><td class="text-left">총 수익</td><td class="positive">${formatCurrency(stmt.total_revenue || 0)}</td></tr>
            <tr><th colspan="2">비용</th></tr>
            ${stmt.expense_breakdown ? Object.entries(stmt.expense_breakdown).map(([k, v]) =>
              `<tr><td class="text-left">${k}</td><td>${formatCurrency(v as number)}</td></tr>`
            ).join('') : ''}
            <tr><td class="text-left">인건비</td><td>${formatCurrency(stmt.payroll_expense || 0)}</td></tr>
            <tr class="total"><td class="text-left">총 비용</td><td class="negative">${formatCurrency((stmt.total_expense || 0) + (stmt.payroll_expense || 0))}</td></tr>
            <tr class="total"><td class="text-left">순이익</td><td class="${(stmt.net_profit || 0) >= 0 ? 'positive' : 'negative'}">${formatCurrency(stmt.net_profit || 0)}</td></tr>
            <tr class="total"><td class="text-left">영업이익률</td><td>${safeToFixed(stmt.profit_margin, 1)}%</td></tr>
          </table>
        `).join('')}
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(content);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const safeToFixed = (value: number | null | undefined, digits: number): string => {
    if (value === null || value === undefined || isNaN(value)) return '0';
    return value.toFixed(digits);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount) + '원';
  };

  const getPeriodLabel = (stmt: ProfitLossStatement) => {
    if (stmt.period_type === 'MONTHLY' && stmt.period_month) {
      return `${stmt.period_year}년 ${stmt.period_month}월`;
    }
    if (stmt.period_type === 'QUARTERLY' && stmt.period_quarter) {
      return `${stmt.period_year}년 ${stmt.period_quarter}분기`;
    }
    return `${stmt.period_year}년`;
  };

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">손익계산서</h1>
          <p className="mt-1 text-sm text-gray-500">월별/분기별/연간 손익 현황을 확인합니다</p>
        </div>
        <button
          onClick={handleDownloadPDF}
          className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
        >
          <Download className="w-4 h-4" />
          PDF 다운로드
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          className="px-3 py-2 border rounded-lg"
        >
          {years.map(year => (
            <option key={year} value={year}>{year}년</option>
          ))}
        </select>
        <div className="flex rounded-lg border overflow-hidden">
          {(['MONTHLY', 'QUARTERLY', 'YEARLY'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setPeriodType(type)}
              className={`px-4 py-2 ${
                periodType === type ? 'bg-blue-600 text-white' : 'bg-white hover:bg-gray-50'
              }`}
            >
              {type === 'MONTHLY' ? '월간' : type === 'QUARTERLY' ? '분기' : '연간'}
            </button>
          ))}
        </div>
      </div>

      {/* Statements */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : statements.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">손익계산서가 없습니다</p>
        </div>
      ) : (
        <div className="space-y-4">
          {statements.map((stmt) => (
            <div key={stmt.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
              {/* Header */}
              <div
                className="p-5 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedId(expandedId === stmt.id ? null : stmt.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <h3 className="font-semibold text-lg">{getPeriodLabel(stmt)}</h3>
                    {stmt.is_finalized && (
                      <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">확정</span>
                    )}
                  </div>
                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <p className="text-sm text-gray-500">순이익</p>
                      <p className={`text-xl font-bold ${stmt.net_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(stmt.net_profit)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">영업이익률</p>
                      <p className="text-xl font-bold">{safeToFixed(stmt.profit_margin, 1)}%</p>
                    </div>
                    {expandedId === stmt.id ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-500" />
                    <span className="text-sm">매출: {formatCurrency(stmt.total_revenue)}</span>
                    {stmt.revenue_change != null && !isNaN(stmt.revenue_change) && (
                      <span className={`text-xs ${stmt.revenue_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ({stmt.revenue_change >= 0 ? '+' : ''}{safeToFixed(stmt.revenue_change, 1)}%)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-red-500" />
                    <span className="text-sm">비용: {formatCurrency(stmt.total_expense + stmt.payroll_expense)}</span>
                    {stmt.expense_change != null && !isNaN(stmt.expense_change) && (
                      <span className={`text-xs ${stmt.expense_change <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ({stmt.expense_change >= 0 ? '+' : ''}{safeToFixed(stmt.expense_change, 1)}%)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-500" />
                    <span className="text-sm">전기대비 이익변화</span>
                    {stmt.profit_change != null && !isNaN(stmt.profit_change) && (
                      <span className={`text-xs font-medium ${stmt.profit_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {stmt.profit_change >= 0 ? '+' : ''}{safeToFixed(stmt.profit_change, 1)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded Detail */}
              {expandedId === stmt.id && (
                <div className="border-t p-5 bg-gray-50">
                  <div className="grid grid-cols-2 gap-8">
                    {/* Revenue */}
                    <div>
                      <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-green-500" />
                        수익 상세
                      </h4>
                      <div className="bg-white rounded-lg p-4 space-y-2">
                        {Object.entries(stmt.revenue_breakdown).map(([source, amount]) => (
                          <div key={source} className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">{source}</span>
                            <span className="font-medium">{formatCurrency(amount)}</span>
                          </div>
                        ))}
                        <div className="flex items-center justify-between pt-2 border-t font-semibold">
                          <span>총 수익</span>
                          <span className="text-green-600">{formatCurrency(stmt.total_revenue)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Expenses */}
                    <div>
                      <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                        <TrendingDown className="w-4 h-4 text-red-500" />
                        비용 상세
                      </h4>
                      <div className="bg-white rounded-lg p-4 space-y-2">
                        {Object.entries(stmt.expense_breakdown).map(([category, amount]) => (
                          <div key={category} className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">{category}</span>
                            <span className="font-medium">{formatCurrency(amount)}</span>
                          </div>
                        ))}
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">인건비</span>
                          <span className="font-medium">{formatCurrency(stmt.payroll_expense)}</span>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t font-semibold">
                          <span>총 비용</span>
                          <span className="text-red-600">{formatCurrency(stmt.total_expense + stmt.payroll_expense)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
