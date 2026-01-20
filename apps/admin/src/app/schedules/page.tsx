'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/layout/header';
import {
  Button,
  Card,
  CardContent,
  Badge,
  PageLoading,
  Select,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Input,
  Label,
  Alert,
} from '@/components/ui';
import { Plus, ChevronLeft, ChevronRight, Clock } from 'lucide-react';

interface Schedule {
  id: string;
  work_date: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  status: string;
  staff: {
    id: string;
    name: string;
    position: string;
  };
  stores: {
    id: string;
    name: string;
  };
}

interface Store {
  id: string;
  name: string;
  brand_id: string;
}

interface Staff {
  id: string;
  name: string;
  position: string;
}

const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [storeFilter, setStoreFilter] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');

  // New schedule dialog
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [newSchedule, setNewSchedule] = useState({
    staffId: '',
    storeId: '',
    startTime: '09:00',
    endTime: '18:00',
    breakMinutes: 60,
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchStores();
    fetchStaff();
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, [currentDate, storeFilter, viewMode]);

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      const startDate = getWeekStart(currentDate).toISOString().split('T')[0];
      const endDate = getWeekEnd(currentDate).toISOString().split('T')[0];

      const params = new URLSearchParams({
        startDate,
        endDate,
      });
      if (storeFilter) params.set('storeId', storeFilter);

      const response = await fetch(`/api/schedules?${params}`);
      if (response.ok) {
        const data = await response.json();
        setSchedules(data);
      }
    } catch (error) {
      console.error('Failed to fetch schedules:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStores = async () => {
    const response = await fetch('/api/stores');
    if (response.ok) {
      const data = await response.json();
      setStores(data);
    }
  };

  const fetchStaff = async () => {
    const response = await fetch('/api/users?status=ACTIVE');
    if (response.ok) {
      const data = await response.json();
      setStaffList(data.data || []);
    }
  };

  const getWeekStart = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    return d;
  };

  const getWeekEnd = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() + (6 - day));
    return d;
  };

  const getWeekDays = () => {
    const start = getWeekStart(currentDate);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  };

  const prevWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 7);
    setCurrentDate(d);
  };

  const nextWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 7);
    setCurrentDate(d);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getSchedulesForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return schedules.filter((s) => s.work_date === dateStr);
  };

  const handleCreateSchedule = async () => {
    setError('');
    setSubmitting(true);

    try {
      const response = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newSchedule,
          workDate: selectedDate,
        }),
      });

      if (response.ok) {
        setShowNewDialog(false);
        setNewSchedule({
          staffId: '',
          storeId: '',
          startTime: '09:00',
          endTime: '18:00',
          breakMinutes: 60,
        });
        fetchSchedules();
      } else {
        const data = await response.json();
        setError(data.error || '스케줄 생성에 실패했습니다.');
      }
    } catch (err) {
      setError('스케줄 생성에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
      const response = await fetch(`/api/schedules/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchSchedules();
      }
    } catch (error) {
      alert('삭제에 실패했습니다.');
    }
  };

  const openNewDialog = (date: Date) => {
    setSelectedDate(date.toISOString().split('T')[0]);
    setShowNewDialog(true);
  };

  const weekDays = getWeekDays();

  return (
    <div>
      <Header title="스케줄 관리" />

      <div className="p-6">
        {/* Toolbar */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={prevWeek}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToToday}>
                오늘
              </Button>
              <Button variant="outline" size="sm" onClick={nextWeek}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <span className="font-medium">
              {getWeekStart(currentDate).toLocaleDateString('ko-KR')} -{' '}
              {getWeekEnd(currentDate).toLocaleDateString('ko-KR')}
            </span>
          </div>
          <div className="flex gap-4">
            <Select
              value={storeFilter}
              onChange={(e) => setStoreFilter(e.target.value)}
              options={[
                { value: '', label: '전체 매장' },
                ...stores.map((s) => ({ value: s.id, label: s.name })),
              ]}
              className="w-40"
            />
          </div>
        </div>

        {loading ? (
          <PageLoading />
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {/* Week header */}
            <div className="grid grid-cols-7 border-b">
              {weekDays.map((day, index) => {
                const isToday = day.toDateString() === new Date().toDateString();
                const isWeekend = index === 0 || index === 6;
                return (
                  <div
                    key={index}
                    className={`p-4 text-center border-r last:border-r-0 ${
                      isToday ? 'bg-primary/10' : ''
                    }`}
                  >
                    <div
                      className={`text-sm font-medium ${
                        isWeekend ? 'text-red-500' : 'text-gray-500'
                      }`}
                    >
                      {DAYS[index]}
                    </div>
                    <div
                      className={`text-lg font-semibold ${
                        isToday ? 'text-primary' : ''
                      }`}
                    >
                      {day.getDate()}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Schedule cells */}
            <div className="grid grid-cols-7 min-h-[400px]">
              {weekDays.map((day, index) => {
                const daySchedules = getSchedulesForDate(day);
                const isWeekend = index === 0 || index === 6;

                return (
                  <div
                    key={index}
                    className={`border-r last:border-r-0 p-2 ${
                      isWeekend ? 'bg-gray-50' : ''
                    }`}
                  >
                    <div className="space-y-2">
                      {daySchedules.map((schedule) => (
                        <div
                          key={schedule.id}
                          className="p-2 bg-blue-50 rounded-md text-sm cursor-pointer hover:bg-blue-100"
                          onClick={() => handleDeleteSchedule(schedule.id)}
                        >
                          <div className="font-medium text-blue-900">
                            {schedule.staff?.name}
                          </div>
                          <div className="text-blue-700 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {schedule.start_time?.slice(11, 16)} -{' '}
                            {schedule.end_time?.slice(11, 16)}
                          </div>
                          <div className="text-blue-600 text-xs">
                            {schedule.stores?.name}
                          </div>
                        </div>
                      ))}
                      <button
                        onClick={() => openNewDialog(day)}
                        className="w-full p-2 border-2 border-dashed border-gray-200 rounded-md text-gray-400 hover:border-primary hover:text-primary text-sm flex items-center justify-center gap-1"
                      >
                        <Plus className="h-4 w-4" />
                        추가
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* New Schedule Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>스케줄 추가</DialogTitle>
          </DialogHeader>

          {error && (
            <Alert variant="error" className="mb-4">
              {error}
            </Alert>
          )}

          <div className="space-y-4">
            <div>
              <Label>날짜</Label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label required>직원</Label>
              <Select
                value={newSchedule.staffId}
                onChange={(e) => setNewSchedule({ ...newSchedule, staffId: e.target.value })}
                options={[
                  { value: '', label: '직원 선택' },
                  ...staffList.map((s) => ({
                    value: s.id,
                    label: `${s.name} (${s.position || '-'})`,
                  })),
                ]}
                className="mt-1"
              />
            </div>
            <div>
              <Label required>매장</Label>
              <Select
                value={newSchedule.storeId}
                onChange={(e) => setNewSchedule({ ...newSchedule, storeId: e.target.value })}
                options={[
                  { value: '', label: '매장 선택' },
                  ...stores.map((s) => ({ value: s.id, label: s.name })),
                ]}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>시작 시간</Label>
                <Input
                  type="time"
                  value={newSchedule.startTime}
                  onChange={(e) =>
                    setNewSchedule({ ...newSchedule, startTime: e.target.value })
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <Label>종료 시간</Label>
                <Input
                  type="time"
                  value={newSchedule.endTime}
                  onChange={(e) =>
                    setNewSchedule({ ...newSchedule, endTime: e.target.value })
                  }
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label>휴게 시간 (분)</Label>
              <Input
                type="number"
                value={newSchedule.breakMinutes}
                onChange={(e) =>
                  setNewSchedule({ ...newSchedule, breakMinutes: parseInt(e.target.value) || 0 })
                }
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>
              취소
            </Button>
            <Button onClick={handleCreateSchedule} disabled={submitting}>
              {submitting ? '생성 중...' : '생성'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
