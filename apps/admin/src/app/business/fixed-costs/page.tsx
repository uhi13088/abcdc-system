'use client';

import { useState, useEffect } from 'react';
import { Plus, Wallet, Edit, Trash2, Calendar, Building2 } from 'lucide-react';

interface FixedCost {
  id: string;
  cost_name: string;
  category: string;
  amount: number;
  frequency: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  payment_day: number;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  notes: string;
}

const categories = [
  { value: '월세', label: '월세' },
  { value: '관리비', label: '관리비' },
  { value: '보험', label: '보험' },
  { value: '통신비', label: '통신비' },
  { value: '기타', label: '기타' },
];

export default function FixedCostsPage() {
  const [costs, setCosts] = useState<FixedCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    cost_name: '',
    category: '월세',
    amount: 0,
    frequency: 'MONTHLY' as const,
    payment_day: 1,
    start_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  useEffect(() => {
    fetchCosts();
  }, []);

  const fetchCosts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/business/fixed-costs');
      if (response.ok) {
        const data = await response.json();
        setCosts(data);
      }
    } catch (error) {
      console.error('Failed to fetch fixed costs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/business/fixed-costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setShowModal(false);
        fetchCosts();
        setFormData({
          cost_name: '',
          category: '월세',
          amount: 0,
          frequency: 'MONTHLY',
          payment_day: 1,
          start_date: new Date().toISOString().split('T')[0],
          notes: '',
        });
      }
    } catch (error) {
      console.error('Failed to create fixed cost:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
      await fetch(`/api/business/fixed-costs/${id}`, { method: 'DELETE' });
      fetchCosts();
    } catch (error) {
      console.error('Failed to delete fixed cost:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount) + '원';
  };

  const getMonthlyAmount = (cost: FixedCost) => {
    if (cost.frequency === 'MONTHLY') return cost.amount;
    if (cost.frequency === 'QUARTERLY') return cost.amount / 3;
    if (cost.frequency === 'YEARLY') return cost.amount / 12;
    return cost.amount;
  };

  const totalMonthly = costs.filter(c => c.is_active).reduce((sum, c) => sum + getMonthlyAmount(c), 0);

  const frequencyLabels = {
    'MONTHLY': '매월',
    'QUARTERLY': '분기',
    'YEARLY': '연간',
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">고정비용 관리</h1>
          <p className="mt-1 text-sm text-gray-500">월세, 관리비 등 정기 비용을 관리합니다</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          고정비용 추가
        </button>
      </div>

      {/* Summary */}
      <div className="bg-white rounded-xl shadow-sm border p-5 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Wallet className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">월간 고정비용 합계</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalMonthly)}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">등록된 항목</p>
            <p className="text-xl font-bold">{costs.filter(c => c.is_active).length}개</p>
          </div>
        </div>
      </div>

      {/* Costs Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : costs.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <Wallet className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">등록된 고정비용이 없습니다</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {costs.map((cost) => (
            <div key={cost.id} className={`bg-white rounded-xl shadow-sm border p-5 ${!cost.is_active ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <Building2 className="w-4 h-4 text-gray-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{cost.cost_name}</h3>
                    <span className="text-xs text-gray-500">{cost.category}</span>
                  </div>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  cost.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                }`}>
                  {cost.is_active ? '활성' : '비활성'}
                </span>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">금액</span>
                  <span className="font-semibold">{formatCurrency(cost.amount)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">주기</span>
                  <span className="text-sm">{frequencyLabels[cost.frequency]}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">납부일</span>
                  <span className="text-sm">매월 {cost.payment_day}일</span>
                </div>
                {cost.frequency !== 'MONTHLY' && (
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>월평균</span>
                    <span>{formatCurrency(getMonthlyAmount(cost))}</span>
                  </div>
                )}
              </div>

              {cost.notes && (
                <p className="text-xs text-gray-500 mb-4 line-clamp-2">{cost.notes}</p>
              )}

              <div className="flex justify-end gap-1 pt-3 border-t">
                <button className="p-2 hover:bg-gray-100 rounded">
                  <Edit className="w-4 h-4 text-gray-500" />
                </button>
                <button onClick={() => handleDelete(cost.id)} className="p-2 hover:bg-red-100 rounded">
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">고정비용 추가</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                닫기
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">비용명</label>
                <input
                  type="text"
                  value={formData.cost_name}
                  onChange={(e) => setFormData({ ...formData, cost_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="예: 본점 월세"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">납부 주기</label>
                  <select
                    value={formData.frequency}
                    onChange={(e) => setFormData({ ...formData, frequency: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="MONTHLY">매월</option>
                    <option value="QUARTERLY">분기</option>
                    <option value="YEARLY">연간</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">납부일</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={formData.payment_day}
                    onChange={(e) => setFormData({ ...formData, payment_day: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">시작일</label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">메모</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
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
