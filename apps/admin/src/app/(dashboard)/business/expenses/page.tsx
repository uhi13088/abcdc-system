'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, Edit2, Check, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface ExpenseTransaction {
  id: string;
  transaction_date: string;
  merchant_name: string;
  amount: number;
  category: string | null;
  ai_category: string | null;
  ai_confidence: number | null;
  user_confirmed: boolean;
  source: string;
}

const CATEGORIES = [
  { value: 'INGREDIENTS', label: '재료비' },
  { value: 'LABOR', label: '인건비' },
  { value: 'RENT', label: '임대료' },
  { value: 'UTILITIES', label: '수도광열비' },
  { value: 'MARKETING', label: '마케팅비' },
  { value: 'SUPPLIES', label: '소모품비' },
  { value: 'MAINTENANCE', label: '수선유지비' },
  { value: 'INSURANCE', label: '보험료' },
  { value: 'TAX', label: '세금공과' },
  { value: 'FINANCE', label: '금융비용' },
  { value: 'DELIVERY', label: '배달비' },
  { value: 'SUBSCRIPTION', label: '구독/서비스' },
  { value: 'OTHER', label: '기타' },
];

export default function ExpensesPage() {
  const [transactions, setTransactions] = useState<ExpenseTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [currentMonth, setCurrentMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [summary, setSummary] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchTransactions();
  }, [currentMonth]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/business/expenses?month=${currentMonth}`);
      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions || []);
        setSummary(data.summary || {});
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      const response = await fetch('/api/business/expenses/sync', { method: 'POST' });
      if (response.ok) {
        const result = await response.json();
        alert(`${result.syncedCount}건의 거래가 동기화되었습니다.`);
        fetchTransactions();
      }
    } catch (error) {
      alert('동기화에 실패했습니다.');
    } finally {
      setSyncing(false);
    }
  };

  const handleClassify = async () => {
    try {
      setClassifying(true);
      const response = await fetch('/api/business/expenses/classify', { method: 'POST' });
      if (response.ok) {
        const result = await response.json();
        alert(`${result.classifiedCount}건이 AI로 분류되었습니다.`);
        fetchTransactions();
      }
    } catch (error) {
      alert('자동 분류에 실패했습니다.');
    } finally {
      setClassifying(false);
    }
  };

  const handleConfirmCategory = async (transactionId: string, category: string) => {
    try {
      const response = await fetch(`/api/business/expenses/${transactionId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category }),
      });

      if (response.ok) {
        setTransactions(prev =>
          prev.map(tx =>
            tx.id === transactionId
              ? { ...tx, category, user_confirmed: true }
              : tx
          )
        );
        setEditingId(null);
      }
    } catch (error) {
      alert('분류 확정에 실패했습니다.');
    }
  };

  const getCategoryLabel = (value: string) => {
    return CATEGORIES.find(c => c.value === value)?.label || value;
  };

  const getConfidenceColor = (confidence: number | null) => {
    if (!confidence) return 'text-gray-400';
    if (confidence >= 0.9) return 'text-green-600';
    if (confidence >= 0.7) return 'text-yellow-600';
    return 'text-red-600';
  };

  const totalExpense = transactions.reduce((sum, tx) => sum + tx.amount, 0);

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">비용 관리</h1>
          <p className="text-gray-600 mt-1">거래내역을 조회하고 분류를 관리합니다.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleClassify}
            disabled={classifying}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {classifying ? '분류 중...' : 'AI 자동 분류'}
          </button>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? '동기화 중...' : '거래 동기화'}
          </button>
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

      {/* 요약 카드 */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <p className="text-sm text-gray-500">총 비용</p>
          <p className="text-2xl font-bold text-gray-900">
            {totalExpense.toLocaleString()}원
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <p className="text-sm text-gray-500">재료비</p>
          <p className="text-2xl font-bold text-orange-600">
            {(summary['INGREDIENTS'] || 0).toLocaleString()}원
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <p className="text-sm text-gray-500">인건비</p>
          <p className="text-2xl font-bold text-blue-600">
            {(summary['LABOR'] || 0).toLocaleString()}원
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <p className="text-sm text-gray-500">기타</p>
          <p className="text-2xl font-bold text-gray-600">
            {(summary['OTHER'] || 0).toLocaleString()}원
          </p>
        </div>
      </div>

      {/* 거래 목록 */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                날짜
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                거래처
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                금액
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                분류
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                확신도
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                작업
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  로딩 중...
                </td>
              </tr>
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  거래 내역이 없습니다.
                </td>
              </tr>
            ) : (
              transactions.map(tx => (
                <tr key={tx.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {format(new Date(tx.transaction_date), 'MM/dd')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {tx.merchant_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {tx.amount.toLocaleString()}원
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editingId === tx.id ? (
                      <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="text-sm border rounded px-2 py-1"
                      >
                        <option value="">선택</option>
                        {CATEGORIES.map(cat => (
                          <option key={cat.value} value={cat.value}>{cat.label}</option>
                        ))}
                      </select>
                    ) : (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        tx.user_confirmed
                          ? 'bg-green-100 text-green-800'
                          : tx.ai_category
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {getCategoryLabel(tx.category || tx.ai_category || 'OTHER')}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {tx.ai_confidence ? (
                      <span className={`text-sm ${getConfidenceColor(tx.ai_confidence)}`}>
                        {Math.round(tx.ai_confidence * 100)}%
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {editingId === tx.id ? (
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleConfirmCategory(tx.id, selectedCategory)}
                          className="p-1 text-green-600 hover:bg-green-50 rounded"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-1 text-gray-500 hover:bg-gray-100 rounded"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingId(tx.id);
                          setSelectedCategory(tx.category || tx.ai_category || '');
                        }}
                        className="p-1 text-gray-500 hover:bg-gray-100 rounded"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
