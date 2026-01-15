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

      // Fetch user profile with store info (use auth_id, not id)
      const { data: userData } = await supabase
        .from('users')
        .select('id, name, company_id, brand_id, store_id, stores(id, name)')
        .eq('auth_id', authUser.id)
        .single();

      if (userData) {
        // Supabase returns relations as arrays, extract first element
        const storeData = Array.isArray(userData.stores) ? userData.stores[0] : userData.stores;
        setUser({
          id: userData.id,
          name: userData.name,
          company_id: userData.company_id,
          brand_id: userData.brand_id,
          store_id: userData.store_id,
          stores: storeData || null,
        });
      }

      const today = new Date().toISOString().split('T')[0];
      const userProfileId = userData?.id;

      if (userProfileId) {
        // Fetch today's schedule - using user profile id, not auth id
        const { data: scheduleData } = await supabase
          .from('schedules')
          .select('start_time, end_time')
          .eq('staff_id', userProfileId)
          .eq('work_date', today)
          .single();

        if (scheduleData) {
          // start_time and end_time are timestamps
          const startTime = scheduleData.start_time ? new Date(scheduleData.start_time).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-';
          const endTime = scheduleData.end_time ? new Date(scheduleData.end_time).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-';
          setTodaySchedule({
            start: startTime,
            end: endTime,
          });
        }

        // Fetch today's attendance - using user profile id
        const { data: attendanceData } = await supabase
          .from('attendances')
          .select('id, actual_check_in, actual_check_out, work_date, status')
          .eq('staff_id', userProfileId)
          .eq('work_date', today)
          .single();

        if (attendanceData) {
          setTodayAttendance(attendanceData);
        }

        // Calculate weekly stats
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const weekStartStr = weekStart.toISOString().split('T')[0];

        const { data: weekAttendance } = await supabase
          .from('attendances')
          .select('actual_check_in, actual_check_out, status, work_hours')
          .eq('staff_id', userProfileId)
          .gte('work_date', weekStartStr);

        if (weekAttendance) {
          let totalHours = 0;
          let lateCount = 0;

          weekAttendance.forEach((record) => {
            // Use pre-calculated work_hours if available
            if (record.work_hours) {
              totalHours += Number(record.work_hours);
            } else if (record.actual_check_in && record.actual_check_out) {
              // Fallback: calculate from timestamps
              const checkIn = new Date(record.actual_check_in);
              const checkOut = new Date(record.actual_check_out);
              totalHours += (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
            }
            if (record.status === 'LATE' || record.status === 'EARLY_LEAVE') {
              lateCount++;
            }
          });

          setWeeklyStats({
            totalHours: Math.round(totalHours),
            workDays: weekAttendance.filter(r => r.actual_check_in).length,
            lateCount,
          });
        }
      }

      // Fetch recent notices - filter by company_id if available
      let noticesQuery = supabase
        .from('notices')
        .select('id, title, created_at')
        .order('created_at', { ascending: false })
        .limit(3);

      if (userData?.company_id) {
        noticesQuery = noticesQuery.eq('company_id', userData.company_id);
      }

      const { data: noticesData } = await noticesQuery;

      if (noticesData) {
        setRecentNotices(noticesData);
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
    if (checkingIn || !user) return;
    setCheckingIn(true);

    try {
      const today = new Date().toISOString().split('T')[0];
      const now = new Date().toISOString();

      if (!todayAttendance || !todayAttendance.actual_check_in) {
        // Check in - create attendance record (use user.id which is the profile id)
        const { data, error } = await supabase
          .from('attendances')
          .upsert({
            staff_id: user.id,
            company_id: user.company_id,
            brand_id: user.brand_id,
            store_id: user.store_id,
            work_date: today,
            actual_check_in: now,
            status: 'NORMAL',
            check_in_method: 'MANUAL',
          })
          .select()
          .single();

        if (!error && data) {
          setTodayAttendance(data);
        }
      } else if (!todayAttendance.actual_check_out) {
        // Check out - update attendance record
        const { data, error } = await supabase
          .from('attendances')
          .update({
            actual_check_out: now,
          })
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
          {todayAttendance?.actual_check_in && (
            <p className="text-center text-sm text-gray-500 mt-2">
              출근 시간: {formatCheckTime(todayAttendance.actual_check_in)}
              {todayAttendance.actual_check_out && ` | 퇴근 시간: ${formatCheckTime(todayAttendance.actual_check_out)}`}
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
