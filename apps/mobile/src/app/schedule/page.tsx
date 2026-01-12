'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { BottomNav } from '@/components/bottom-nav';
import { createClient } from '@/lib/supabase/client';

interface ScheduleItem {
  id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  shift_type: string | null;
}

interface WeekSchedule {
  date: Date;
  dayOfWeek: string;
  schedule: ScheduleItem | null;
  isToday: boolean;
}

export default function SchedulePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Start from Monday
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  });
  const [weekSchedules, setWeekSchedules] = useState<WeekSchedule[]>([]);
  const [weeklySummary, setWeeklySummary] = useState({ totalHours: 0, workDays: 0 });

  const supabase = createClient();
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        router.push('/auth/login');
        return;
      }

      // Calculate week date range
      const weekEnd = new Date(currentWeekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const startStr = currentWeekStart.toISOString().split('T')[0];
      const endStr = weekEnd.toISOString().split('T')[0];

      const { data: schedulesData } = await supabase
        .from('schedules')
        .select('id, date, start_time, end_time, shift_type')
        .eq('user_id', authUser.id)
        .gte('date', startStr)
        .lte('date', endStr);

      // Build week schedule array
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];

      const week: WeekSchedule[] = [];
      let totalMinutes = 0;
      let workDays = 0;

      for (let i = 0; i < 7; i++) {
        const date = new Date(currentWeekStart);
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];

        const schedule = schedulesData?.find((s) => s.date === dateStr) || null;

        if (schedule?.start_time && schedule?.end_time) {
          const start = new Date(`2000-01-01T${schedule.start_time}`);
          const end = new Date(`2000-01-01T${schedule.end_time}`);
          totalMinutes += (end.getTime() - start.getTime()) / (1000 * 60);
          workDays++;
        }

        week.push({
          date,
          dayOfWeek: dayNames[date.getDay()],
          schedule,
          isToday: dateStr === todayStr,
        });
      }

      setWeekSchedules(week);
      setWeeklySummary({
        totalHours: Math.round(totalMinutes / 60),
        workDays,
      });
    } catch (error) {
      console.error('Error fetching schedules:', error);
    } finally {
      setLoading(false);
    }
  }, [supabase, router, currentWeekStart]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentWeekStart((prev) => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() + (direction === 'prev' ? -7 : 7));
      return newDate;
    });
  };

  const getWeekLabel = () => {
    const year = currentWeekStart.getFullYear();
    const month = currentWeekStart.getMonth() + 1;
    const weekOfMonth = Math.ceil((currentWeekStart.getDate() + 6) / 7);
    return `${year}년 ${month}월 ${weekOfMonth}주차`;
  };

  const getShiftColor = (shiftType: string | null) => {
    if (!shiftType) return 'bg-gray-100 text-gray-400';
    switch (shiftType) {
      case 'MORNING':
        return 'bg-blue-100 text-blue-700';
      case 'AFTERNOON':
        return 'bg-orange-100 text-orange-700';
      case 'NIGHT':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getShiftLabel = (shiftType: string | null) => {
    if (!shiftType) return '휴무';
    const labels: Record<string, string> = {
      MORNING: '오전',
      AFTERNOON: '오후',
      NIGHT: '야간',
      FULL: '종일',
    };
    return labels[shiftType] || shiftType;
  };

  const formatTimeRange = (schedule: ScheduleItem | null) => {
    if (!schedule?.start_time || !schedule?.end_time) return '휴무';
    return `${schedule.start_time.slice(0, 5)} - ${schedule.end_time.slice(0, 5)}`;
  };

  const calculateDayHours = (schedule: ScheduleItem | null) => {
    if (!schedule?.start_time || !schedule?.end_time) return null;
    const start = new Date(`2000-01-01T${schedule.start_time}`);
    const end = new Date(`2000-01-01T${schedule.end_time}`);
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    return `${hours}시간`;
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
      <div className="bg-white border-b border-gray-200 p-4 safe-top">
        <h1 className="text-xl font-bold text-gray-900">근무 스케줄</h1>
      </div>

      {/* Week Navigation */}
      <div className="bg-white p-4 flex items-center justify-between border-b border-gray-200">
        <button onClick={() => navigateWeek('prev')} className="p-2 rounded-full hover:bg-gray-100">
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <span className="font-semibold text-gray-900">{getWeekLabel()}</span>
        <button onClick={() => navigateWeek('next')} className="p-2 rounded-full hover:bg-gray-100">
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Week Summary */}
      <div className="p-4">
        <div className="bg-primary rounded-2xl p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-primary-100 text-sm">이번 주 근무</p>
              <p className="text-2xl font-bold">{weeklySummary.totalHours}시간</p>
            </div>
            <div className="text-right">
              <p className="text-primary-100 text-sm">근무일</p>
              <p className="text-2xl font-bold">{weeklySummary.workDays}일</p>
            </div>
          </div>
        </div>
      </div>

      {/* Schedule List */}
      <div className="px-4 space-y-3">
        {weekSchedules.map((item) => (
          <div
            key={item.date.toISOString()}
            className={`bg-white rounded-xl p-4 shadow-sm ${item.isToday ? 'ring-2 ring-primary' : ''}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div
                  className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center ${
                    item.isToday ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  <span className="text-xs">{item.dayOfWeek}</span>
                  <span className="font-bold">{item.date.getDate()}</span>
                </div>
                <div className="ml-4">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getShiftColor(item.schedule?.shift_type || null)}`}>
                    {getShiftLabel(item.schedule?.shift_type || null)}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium text-gray-900">{formatTimeRange(item.schedule)}</p>
                {calculateDayHours(item.schedule) && (
                  <p className="text-xs text-gray-500">{calculateDayHours(item.schedule)}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="p-4 mt-4">
        <div className="bg-white rounded-xl p-4">
          <p className="text-sm font-medium text-gray-700 mb-3">근무 유형</p>
          <div className="flex items-center space-x-4 text-xs">
            <span className="flex items-center">
              <span className="w-3 h-3 bg-blue-100 rounded-full mr-1"></span>
              오전
            </span>
            <span className="flex items-center">
              <span className="w-3 h-3 bg-orange-100 rounded-full mr-1"></span>
              오후
            </span>
            <span className="flex items-center">
              <span className="w-3 h-3 bg-purple-100 rounded-full mr-1"></span>
              야간
            </span>
            <span className="flex items-center">
              <span className="w-3 h-3 bg-gray-100 rounded-full mr-1"></span>
              휴무
            </span>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
