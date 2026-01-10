'use client';

import { useState, useEffect } from 'react';
import { Building2, Users, Layers, TrendingUp, Activity, Server } from 'lucide-react';
import { formatNumber } from '@/lib/utils';

interface PlatformStats {
  totalCompanies: number;
  totalUsers: number;
  totalBrands: number;
  activeCompanies: number;
  monthlyActiveUsers: number;
  serverStatus: 'healthy' | 'warning' | 'error';
}

export default function DashboardPage() {
  const [stats, setStats] = useState<PlatformStats>({
    totalCompanies: 0,
    totalUsers: 0,
    totalBrands: 0,
    activeCompanies: 0,
    monthlyActiveUsers: 0,
    serverStatus: 'healthy',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Demo data - in production, fetch from API
    setStats({
      totalCompanies: 48,
      totalUsers: 1234,
      totalBrands: 156,
      activeCompanies: 42,
      monthlyActiveUsers: 892,
      serverStatus: 'healthy',
    });
    setLoading(false);
  }, []);

  const statCards = [
    {
      name: '전체 회사',
      value: stats.totalCompanies,
      icon: Building2,
      change: '+3',
      changeType: 'positive' as const,
    },
    {
      name: '전체 사용자',
      value: stats.totalUsers,
      icon: Users,
      change: '+28',
      changeType: 'positive' as const,
    },
    {
      name: '전체 브랜드',
      value: stats.totalBrands,
      icon: Layers,
      change: '+5',
      changeType: 'positive' as const,
    },
    {
      name: '활성 회사',
      value: stats.activeCompanies,
      icon: Activity,
      change: '87%',
      changeType: 'neutral' as const,
    },
    {
      name: '월간 활성 사용자',
      value: stats.monthlyActiveUsers,
      icon: TrendingUp,
      change: '+12%',
      changeType: 'positive' as const,
    },
    {
      name: '서버 상태',
      value: stats.serverStatus === 'healthy' ? '정상' : stats.serverStatus === 'warning' ? '주의' : '오류',
      icon: Server,
      change: '99.9%',
      changeType: stats.serverStatus === 'healthy' ? 'positive' as const : 'negative' as const,
    },
  ];

  const recentActivities = [
    { id: 1, company: '맛있는 치킨', action: '신규 가입', time: '5분 전' },
    { id: 2, company: '행복한 베이커리', action: '브랜드 추가', time: '15분 전' },
    { id: 3, company: '카페모카', action: '사용자 10명 추가', time: '1시간 전' },
    { id: 4, company: '든든한 식당', action: '플랜 업그레이드', time: '2시간 전' },
    { id: 5, company: '맛집 프랜차이즈', action: '매장 5개 추가', time: '3시간 전' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">플랫폼 대시보드</h1>
        <p className="text-gray-600">ABC Staff System 전체 현황</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat) => (
          <div key={stat.name} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {typeof stat.value === 'number' ? formatNumber(stat.value) : stat.value}
                </p>
              </div>
              <div className="p-3 bg-primary/10 rounded-full">
                <stat.icon className="w-6 h-6 text-primary" />
              </div>
            </div>
            <div className="mt-4">
              <span className={`text-sm font-medium ${
                stat.changeType === 'positive' ? 'text-green-600' :
                stat.changeType === 'negative' ? 'text-red-600' : 'text-gray-600'
              }`}>
                {stat.change}
              </span>
              <span className="text-sm text-gray-500 ml-2">지난 달 대비</span>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activities & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activities */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">최근 활동</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {recentActivities.map((activity) => (
              <div key={activity.id} className="px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{activity.company}</p>
                  <p className="text-sm text-gray-500">{activity.action}</p>
                </div>
                <span className="text-sm text-gray-400">{activity.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">빠른 작업</h2>
          </div>
          <div className="p-6 space-y-4">
            <button className="w-full py-3 px-4 bg-primary text-white rounded-lg hover:bg-primary-700 transition-colors">
              새 회사 등록
            </button>
            <button className="w-full py-3 px-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
              시스템 공지 발송
            </button>
            <button className="w-full py-3 px-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
              전체 리포트 다운로드
            </button>
            <button className="w-full py-3 px-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
              데이터베이스 백업
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
