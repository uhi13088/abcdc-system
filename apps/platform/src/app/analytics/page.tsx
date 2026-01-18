'use client';

import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Users, Building2, Calendar } from 'lucide-react';
import { formatNumber, formatCurrency } from '@/lib/utils';

interface AnalyticsData {
  metrics: {
    newCompanies: number;
    newUsers: number;
    mau: number;
    monthlyRevenue: number;
  };
  companyGrowth: Array<{ month: string; count: number }>;
  planDistribution: Array<{ plan: string; count: number; percentage: number }>;
  topCompanies: Array<{ name: string; users: number; stores: number; revenue: number }>;
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState('month');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await fetch(`/api/analytics?period=${period}`);
        if (response.ok) {
          setData(await response.json());
        }
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, [period]);

  const metrics = data?.metrics ? [
    { name: '신규 가입 회사', value: data.metrics.newCompanies || 0, change: '-', icon: Building2 },
    { name: '신규 사용자', value: data.metrics.newUsers || 0, change: '-', icon: Users },
    { name: 'MAU', value: data.metrics.mau || 0, change: '-', icon: TrendingUp },
    { name: '월 매출', value: data.metrics.monthlyRevenue || 0, isCurrency: true, change: '-', icon: BarChart3 },
  ] : [
    { name: '신규 가입 회사', value: 0, change: '-', icon: Building2 },
    { name: '신규 사용자', value: 0, change: '-', icon: Users },
    { name: 'MAU', value: 0, change: '-', icon: TrendingUp },
    { name: '월 매출', value: 0, isCurrency: true, change: '-', icon: BarChart3 },
  ];

  const companyGrowth = data?.companyGrowth || [];
  const planDistribution = data?.planDistribution || [];
  const topCompanies = data?.topCompanies || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

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
