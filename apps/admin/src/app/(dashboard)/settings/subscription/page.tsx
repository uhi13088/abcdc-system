'use client';

import React, { useState, useEffect } from 'react';
import { Check, CreditCard, AlertCircle, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface Plan {
  id: string;
  name: string;
  displayName: string;
  priceMonthly: number;
  priceYearly: number;
  maxEmployees: number;
  maxStores: number;
  features: string[];
}

interface Subscription {
  id: string;
  planId: string;
  planName: string;
  status: string;
  billingCycle: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

interface PaymentHistory {
  id: string;
  amount: number;
  status: string;
  paidAt: string;
  invoiceUrl?: string;
}

export default function SubscriptionPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [payments, setPayments] = useState<PaymentHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [changingPlan, setChangingPlan] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [subRes, plansRes, paymentsRes] = await Promise.all([
        fetch('/api/subscription'),
        fetch('/api/subscription/plans'),
        fetch('/api/subscription/payments'),
      ]);

      if (subRes.ok) {
        const subData = await subRes.json();
        setSubscription(subData.subscription);
      }

      if (plansRes.ok) {
        const plansData = await plansRes.json();
        setPlans(plansData.plans || []);
      }

      if (paymentsRes.ok) {
        const paymentsData = await paymentsRes.json();
        setPayments(paymentsData.payments || []);
      }
    } catch (error) {
      console.error('Failed to fetch subscription data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePlan = async (planId: string) => {
    if (!confirm('플랜을 변경하시겠습니까?')) return;

    try {
      setChangingPlan(true);
      const response = await fetch('/api/subscription/change-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, billingCycle }),
      });

      if (response.ok) {
        const { checkoutUrl } = await response.json();
        if (checkoutUrl) {
          window.location.href = checkoutUrl;
        } else {
          alert('플랜이 변경되었습니다.');
          fetchData();
        }
      } else {
        alert('플랜 변경에 실패했습니다.');
      }
    } catch (error) {
      alert('오류가 발생했습니다.');
    } finally {
      setChangingPlan(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm('정말 구독을 취소하시겠습니까? 현재 결제 기간이 끝나면 무료 플랜으로 변경됩니다.')) {
      return;
    }

    try {
      const response = await fetch('/api/subscription/cancel', {
        method: 'POST',
      });

      if (response.ok) {
        alert('구독이 취소되었습니다. 현재 결제 기간이 끝나면 무료 플랜으로 변경됩니다.');
        fetchData();
      }
    } catch (error) {
      alert('구독 취소에 실패했습니다.');
    }
  };

  const handleManagePayment = async () => {
    try {
      const response = await fetch('/api/subscription/portal', {
        method: 'POST',
      });

      if (response.ok) {
        const { portalUrl } = await response.json();
        window.open(portalUrl, '_blank');
      }
    } catch (error) {
      alert('결제 관리 페이지를 열 수 없습니다.');
    }
  };

  const getPrice = (plan: Plan) => {
    return billingCycle === 'YEARLY' ? plan.priceYearly : plan.priceMonthly;
  };

  const getMonthlyPrice = (plan: Plan) => {
    return billingCycle === 'YEARLY' ? Math.round(plan.priceYearly / 12) : plan.priceMonthly;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">구독 관리</h1>
        <p className="text-gray-600 mt-1">플랜을 관리하고 결제 정보를 확인합니다.</p>
      </div>

      {/* 현재 구독 상태 */}
      {subscription && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">현재 플랜</h2>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold text-blue-600">{subscription.planName}</h3>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                <span>
                  {subscription.billingCycle === 'YEARLY' ? '연간 결제' : '월간 결제'}
                </span>
                <span>
                  다음 결제일: {format(new Date(subscription.currentPeriodEnd), 'yyyy년 M월 d일', { locale: ko })}
                </span>
              </div>
              {subscription.cancelAtPeriodEnd && (
                <div className="flex items-center gap-2 mt-2 text-orange-600">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">구독 취소 예정 (기간 종료 후 무료 플랜으로 변경)</span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleManagePayment}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <CreditCard className="h-4 w-4 inline mr-2" />
                결제 수단 관리
              </button>
              {!subscription.cancelAtPeriodEnd && subscription.planName !== '무료' && (
                <button
                  onClick={handleCancelSubscription}
                  className="px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
                >
                  구독 취소
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 결제 주기 선택 */}
      <div className="flex items-center justify-center gap-4 bg-gray-100 rounded-lg p-1 max-w-xs mx-auto">
        <button
          onClick={() => setBillingCycle('MONTHLY')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            billingCycle === 'MONTHLY'
              ? 'bg-white shadow text-gray-900'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          월간
        </button>
        <button
          onClick={() => setBillingCycle('YEARLY')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            billingCycle === 'YEARLY'
              ? 'bg-white shadow text-gray-900'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          연간 <span className="text-green-600">(20% 할인)</span>
        </button>
      </div>

      {/* 플랜 목록 */}
      <div className="grid grid-cols-3 gap-6">
        {plans.map(plan => {
          const isCurrent = subscription?.planId === plan.id;
          const price = getPrice(plan);
          const monthlyPrice = getMonthlyPrice(plan);

          return (
            <div
              key={plan.id}
              className={`bg-white rounded-xl shadow-sm border p-6 ${
                isCurrent ? 'border-blue-500 ring-2 ring-blue-200' : ''
              }`}
            >
              {isCurrent && (
                <span className="inline-block bg-blue-100 text-blue-700 text-xs font-medium px-2 py-1 rounded-full mb-4">
                  현재 플랜
                </span>
              )}
              <h3 className="text-xl font-bold text-gray-900">{plan.displayName}</h3>
              <div className="mt-4">
                <span className="text-3xl font-bold">
                  {price === 0 ? '무료' : `${monthlyPrice.toLocaleString()}원`}
                </span>
                {price > 0 && <span className="text-gray-500">/월</span>}
              </div>
              {billingCycle === 'YEARLY' && price > 0 && (
                <p className="text-sm text-gray-500 mt-1">
                  연 {price.toLocaleString()}원 결제
                </p>
              )}

              <ul className="mt-6 space-y-3">
                <li className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-500" />
                  직원 {plan.maxEmployees === -1 ? '무제한' : `최대 ${plan.maxEmployees}명`}
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-500" />
                  매장 {plan.maxStores === -1 ? '무제한' : `최대 ${plan.maxStores}개`}
                </li>
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-500" />
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleChangePlan(plan.id)}
                disabled={isCurrent || changingPlan}
                className={`w-full mt-6 py-2 px-4 rounded-lg font-medium transition-colors ${
                  isCurrent
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isCurrent ? '현재 플랜' : changingPlan ? '처리 중...' : '선택'}
              </button>
            </div>
          );
        })}
      </div>

      {/* 결제 이력 */}
      {payments.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">결제 이력</h2>
          <table className="min-w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">날짜</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">금액</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">상태</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">영수증</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(payment => (
                <tr key={payment.id} className="border-b">
                  <td className="py-3 px-4 text-sm">
                    {format(new Date(payment.paidAt), 'yyyy-MM-dd')}
                  </td>
                  <td className="py-3 px-4 text-sm">
                    {payment.amount.toLocaleString()}원
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      payment.status === 'SUCCEEDED'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {payment.status === 'SUCCEEDED' ? '완료' : '실패'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {payment.invoiceUrl && (
                      <a
                        href={payment.invoiceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <ExternalLink className="h-4 w-4 inline" />
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
