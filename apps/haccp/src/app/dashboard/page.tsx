'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Thermometer,
  ClipboardCheck,
  Factory,
  Bug,
  FileCheck,
  AlertTriangle,
  CheckCircle,
  Wifi,
  WifiOff,
  RefreshCw,
  Bell,
  TrendingUp,
  Calendar,
  Clock,
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

      {/* 오늘 현황 요약 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* CCP 이탈 현황 - 가장 중요 */}
        <div className={`rounded-xl p-6 shadow-sm border-2 ${stats.ccpDeviations > 0 ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-300'}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">CCP 이탈 현황</h3>
            {stats.ccpDeviations === 0 ? (
              <CheckCircle className="w-8 h-8 text-green-500" />
            ) : (
              <AlertTriangle className="w-8 h-8 text-red-500" />
            )}
          </div>
          <p className={`text-5xl font-bold mb-2 ${stats.ccpDeviations > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {stats.ccpDeviations}
          </p>
          <p className="text-sm text-gray-600">
            {stats.ccpDeviations === 0 ? '모든 CCP가 정상 범위입니다' : '즉시 확인이 필요합니다'}
          </p>
        </div>

        {/* 오늘 위생점검 */}
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">오늘 위생점검</h3>
            <ClipboardCheck className="w-6 h-6 text-cyan-500" />
          </div>
          <div className="flex items-end gap-2 mb-2">
            <p className="text-4xl font-bold text-gray-900">{stats.todayHygieneChecks.completed}</p>
            <p className="text-xl text-gray-400 mb-1">/ {stats.todayHygieneChecks.total}</p>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
            <div
              className="bg-cyan-500 h-2 rounded-full transition-all"
              style={{ width: `${(stats.todayHygieneChecks.completed / stats.todayHygieneChecks.total) * 100}%` }}
            />
          </div>
          <p className="text-sm text-gray-500">
            {stats.todayHygieneChecks.completed === stats.todayHygieneChecks.total ? '모든 점검 완료!' : `${stats.todayHygieneChecks.total - stats.todayHygieneChecks.completed}건 남음`}
          </p>
        </div>

        {/* IoT 센서 상태 */}
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">IoT 센서 상태</h3>
            {stats.sensorStatus.offline === 0 ? (
              <Wifi className="w-6 h-6 text-green-500" />
            ) : (
              <WifiOff className="w-6 h-6 text-red-500" />
            )}
          </div>
          <div className="flex items-end gap-2 mb-2">
            <p className="text-4xl font-bold text-green-600">{stats.sensorStatus.online}</p>
            <p className="text-xl text-gray-400 mb-1">/ {stats.sensorStatus.total}</p>
          </div>
          {stats.sensorStatus.offline > 0 && (
            <p className="text-sm text-red-600 font-medium">
              {stats.sensorStatus.offline}개 센서 오프라인
            </p>
          )}
          {stats.sensorStatus.offline === 0 && stats.sensorStatus.total > 0 && (
            <p className="text-sm text-green-600">모든 센서 정상 작동 중</p>
          )}
          {stats.sensorStatus.total === 0 && (
            <p className="text-sm text-gray-500">등록된 센서 없음</p>
          )}
        </div>
      </div>

      {/* 주요 현황 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Link href="/ccp/records" className="bg-white rounded-xl p-5 shadow-sm border hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <Thermometer className="w-5 h-5 text-red-600" />
            </div>
            <span className="text-sm text-gray-500">오늘 CCP 기록</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.todayCcpRecords}<span className="text-lg text-gray-400 ml-1">건</span></p>
        </Link>

        <Link href="/production" className="bg-white rounded-xl p-5 shadow-sm border hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Factory className="w-5 h-5 text-indigo-600" />
            </div>
            <span className="text-sm text-gray-500">오늘 생산</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.todayProduction}<span className="text-lg text-gray-400 ml-1">건</span></p>
        </Link>

        <Link href="/inspections" className="bg-white rounded-xl p-5 shadow-sm border hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <FileCheck className="w-5 h-5 text-purple-600" />
            </div>
            <span className="text-sm text-gray-500">입고검사 대기</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.pendingInspections}<span className="text-lg text-gray-400 ml-1">건</span></p>
        </Link>

        <Link href="/inventory" className="bg-white rounded-xl p-5 shadow-sm border hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
            </div>
            <span className="text-sm text-gray-500">재고 부족</span>
          </div>
          <p className={`text-3xl font-bold ${stats.lowStockMaterials > 0 ? 'text-orange-600' : 'text-gray-900'}`}>
            {stats.lowStockMaterials}<span className="text-lg text-gray-400 ml-1">건</span>
          </p>
        </Link>
      </div>

      {/* 주간/월간 현황 및 알림 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 정기 점검 현황 */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-500" />
              정기 점검 현황
            </h2>
          </div>
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Bug className="w-5 h-5 text-yellow-600" />
                <span className="font-medium">주간 방충방서 점검</span>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${stats.weeklyPestControl.completed ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                {stats.weeklyPestControl.completed ? '완료' : '미완료'}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                <span className="font-medium">월간 CCP 검증</span>
              </div>
              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                {stats.monthlyVerification.completed}/{stats.monthlyVerification.total}
              </span>
            </div>
          </div>
        </div>

        {/* 최근 알림 */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Bell className="w-5 h-5 text-gray-500" />
              최근 알림
            </h2>
            <Link href="/notifications" className="text-sm text-blue-600 hover:underline">
              전체보기
            </Link>
          </div>
          <div className="divide-y">
            {stats.recentAlerts.length > 0 ? (
              stats.recentAlerts.slice(0, 4).map((alert) => (
                <div key={alert.id} className="p-4 flex items-start gap-3">
                  <div className={`w-2 h-2 mt-2 rounded-full ${
                    alert.severity === 'HIGH' ? 'bg-red-500' :
                    alert.severity === 'MEDIUM' ? 'bg-yellow-500' : 'bg-blue-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 truncate">{alert.message}</p>
                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3" />
                      {new Date(alert.createdAt).toLocaleString('ko-KR', {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-gray-500">
                <Bell className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">새로운 알림이 없습니다</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
