'use client';

import { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Clock, CheckCircle, XCircle, AlertCircle, Edit3, X } from 'lucide-react';

interface Attendance {
  id: string;
  staff_id: string;
  staff_name?: string;
  staff?: {
    id: string;
    name: string;
    email?: string;
    position?: string;
  };
  work_date: string;
  scheduled_check_in: string | null;
  scheduled_check_out: string | null;
  actual_check_in: string | null;
  actual_check_out: string | null;
  status: 'NORMAL' | 'LATE' | 'EARLY_LEAVE' | 'ABSENT' | 'VACATION' | null;
  work_hours: number | null;
  overtime_hours: number | null;
}

interface EditModalData {
  attendance: Attendance | null;
  isOpen: boolean;
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

  // 수정 모달 관련 상태
  const [editModal, setEditModal] = useState<EditModalData>({ attendance: null, isOpen: false });
  const [editForm, setEditForm] = useState({
    actual_check_in: '',
    actual_check_out: '',
    status: '',
    correction_reason: '',
  });
  const [saving, setSaving] = useState(false);

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

  // 날짜+시간 문자열을 datetime-local input 형식으로 변환
  const toDateTimeLocal = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    // datetime-local 형식: YYYY-MM-DDTHH:mm
    return format(date, "yyyy-MM-dd'T'HH:mm");
  };

  // 수정 모달 열기
  const openEditModal = (attendance: Attendance) => {
    setEditForm({
      actual_check_in: toDateTimeLocal(attendance.actual_check_in),
      actual_check_out: toDateTimeLocal(attendance.actual_check_out),
      status: attendance.status || 'NORMAL',
      correction_reason: '',
    });
    setEditModal({ attendance, isOpen: true });
  };

  // 수정 모달 닫기
  const closeEditModal = () => {
    setEditModal({ attendance: null, isOpen: false });
    setEditForm({
      actual_check_in: '',
      actual_check_out: '',
      status: '',
      correction_reason: '',
    });
  };

  // 출퇴근 기록 수정 저장
  const handleSaveEdit = async () => {
    if (!editModal.attendance) return;

    if (!editForm.correction_reason.trim()) {
      alert('수정 사유를 입력해주세요.');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/attendances/${editModal.attendance.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actual_check_in: editForm.actual_check_in ? new Date(editForm.actual_check_in).toISOString() : null,
          actual_check_out: editForm.actual_check_out ? new Date(editForm.actual_check_out).toISOString() : null,
          status: editForm.status,
          correction_reason: editForm.correction_reason,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        alert(result.message || '수정이 완료되었습니다.');
        closeEditModal();
        fetchAttendances();
      } else {
        const error = await response.json();
        alert(error.error || '수정에 실패했습니다.');
      }
    } catch (error) {
      console.error('Edit error:', error);
      alert('수정 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
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
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {attendances.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
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
                        {attendance.staff?.name || attendance.staff_name || '-'}
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
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => openEditModal(attendance)}
                          className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit3 className="w-4 h-4 mr-1" />
                          수정
                        </button>
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
                          {(a.staff?.name || a.staff_name)?.split(' ')[0] || '직원'}
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

      {/* 출퇴근 수정 모달 */}
      {editModal.isOpen && editModal.attendance && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900">출퇴근 기록 수정</h3>
              <button onClick={closeEditModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                <span className="font-medium">{editModal.attendance.staff?.name || editModal.attendance.staff_name || '직원'}</span>
                님의 {format(new Date(editModal.attendance.work_date), 'yyyy년 M월 d일 (E)', { locale: ko })} 기록
              </p>
            </div>

            <div className="space-y-4">
              {/* 출근 시간 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">출근 시간</label>
                <input
                  type="datetime-local"
                  value={editForm.actual_check_in}
                  onChange={(e) => setEditForm(prev => ({ ...prev, actual_check_in: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* 퇴근 시간 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">퇴근 시간</label>
                <input
                  type="datetime-local"
                  value={editForm.actual_check_out}
                  onChange={(e) => setEditForm(prev => ({ ...prev, actual_check_out: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* 상태 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="NORMAL">정상</option>
                  <option value="LATE">지각</option>
                  <option value="EARLY_LEAVE">조퇴</option>
                  <option value="ABSENT">결근</option>
                  <option value="VACATION">휴가</option>
                </select>
              </div>

              {/* 수정 사유 (필수) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  수정 사유 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={editForm.correction_reason}
                  onChange={(e) => setEditForm(prev => ({ ...prev, correction_reason: e.target.value }))}
                  placeholder="수정 사유를 입력해주세요 (직원에게 알림이 발송됩니다)"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
              </div>

              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-700">
                  <strong>알림:</strong> 수정 시 근무시간이 자동으로 재계산되며, 해당 직원에게 수정 알림이 발송됩니다.
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={closeEditModal}
                className="flex-1 py-2.5 px-4 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="flex-1 py-2.5 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
