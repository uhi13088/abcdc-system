'use client';

import { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Clock, MapPin, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface Attendance {
  id: string;
  staff_id: string;
  staff_name?: string;
  work_date: string;
  scheduled_check_in: string | null;
  scheduled_check_out: string | null;
  actual_check_in: string | null;
  actual_check_out: string | null;
  status: 'NORMAL' | 'LATE' | 'EARLY_LEAVE' | 'ABSENT' | 'VACATION' | null;
  work_hours: number | null;
  overtime_hours: number | null;
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  NORMAL: { label: '정상', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  LATE: { label: '지각', color: 'bg-yellow-100 text-yellow-800', icon: AlertCircle },
  EARLY_LEAVE: { label: '조퇴', color: 'bg-orange-100 text-orange-800', icon: AlertCircle },
  ABSENT: { label: '결근', color: 'bg-red-100 text-red-800', icon: XCircle },
  VACATION: { label: '휴가', color: 'bg-blue-100 text-blue-800', icon: Clock },
};

export default function AttendancePage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'calendar' | 'list'>('list');

  useEffect(() => {
    fetchAttendances();
  }, [currentDate]);

  const fetchAttendances = async () => {
    try {
      setLoading(true);
      const start = format(startOfMonth(currentDate), 'yyyy-MM-dd');
      const end = format(endOfMonth(currentDate), 'yyyy-MM-dd');

      const response = await fetch(`/api/attendances?startDate=${start}&endDate=${end}&limit=1000`);
      if (response.ok) {
        const result = await response.json();
        // API returns { data: [...], pagination: {...} }
        const attendanceData = Array.isArray(result) ? result : (result.data || []);
        setAttendances(attendanceData);
      } else {
        setAttendances([]);
      }
    } catch (error) {
      console.error('Failed to fetch attendances:', error);
      setAttendances([]);
    } finally {
      setLoading(false);
    }
  };

  const goToPreviousMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1));
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return '-';
    return format(new Date(dateString), 'HH:mm');
  };

  const days = eachDayOfInterval({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate),
  });

  const getAttendanceForDay = (day: Date) => {
    return attendances.filter(a => isSameDay(new Date(a.work_date), day));
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">출퇴근 관리</h1>
          <p className="mt-1 text-sm text-gray-500">직원들의 출퇴근 현황을 관리합니다</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView('list')}
              className={`px-3 py-1.5 text-sm rounded-lg ${
                view === 'list' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              목록
            </button>
            <button
              onClick={() => setView('calendar')}
              className={`px-3 py-1.5 text-sm rounded-lg ${
                view === 'calendar' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              캘린더
            </button>
          </div>
        </div>
      </div>

      {/* Month Navigation */}
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={goToPreviousMonth}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-semibold">
          {format(currentDate, 'yyyy년 M월', { locale: ko })}
        </h2>
        <button
          onClick={goToNextMonth}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {Object.entries(statusConfig).map(([status, config]) => {
          const count = attendances.filter(a => a.status === status).length;
          const Icon = config.icon;
          return (
            <div key={status} className="bg-white rounded-xl p-4 shadow-sm border">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">{config.label}</span>
              </div>
              <p className="text-2xl font-bold">{count}</p>
            </div>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : view === 'list' ? (
        /* List View */
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">날짜</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">직원</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">예정 출근</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">실제 출근</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">예정 퇴근</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">실제 퇴근</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">근무시간</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {attendances.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    출퇴근 기록이 없습니다
                  </td>
                </tr>
              ) : (
                attendances.map((attendance) => {
                  const statusInfo = attendance.status ? statusConfig[attendance.status] : null;
                  return (
                    <tr key={attendance.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {format(new Date(attendance.work_date), 'M/d (E)', { locale: ko })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {attendance.staff_name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatTime(attendance.scheduled_check_in)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {formatTime(attendance.actual_check_in)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatTime(attendance.scheduled_check_out)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {formatTime(attendance.actual_check_out)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {attendance.work_hours ? `${attendance.work_hours}시간` : '-'}
                        {attendance.overtime_hours ? (
                          <span className="text-orange-600 ml-1">
                            (+{attendance.overtime_hours}h)
                          </span>
                        ) : null}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {statusInfo ? (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* Calendar View */
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="grid grid-cols-7 gap-1">
            {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
              <div key={day} className="text-center py-2 text-sm font-medium text-gray-500">
                {day}
              </div>
            ))}
            {days.map((day, idx) => {
              const dayAttendances = getAttendanceForDay(day);
              const isToday = isSameDay(day, new Date());

              return (
                <div
                  key={day.toISOString()}
                  className={`min-h-24 p-2 border rounded-lg ${
                    isToday ? 'bg-blue-50 border-blue-200' : 'border-gray-100'
                  }`}
                >
                  <div className={`text-sm font-medium mb-1 ${
                    day.getDay() === 0 ? 'text-red-500' : day.getDay() === 6 ? 'text-blue-500' : ''
                  }`}>
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-1">
                    {dayAttendances.slice(0, 3).map((a) => {
                      const statusInfo = a.status ? statusConfig[a.status] : null;
                      return (
                        <div
                          key={a.id}
                          className={`text-xs px-1 py-0.5 rounded truncate ${
                            statusInfo?.color || 'bg-gray-100'
                          }`}
                        >
                          {a.staff_name?.split(' ')[0] || '직원'}
                        </div>
                      );
                    })}
                    {dayAttendances.length > 3 && (
                      <div className="text-xs text-gray-500">
                        +{dayAttendances.length - 3}명
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
