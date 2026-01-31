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
  Zap,
  Loader2,
  Sunrise,
  Sunset,
  User,
  Building2,
} from 'lucide-react';

interface UserInfo {
  name: string;
  companyName: string | null;
  storeName: string | null;
  role: string;
}

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
  const [quickCheckLoading, setQuickCheckLoading] = useState(false);
  const [morningCheckLoading, setMorningCheckLoading] = useState(false);
  const [closingCheckLoading, setClosingCheckLoading] = useState(false);
  const [quickCheckResult, setQuickCheckResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

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

  const fetchUserInfo = useCallback(async () => {
    try {
      const response = await fetch('/api/haccp/user-info');
      if (response.ok) {
        const data = await response.json();
        setUserInfo(data);
      }
    } catch (err) {
      console.error('Error fetching user info:', err);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchUserInfo();
    // 5분마다 자동 새로고침
    const interval = setInterval(() => fetchStats(false), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchStats, fetchUserInfo]);

  // 원클릭 일일점검 완료
  const handleQuickDailyCheck = async () => {
    if (!confirm('오늘의 일일점검을 모두 정상값으로 완료하시겠습니까?\n\n• 위생점검 (작업전/작업중/작업후)\n• 저장소 온도점검\n\n이미 완료된 점검은 건너뜁니다.')) {
      return;
    }

    setQuickCheckLoading(true);
    setQuickCheckResult(null);

    try {
      const response = await fetch('/api/haccp/quick-daily-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          check_date: new Date().toISOString().split('T')[0],
          skip_existing: true,
        }),
      });

      const data = await response.json();

      setQuickCheckResult({
        success: response.ok,
        message: data.message || (response.ok ? '일일점검이 완료되었습니다!' : '오류가 발생했습니다.'),
      });

      // 통계 새로고침
      if (response.ok) {
        fetchStats(false);
      }

      // 3초 후 결과 메시지 숨기기
      setTimeout(() => setQuickCheckResult(null), 5000);
    } catch (_err) {
      setQuickCheckResult({
        success: false,
        message: '네트워크 오류가 발생했습니다.',
      });
    } finally {
      setQuickCheckLoading(false);
    }
  };

  // 원클릭 하루 시작
  const handleMorningCheck = async () => {
    if (!confirm('하루 시작 점검을 실행하시겠습니까?\n\n생성되는 기록:\n• 위생점검 (작업전)\n• 저장소 온도 점검\n• CCP 초기 점검\n• 장비 온도 기록\n\n이미 완료된 점검은 건너뜁니다.')) {
      return;
    }

    setMorningCheckLoading(true);
    setQuickCheckResult(null);

    try {
      const response = await fetch('/api/haccp/quick-morning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          check_date: new Date().toISOString().split('T')[0],
          skip_existing: true,
        }),
      });

      const data = await response.json();

      setQuickCheckResult({
        success: response.ok,
        message: data.message || (response.ok ? '하루 시작 점검이 완료되었습니다!' : '오류가 발생했습니다.'),
      });

      if (response.ok) {
        fetchStats(false);
      }

      setTimeout(() => setQuickCheckResult(null), 5000);
    } catch (_err) {
      setQuickCheckResult({
        success: false,
        message: '네트워크 오류가 발생했습니다.',
      });
    } finally {
      setMorningCheckLoading(false);
    }
  };

  // 원클릭 마감
  const handleClosingCheck = async () => {
    if (!confirm('마감 점검을 실행하시겠습니까?\n\n생성되는 기록:\n• 위생점검 (작업후)\n• 마감 저장소 온도 점검\n• 마감 CCP 기록\n• 마감 장비 온도 기록')) {
      return;
    }

    setClosingCheckLoading(true);
    setQuickCheckResult(null);

    try {
      const response = await fetch('/api/haccp/quick-closing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          check_date: new Date().toISOString().split('T')[0],
        }),
      });

      const data = await response.json();

      setQuickCheckResult({
        success: response.ok,
        message: data.message || (response.ok ? '마감 점검이 완료되었습니다!' : '오류가 발생했습니다.'),
      });

      if (response.ok) {
        fetchStats(false);
      }

      setTimeout(() => setQuickCheckResult(null), 5000);
    } catch (_err) {
      setQuickCheckResult({
        success: false,
        message: '네트워크 오류가 발생했습니다.',
      });
    } finally {
      setClosingCheckLoading(false);
    }
  };

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
    <div className="p-4 lg:p-6">
      {/* 유저 정보 표시 */}
      {userInfo && (
        <div className="mb-4 flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
          <User className="w-4 h-4 text-gray-400" />
          <span className="font-medium text-gray-900">{userInfo.name}</span>
          {(userInfo.companyName || userInfo.storeName) && (
            <>
              <span className="text-gray-300">|</span>
              <Building2 className="w-4 h-4 text-gray-400" />
              <span>{userInfo.storeName || userInfo.companyName}</span>
            </>
          )}
        </div>
      )}

      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">HACCP 관리</h1>
          <p className="mt-1 text-sm text-gray-500">
            식품 안전 관리 시스템 - 위해요소 중점관리
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* 원클릭 하루 시작 버튼 */}
          <button
            onClick={handleMorningCheck}
            disabled={morningCheckLoading || closingCheckLoading}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-lg hover:from-amber-500 hover:to-orange-600 disabled:opacity-50 shadow-sm"
            title="출근 후 하루 시작 점검 (위생점검/CCP/저장소)"
          >
            {morningCheckLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sunrise className="w-4 h-4" />
            )}
            <span className="text-sm font-medium">하루 시작</span>
          </button>
          {/* 원클릭 마감 버튼 */}
          <button
            onClick={handleClosingCheck}
            disabled={morningCheckLoading || closingCheckLoading}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50 shadow-sm"
            title="퇴근 전 마감 점검"
          >
            {closingCheckLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sunset className="w-4 h-4" />
            )}
            <span className="text-sm font-medium">마감</span>
          </button>
          {/* 원클릭 전체 점검 버튼 */}
          <button
            onClick={handleQuickDailyCheck}
            disabled={quickCheckLoading || morningCheckLoading || closingCheckLoading}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 shadow-sm"
            title="오늘의 모든 일일점검을 정상값으로 한번에 완료합니다"
          >
            {quickCheckLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            <span className="text-sm font-medium">전체 점검</span>
          </button>
          <button
            onClick={() => fetchStats(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="text-sm">새로고침</span>
          </button>
        </div>
      </div>

      {/* 원클릭 점검 결과 알림 */}
      {quickCheckResult && (
        <div className={`mb-4 p-4 rounded-lg border flex items-center gap-3 ${
          quickCheckResult.success
            ? 'bg-green-50 border-green-200 text-green-700'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {quickCheckResult.success ? (
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          )}
          <span className="text-sm">{quickCheckResult.message}</span>
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* 오늘 현황 요약 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* CCP 이탈 현황 - 가장 중요 */}
        <div className={`rounded-xl p-4 shadow-sm border-2 ${stats.ccpDeviations > 0 ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-300'}`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-900">CCP 이탈 현황</h3>
            {stats.ccpDeviations === 0 ? (
              <CheckCircle className="w-6 h-6 text-green-500" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-red-500" />
            )}
          </div>
          <p className={`text-4xl font-bold mb-1 ${stats.ccpDeviations > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {stats.ccpDeviations}
          </p>
          <p className="text-sm text-gray-600">
            {stats.ccpDeviations === 0 ? '모든 CCP가 정상 범위입니다' : '즉시 확인이 필요합니다'}
          </p>
        </div>

        {/* 오늘 위생점검 */}
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-900">오늘 위생점검</h3>
            <ClipboardCheck className="w-5 h-5 text-cyan-500" />
          </div>
          <div className="flex items-end gap-2 mb-1">
            <p className="text-3xl font-bold text-gray-900">{stats.todayHygieneChecks.completed}</p>
            <p className="text-lg text-gray-400 mb-0.5">/ {stats.todayHygieneChecks.total}</p>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5 mb-1">
            <div
              className="bg-cyan-500 h-1.5 rounded-full transition-all"
              style={{ width: `${(stats.todayHygieneChecks.completed / stats.todayHygieneChecks.total) * 100}%` }}
            />
          </div>
          <p className="text-sm text-gray-500">
            {stats.todayHygieneChecks.completed === stats.todayHygieneChecks.total ? '모든 점검 완료!' : `${stats.todayHygieneChecks.total - stats.todayHygieneChecks.completed}건 남음`}
          </p>
        </div>

        {/* IoT 센서 상태 */}
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-900">IoT 센서 상태</h3>
            {stats.sensorStatus.offline === 0 ? (
              <Wifi className="w-5 h-5 text-green-500" />
            ) : (
              <WifiOff className="w-5 h-5 text-red-500" />
            )}
          </div>
          <div className="flex items-end gap-2 mb-1">
            <p className="text-3xl font-bold text-green-600">{stats.sensorStatus.online}</p>
            <p className="text-lg text-gray-400 mb-0.5">/ {stats.sensorStatus.total}</p>
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Link href="/ccp/records" className="bg-white rounded-xl p-3 shadow-sm border hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
              <Thermometer className="w-4 h-4 text-red-600" />
            </div>
            <span className="text-sm text-gray-500">오늘 CCP 기록</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.todayCcpRecords}<span className="text-base text-gray-400 ml-1">건</span></p>
        </Link>

        <Link href="/production" className="bg-white rounded-xl p-3 shadow-sm border hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Factory className="w-4 h-4 text-indigo-600" />
            </div>
            <span className="text-sm text-gray-500">오늘 생산</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.todayProduction}<span className="text-base text-gray-400 ml-1">건</span></p>
        </Link>

        <Link href="/inspections" className="bg-white rounded-xl p-3 shadow-sm border hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
              <FileCheck className="w-4 h-4 text-purple-600" />
            </div>
            <span className="text-sm text-gray-500">입고검사 대기</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.pendingInspections}<span className="text-base text-gray-400 ml-1">건</span></p>
        </Link>

        <Link href="/inventory" className="bg-white rounded-xl p-3 shadow-sm border hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-orange-600" />
            </div>
            <span className="text-sm text-gray-500">재고 부족</span>
          </div>
          <p className={`text-2xl font-bold ${stats.lowStockMaterials > 0 ? 'text-orange-600' : 'text-gray-900'}`}>
            {stats.lowStockMaterials}<span className="text-base text-gray-400 ml-1">건</span>
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
