'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Clock, AlertCircle, CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface Correction {
  id: string;
  attendance_id: string;
  request_type: string;
  original_check_in: string | null;
  original_check_out: string | null;
  requested_check_in: string | null;
  requested_check_out: string | null;
  reason: string;
  reason_category: string | null;
  overtime_hours: number | null;
  status: string;
  review_comment: string | null;
  auto_generated: boolean;
  created_at: string;
  attendances: {
    id: string;
    work_date: string;
    scheduled_check_in: string | null;
    scheduled_check_out: string | null;
    actual_check_in: string | null;
    actual_check_out: string | null;
  };
}

interface ReasonCategory {
  code: string;
  name: string;
  applicable_types: string[];
}

const REQUEST_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  LATE_CHECKIN: { label: '지각', color: 'text-orange-600 bg-orange-50' },
  EARLY_CHECKOUT: { label: '조퇴', color: 'text-yellow-600 bg-yellow-50' },
  OVERTIME: { label: '연장근무', color: 'text-blue-600 bg-blue-50' },
  NO_SHOW_REASON: { label: '미출근', color: 'text-red-600 bg-red-50' },
  TIME_CORRECTION: { label: '시간수정', color: 'text-gray-600 bg-gray-50' },
};

const STATUS_CONFIG: Record<string, { label: string; icon: typeof CheckCircle; color: string }> = {
  PENDING: { label: '승인 대기', icon: Clock, color: 'text-yellow-600' },
  APPROVED: { label: '승인됨', icon: CheckCircle, color: 'text-green-600' },
  REJECTED: { label: '거절됨', icon: XCircle, color: 'text-red-600' },
  CANCELLED: { label: '취소됨', icon: XCircle, color: 'text-gray-600' },
};

export default function CorrectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [correction, setCorrection] = useState<Correction | null>(null);
  const [reasonCategories, setReasonCategories] = useState<ReasonCategory[]>([]);
  const [error, setError] = useState('');

  // 폼 상태
  const [reason, setReason] = useState('');
  const [reasonCategory, setReasonCategory] = useState('');
  const [requestedCheckIn, setRequestedCheckIn] = useState('');
  const [requestedCheckOut, setRequestedCheckOut] = useState('');
  const [overtimeHours, setOvertimeHours] = useState('');

  useEffect(() => {
    fetchCorrection();
  }, [id]);

  const fetchCorrection = async () => {
    try {
      const response = await fetch(`/api/attendance/corrections/${id}`);
      if (!response.ok) {
        const data = await response.json();
        setError(data.error || '데이터를 불러올 수 없습니다.');
        return;
      }

      const data = await response.json();
      setCorrection(data.correction);
      setReasonCategories(data.reasonCategories || []);

      // 폼 초기값 설정
      setReason(data.correction.reason || '');
      setReasonCategory(data.correction.reason_category || '');
      if (data.correction.requested_check_in) {
        setRequestedCheckIn(formatTimeForInput(data.correction.requested_check_in));
      }
      if (data.correction.requested_check_out) {
        setRequestedCheckOut(formatTimeForInput(data.correction.requested_check_out));
      }
      if (data.correction.overtime_hours) {
        setOvertimeHours(data.correction.overtime_hours.toString());
      }
    } catch (err) {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const formatTimeForInput = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toTimeString().slice(0, 5);
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    });
  };

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError('사유를 입력해주세요.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/attendance/corrections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          correctionId: correction?.id,
          reason: reason.trim(),
          reasonCategory,
          requestedCheckIn: requestedCheckIn
            ? `${correction?.attendances.work_date}T${requestedCheckIn}:00`
            : undefined,
          requestedCheckOut: requestedCheckOut
            ? `${correction?.attendances.work_date}T${requestedCheckOut}:00`
            : undefined,
          overtimeHours: overtimeHours ? parseFloat(overtimeHours) : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || '요청 처리 중 오류가 발생했습니다.');
        return;
      }

      // 성공 - 홈으로 이동
      router.push('/home');
    } catch (err) {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('정말 요청을 취소하시겠습니까?')) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/attendance/corrections/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        router.push('/home');
      } else {
        const data = await response.json();
        setError(data.error || '취소 처리 중 오류가 발생했습니다.');
      }
    } catch (err) {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!correction) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <p className="text-gray-600">{error || '요청을 찾을 수 없습니다.'}</p>
        <button
          onClick={() => router.back()}
          className="mt-4 px-4 py-2 bg-primary text-white rounded-lg"
        >
          돌아가기
        </button>
      </div>
    );
  }

  const typeConfig = REQUEST_TYPE_LABELS[correction.request_type] || {
    label: correction.request_type,
    color: 'text-gray-600 bg-gray-50',
  };
  const statusConfig = STATUS_CONFIG[correction.status] || STATUS_CONFIG.PENDING;
  const StatusIcon = statusConfig.icon;
  const isEditable = correction.status === 'PENDING';
  const applicableCategories = reasonCategories.filter(
    (cat) => cat.applicable_types.includes(correction.request_type)
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 safe-top sticky top-0 z-10">
        <div className="flex items-center">
          <button onClick={() => router.back()} className="p-2 -ml-2 mr-2">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">근태 수정 요청</h1>
        </div>
      </div>

      <div className="p-4 space-y-4 pb-32">
        {/* 상태 카드 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${typeConfig.color}`}>
              {typeConfig.label}
            </span>
            <div className={`flex items-center gap-1 ${statusConfig.color}`}>
              <StatusIcon className="w-4 h-4" />
              <span className="text-sm font-medium">{statusConfig.label}</span>
            </div>
          </div>

          <div className="text-center py-2">
            <p className="text-sm text-gray-500">근무일</p>
            <p className="text-lg font-semibold text-gray-900">
              {formatDate(correction.attendances.work_date)}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
            <div className="text-center">
              <p className="text-xs text-gray-500">예정 출근</p>
              <p className="font-medium">{formatTime(correction.attendances.scheduled_check_in)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">실제 출근</p>
              <p className="font-medium">{formatTime(correction.attendances.actual_check_in)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">예정 퇴근</p>
              <p className="font-medium">{formatTime(correction.attendances.scheduled_check_out)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">실제 퇴근</p>
              <p className="font-medium">{formatTime(correction.attendances.actual_check_out)}</p>
            </div>
          </div>
        </div>

        {/* 거절 사유 (거절된 경우) */}
        {correction.status === 'REJECTED' && correction.review_comment && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
            <p className="text-sm font-medium text-red-800 mb-1">거절 사유</p>
            <p className="text-sm text-red-700">{correction.review_comment}</p>
          </div>
        )}

        {/* 수정 폼 */}
        {isEditable ? (
          <>
            {/* 사유 카테고리 */}
            {applicableCategories.length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  사유 분류
                </label>
                <div className="flex flex-wrap gap-2">
                  {applicableCategories.map((cat) => (
                    <button
                      key={cat.code}
                      onClick={() => setReasonCategory(cat.code)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        reasonCategory === cat.code
                          ? 'bg-primary text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 사유 입력 */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                사유 입력 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="사유를 상세히 입력해주세요..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              />
            </div>

            {/* 시간 수정 (지각/조퇴) */}
            {(correction.request_type === 'LATE_CHECKIN' || correction.request_type === 'TIME_CORRECTION') && (
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  출근 시간 수정 (선택)
                </label>
                <input
                  type="time"
                  value={requestedCheckIn}
                  onChange={(e) => setRequestedCheckIn(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <p className="text-xs text-gray-500 mt-1">
                  수정을 원하지 않으면 비워두세요
                </p>
              </div>
            )}

            {(correction.request_type === 'EARLY_CHECKOUT' || correction.request_type === 'TIME_CORRECTION') && (
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  퇴근 시간 수정 (선택)
                </label>
                <input
                  type="time"
                  value={requestedCheckOut}
                  onChange={(e) => setRequestedCheckOut(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <p className="text-xs text-gray-500 mt-1">
                  수정을 원하지 않으면 비워두세요
                </p>
              </div>
            )}

            {/* 연장근무 시간 */}
            {correction.request_type === 'OVERTIME' && (
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  연장근무 시간 (시간)
                </label>
                <input
                  type="number"
                  value={overtimeHours}
                  onChange={(e) => setOvertimeHours(e.target.value)}
                  placeholder="예: 1.5"
                  step="0.5"
                  min="0.5"
                  max="8"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            )}

            {/* 에러 메시지 */}
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
                {error}
              </div>
            )}
          </>
        ) : (
          /* 읽기 전용 (이미 처리된 경우) */
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-sm font-medium text-gray-700 mb-2">제출된 사유</p>
            <p className="text-gray-900">{correction.reason || '(미입력)'}</p>
            {correction.reason_category && (
              <p className="text-sm text-gray-500 mt-2">
                분류: {reasonCategories.find((c) => c.code === correction.reason_category)?.name || correction.reason_category}
              </p>
            )}
          </div>
        )}
      </div>

      {/* 하단 버튼 */}
      {isEditable && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 safe-bottom">
          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              disabled={submitting}
              className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium disabled:opacity-50"
            >
              취소
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !reason.trim()}
              className="flex-1 py-3 bg-primary text-white rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  제출 중...
                </>
              ) : (
                '제출하기'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
