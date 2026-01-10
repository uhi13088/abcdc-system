'use client';

import { useState, useEffect } from 'react';
import { Plus, PieChart, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

interface BudgetPlan {
  id: string;
  budget_year: number;
  budget_month: number;
  category: string;
  planned_amount: number;
  actual_amount: number;
  variance: number;
}

const categories = [
  { value: '재료비', label: '재료비', color: 'bg-orange-500' },
  { value: '인건비', label: '인건비', color: 'bg-green-500' },
  { value: '관리비', label: '관리비', color: 'bg-blue-500' },
  { value: '월세', label: '월세', color: 'bg-purple-500' },
  { value: '마케팅', label: '마케팅', color: 'bg-pink-500' },
  { value: '기타', label: '기타', color: 'bg-gray-500' },
];

export default function BudgetPage() {
  const [budgets, setBudgets] = useState<BudgetPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [formData, setFormData] = useState({
    category: '재료비',
    planned_amount: 0,
  });

  useEffect(() => {
    fetchBudgets();
  }, [selectedYear, selectedMonth]);

  const fetchBudgets = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/business/budget?year=${selectedYear}&month=${selectedMonth}`);
      if (response.ok) {
        const data = await response.json();
        setBudgets(data);
      } else {
        // Demo data
        setBudgets([
          { id: '1', budget_year: 2024, budget_month: 12, category: '재료비', planned_amount: 9000000, actual_amount: 8500000, variance: 500000 },
          { id: '2', budget_year: 2024, budget_month: 12, category: '인건비', planned_amount: 6500000, actual_amount: 6200000, variance: 300000 },
          { id: '3', budget_year: 2024, budget_month: 12, category: '관리비', planned_amount: 2000000, actual_amount: 2300000, variance: -300000 },
          { id: '4', budget_year: 2024, budget_month: 12, category: '월세', planned_amount: 1500000, actual_amount: 1500000, variance: 0 },
        ]);
      }
    } catch (error) {
      console.error('Failed to fetch budgets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/business/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          budget_year: selectedYear,
          budget_month: selectedMonth,
          ...formData,
        }),
      });

      if (response.ok) {
        setShowModal(false);
        fetchBudgets();
        setFormData({ category: '재료비', planned_amount: 0 });
      }
    } catch (error) {
      console.error('Failed to create budget:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount) + '원';
  };

  const totalPlanned = budgets.reduce((sum, b) => sum + b.planned_amount, 0);
  const totalActual = budgets.reduce((sum, b) => sum + b.actual_amount, 0);
  const totalVariance = totalPlanned - totalActual;

  const getCategoryColor = (category: string) => {
    return categories.find(c => c.value === category)?.color || 'bg-gray-500';
  };

  const getVarianceStatus = (variance: number) => {
    if (variance > 0) return { color: 'text-green-600', icon: TrendingDown, label: '절감' };
    if (variance < 0) return { color: 'text-red-600', icon: TrendingUp, label: '초과' };
    return { color: 'text-gray-600', icon: null, label: '예산 내' };
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">예산 관리</h1>
          <p className="mt-1 text-sm text-gray-500">예산 계획을 수립하고 실적과 비교합니다</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          예산 추가
        </button>
      </div>

      {/* Period Selector */}
      <div className="flex gap-4 mb-6">
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          className="px-3 py-2 border rounded-lg"
        >
          {[2024, 2025, 2026].map(year => (
            <option key={year} value={year}>{year}년</option>
          ))}
        </select>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
          className="px-3 py-2 border rounded-lg"
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
            <option key={month} value={month}>{month}월</option>
          ))}
        </select>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <PieChart className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">총 예산</p>
              <p className="text-xl font-bold">{formatCurrency(totalPlanned)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gray-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">실제 지출</p>
              <p className="text-xl font-bold">{formatCurrency(totalActual)}</p>
            </div>
          </div>
        </div>
        <div className={`bg-white rounded-xl shadow-sm border p-5 ${totalVariance < 0 ? 'border-red-200' : ''}`}>
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${totalVariance >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
              {totalVariance >= 0 ? (
                <TrendingDown className="w-6 h-6 text-green-600" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-red-600" />
              )}
            </div>
            <div>
              <p className="text-sm text-gray-500">{totalVariance >= 0 ? '절감액' : '초과액'}</p>
              <p className={`text-xl font-bold ${totalVariance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(Math.abs(totalVariance))}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Budget Items */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : budgets.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <PieChart className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">등록된 예산이 없습니다</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">카테고리</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">예산</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">실적</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">차이</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">진행률</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {budgets.map((budget) => {
                const status = getVarianceStatus(budget.variance);
                const progress = budget.planned_amount > 0
                  ? Math.min((budget.actual_amount / budget.planned_amount) * 100, 150)
                  : 0;
                const isOverBudget = progress > 100;

                return (
                  <tr key={budget.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full ${getCategoryColor(budget.category)}`}></span>
                        <span className="font-medium">{budget.category}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">{formatCurrency(budget.planned_amount)}</td>
                    <td className="px-6 py-4 text-right">{formatCurrency(budget.actual_amount)}</td>
                    <td className="px-6 py-4 text-right">
                      <span className={`flex items-center justify-end gap-1 ${status.color}`}>
                        {status.icon && <status.icon className="w-4 h-4" />}
                        {formatCurrency(Math.abs(budget.variance))}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${isOverBudget ? 'bg-red-500' : 'bg-green-500'}`}
                            style={{ width: `${Math.min(progress, 100)}%` }}
                          ></div>
                        </div>
                        <span className={`text-sm ${isOverBudget ? 'text-red-600' : 'text-gray-600'}`}>
                          {progress.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">예산 추가</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                닫기
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  {selectedYear}년 {selectedMonth}월 예산
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  {categories.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">예산 금액</label>
                <input
                  type="number"
                  value={formData.planned_amount}
                  onChange={(e) => setFormData({ ...formData, planned_amount: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">
                  취소
                </button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
