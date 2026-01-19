'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Clock, Edit2, Save, X, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
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

interface CorrectionRequest {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requested_check_in: string | null;
  requested_check_out: string | null;
  reason: string;
  rejection_reason: string | null;
  created_at: string;
  processed_at: string | null;
}

export default function AttendanceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const attendanceId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [record, setRecord] = useState<AttendanceRecord | null>(null);
  const [correctionRequests, setCorrectionRequests] = useState<CorrectionRequest[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    checkIn: '',
    checkOut: '',
    reason: '',
  });
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const fetchRecord = useCallback(async () => {
    try {
      const [recordRes, requestsRes] = await Promise.all([
        fetch(`/api/attendances/${attendanceId}`),
        fetch(`/api/attendances/${attendanceId}/correct`),
      ]);

      if (!recordRes.ok) {
        if (recordRes.status === 401) {
          router.push('/auth/login');
          return;
        }
        throw new Error('Failed to fetch');
      }

      const data = await recordRes.json();
      setRecord(data);

      if (requestsRes.ok) {
        const requestsData = await requestsRes.json();
        setCorrectionRequests(requestsData);
      }

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
      EARLY_CHECK_IN: '조기출근',
      EARLY_LEAVE: '조퇴',
      LATE_AND_EARLY_LEAVE: '지각+조퇴',
      OVERTIME: '연장근무',
      ABSENT: '결근',
      NO_SHOW: '미출근',
      VACATION: '휴가',
    };
    return labels[status] || status;
  };

  const getStatusStyle = (status: string) => {
    const styles: Record<string, string> = {
      NORMAL: 'bg-green-100 text-green-700',
      LATE: 'bg-yellow-100 text-yellow-700',
      EARLY_CHECK_IN: 'bg-blue-100 text-blue-700',
      EARLY_LEAVE: 'bg-orange-100 text-orange-700',
      LATE_AND_EARLY_LEAVE: 'bg-red-100 text-red-700',
      OVERTIME: 'bg-purple-100 text-purple-700',
      ABSENT: 'bg-red-100 text-red-700',
      NO_SHOW: 'bg-red-100 text-red-700',
      VACATION: 'bg-blue-100 text-blue-700',
    };
    return styles[status] || 'bg-gray-100 text-gray-700';
  };

  const hasPendingRequest = correctionRequests.some(r => r.status === 'PENDING');

  const handleSave = async () => {
    if (!editData.reason.trim()) {
      setError('수정 사유를 입력해주세요.');
      return;
    }

    setError('');
    setSuccessMessage('');
    setSaving(true);

    try {
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
        setError(result.error || '요청에 실패했습니다.');
        return;
      }

      setSuccessMessage('수정 요청이 접수되었습니다. 관리자 승인 후 반영됩니다.');
      await fetchRecord();
      setIsEditing(false);
      setEditData(prev => ({ ...prev, reason: '' }));
    } catch (error) {
      console.error('Error saving correction:', error);
      setError('요청에 실패했습니다.');
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
          {!isEditing && !hasPendingRequest && (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center text-primary font-medium"
            >
              <Edit2 className="w-4 h-4 mr-1" />
              수정요청
            </button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Success Message */}
        {successMessage && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start">
            <CheckCircle className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-green-700">{successMessage}</p>
          </div>
        )}

        {/* Pending Request Notice */}
        {hasPendingRequest && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start">
            <AlertCircle className="w-5 h-5 text-yellow-500 mr-2 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-yellow-700 font-medium">수정 요청 대기 중</p>
              <p className="text-xs text-yellow-600 mt-1">
                관리자 승인을 기다리고 있습니다. 승인 후 급여에 반영됩니다.
              </p>
            </div>
          </div>
        )}

        {/* Date & Status */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">{formatDate(record.work_date)}</h2>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusStyle(record.status)}`}>
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

        {/* Correction Request History */}
        {correctionRequests.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-3">수정 요청 이력</h3>
            <div className="space-y-3">
              {correctionRequests.map((req) => (
                <div
                  key={req.id}
                  className={`p-3 rounded-xl ${
                    req.status === 'PENDING'
                      ? 'bg-yellow-50 border border-yellow-200'
                      : req.status === 'APPROVED'
                      ? 'bg-green-50 border border-green-200'
                      : 'bg-red-50 border border-red-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      {req.status === 'PENDING' && <AlertCircle className="w-4 h-4 text-yellow-500 mr-1" />}
                      {req.status === 'APPROVED' && <CheckCircle className="w-4 h-4 text-green-500 mr-1" />}
                      {req.status === 'REJECTED' && <XCircle className="w-4 h-4 text-red-500 mr-1" />}
                      <span className={`text-sm font-medium ${
                        req.status === 'PENDING' ? 'text-yellow-700' :
                        req.status === 'APPROVED' ? 'text-green-700' : 'text-red-700'
                      }`}>
                        {req.status === 'PENDING' ? '대기 중' :
                         req.status === 'APPROVED' ? '승인됨' : '거절됨'}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(req.created_at).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">사유: {req.reason}</p>
                  {req.requested_check_out && (
                    <p className="text-xs text-gray-500 mt-1">
                      요청 퇴근: {formatTime(req.requested_check_out)}
                    </p>
                  )}
                  {req.status === 'REJECTED' && req.rejection_reason && (
                    <p className="text-xs text-red-600 mt-1">거절 사유: {req.rejection_reason}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Edit Form */}
        {isEditing && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-3">수정 사유</h3>
            <textarea
              value={editData.reason}
              onChange={(e) => setEditData(prev => ({ ...prev, reason: e.target.value }))}
              placeholder="수정 사유를 입력해주세요 (예: 퇴근 기록 깜빡함, 연장 근무 등)"
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
                    요청하기
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Notice */}
        <div className="bg-orange-50 rounded-xl p-4">
          <p className="text-xs text-orange-700 leading-relaxed">
            <span className="font-medium">안내:</span> 출퇴근 수정 요청 후 관리자 승인이 필요합니다.
            승인되면 급여에 자동 반영됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}
