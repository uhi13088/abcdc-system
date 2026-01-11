'use client';

import { useState, useEffect } from 'react';
import { Plus, Calendar, Receipt, Tag, Search, CheckCircle, AlertCircle } from 'lucide-react';

interface ExpenseTransaction {
  id: string;
  transaction_date: string;
  amount: number;
  description: string;
  merchant_name: string;
  category: string;
  ai_classified: boolean;
  ai_confidence: number;
  user_confirmed: boolean;
}

const categories = [
  { value: '재료비', label: '재료비', color: 'bg-orange-100 text-orange-700' },
  { value: '관리비', label: '관리비', color: 'bg-blue-100 text-blue-700' },
  { value: '월세', label: '월세', color: 'bg-purple-100 text-purple-700' },
  { value: '인건비', label: '인건비', color: 'bg-green-100 text-green-700' },
  { value: '기타', label: '기타', color: 'bg-gray-100 text-gray-700' },
];

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<ExpenseTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [filterCategory, setFilterCategory] = useState('');
  const [formData, setFormData] = useState({
    transaction_date: new Date().toISOString().split('T')[0],
    amount: 0,
    description: '',
    merchant_name: '',
    category: '기타',
  });

  useEffect(() => {
    fetchExpenses();
  }, [selectedMonth, filterCategory]);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      let url = `/api/business/expenses?month=${selectedMonth}`;
      if (filterCategory) url += `&category=${filterCategory}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setExpenses(data);
      }
    } catch (error) {
      console.error('Failed to fetch expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/business/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setShowModal(false);
        fetchExpenses();
        setFormData({
          transaction_date: new Date().toISOString().split('T')[0],
          amount: 0,
          description: '',
          merchant_name: '',
          category: '기타',
        });
      }
    } catch (error) {
      console.error('Failed to create expense:', error);
    }
  };

  const confirmCategory = async (id: string) => {
    try {
      await fetch(`/api/business/expenses/${id}/confirm`, { method: 'POST' });
      fetchExpenses();
    } catch (error) {
      console.error('Failed to confirm category:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount) + '원';
  };

  const getCategoryColor = (category: string) => {
    return categories.find(c => c.value === category)?.color || 'bg-gray-100 text-gray-700';
  };

  const totalByCategory = categories.map(cat => ({
    ...cat,
    total: expenses.filter(e => e.category === cat.value).reduce((sum, e) => sum + e.amount, 0),
  }));

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">지출 관리</h1>
          <p className="mt-1 text-sm text-gray-500">지출 내역을 분류하고 관리합니다</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          지출 입력
        </button>
      </div>

      {/* Filters & Summary */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500">조회 기간</span>
          </div>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>

        {totalByCategory.map((cat, idx) => (
          <div
            key={idx}
            onClick={() => setFilterCategory(filterCategory === cat.value ? '' : cat.value)}
            className={`bg-white rounded-xl shadow-sm border p-4 cursor-pointer hover:shadow-md transition-shadow ${
              filterCategory === cat.value ? 'ring-2 ring-blue-500' : ''
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-3 h-3 rounded-full ${cat.color.replace('text', 'bg').split(' ')[0]}`}></span>
              <span className="text-sm text-gray-500">{cat.label}</span>
            </div>
            <p className="text-lg font-bold">{formatCurrency(cat.total)}</p>
          </div>
        ))}
      </div>

      {/* Expenses Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">날짜</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">내용</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">업체</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">카테고리</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">금액</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">확인</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <Receipt className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    등록된 지출이 없습니다
                  </td>
                </tr>
              ) : (
                expenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm">{expense.transaction_date}</td>
                    <td className="px-6 py-4 text-sm">{expense.description}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{expense.merchant_name || '-'}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 text-xs rounded-full ${getCategoryColor(expense.category)}`}>
                          {expense.category}
                        </span>
                        {expense.ai_classified && !expense.user_confirmed && (
                          <span className="text-xs text-yellow-600" title={`AI 신뢰도: ${(expense.ai_confidence * 100).toFixed(0)}%`}>
                            AI
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-medium">{formatCurrency(expense.amount)}</td>
                    <td className="px-6 py-4 text-center">
                      {expense.user_confirmed ? (
                        <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />
                      ) : (
                        <button
                          onClick={() => confirmCategory(expense.id)}
                          className="text-blue-600 hover:text-blue-700 text-sm"
                        >
                          확인
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">지출 입력</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                닫기
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">날짜</label>
                  <input
                    type="date"
                    value={formData.transaction_date}
                    onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">금액</label>
                  <input
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">내용</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">업체명</label>
                  <input
                    type="text"
                    value={formData.merchant_name}
                    onChange={(e) => setFormData({ ...formData, merchant_name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
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
