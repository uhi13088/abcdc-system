'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Users, Layers, TrendingUp, Activity, Server, Store } from 'lucide-react';
import { formatNumber } from '@/lib/utils';

interface PlatformStats {
  totalCompanies: number;
  totalUsers: number;
  totalBrands: number;
  totalStores: number;
  activeCompanies: number;
  monthlyActiveUsers: number;
  serverStatus: 'healthy' | 'warning' | 'error';
  recentActivities: Array<{
    id: string;
    company: string;
    action: string;
    time: string;
  }>;
}

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<PlatformStats>({
    totalCompanies: 0,
    totalUsers: 0,
    totalBrands: 0,
    totalStores: 0,
    activeCompanies: 0,
    monthlyActiveUsers: 0,
    serverStatus: 'healthy',
    recentActivities: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      name: '전체 회사',
      value: stats.totalCompanies,
      icon: Building2,
      suffix: '개',
    },
    {
      name: '전체 사용자',
      value: stats.totalUsers,
      icon: Users,
      suffix: '명',
    },
    {
      name: '전체 브랜드',
      value: stats.totalBrands,
      icon: Layers,
      suffix: '개',
    },
    {
      name: '전체 매장',
      value: stats.totalStores,
      icon: Store,
      suffix: '개',
    },
    {
      name: '활성 회사',
      value: stats.activeCompanies,
      icon: Activity,
      suffix: '개',
    },
    {
      name: '월간 활성 사용자',
      value: stats.monthlyActiveUsers,
      icon: TrendingUp,
      suffix: '명',
    },
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
                  {formatNumber(stat.value)}<span className="text-base font-normal text-gray-500 ml-1">{stat.suffix}</span>
                </p>
              </div>
              <div className="p-3 bg-primary/10 rounded-full">
                <stat.icon className="w-6 h-6 text-primary" />
              </div>
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
            {stats.recentActivities.length > 0 ? (
              stats.recentActivities.map((activity) => (
                <div key={activity.id} className="px-6 py-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{activity.company}</p>
                    <p className="text-sm text-gray-500">{activity.action}</p>
                  </div>
                  <span className="text-sm text-gray-400">{activity.time}</span>
                </div>
              ))
            ) : (
              <div className="px-6 py-8 text-center text-gray-500">
                최근 활동이 없습니다
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">빠른 작업</h2>
          </div>
          <div className="p-6 space-y-4">
            <button
              onClick={() => router.push('/companies?new=true')}
              className="w-full py-3 px-4 bg-primary text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              새 회사 등록
            </button>
            <button
              onClick={() => router.push('/brands?new=true')}
              className="w-full py-3 px-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              새 브랜드 등록
            </button>
            <button
              onClick={() => router.push('/subscriptions')}
              className="w-full py-3 px-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              구독 현황 보기
            </button>
            <button
              onClick={() => router.push('/analytics')}
              className="w-full py-3 px-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              분석 리포트 보기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
