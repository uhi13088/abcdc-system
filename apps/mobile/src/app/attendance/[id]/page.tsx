'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Clock, Edit2, Save, X } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';

interface AttendanceRecord {
  id: string;
  work_date: string;
  actual_check_in: string | null;
  actual_check_out: string | null;
  scheduled_check_in: string | null;
  scheduled_check_out: string | null;
  status: string;
  work_hours: number | null;
  base_pay: number | null;
  overtime_pay: number | null;
  night_pay: number | null;
  correction_reason: string | null;
  corrected_at: string | null;
}

export default function AttendanceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const attendanceId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [record, setRecord] = useState<AttendanceRecord | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    checkIn: '',
    checkOut: '',
    reason: '',
  });
  const [error, setError] = useState('');

  const fetchRecord = useCallback(async () => {
    try {
      const response = await fetch(`/api/attendances/${attendanceId}`);
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/auth/login');
          return;
        }
        throw new Error('Failed to fetch');
      }
      const data = await response.json();
      setRecord(data);

      // Set edit data from existing record
      if (data.actual_check_in) {
        const checkInDate = new Date(data.actual_check_in);
        setEditData(prev => ({
          ...prev,
          checkIn: `${checkInDate.getHours().toString().padStart(2, '0')}:${checkInDate.getMinutes().toString().padStart(2, '0')}`,
        }));
      }
      if (data.actual_check_out) {
        const checkOutDate = new Date(data.actual_check_out);
        setEditData(prev => ({
          ...prev,
          checkOut: `${checkOutDate.getHours().toString().padStart(2, '0')}:${checkOutDate.getMinutes().toString().padStart(2, '0')}`,
        }));
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  }, [attendanceId, router]);

  useEffect(() => {
    fetchRecord();
  }, [fetchRecord]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${days[date.getDay()]})`;
  };

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '0원';
    return amount.toLocaleString('ko-KR') + '원';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      NORMAL: '정상',
      LATE: '지각',
      EARLY_LEAVE: '조퇴',
      ABSENT: '결근',
      VACATION: '휴가',
    };
    return labels[status] || status;
  };

  const handleSave = async () => {
    if (!editData.reason.trim()) {
      setError('수정 사유를 입력해주세요.');
      return;
    }

    setError('');
    setSaving(true);

    try {
      // Build datetime from time input
      const workDate = record?.work_date || new Date().toISOString().split('T')[0];
      let correctedCheckIn = undefined;
      let correctedCheckOut = undefined;

      if (editData.checkIn && record?.actual_check_in) {
        const [hours, minutes] = editData.checkIn.split(':');
        const checkInDate = new Date(workDate);
        checkInDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        correctedCheckIn = checkInDate.toISOString();
      }

      if (editData.checkOut) {
        const [hours, minutes] = editData.checkOut.split(':');
        const checkOutDate = new Date(workDate);
        checkOutDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        correctedCheckOut = checkOutDate.toISOString();
      }

      const response = await fetch(`/api/attendances/${attendanceId}/correct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          corrected_check_in: correctedCheckIn,
          corrected_check_out: correctedCheckOut,
          correction_reason: editData.reason,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || '수정에 실패했습니다.');
        return;
      }

      // Refresh record and exit edit mode
      await fetchRecord();
      setIsEditing(false);
      setEditData(prev => ({ ...prev, reason: '' }));
    } catch (error) {
      console.error('Error saving correction:', error);
      setError('수정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <p className="text-gray-500">출퇴근 기록을 찾을 수 없습니다.</p>
        <button onClick={() => router.back()} className="mt-4 text-primary">
          돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 safe-top">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button onClick={() => router.back()} className="p-2 -ml-2 mr-2">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <h1 className="text-xl font-bold text-gray-900">출퇴근 상세</h1>
          </div>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center text-primary font-medium"
            >
              <Edit2 className="w-4 h-4 mr-1" />
              수정
            </button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Date & Status */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">{formatDate(record.work_date)}</h2>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              record.status === 'NORMAL' ? 'bg-green-100 text-green-700' :
              record.status === 'LATE' ? 'bg-yellow-100 text-yellow-700' :
              record.status === 'EARLY_LEAVE' ? 'bg-orange-100 text-orange-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {getStatusLabel(record.status)}
            </span>
          </div>
        </div>

        {/* Time Records */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center">
            <Clock className="w-5 h-5 mr-2 text-primary" />
            출퇴근 시간
          </h3>

          <div className="space-y-4">
            {/* Check In */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">출근</p>
                {isEditing ? (
                  <input
                    type="time"
                    value={editData.checkIn}
                    onChange={(e) => setEditData(prev => ({ ...prev, checkIn: e.target.value }))}
                    className="mt-1 px-3 py-2 border border-gray-300 rounded-lg text-lg font-medium"
                  />
                ) : (
                  <p className="text-xl font-bold text-gray-900">
                    {formatTime(record.actual_check_in)}
                  </p>
                )}
              </div>
              {record.scheduled_check_in && (
                <div className="text-right">
                  <p className="text-xs text-gray-400">예정 시간</p>
                  <p className="text-sm text-gray-500">{formatTime(record.scheduled_check_in)}</p>
                </div>
              )}
            </div>

            <div className="border-t border-gray-100"></div>

            {/* Check Out */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">퇴근</p>
                {isEditing ? (
                  <input
                    type="time"
                    value={editData.checkOut}
                    onChange={(e) => setEditData(prev => ({ ...prev, checkOut: e.target.value }))}
                    className="mt-1 px-3 py-2 border border-gray-300 rounded-lg text-lg font-medium"
                  />
                ) : (
                  <p className="text-xl font-bold text-gray-900">
                    {formatTime(record.actual_check_out) || '-'}
                  </p>
                )}
              </div>
              {record.scheduled_check_out && (
                <div className="text-right">
                  <p className="text-xs text-gray-400">예정 시간</p>
                  <p className="text-sm text-gray-500">{formatTime(record.scheduled_check_out)}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Work Hours & Pay */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h3 className="font-bold text-gray-900 mb-4">근무 시간 및 급여</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-gray-900">
                {record.work_hours ? Math.round(record.work_hours * 10) / 10 : 0}시간
              </p>
              <p className="text-sm text-gray-500">근무시간</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-primary">
                {formatCurrency((record.base_pay || 0) + (record.overtime_pay || 0) + (record.night_pay || 0))}
              </p>
              <p className="text-sm text-gray-500">일당</p>
            </div>
          </div>

          {(record.overtime_pay || record.night_pay) && (
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">기본급</span>
                <span className="text-gray-900">{formatCurrency(record.base_pay)}</span>
              </div>
              {record.overtime_pay && record.overtime_pay > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">연장수당</span>
                  <span className="text-gray-900">{formatCurrency(record.overtime_pay)}</span>
                </div>
              )}
              {record.night_pay && record.night_pay > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">야간수당</span>
                  <span className="text-gray-900">{formatCurrency(record.night_pay)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Correction History */}
        {record.corrected_at && (
          <div className="bg-blue-50 rounded-xl p-4">
            <p className="text-sm text-blue-700 font-medium mb-1">수정 기록</p>
            <p className="text-sm text-blue-600">
              {new Date(record.corrected_at).toLocaleString('ko-KR')}에 수정됨
            </p>
            {record.correction_reason && (
              <p className="text-sm text-blue-600 mt-1">
                사유: {record.correction_reason}
              </p>
            )}
          </div>
        )}

        {/* Edit Form */}
        {isEditing && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-3">수정 사유</h3>
            <textarea
              value={editData.reason}
              onChange={(e) => setEditData(prev => ({ ...prev, reason: e.target.value }))}
              placeholder="수정 사유를 입력해주세요 (예: 퇴근 기록 깜빡함)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none h-24"
            />
            {error && (
              <p className="text-red-500 text-sm mt-2">{error}</p>
            )}

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => {
                  setIsEditing(false);
                  setError('');
                  setEditData(prev => ({ ...prev, reason: '' }));
                }}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium flex items-center justify-center"
              >
                <X className="w-4 h-4 mr-1" />
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-3 bg-primary text-white rounded-xl font-medium flex items-center justify-center disabled:opacity-50"
              >
                {saving ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-1" />
                    저장
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Notice */}
        <div className="bg-orange-50 rounded-xl p-4">
          <p className="text-xs text-orange-700 leading-relaxed">
            <span className="font-medium">안내:</span> 출퇴근 기록 수정 후 관리자가 확인합니다.
            관리자가 기록을 수정할 경우 알림으로 안내드립니다.
          </p>
        </div>
      </div>
    </div>
  );
}
