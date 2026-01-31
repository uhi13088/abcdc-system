'use client';

import React, { useState, useEffect } from 'react';
import { Edit2, Search, CreditCard, TrendingUp, Building2, AlertCircle } from 'lucide-react';
import { format, addMonths, addYears } from 'date-fns';

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
  ceoName: string;
  userEmail: string;
  planId: string;
  planName: string;
  status: 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'TRIAL';
  billingCycle: 'MONTHLY' | 'YEARLY';
  currentPeriodEnd: string;
  amount: number;
  cancelAtPeriodEnd: boolean;
  haccpAddonEnabled: boolean;
  roastingAddonEnabled: boolean;
}

export default function SubscriptionsPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'plans' | 'subscriptions'>('plans');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPlan, setFilterPlan] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isEditPlanOpen, setIsEditPlanOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [isEditSubscriptionOpen, setIsEditSubscriptionOpen] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
  const [savingSubscription, setSavingSubscription] = useState(false);
  const [editFormData, setEditFormData] = useState<{
    planId: string;
    status: string;
    billingCycle: 'MONTHLY' | 'YEARLY';
    currentPeriodEnd: string;
    haccpAddonEnabled: boolean;
    roastingAddonEnabled: boolean;
  } | null>(null);

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
          name: p.name?.toUpperCase() || p.name,
          displayName: p.display_name || p.name,
          priceMonthly: p.price_monthly || 0,
          priceYearly: p.price_yearly || (p.price_monthly || 0) * 12 * 0.8,
          maxEmployees: p.max_employees ?? 10,
          maxStores: p.max_stores ?? 1,
          features: Array.isArray(p.features) ? p.features : Object.keys(p.features || {}).filter(k => p.features[k]),
          active: p.is_active !== false,
          subscriberCount: p.subscriber_count || 0,
        })));

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setSubscriptions((data.subscriptions || []).map((s: any) => ({
          id: s.id,
          companyId: s.company_id,
          companyName: s.companies?.name || '(회사 정보 없음)',
          ceoName: s.companies?.ceo_name || '-',
          userEmail: s.admin_user?.email || s.companies?.email || '-',
          planId: s.plan_id,
          planName: s.subscription_plans?.display_name || s.subscription_plans?.name || '무료',
          status: s.status || 'ACTIVE',
          billingCycle: s.billing_cycle || 'MONTHLY',
          currentPeriodEnd: s.current_period_end || '2099-12-31',
          amount: s.subscription_plans?.price_monthly || 0,
          cancelAtPeriodEnd: s.cancel_at_period_end || false,
          haccpAddonEnabled: s.haccp_addon_enabled || false,
          roastingAddonEnabled: s.roasting_addon_enabled || false,
        })));
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Check if a plan is paid (has price > 0)
  const isPaidPlan = (planId: string) => {
    const plan = plans.find(p => p.id === planId);
    return plan ? plan.priceMonthly > 0 : false;
  };

  // Calculate expiration date based on billing cycle
  const calculateExpirationDate = (billingCycle: 'MONTHLY' | 'YEARLY') => {
    const today = new Date();
    return billingCycle === 'YEARLY'
      ? format(addYears(today, 1), 'yyyy-MM-dd')
      : format(addMonths(today, 1), 'yyyy-MM-dd');
  };

  // Handle plan change in edit form
  const handlePlanChange = (newPlanId: string) => {
    if (!editFormData) return;

    const wasPaid = isPaidPlan(editFormData.planId);
    const willBePaid = isPaidPlan(newPlanId);

    let newPeriodEnd = editFormData.currentPeriodEnd;

    // FREE → Paid: Set new expiration date
    if (!wasPaid && willBePaid) {
      newPeriodEnd = calculateExpirationDate(editFormData.billingCycle);
    }
    // Paid → FREE: Clear expiration date
    else if (wasPaid && !willBePaid) {
      newPeriodEnd = '';
    }

    setEditFormData({
      ...editFormData,
      planId: newPlanId,
      currentPeriodEnd: newPeriodEnd,
    });
  };

  // Handle billing cycle change
  const handleBillingCycleChange = (newCycle: 'MONTHLY' | 'YEARLY') => {
    if (!editFormData) return;

    // Only recalculate if it's a paid plan
    if (isPaidPlan(editFormData.planId)) {
      setEditFormData({
        ...editFormData,
        billingCycle: newCycle,
        currentPeriodEnd: calculateExpirationDate(newCycle),
      });
    } else {
      setEditFormData({
        ...editFormData,
        billingCycle: newCycle,
      });
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

  const filteredSubscriptions = subscriptions.filter(sub => {
    const matchesSearch =
      sub.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.ceoName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.userEmail.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPlan = filterPlan === 'all' || sub.planName === filterPlan;
    const matchesStatus = filterStatus === 'all' || sub.status === filterStatus;
    return matchesSearch && matchesPlan && matchesStatus;
  });

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
          <div className="p-4 border-b space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="이메일, 대표자명, 회사명으로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-3">
              <select
                value={filterPlan}
                onChange={(e) => setFilterPlan(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">모든 플랜</option>
                {plans.map(p => (
                  <option key={p.id} value={p.displayName}>{p.displayName}</option>
                ))}
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">모든 상태</option>
                <option value="ACTIVE">활성</option>
                <option value="PAST_DUE">결제 지연</option>
                <option value="CANCELED">취소됨</option>
                <option value="TRIAL">체험</option>
              </select>
              <span className="text-sm text-gray-500 self-center ml-auto">
                {filteredSubscriptions.length}개 결과
              </span>
            </div>
          </div>
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">이메일</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">회사</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">플랜</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">애드온</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">금액</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredSubscriptions.map(sub => (
                <tr key={sub.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{sub.userEmail}</div>
                    <div className="text-xs text-gray-500">{sub.ceoName}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{sub.companyName}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">
                      {sub.planName}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-1">
                      {sub.haccpAddonEnabled && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 rounded">
                          HACCP
                        </span>
                      )}
                      {sub.roastingAddonEnabled && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded">
                          로스팅
                        </span>
                      )}
                      {!sub.haccpAddonEnabled && !sub.roastingAddonEnabled && (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {sub.amount === 0 ? '-' : `${sub.amount.toLocaleString()}원`}
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(sub.status)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => {
                        setEditingSubscription(sub);
                        setEditFormData({
                          planId: sub.planId,
                          status: sub.status,
                          billingCycle: sub.billingCycle,
                          currentPeriodEnd: sub.currentPeriodEnd === '2099-12-31' ? '' : sub.currentPeriodEnd,
                          haccpAddonEnabled: sub.haccpAddonEnabled,
                          roastingAddonEnabled: sub.roastingAddonEnabled,
                        });
                        setIsEditSubscriptionOpen(true);
                      }}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 플랜 수정 모달 */}
      {isEditPlanOpen && editingPlan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => { setIsEditPlanOpen(false); setEditingPlan(null); }}>
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4" onClick={(e) => e.stopPropagation()}>
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

      {/* 구독 수정 모달 */}
      {isEditSubscriptionOpen && editingSubscription && editFormData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => { setIsEditSubscriptionOpen(false); setEditingSubscription(null); setEditFormData(null); }}>
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b">
              <h2 className="text-xl font-bold">구독 수정</h2>
              <p className="text-sm text-gray-500 mt-1">{editingSubscription.companyName}</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">플랜</label>
                <select
                  value={editFormData.planId}
                  onChange={(e) => handlePlanChange(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {plans.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.displayName} ({p.priceMonthly === 0 ? '무료' : `${p.priceMonthly.toLocaleString()}원/월`})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
                <select
                  value={editFormData.status}
                  onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ACTIVE">활성</option>
                  <option value="PAST_DUE">결제 지연</option>
                  <option value="CANCELED">취소됨</option>
                  <option value="TRIAL">체험</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">결제 주기</label>
                <select
                  value={editFormData.billingCycle}
                  onChange={(e) => handleBillingCycleChange(e.target.value as 'MONTHLY' | 'YEARLY')}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="MONTHLY">월간</option>
                  <option value="YEARLY">연간</option>
                </select>
              </div>

              {/* 유료 플랜일 때만 만료일 표시 */}
              {isPaidPlan(editFormData.planId) && (
                <div className="border-t pt-4 mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-3">유료 플랜 설정</label>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">만료일</label>
                      <input
                        type="date"
                        value={editFormData.currentPeriodEnd}
                        onChange={(e) => setEditFormData({ ...editFormData, currentPeriodEnd: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        만료일이 지나면 자동으로 무료 플랜으로 변경됩니다
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="border-t pt-4 mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-3">애드온</label>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editFormData.haccpAddonEnabled}
                      onChange={(e) => setEditFormData({ ...editFormData, haccpAddonEnabled: e.target.checked })}
                      className="w-4 h-4 text-orange-600 rounded"
                    />
                    <div>
                      <div className="font-medium text-gray-900">HACCP 관리</div>
                      <div className="text-xs text-gray-500">식품안전관리 기능 (+99,000원/월)</div>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editFormData.roastingAddonEnabled}
                      onChange={(e) => setEditFormData({ ...editFormData, roastingAddonEnabled: e.target.checked })}
                      className="w-4 h-4 text-amber-600 rounded"
                    />
                    <div>
                      <div className="font-medium text-gray-900">로스팅 관리</div>
                      <div className="text-xs text-gray-500">원두 로스팅 관리 기능 (+99,000원/월)</div>
                    </div>
                  </label>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsEditSubscriptionOpen(false);
                  setEditingSubscription(null);
                  setEditFormData(null);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                disabled={savingSubscription}
              >
                취소
              </button>
              <button
                disabled={savingSubscription}
                onClick={async () => {
                  try {
                    setSavingSubscription(true);

                    const response = await fetch(`/api/company-subscriptions/${editingSubscription.id}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        plan_id: editFormData.planId,
                        status: editFormData.status,
                        billing_cycle: editFormData.billingCycle,
                        current_period_end: isPaidPlan(editFormData.planId) ? editFormData.currentPeriodEnd : null,
                        haccp_addon_enabled: editFormData.haccpAddonEnabled,
                        roasting_addon_enabled: editFormData.roastingAddonEnabled,
                      }),
                    });

                    if (response.ok) {
                      setIsEditSubscriptionOpen(false);
                      setEditingSubscription(null);
                      setEditFormData(null);
                      fetchData();
                    } else {
                      const error = await response.json();
                      alert(error.error || '저장에 실패했습니다.');
                    }
                  } catch (error) {
                    console.error('Failed to save:', error);
                    alert('저장에 실패했습니다.');
                  } finally {
                    setSavingSubscription(false);
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {savingSubscription ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
