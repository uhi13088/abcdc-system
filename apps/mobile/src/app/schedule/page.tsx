'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { BottomNav } from '@/components/bottom-nav';
import { formatLocalDate } from '@/lib/utils';

interface ScheduleItem {
  id: string;
  work_date: string;
  start_time: string | null;
  end_time: string | null;
  status: string | null;
  break_minutes: number | null;
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
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  });
  const [weekSchedules, setWeekSchedules] = useState<WeekSchedule[]>([]);
  const [weeklySummary, setWeeklySummary] = useState({ totalHours: 0, workDays: 0 });

  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    try {
      // Calculate week date range
      const weekEnd = new Date(currentWeekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const startStr = formatLocalDate(currentWeekStart);
      const endStr = formatLocalDate(weekEnd);

      // Fetch schedules via API
      const response = await fetch(`/api/schedules/week?start=${startStr}&end=${endStr}`);
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/auth/login');
          return;
        }
        throw new Error('Failed to fetch schedules');
      }

      const schedulesData: ScheduleItem[] = await response.json();

      // Build week schedule array
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = formatLocalDate(today);

      const week: WeekSchedule[] = [];
      let totalMinutes = 0;
      let workDays = 0;

      for (let i = 0; i < 7; i++) {
        const date = new Date(currentWeekStart);
        date.setDate(date.getDate() + i);
        const dateStr = formatLocalDate(date);

        const schedule = schedulesData?.find((s) => s.work_date === dateStr) || null;

        if (schedule?.start_time && schedule?.end_time) {
          const start = new Date(schedule.start_time);
          const end = new Date(schedule.end_time);
          const breakMins = schedule.break_minutes || 0;
          totalMinutes += (end.getTime() - start.getTime()) / (1000 * 60) - breakMins;
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
  }, [router, currentWeekStart]);

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

  const getScheduleStatusColor = (status: string | null) => {
    if (!status) return 'bg-gray-100 text-gray-400';
    switch (status) {
      case 'SCHEDULED':
        return 'bg-blue-100 text-blue-700';
      case 'CONFIRMED':
        return 'bg-green-100 text-green-700';
      case 'COMPLETED':
        return 'bg-gray-100 text-gray-700';
      case 'CANCELLED':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusLabel = (schedule: ScheduleItem | null) => {
    if (!schedule) return '휴무';
    if (!schedule.start_time) return '휴무';
    const labels: Record<string, string> = {
      SCHEDULED: '예정',
      CONFIRMED: '확정',
      COMPLETED: '완료',
      CANCELLED: '취소',
    };
    return labels[schedule.status || ''] || '근무';
  };

  const formatTimeRange = (schedule: ScheduleItem | null) => {
    if (!schedule?.start_time || !schedule?.end_time) return '휴무';
    const startTime = new Date(schedule.start_time).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    const endTime = new Date(schedule.end_time).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    return `${startTime} - ${endTime}`;
  };

  const calculateDayHours = (schedule: ScheduleItem | null) => {
    if (!schedule?.start_time || !schedule?.end_time) return null;
    const start = new Date(schedule.start_time);
    const end = new Date(schedule.end_time);
    const breakMins = schedule.break_minutes || 0;
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60) - (breakMins / 60);
    return `${Math.round(hours * 10) / 10}시간`;
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
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getScheduleStatusColor(item.schedule?.status || null)}`}>
                    {getStatusLabel(item.schedule)}
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
          <p className="text-sm font-medium text-gray-700 mb-3">상태 안내</p>
          <div className="flex items-center space-x-4 text-xs">
            <span className="flex items-center">
              <span className="w-3 h-3 bg-blue-100 rounded-full mr-1"></span>
              예정
            </span>
            <span className="flex items-center">
              <span className="w-3 h-3 bg-green-100 rounded-full mr-1"></span>
              확정
            </span>
            <span className="flex items-center">
              <span className="w-3 h-3 bg-gray-200 rounded-full mr-1"></span>
              완료
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
