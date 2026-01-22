'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Package,
  Truck,
  Users,
  Thermometer,
  ClipboardCheck,
  Factory,
  Send,
  Bug,
  Boxes,
  FileCheck,
  AlertTriangle,
  CheckCircle,
  Wifi,
  WifiOff,
  GraduationCap,
  FileText,
  Settings,
  Wrench,
  RotateCcw,
  Warehouse,
  RefreshCw,
} from 'lucide-react';

interface DashboardStats {
  todayHygieneChecks: {
    completed: number;
    total: number;
  };
  pendingCcpRecords: number;
  lowStockMaterials: number;
  pendingInspections: number;
  todayProduction: number;
  ccpDeviations: number;
  todayCcpRecords: number;
  weeklyPestControl: {
    completed: boolean;
    lastCheck: string | null;
  };
  monthlyVerification: {
    completed: number;
    total: number;
  };
  sensorStatus: {
    total: number;
    online: number;
    offline: number;
  };
  recentAlerts: Array<{
    id: string;
    type: string;
    message: string;
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    createdAt: string;
  }>;
}

const haccpModules = [
  {
    title: '제품 관리',
    description: '제품 마스터 데이터',
    href: '/products',
    icon: Package,
    color: 'bg-blue-500',
  },
  {
    title: '원부재료',
    description: '원료/부재료/포장재 관리',
    href: '/materials',
    icon: Boxes,
    color: 'bg-green-500',
  },
  {
    title: '공급업체',
    description: '공급업체 정보 관리',
    href: '/suppliers',
    icon: Truck,
    color: 'bg-purple-500',
  },
  {
    title: 'CCP 관리',
    description: '중요관리점 모니터링',
    href: '/ccp',
    icon: Thermometer,
    color: 'bg-red-500',
  },
  {
    title: '일반위생',
    description: '일일 위생 점검',
    href: '/hygiene',
    icon: ClipboardCheck,
    color: 'bg-cyan-500',
  },
  {
    title: '입고검사',
    description: '원부재료 입고 검사',
    href: '/inspections',
    icon: FileCheck,
    color: 'bg-orange-500',
  },
  {
    title: '생산관리',
    description: '생산 기록 관리',
    href: '/production',
    icon: Factory,
    color: 'bg-indigo-500',
  },
  {
    title: '출하관리',
    description: '출하 기록 관리',
    href: '/shipments',
    icon: Send,
    color: 'bg-teal-500',
  },
  {
    title: '방충방서',
    description: '해충 방제 관리',
    href: '/pest-control',
    icon: Bug,
    color: 'bg-yellow-500',
  },
  {
    title: '원료수불',
    description: '원료 재고 관리',
    href: '/inventory',
    icon: Boxes,
    color: 'bg-pink-500',
  },
  {
    title: '반제품',
    description: '중간제품 생산 관리',
    href: '/semi-products',
    icon: Package,
    color: 'bg-lime-500',
  },
  {
    title: '교육훈련',
    description: 'HACCP 교육 기록',
    href: '/training',
    icon: GraduationCap,
    color: 'bg-violet-500',
  },
  {
    title: '감사보고서',
    description: '내부/외부 감사',
    href: '/audit-report',
    icon: FileText,
    color: 'bg-slate-500',
  },
  {
    title: '검교정',
    description: '계측기 검교정 관리',
    href: '/calibration',
    icon: Wrench,
    color: 'bg-amber-500',
  },
  {
    title: '반품/폐기',
    description: '반품/회수/폐기 기록',
    href: '/returns-disposals',
    icon: RotateCcw,
    color: 'bg-rose-500',
  },
  {
    title: '보관창고',
    description: '보관 창고 점검',
    href: '/storage-inspections',
    icon: Warehouse,
    color: 'bg-emerald-500',
  },
  {
    title: 'IoT 센서',
    description: '센서 모니터링',
    href: '/sensors',
    icon: Wifi,
    color: 'bg-sky-500',
  },
];

export default function HACCPDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    todayHygieneChecks: { completed: 0, total: 3 },
    pendingCcpRecords: 0,
    lowStockMaterials: 0,
    pendingInspections: 0,
    todayProduction: 0,
    ccpDeviations: 0,
    todayCcpRecords: 0,
    weeklyPestControl: { completed: false, lastCheck: null },
    monthlyVerification: { completed: 0, total: 0 },
    sensorStatus: { total: 0, online: 0, offline: 0 },
    recentAlerts: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    setError(null);

    try {
      const response = await fetch('/api/haccp/dashboard/stats');
      if (!response.ok) {
        throw new Error('통계 데이터를 불러오는데 실패했습니다.');
      }
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error('Error fetching stats:', err);
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    // 5분마다 자동 새로고침
    const interval = setInterval(() => fetchStats(false), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">HACCP 관리</h1>
          <p className="mt-1 text-sm text-gray-500">
            식품 안전 관리 시스템 - 위해요소 중점관리
          </p>
        </div>
        <button
          onClick={() => fetchStats(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span className="text-sm">새로고침</span>
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-8">
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="flex items-center gap-2 mb-2">
            <ClipboardCheck className="w-4 h-4 text-cyan-500" />
            <span className="text-xs text-gray-500">오늘 위생점검</span>
          </div>
          <p className="text-2xl font-bold">{stats.todayHygieneChecks.completed}/{stats.todayHygieneChecks.total}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="flex items-center gap-2 mb-2">
            <Thermometer className="w-4 h-4 text-red-500" />
            <span className="text-xs text-gray-500">오늘 CCP 기록</span>
          </div>
          <p className="text-2xl font-bold">{stats.todayCcpRecords}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            <span className="text-xs text-gray-500">재고 부족</span>
          </div>
          <p className="text-2xl font-bold">{stats.lowStockMaterials}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="flex items-center gap-2 mb-2">
            <FileCheck className="w-4 h-4 text-purple-500" />
            <span className="text-xs text-gray-500">입고검사 대기</span>
          </div>
          <p className="text-2xl font-bold">{stats.pendingInspections}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="flex items-center gap-2 mb-2">
            <Factory className="w-4 h-4 text-indigo-500" />
            <span className="text-xs text-gray-500">오늘 생산</span>
          </div>
          <p className="text-2xl font-bold">{stats.todayProduction}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="flex items-center gap-2 mb-2">
            {stats.ccpDeviations === 0 ? (
              <CheckCircle className="w-4 h-4 text-green-500" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-500" />
            )}
            <span className="text-xs text-gray-500">CCP 이탈</span>
          </div>
          <p className={`text-2xl font-bold ${stats.ccpDeviations > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {stats.ccpDeviations}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="flex items-center gap-2 mb-2">
            {stats.sensorStatus.offline === 0 ? (
              <Wifi className="w-4 h-4 text-green-500" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-500" />
            )}
            <span className="text-xs text-gray-500">IoT 센서</span>
          </div>
          <p className={`text-2xl font-bold ${stats.sensorStatus.offline > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {stats.sensorStatus.online}/{stats.sensorStatus.total}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="flex items-center gap-2 mb-2">
            <Bug className="w-4 h-4 text-yellow-500" />
            <span className="text-xs text-gray-500">주간 방충방서</span>
          </div>
          <p className={`text-2xl font-bold ${stats.weeklyPestControl.completed ? 'text-green-600' : 'text-orange-600'}`}>
            {stats.weeklyPestControl.completed ? '완료' : '미완료'}
          </p>
        </div>
      </div>

      {/* Module Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {haccpModules.map((module) => {
          const Icon = module.icon;
          return (
            <Link
              key={module.href}
              href={module.href}
              className="bg-white rounded-xl p-6 shadow-sm border hover:shadow-md hover:border-blue-300 transition-all group"
            >
              <div className={`w-12 h-12 ${module.color} rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{module.title}</h3>
              <p className="text-sm text-gray-500">{module.description}</p>
            </Link>
          );
        })}
      </div>

      {/* Recent Activity */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-4">최근 활동</h2>
        <div className="bg-white rounded-xl shadow-sm border divide-y">
          <div className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-cyan-100 rounded-lg flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-cyan-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">오전 위생점검 완료</p>
              <p className="text-xs text-gray-500">오늘 09:00 · 김철수</p>
            </div>
            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">PASS</span>
          </div>
          <div className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <Thermometer className="w-5 h-5 text-red-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">CCP-1 가열공정 온도 기록</p>
              <p className="text-xs text-gray-500">오늘 08:30 · 박영희</p>
            </div>
            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">정상</span>
          </div>
          <div className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <FileCheck className="w-5 h-5 text-orange-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">원료 입고검사 완료</p>
              <p className="text-xs text-gray-500">어제 14:20 · 이민수</p>
            </div>
            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">합격</span>
          </div>
        </div>
      </div>
    </div>
  );
}
