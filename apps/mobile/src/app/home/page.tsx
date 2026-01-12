'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, Calendar, Bell, ChevronRight, FileText, Send } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BottomNav } from '@/components/bottom-nav';
import { formatTime, formatDate } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

interface UserProfile {
  id: string;
  name: string;
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
  check_in: string | null;
  check_out: string | null;
  date: string;
}

interface WeeklyStats {
  totalHours: number;
  workDays: number;
  lateCount: number;
}

export default function HomePage() {
  const router = useRouter();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [todaySchedule, setTodaySchedule] = useState<TodaySchedule | null>(null);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
  const [recentNotices, setRecentNotices] = useState<Notice[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats>({ totalHours: 0, workDays: 0, lateCount: 0 });
  const [checkingIn, setCheckingIn] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      // Get current user
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        router.push('/auth/login');
        return;
      }

      // Fetch user profile with store info
      const { data: userData } = await supabase
        .from('users')
        .select('id, name, stores(id, name)')
        .eq('id', authUser.id)
        .single();

      if (userData) {
        // Supabase returns relations as arrays, extract first element
        const storeData = Array.isArray(userData.stores) ? userData.stores[0] : userData.stores;
        setUser({
          id: userData.id,
          name: userData.name,
          stores: storeData || null,
        });
      }

      const today = new Date().toISOString().split('T')[0];

      // Fetch today's schedule
      const { data: scheduleData } = await supabase
        .from('schedules')
        .select('start_time, end_time')
        .eq('user_id', authUser.id)
        .eq('date', today)
        .single();

      if (scheduleData) {
        setTodaySchedule({
          start: scheduleData.start_time?.slice(0, 5) || '-',
          end: scheduleData.end_time?.slice(0, 5) || '-',
        });
      }

      // Fetch today's attendance
      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('id, check_in, check_out, date')
        .eq('user_id', authUser.id)
        .eq('date', today)
        .single();

      if (attendanceData) {
        setTodayAttendance(attendanceData);
      }

      // Fetch recent notices
      const { data: noticesData } = await supabase
        .from('notices')
        .select('id, title, created_at')
        .order('created_at', { ascending: false })
        .limit(3);

      if (noticesData) {
        setRecentNotices(noticesData);
      }

      // Calculate weekly stats
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekStartStr = weekStart.toISOString().split('T')[0];

      const { data: weekAttendance } = await supabase
        .from('attendance')
        .select('check_in, check_out, status')
        .eq('user_id', authUser.id)
        .gte('date', weekStartStr);

      if (weekAttendance) {
        let totalMinutes = 0;
        let lateCount = 0;

        weekAttendance.forEach((record) => {
          if (record.check_in && record.check_out) {
            const checkIn = new Date(`2000-01-01T${record.check_in}`);
            const checkOut = new Date(`2000-01-01T${record.check_out}`);
            totalMinutes += (checkOut.getTime() - checkIn.getTime()) / (1000 * 60);
          }
          if (record.status === 'LATE' || record.status === 'EARLY_LEAVE') {
            lateCount++;
          }
        });

        setWeeklyStats({
          totalHours: Math.round(totalMinutes / 60),
          workDays: weekAttendance.length,
          lateCount,
        });
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [supabase, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCheckInOut = async () => {
    if (checkingIn) return;
    setCheckingIn(true);

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      const today = new Date().toISOString().split('T')[0];
      const now = new Date().toTimeString().slice(0, 8);

      if (!todayAttendance || !todayAttendance.check_in) {
        // Check in
        const { data, error } = await supabase
          .from('attendance')
          .upsert({
            user_id: authUser.id,
            store_id: user?.stores?.id,
            date: today,
            check_in: now,
            status: 'PRESENT',
          })
          .select()
          .single();

        if (!error && data) {
          setTodayAttendance(data);
        }
      } else if (!todayAttendance.check_out) {
        // Check out
        const { data, error } = await supabase
          .from('attendance')
          .update({ check_out: now })
          .eq('id', todayAttendance.id)
          .select()
          .single();

        if (!error && data) {
          setTodayAttendance(data);
        }
      }
    } catch (error) {
      console.error('Error checking in/out:', error);
    } finally {
      setCheckingIn(false);
    }
  };

  const isCheckedIn = Boolean(todayAttendance?.check_in && !todayAttendance?.check_out);
  const isWorkComplete = Boolean(todayAttendance?.check_in && todayAttendance?.check_out);

  const formatNoticeDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
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
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
            <span className="text-lg font-bold">{user?.name?.charAt(0) || '?'}</span>
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
          <button
            onClick={handleCheckInOut}
            disabled={checkingIn || isWorkComplete}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-colors disabled:opacity-50 ${
              isWorkComplete
                ? 'bg-gray-400 text-white'
                : isCheckedIn
                ? 'bg-red-500 text-white'
                : 'bg-primary text-white'
            }`}
          >
            {checkingIn ? '처리 중...' : isWorkComplete ? '근무 완료' : isCheckedIn ? '퇴근하기' : '출근하기'}
          </button>
          {todayAttendance?.check_in && (
            <p className="text-center text-sm text-gray-500 mt-2">
              출근 시간: {todayAttendance.check_in.slice(0, 5)}
              {todayAttendance.check_out && ` | 퇴근 시간: ${todayAttendance.check_out.slice(0, 5)}`}
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

      <BottomNav />
    </div>
  );
}
