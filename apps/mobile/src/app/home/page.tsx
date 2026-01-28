'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, Calendar, Bell, ChevronRight, FileText, Send, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BottomNav } from '@/components/bottom-nav';
import { formatTime, formatDate } from '@/lib/utils';
import { PushNotificationPrompt } from '@abc/shared';

interface UserProfile {
  id: string;
  name: string;
  company_id: string | null;
  brand_id: string | null;
  store_id: string | null;
  stores: { id: string; name: string } | null;
}

interface TodaySchedule {
  start: string;
  end: string;
}

interface Notice {
  id: string;
  title: string;
  created_at: string;
}

interface AttendanceRecord {
  id: string;
  actual_check_in: string | null;
  actual_check_out: string | null;
  work_date: string;
  status: string | null;
}

interface WeeklyStats {
  totalHours: number;
  workDays: number;
  lateCount: number;
}

// NotificationCount interface removed - unreadCount used directly

export default function HomePage() {
  const router = useRouter();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [todaySchedule, setTodaySchedule] = useState<TodaySchedule | null>(null);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
  const [recentNotices, setRecentNotices] = useState<Notice[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats>({ totalHours: 0, workDays: 0, lateCount: 0 });
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      // Fetch user profile via API
      const userResponse = await fetch('/api/me');
      if (!userResponse.ok) {
        if (userResponse.status === 401) {
          router.push('/auth/login');
          return;
        }
        throw new Error('Failed to fetch user');
      }
      const userData = await userResponse.json();
      setUser(userData);

      // Fetch all data in parallel via API routes
      const [scheduleRes, attendanceRes, weeklyRes, noticesRes, notificationsRes] = await Promise.all([
        fetch('/api/schedules/today'),
        fetch('/api/attendances/today'),
        fetch('/api/attendances/weekly'),
        fetch('/api/notices?limit=3'),
        fetch('/api/notifications?limit=1'),
      ]);

      if (scheduleRes.ok) {
        const scheduleData = await scheduleRes.json();
        if (scheduleData) {
          setTodaySchedule(scheduleData);
        }
      }

      if (attendanceRes.ok) {
        const attendanceData = await attendanceRes.json();
        if (attendanceData) {
          setTodayAttendance(attendanceData);
        }
      }

      if (weeklyRes.ok) {
        const weeklyData = await weeklyRes.json();
        setWeeklyStats(weeklyData);
      }

      if (noticesRes.ok) {
        const noticesData = await noticesRes.json();
        setRecentNotices(noticesData);
      }

      if (notificationsRes.ok) {
        const notificationsData = await notificationsRes.json();
        setUnreadNotifications(notificationsData.unreadCount || 0);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const isCheckedIn = Boolean(todayAttendance?.actual_check_in && !todayAttendance?.actual_check_out);
  const isWorkComplete = Boolean(todayAttendance?.actual_check_in && todayAttendance?.actual_check_out);

  const formatNoticeDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
  };

  const formatCheckTime = (timestamp: string | null) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 bg-gray-50">
      {/* Header */}
      <div className="bg-primary text-white p-6 rounded-b-3xl safe-top">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-primary-100 text-sm">{user?.stores?.name || '매장 미배정'}</p>
            <h1 className="text-xl font-bold">{user?.name || '사용자'}님, 안녕하세요!</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/notifications"
              className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center relative"
            >
              <Bell className="w-5 h-5" />
              {unreadNotifications > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold">
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </span>
              )}
            </Link>
            <Link
              href="/messages"
              className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center"
            >
              <MessageCircle className="w-5 h-5" />
            </Link>
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <span className="text-lg font-bold">{user?.name?.charAt(0) || '?'}</span>
            </div>
          </div>
        </div>

        {/* Time Card */}
        <div className="bg-white/10 rounded-2xl p-4">
          <div className="text-center">
            <p className="text-primary-100 text-sm">{formatDate(currentTime)}</p>
            <p className="text-4xl font-bold my-2">{formatTime(currentTime)}</p>
            <p className="text-primary-100 text-sm">
              오늘 근무: {todaySchedule ? `${todaySchedule.start} - ${todaySchedule.end}` : '스케줄 없음'}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="p-4 -mt-6">
        <div className="bg-white rounded-2xl shadow-sm p-4">
          {isWorkComplete ? (
            <Link
              href="/qr-scan"
              className="w-full py-4 rounded-xl font-bold text-lg transition-colors block text-center bg-blue-500 text-white"
            >
              재출근하기
            </Link>
          ) : (
            <Link
              href="/qr-scan"
              className={`w-full py-4 rounded-xl font-bold text-lg transition-colors block text-center ${
                isCheckedIn
                  ? 'bg-red-500 text-white'
                  : 'bg-primary text-white'
              }`}
            >
              {isCheckedIn ? '퇴근하기' : '출근하기'}
            </Link>
          )}
          {todayAttendance?.actual_check_in && (
            <p className="text-center text-sm text-gray-500 mt-2">
              출근 시간: {formatCheckTime(todayAttendance.actual_check_in)}
              {todayAttendance.actual_check_out && ` | 퇴근 시간: ${formatCheckTime(todayAttendance.actual_check_out)}`}
            </p>
          )}

          {/* Checkout Notice */}
          {isCheckedIn && (
            <p className="text-center text-xs text-orange-600 mt-2 bg-orange-50 rounded-lg py-2 px-3">
              퇴근 기록이 없으면 예정 시간 기준으로 급여가 계산됩니다.
            </p>
          )}

          {/* Quick Request Buttons */}
          <div className="flex gap-2 mt-3">
            <Link
              href="/request"
              className="flex-1 py-3 bg-gray-100 rounded-xl text-center font-medium text-gray-700 flex items-center justify-center gap-2"
            >
              <FileText className="w-4 h-4" />
              휴가신청
            </Link>
            <Link
              href="/request"
              className="flex-1 py-3 bg-gray-100 rounded-xl text-center font-medium text-gray-700 flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              근무신청
            </Link>
          </div>
        </div>
      </div>

      {/* Today's Info */}
      <div className="p-4 space-y-4">
        {/* Schedule Card */}
        <Link href="/schedule" className="block">
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900 flex items-center">
                <Calendar className="w-5 h-5 mr-2 text-primary" />
                오늘 스케줄
              </h2>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">근무시간</span>
              <span className="font-medium">
                {todaySchedule ? `${todaySchedule.start} - ${todaySchedule.end}` : '스케줄 없음'}
              </span>
            </div>
          </div>
        </Link>

        {/* Notices Card */}
        <Link href="/notices" className="block">
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900 flex items-center">
                <Bell className="w-5 h-5 mr-2 text-primary" />
                공지사항
              </h2>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </div>
            <div className="space-y-3">
              {recentNotices.length > 0 ? (
                recentNotices.map((notice) => (
                  <div key={notice.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 truncate flex-1 mr-2">{notice.title}</span>
                    <span className="text-gray-400">{formatNoticeDate(notice.created_at)}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-400">공지사항이 없습니다</p>
              )}
            </div>
          </div>
        </Link>

        {/* Weekly Hours */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900 flex items-center">
              <Clock className="w-5 h-5 mr-2 text-primary" />
              이번 주 근무
            </h2>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-center flex-1">
              <p className="text-2xl font-bold text-primary">{weeklyStats.totalHours}</p>
              <p className="text-xs text-gray-500">근무 시간</p>
            </div>
            <div className="h-12 w-px bg-gray-200"></div>
            <div className="text-center flex-1">
              <p className="text-2xl font-bold text-gray-900">{weeklyStats.workDays}</p>
              <p className="text-xs text-gray-500">근무 일수</p>
            </div>
            <div className="h-12 w-px bg-gray-200"></div>
            <div className="text-center flex-1">
              <p className={`text-2xl font-bold ${weeklyStats.lateCount > 0 ? 'text-red-500' : 'text-green-500'}`}>
                {weeklyStats.lateCount}
              </p>
              <p className="text-xs text-gray-500">지각/조퇴</p>
            </div>
          </div>
        </div>
      </div>

      {/* Push Notification Prompt */}
      <PushNotificationPrompt />

      <BottomNav />
    </div>
  );
}
