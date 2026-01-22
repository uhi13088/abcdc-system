'use client';

import React, { useState, useEffect } from 'react';
import { Edit2, Search, CreditCard, TrendingUp, Building2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

interface Plan {
  id: string;
  name: string;
  displayName: string;
  priceMonthly: number;
  priceYearly: number;
  maxEmployees: number;
  maxStores: number;
  features: string[];
  active: boolean;
  subscriberCount: number;
}

interface Subscription {
  id: string;
  companyId: string;
  companyName: string;
  planId: string;
  planName: string;
  status: 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'TRIAL';
  billingCycle: 'MONTHLY' | 'YEARLY';
  currentPeriodEnd: string;
  amount: number;
  cancelAtPeriodEnd: boolean;
}

export default function SubscriptionsPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'plans' | 'subscriptions'>('plans');
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditPlanOpen, setIsEditPlanOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await fetch('/api/subscriptions');
      if (response.ok) {
        const data = await response.json();
        // Transform API data to match component interface
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setPlans((data.plans || []).map((p: any) => ({
          id: p.id,
          name: p.tier?.toUpperCase() || p.name,
          displayName: p.name,
          priceMonthly: p.price || 0,
          priceYearly: (p.price || 0) * 12 * 0.8, // 20% discount for yearly
          maxEmployees: p.max_employees || 10,
          maxStores: p.max_stores || 1,
          features: p.features || [],
          active: true,
          subscriberCount: p.subscriber_count || 0,
        })));

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setSubscriptions((data.subscriptions || []).map((s: any) => ({
          id: s.id,
          companyId: s.company_id,
          companyName: s.companies?.name || '알 수 없음',
          planId: s.plan_id,
          planName: s.subscription_plans?.name || '무료',
          status: s.status || 'ACTIVE',
          billingCycle: s.billing_cycle || 'MONTHLY',
          currentPeriodEnd: s.current_period_end || '2099-12-31',
          amount: s.subscription_plans?.price || 0,
          cancelAtPeriodEnd: s.cancel_at_period_end || false,
        })));
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: Subscription['status']) => {
    const config = {
      ACTIVE: { color: 'bg-green-100 text-green-700', label: '활성' },
      PAST_DUE: { color: 'bg-red-100 text-red-700', label: '결제 지연' },
      CANCELED: { color: 'bg-gray-100 text-gray-700', label: '취소됨' },
      TRIAL: { color: 'bg-blue-100 text-blue-700', label: '체험' },
    };
    const { color, label } = config[status];
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${color}`}>
        {label}
      </span>
    );
  };

  const filteredSubscriptions = subscriptions.filter(
    sub => sub.companyName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 통계 계산
  const totalMRR = subscriptions
    .filter(s => s.status === 'ACTIVE')
    .reduce((sum, s) => sum + (s.billingCycle === 'MONTHLY' ? s.amount : s.amount / 12), 0);

  const _activeSubscribers = subscriptions.filter(s => s.status === 'ACTIVE').length;
  const pastDueCount = subscriptions.filter(s => s.status === 'PAST_DUE').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">구독 관리</h1>
          <p className="text-gray-600 mt-1">플랜 및 구독을 관리합니다</p>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">월간 반복 수익 (MRR)</p>
              <p className="text-xl font-bold text-gray-900">
                {Math.round(totalMRR).toLocaleString()}원
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">전체 구독자</p>
              <p className="text-xl font-bold text-gray-900">{plans.reduce((sum, p) => sum + p.subscriberCount, 0)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">유료 구독자</p>
              <p className="text-xl font-bold text-gray-900">
                {plans.filter(p => p.priceMonthly > 0).reduce((sum, p) => sum + p.subscriberCount, 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">결제 지연</p>
              <p className="text-xl font-bold text-red-600">{pastDueCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 탭 */}
      <div className="border-b">
        <nav className="-mb-px flex gap-6">
          <button
            onClick={() => setActiveTab('plans')}
            className={`py-3 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'plans'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            플랜 관리
          </button>
          <button
            onClick={() => setActiveTab('subscriptions')}
            className={`py-3 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'subscriptions'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            구독 목록
          </button>
        </nav>
      </div>

      {/* 플랜 관리 탭 */}
      {activeTab === 'plans' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map(plan => (
            <div
              key={plan.id}
              className={`bg-white rounded-xl shadow-sm border p-6 ${
                !plan.active ? 'opacity-50' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">{plan.displayName}</h3>
                <button
                  onClick={() => {
                    setEditingPlan(plan);
                    setIsEditPlanOpen(true);
                  }}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>

              <div className="mb-4">
                <span className="text-3xl font-bold text-gray-900">
                  {plan.priceMonthly === 0 ? '무료' : `${plan.priceMonthly.toLocaleString()}원`}
                </span>
                {plan.priceMonthly > 0 && <span className="text-gray-500">/월</span>}
              </div>

              <div className="space-y-2 mb-4 text-sm text-gray-600">
                <p>직원: {plan.maxEmployees === -1 ? '무제한' : `최대 ${plan.maxEmployees}명`}</p>
                <p>매장: {plan.maxStores === -1 ? '무제한' : `최대 ${plan.maxStores}개`}</p>
              </div>

              <ul className="space-y-2 mb-6">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-sm">
                    <span className="text-green-500">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>

              <div className="pt-4 border-t">
                <p className="text-sm text-gray-500">
                  <span className="font-semibold text-gray-900">{plan.subscriberCount}</span> 구독자
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 구독 목록 탭 */}
      {activeTab === 'subscriptions' && (
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="회사명으로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">회사</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">플랜</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">결제 주기</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">금액</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">다음 결제일</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredSubscriptions.map(sub => (
                <tr key={sub.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{sub.companyName}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">
                      {sub.planName}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {sub.billingCycle === 'MONTHLY' ? '월간' : '연간'}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {sub.amount === 0 ? '-' : `${sub.amount.toLocaleString()}원`}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {sub.amount === 0 ? '-' : format(new Date(sub.currentPeriodEnd), 'yyyy-MM-dd')}
                    {sub.cancelAtPeriodEnd && (
                      <span className="ml-2 text-xs text-orange-600">(취소 예정)</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(sub.status)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 플랜 수정 모달 */}
      {isEditPlanOpen && editingPlan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4">
            <div className="px-6 py-4 border-b">
              <h2 className="text-xl font-bold">플랜 수정: {editingPlan.displayName}</h2>
            </div>
            <form id="planEditForm" className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">표시 이름</label>
                <input
                  type="text"
                  name="displayName"
                  defaultValue={editingPlan.displayName}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">월간 가격</label>
                  <input
                    type="number"
                    name="priceMonthly"
                    defaultValue={editingPlan.priceMonthly}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">연간 가격</label>
                  <input
                    type="number"
                    name="priceYearly"
                    defaultValue={editingPlan.priceYearly}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">최대 직원 수</label>
                  <input
                    type="number"
                    name="maxEmployees"
                    defaultValue={editingPlan.maxEmployees}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">-1 = 무제한</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">최대 매장 수</label>
                  <input
                    type="number"
                    name="maxStores"
                    defaultValue={editingPlan.maxStores}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">-1 = 무제한</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="active"
                  name="active"
                  defaultChecked={editingPlan.active}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <label htmlFor="active" className="text-sm text-gray-700">활성화</label>
              </div>
            </form>
            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsEditPlanOpen(false);
                  setEditingPlan(null);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                취소
              </button>
              <button
                onClick={async () => {
                  try {
                    const form = document.getElementById('planEditForm') as HTMLFormElement;
                    const formData = new FormData(form);

                    const response = await fetch(`/api/subscriptions/${editingPlan?.id}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        displayName: formData.get('displayName') || editingPlan?.displayName,
                        priceMonthly: Number(formData.get('priceMonthly')) || editingPlan?.priceMonthly,
                        priceYearly: Number(formData.get('priceYearly')) || editingPlan?.priceYearly,
                        maxEmployees: Number(formData.get('maxEmployees')) || editingPlan?.maxEmployees,
                        maxStores: Number(formData.get('maxStores')) || editingPlan?.maxStores,
                        features: editingPlan?.features || [],
                      }),
                    });

                    if (response.ok) {
                      setIsEditPlanOpen(false);
                      setEditingPlan(null);
                      fetchData();
                    } else {
                      alert('저장에 실패했습니다.');
                    }
                  } catch (error) {
                    console.error('Failed to save:', error);
                    alert('저장에 실패했습니다.');
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
