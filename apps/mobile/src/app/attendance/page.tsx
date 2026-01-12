'use client';

import { useState, useEffect, useCallback } from 'react';
import { Calendar } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { BottomNav } from '@/components/bottom-nav';
import { createClient } from '@/lib/supabase/client';

interface AttendanceRecord {
  id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  status: string;
}

interface MonthlySummary {
  workDays: number;
  totalHours: number;
  lateCount: number;
}

export default function AttendancePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<MonthlySummary>({ workDays: 0, totalHours: 0, lateCount: 0 });
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);

  const supabase = createClient();

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        router.push('/auth/login');
        return;
      }

      const [year, month] = selectedMonth.split('-');
      const startDate = `${year}-${month}-01`;
      const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];

      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('id, date, check_in, check_out, status')
        .eq('user_id', authUser.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

      if (attendanceData) {
        setRecords(attendanceData);

        // Calculate summary
        let totalMinutes = 0;
        let lateCount = 0;

        attendanceData.forEach((record) => {
          if (record.check_in && record.check_out) {
            const checkIn = new Date(`2000-01-01T${record.check_in}`);
            const checkOut = new Date(`2000-01-01T${record.check_out}`);
            totalMinutes += (checkOut.getTime() - checkIn.getTime()) / (1000 * 60);
          }
          if (record.status === 'LATE' || record.status === 'EARLY_LEAVE') {
            lateCount++;
          }
        });

        setSummary({
          workDays: attendanceData.length,
          totalHours: Math.round(totalMinutes / 60),
          lateCount,
        });
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  }, [supabase, router, selectedMonth]);

  useEffect(() => {
    // Generate available months (last 12 months)
    const months: string[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    }
    setAvailableMonths(months);
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${month}/${day} (${days[date.getDay()]})`;
  };

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return '-';
    return timeStr.slice(0, 5);
  };

  const calculateHours = (checkIn: string | null, checkOut: string | null) => {
    if (!checkIn || !checkOut) return '-';
    const start = new Date(`2000-01-01T${checkIn}`);
    const end = new Date(`2000-01-01T${checkOut}`);
    const diffMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
    const hours = Math.floor(diffMinutes / 60);
    const minutes = Math.round(diffMinutes % 60);
    return minutes > 0 ? `${hours}시간 ${minutes}분` : `${hours}시간`;
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      PRESENT: 'bg-green-100 text-green-700',
      LATE: 'bg-yellow-100 text-yellow-700',
      EARLY_LEAVE: 'bg-orange-100 text-orange-700',
      ABSENT: 'bg-red-100 text-red-700',
    };
    const labels: Record<string, string> = {
      PRESENT: '정상',
      LATE: '지각',
      EARLY_LEAVE: '조퇴',
      ABSENT: '결근',
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
        {labels[status] || status}
      </span>
    );
  };

  const formatMonthLabel = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    return `${year}년 ${parseInt(month)}월`;
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
        <h1 className="text-xl font-bold text-gray-900">출퇴근 기록</h1>
      </div>

      {/* Summary */}
      <div className="p-4">
        <div className="bg-primary rounded-2xl p-4 text-white">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">{formatMonthLabel(selectedMonth)} 근무 현황</h2>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-white/20 text-white px-3 py-1 rounded-lg text-sm"
            >
              {availableMonths.map((month) => (
                <option key={month} value={month}>
                  {formatMonthLabel(month)}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-3xl font-bold">{summary.workDays}</p>
              <p className="text-primary-100 text-xs">근무일</p>
            </div>
            <div>
              <p className="text-3xl font-bold">{summary.totalHours}</p>
              <p className="text-primary-100 text-xs">총 시간</p>
            </div>
            <div>
              <p className="text-3xl font-bold">{summary.lateCount}</p>
              <p className="text-primary-100 text-xs">지각/조퇴</p>
            </div>
          </div>
        </div>
      </div>

      {/* Records List */}
      <div className="px-4">
        <h2 className="font-semibold text-gray-900 mb-3 flex items-center">
          <Calendar className="w-5 h-5 mr-2 text-primary" />
          출퇴근 기록
        </h2>
        {records.length > 0 ? (
          <div className="space-y-3">
            {records.map((record) => (
              <div key={record.id} className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900">{formatDate(record.date)}</span>
                  {getStatusBadge(record.status)}
                </div>
                <div className="grid grid-cols-3 text-sm text-gray-500">
                  <div>
                    <p className="text-xs text-gray-400">출근</p>
                    <p className="font-medium text-gray-900">{formatTime(record.check_in)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">퇴근</p>
                    <p className="font-medium text-gray-900">{formatTime(record.check_out)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">근무</p>
                    <p className="font-medium text-gray-900">{calculateHours(record.check_in, record.check_out)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl p-8 shadow-sm text-center">
            <p className="text-gray-400">이번 달 출퇴근 기록이 없습니다</p>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
