'use client';

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Download,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface ProfitLossStatement {
  companyId: string;
  periodStart: string;
  periodEnd: string;
  totalRevenue: number;
  totalExpense: number;
  payrollExpense: number;
  expenseByCategory: Record<string, number>;
  netProfit: number;
  netProfitMargin: number;
  revenueChange: number;
  expenseChange: number;
  profitChange: number;
}

interface AIRecommendation {
  icon: string;
  title: string;
  description: string;
  action: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

const CATEGORY_LABELS: Record<string, string> = {
  INGREDIENTS: '재료비',
  LABOR: '인건비',
  RENT: '임대료',
  UTILITIES: '수도광열비',
  MARKETING: '마케팅비',
  SUPPLIES: '소모품비',
  MAINTENANCE: '수선유지비',
  INSURANCE: '보험료',
  TAX: '세금공과',
  FINANCE: '금융비용',
  DELIVERY: '배달비',
  SUBSCRIPTION: '구독/서비스',
  OTHER: '기타',
};

const CATEGORY_COLORS: Record<string, string> = {
  INGREDIENTS: '#f97316',
  LABOR: '#3b82f6',
  RENT: '#8b5cf6',
  UTILITIES: '#10b981',
  MARKETING: '#ec4899',
  SUPPLIES: '#6366f1',
  MAINTENANCE: '#14b8a6',
  INSURANCE: '#f59e0b',
  TAX: '#ef4444',
  FINANCE: '#84cc16',
  DELIVERY: '#06b6d4',
  SUBSCRIPTION: '#a855f7',
  OTHER: '#6b7280',
};

export default function ProfitLossPage() {
  const [statement, setStatement] = useState<ProfitLossStatement | null>(null);
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(format(new Date(), 'yyyy-MM'));

  useEffect(() => {
    fetchStatement();
  }, [currentMonth]);

  const fetchStatement = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/business/profit-loss?month=${currentMonth}`);
      if (response.ok) {
        const data = await response.json();
        setStatement(data.statement);
        setRecommendations(data.recommendations || []);
      }
    } catch (error) {
      console.error('Failed to fetch statement:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      const [year, month] = currentMonth.split('-').map(Number);
      const response = await fetch('/api/business/profit-loss/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month }),
      });

      if (response.ok) {
        alert('손익계산서가 생성되었습니다.');
        fetchStatement();
      }
    } catch (error) {
      alert('생성에 실패했습니다.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadPDF = async () => {
    const [year, month] = currentMonth.split('-').map(Number);
    window.open(`/api/business/profit-loss/pdf?year=${year}&month=${month}`, '_blank');
  };

  const renderChangeIndicator = (change: number, inverted = false) => {
    const isPositive = inverted ? change < 0 : change > 0;
    const color = isPositive ? 'text-green-600' : change === 0 ? 'text-gray-500' : 'text-red-600';

    return (
      <span className={`flex items-center gap-1 text-sm ${color}`}>
        {change > 0 ? (
          <TrendingUp className="h-4 w-4" />
        ) : change < 0 ? (
          <TrendingDown className="h-4 w-4" />
        ) : null}
        {change !== 0 && `${Math.abs(change).toFixed(1)}%`}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">손익계산서</h1>
          <p className="text-gray-600 mt-1">매출과 비용을 분석하여 경영 현황을 파악합니다.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
            {generating ? '생성 중...' : '다시 계산'}
          </button>
          {statement && (
            <button
              onClick={handleDownloadPDF}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download className="h-4 w-4" />
              PDF 다운로드
            </button>
          )}
        </div>
      </div>

      {/* 월 선택 */}
      <div className="flex items-center justify-between bg-white rounded-lg shadow-sm border p-4">
        <button
          onClick={() => {
            const [year, month] = currentMonth.split('-').map(Number);
            const prev = new Date(year, month - 2, 1);
            setCurrentMonth(format(prev, 'yyyy-MM'));
          }}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="text-lg font-semibold">
          {format(new Date(currentMonth + '-01'), 'yyyy년 M월', { locale: ko })}
        </span>
        <button
          onClick={() => {
            const [year, month] = currentMonth.split('-').map(Number);
            const next = new Date(year, month, 1);
            setCurrentMonth(format(next, 'yyyy-MM'));
          }}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {!statement ? (
        <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
          <p className="text-gray-500 mb-4">해당 월의 손익계산서가 없습니다.</p>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            손익계산서 생성
          </button>
        </div>
      ) : (
        <>
          {/* 요약 카드 */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <p className="text-sm text-gray-500 mb-1">총 매출</p>
              <p className="text-3xl font-bold text-gray-900">
                {statement.totalRevenue.toLocaleString()}원
              </p>
              <div className="mt-2">
                {renderChangeIndicator(statement.revenueChange)}
                <span className="text-xs text-gray-500 ml-1">전월 대비</span>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-6">
              <p className="text-sm text-gray-500 mb-1">총 비용</p>
              <p className="text-3xl font-bold text-gray-900">
                {statement.totalExpense.toLocaleString()}원
              </p>
              <div className="mt-2">
                {renderChangeIndicator(statement.expenseChange, true)}
                <span className="text-xs text-gray-500 ml-1">전월 대비</span>
              </div>
            </div>

            <div className={`rounded-lg shadow-sm border p-6 ${
              statement.netProfit >= 0 ? 'bg-green-50' : 'bg-red-50'
            }`}>
              <p className="text-sm text-gray-500 mb-1">순이익</p>
              <p className={`text-3xl font-bold ${
                statement.netProfit >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {statement.netProfit.toLocaleString()}원
              </p>
              <div className="mt-2">
                {renderChangeIndicator(statement.profitChange)}
                <span className="text-xs text-gray-500 ml-1">전월 대비</span>
              </div>
            </div>
          </div>

          {/* 비용 구조 */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">비용 구조</h3>
            <div className="grid grid-cols-2 gap-8">
              {/* 비용 비율 바 */}
              <div className="space-y-3">
                {Object.entries(statement.expenseByCategory)
                  .sort(([, a], [, b]) => b - a)
                  .map(([category, amount]) => {
                    const ratio = (amount / statement.totalExpense) * 100;
                    return (
                      <div key={category}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-700">
                            {CATEGORY_LABELS[category] || category}
                          </span>
                          <span className="text-gray-500">
                            {amount.toLocaleString()}원 ({ratio.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${ratio}%`,
                              backgroundColor: CATEGORY_COLORS[category] || '#6b7280',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* 수익성 지표 */}
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">이익률</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {statement.netProfitMargin.toFixed(1)}%
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">인건비 비율</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {((statement.payrollExpense / statement.totalRevenue) * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">재료비 비율</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {(((statement.expenseByCategory['INGREDIENTS'] || 0) / statement.totalRevenue) * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* AI 개선 제안 */}
          {recommendations.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                AI 개선 제안
              </h3>
              <div className="space-y-4">
                {recommendations.map((rec, idx) => (
                  <div
                    key={idx}
                    className={`flex items-start gap-4 p-4 rounded-lg ${
                      rec.priority === 'HIGH'
                        ? 'bg-red-50 border border-red-200'
                        : rec.priority === 'MEDIUM'
                        ? 'bg-yellow-50 border border-yellow-200'
                        : 'bg-blue-50 border border-blue-200'
                    }`}
                  >
                    <span className="text-2xl">{rec.icon}</span>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{rec.title}</h4>
                      <p className="text-sm text-gray-600 mt-1">{rec.description}</p>
                    </div>
                    <button
                      className={`px-3 py-1.5 text-sm rounded-lg ${
                        rec.priority === 'HIGH'
                          ? 'bg-red-600 text-white hover:bg-red-700'
                          : rec.priority === 'MEDIUM'
                          ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {rec.action}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
