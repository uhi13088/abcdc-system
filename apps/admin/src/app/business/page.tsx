'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Wallet,
  Receipt,
  PieChart,
  BarChart3,
  FileText,
  Settings,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

interface DashboardStats {
  todaySales: number;
  monthSales: number;
  monthExpenses: number;
  netProfit: number;
  profitMargin: number;
  salesChange: number;
  expenseChange: number;
  profitChange: number;
}

const modules = [
  { name: '매출 관리', href: '/business/sales', icon: CreditCard, color: 'bg-green-500', description: '일일/월간 매출 현황' },
  { name: '지출 관리', href: '/business/expenses', icon: Receipt, color: 'bg-red-500', description: '비용 분류 및 관리' },
  { name: '고정비용', href: '/business/fixed-costs', icon: Wallet, color: 'bg-yellow-500', description: '월세, 관리비 등' },
  { name: '손익계산서', href: '/business/profit-loss', icon: FileText, color: 'bg-blue-500', description: '월간/분기별 손익' },
  { name: '예산 관리', href: '/business/budget', icon: PieChart, color: 'bg-purple-500', description: '예산 계획 및 비교' },
  { name: '분석 리포트', href: '/business/reports', icon: BarChart3, color: 'bg-indigo-500', description: 'AI 인사이트' },
];

export default function BusinessPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/business/dashboard');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else {
        // Demo data for now
        setStats({
          todaySales: 1250000,
          monthSales: 32500000,
          monthExpenses: 18500000,
          netProfit: 14000000,
          profitMargin: 43.1,
          salesChange: 8.5,
          expenseChange: 3.2,
          profitChange: 12.3,
        });
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(amount);
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">경영관리</h1>
        <p className="mt-1 text-sm text-gray-500">매출, 비용, 손익을 한눈에 파악하세요</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">오늘 매출</p>
              <p className="text-2xl font-bold text-gray-900">
                {loading ? '-' : formatCurrency(stats?.todaySales || 0)}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-500">실시간 업데이트</div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">이번달 매출</p>
              <p className="text-2xl font-bold text-gray-900">
                {loading ? '-' : formatCurrency(stats?.monthSales || 0)}
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          {stats && (
            <div className={`mt-2 text-xs flex items-center ${stats.salesChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {stats.salesChange >= 0 ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
              전월 대비 {Math.abs(stats.salesChange).toFixed(1)}%
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">이번달 비용</p>
              <p className="text-2xl font-bold text-gray-900">
                {loading ? '-' : formatCurrency(stats?.monthExpenses || 0)}
              </p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <TrendingDown className="w-6 h-6 text-red-600" />
            </div>
          </div>
          {stats && (
            <div className={`mt-2 text-xs flex items-center ${stats.expenseChange <= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {stats.expenseChange <= 0 ? <ArrowDownRight className="w-3 h-3 mr-1" /> : <ArrowUpRight className="w-3 h-3 mr-1" />}
              전월 대비 {Math.abs(stats.expenseChange).toFixed(1)}%
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">순이익</p>
              <p className="text-2xl font-bold text-gray-900">
                {loading ? '-' : formatCurrency(stats?.netProfit || 0)}
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <PieChart className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          {stats && (
            <div className="mt-2 text-xs text-gray-500">
              영업이익률 {stats.profitMargin.toFixed(1)}%
            </div>
          )}
        </div>
      </div>

      {/* Quick Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Revenue Chart Placeholder */}
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">월별 매출 추이</h3>
            <Link href="/business/reports" className="text-sm text-blue-600 hover:text-blue-700">
              자세히 보기
            </Link>
          </div>
          <div className="h-48 flex items-center justify-center bg-gray-50 rounded-lg">
            <div className="text-center text-gray-400">
              <BarChart3 className="w-12 h-12 mx-auto mb-2" />
              <p>차트가 여기에 표시됩니다</p>
            </div>
          </div>
        </div>

        {/* Expense Breakdown */}
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">비용 구조</h3>
            <Link href="/business/expenses" className="text-sm text-blue-600 hover:text-blue-700">
              자세히 보기
            </Link>
          </div>
          <div className="space-y-3">
            {[
              { category: '재료비', amount: 8500000, percent: 46 },
              { category: '인건비', amount: 6200000, percent: 33 },
              { category: '월세', amount: 2500000, percent: 14 },
              { category: '관리비', amount: 800000, percent: 4 },
              { category: '기타', amount: 500000, percent: 3 },
            ].map((item, idx) => (
              <div key={idx}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-600">{item.category}</span>
                  <span className="font-medium">{formatCurrency(item.amount)}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${item.percent}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Module Navigation */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">경영관리 메뉴</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {modules.map((module) => (
            <Link
              key={module.name}
              href={module.href}
              className="bg-white rounded-xl shadow-sm border p-4 hover:shadow-md transition-shadow"
            >
              <div className={`w-10 h-10 ${module.color} rounded-lg flex items-center justify-center mb-3`}>
                <module.icon className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-medium text-gray-900 mb-1">{module.name}</h3>
              <p className="text-xs text-gray-500">{module.description}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Integration Status */}
      <div className="bg-white rounded-xl shadow-sm border p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">연동 현황</h3>
          <Link href="/business/settings" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
            <Settings className="w-4 h-4" />
            연동 설정
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Toss POS</p>
              <p className="text-xs text-gray-500">연동 대기</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Wallet className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">오픈뱅킹</p>
              <p className="text-xs text-gray-500">연동 대기</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Receipt className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">급여 시스템</p>
              <p className="text-xs text-green-600">연동됨</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
