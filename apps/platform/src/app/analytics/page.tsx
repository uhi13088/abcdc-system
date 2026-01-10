'use client';

import { useState } from 'react';
import { BarChart3, TrendingUp, Users, Building2, Calendar } from 'lucide-react';
import { formatNumber, formatCurrency } from '@/lib/utils';

export default function AnalyticsPage() {
  const [period, setPeriod] = useState('month');

  const metrics = [
    { name: '신규 가입 회사', value: 12, change: '+20%', icon: Building2 },
    { name: '신규 사용자', value: 156, change: '+35%', icon: Users },
    { name: 'MAU', value: 892, change: '+12%', icon: TrendingUp },
    { name: '월 매출', value: 24500000, isCurrency: true, change: '+18%', icon: BarChart3 },
  ];

  const companyGrowth = [
    { month: '1월', count: 35 },
    { month: '2월', count: 38 },
    { month: '3월', count: 41 },
    { month: '4월', count: 43 },
    { month: '5월', count: 45 },
    { month: '6월', count: 48 },
  ];

  const planDistribution = [
    { plan: 'Free', count: 15, percentage: 31 },
    { plan: 'Basic', count: 18, percentage: 38 },
    { plan: 'Premium', count: 10, percentage: 21 },
    { plan: 'Enterprise', count: 5, percentage: 10 },
  ];

  const topCompanies = [
    { name: '카페모카 프랜차이즈', users: 156, stores: 35, revenue: 8500000 },
    { name: '맛있는 치킨', users: 48, stores: 12, revenue: 3200000 },
    { name: '맛집 프랜차이즈', users: 32, stores: 8, revenue: 2100000 },
    { name: '행복한 베이커리', users: 20, stores: 5, revenue: 1500000 },
    { name: '든든한 식당', users: 5, stores: 1, revenue: 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">분석</h1>
          <p className="text-gray-600">플랫폼 전체 분석 및 통계</p>
        </div>
        <div className="flex items-center space-x-2">
          <Calendar className="w-5 h-5 text-gray-400" />
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="week">이번 주</option>
            <option value="month">이번 달</option>
            <option value="quarter">이번 분기</option>
            <option value="year">올해</option>
          </select>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric) => (
          <div key={metric.name} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{metric.name}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {metric.isCurrency ? formatCurrency(metric.value) : formatNumber(metric.value)}
                </p>
              </div>
              <div className="p-3 bg-primary/10 rounded-full">
                <metric.icon className="w-6 h-6 text-primary" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-sm font-medium text-green-600">{metric.change}</span>
              <span className="text-sm text-gray-500 ml-2">전월 대비</span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Company Growth Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">회사 증가 추이</h2>
          <div className="space-y-4">
            {companyGrowth.map((item) => (
              <div key={item.month} className="flex items-center">
                <span className="w-12 text-sm text-gray-600">{item.month}</span>
                <div className="flex-1 mx-4">
                  <div className="h-8 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${(item.count / 50) * 100}%` }}
                    ></div>
                  </div>
                </div>
                <span className="w-12 text-sm font-medium text-gray-900">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Plan Distribution */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">플랜 분포</h2>
          <div className="space-y-4">
            {planDistribution.map((item) => (
              <div key={item.plan}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">{item.plan}</span>
                  <span className="text-sm text-gray-500">{item.count}개 ({item.percentage}%)</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${item.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Companies */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">상위 회사</h2>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">회사명</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">사용자</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">매장</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">월 매출</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {topCompanies.map((company, index) => (
              <tr key={company.name} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <span className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center text-xs font-medium text-primary mr-3">
                      {index + 1}
                    </span>
                    <span className="font-medium text-gray-900">{company.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatNumber(company.users)}명
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {company.stores}개
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                  {formatCurrency(company.revenue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
