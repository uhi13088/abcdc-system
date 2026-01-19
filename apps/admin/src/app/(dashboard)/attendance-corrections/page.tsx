'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, Check, X, AlertCircle, ChevronRight } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';

interface CorrectionRequest {
  id: string;
  attendance_id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  request_type: string;
  original_check_in: string | null;
  original_check_out: string | null;
  original_status: string | null;
  requested_check_in: string | null;
  requested_check_out: string | null;
  requested_status: string | null;
  reason: string;
  calculated_work_hours: number | null;
  calculated_daily_total: number | null;
  created_at: string;
  requester: {
    id: string;
    name: string;
    email: string;
    position: string;
  };
  attendance: {
    id: string;
    work_date: string;
    status: string;
  };
}

export default function AttendanceCorrectionsPage() {
  const { accessToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<CorrectionRequest[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('PENDING');
  const [processing, setProcessing] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{ id: string; open: boolean; reason: string }>({
    id: '',
    open: false,
    reason: '',
  });

  const fetchRequests = useCallback(async () => {
    if (!accessToken) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/attendance-corrections?status=${statusFilter}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (response.ok) {
        const data = await response.json();
        setRequests(data.data || []);
        setPendingCount(data.pendingCount || 0);
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  }, [accessToken, statusFilter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
  };

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '-';
    return amount.toLocaleString('ko-KR') + '원';
  };

  const handleApprove = async (id: string) => {
    if (!accessToken || processing) return;

    setProcessing(id);
    try {
      const response = await fetch(`/api/attendance-corrections/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ action: 'approve' }),
      });

      if (response.ok) {
        await fetchRequests();
      } else {
        const result = await response.json();
        alert(result.error || '승인에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error approving:', error);
      alert('승인에 실패했습니다.');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async () => {
    if (!accessToken || processing || !rejectModal.id) return;

    setProcessing(rejectModal.id);
    try {
      const response = await fetch(`/api/attendance-corrections/${rejectModal.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          action: 'reject',
          rejection_reason: rejectModal.reason,
        }),
      });

      if (response.ok) {
        setRejectModal({ id: '', open: false, reason: '' });
        await fetchRequests();
      } else {
        const result = await response.json();
        alert(result.error || '거절에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error rejecting:', error);
      alert('거절에 실패했습니다.');
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">출퇴근 수정 요청</h1>
          <p className="text-gray-500 mt-1">직원들의 출퇴근 수정 요청을 확인하고 승인/거절합니다.</p>
        </div>
        {pendingCount > 0 && (
          <div className="flex items-center bg-yellow-100 text-yellow-800 px-4 py-2 rounded-lg">
            <AlertCircle className="w-5 h-5 mr-2" />
            <span className="font-medium">{pendingCount}건</span>의 대기 요청
          </div>
        )}
      </div>

      {/* Status Filter */}
      <div className="flex gap-2 mb-6">
        {[
          { value: 'PENDING', label: '대기 중' },
          { value: 'APPROVED', label: '승인됨' },
          { value: 'REJECTED', label: '거절됨' },
        ].map((option) => (
          <button
            key={option.value}
            onClick={() => setStatusFilter(option.value)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              statusFilter === option.value
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Requests List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">수정 요청이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <div key={request.id} className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <span className="text-primary font-bold">
                        {request.requester?.name?.charAt(0) || '?'}
                      </span>
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">{request.requester?.name || '알 수 없음'}</p>
                      <p className="text-sm text-gray-500">
                        {request.attendance?.work_date ? formatDate(request.attendance.work_date) : '-'} 출퇴근
                      </p>
                    </div>
                  </div>

                  {/* Time Changes */}
                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {request.requested_check_in && (
                        <div>
                          <p className="text-gray-500 mb-1">출근 시간 변경</p>
                          <p className="font-medium">
                            <span className="text-gray-400 line-through mr-2">
                              {formatTime(request.original_check_in)}
                            </span>
                            <ChevronRight className="w-4 h-4 inline text-gray-400" />
                            <span className="text-primary ml-2">
                              {formatTime(request.requested_check_in)}
                            </span>
                          </p>
                        </div>
                      )}
                      {request.requested_check_out && (
                        <div>
                          <p className="text-gray-500 mb-1">퇴근 시간 변경</p>
                          <p className="font-medium">
                            <span className="text-gray-400 line-through mr-2">
                              {formatTime(request.original_check_out)}
                            </span>
                            <ChevronRight className="w-4 h-4 inline text-gray-400" />
                            <span className="text-primary ml-2">
                              {formatTime(request.requested_check_out)}
                            </span>
                          </p>
                        </div>
                      )}
                    </div>

                    {request.calculated_work_hours !== null && (
                      <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between text-sm">
                        <span className="text-gray-500">예상 근무시간</span>
                        <span className="font-medium">{request.calculated_work_hours}시간</span>
                      </div>
                    )}
                    {request.calculated_daily_total !== null && (
                      <div className="flex justify-between text-sm mt-1">
                        <span className="text-gray-500">예상 일당</span>
                        <span className="font-bold text-primary">{formatCurrency(request.calculated_daily_total)}</span>
                      </div>
                    )}
                  </div>

                  {/* Reason */}
                  <div className="mb-4">
                    <p className="text-sm text-gray-500 mb-1">수정 사유</p>
                    <p className="text-gray-900">{request.reason}</p>
                  </div>

                  {/* Request Date */}
                  <p className="text-xs text-gray-400">
                    요청일: {new Date(request.created_at).toLocaleString('ko-KR')}
                  </p>
                </div>

                {/* Actions */}
                {request.status === 'PENDING' && (
                  <div className="flex flex-col gap-2 ml-4">
                    <button
                      onClick={() => handleApprove(request.id)}
                      disabled={processing === request.id}
                      className="flex items-center justify-center px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
                    >
                      {processing === request.id ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      ) : (
                        <>
                          <Check className="w-4 h-4 mr-1" />
                          승인
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setRejectModal({ id: request.id, open: true, reason: '' })}
                      disabled={processing === request.id}
                      className="flex items-center justify-center px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
                    >
                      <X className="w-4 h-4 mr-1" />
                      거절
                    </button>
                  </div>
                )}

                {request.status === 'APPROVED' && (
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                    승인됨
                  </span>
                )}

                {request.status === 'REJECTED' && (
                  <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                    거절됨
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-4">수정 요청 거절</h3>
            <p className="text-gray-500 text-sm mb-4">거절 사유를 입력해주세요 (선택사항)</p>
            <textarea
              value={rejectModal.reason}
              onChange={(e) => setRejectModal(prev => ({ ...prev, reason: e.target.value }))}
              placeholder="거절 사유를 입력해주세요..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none h-24 mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setRejectModal({ id: '', open: false, reason: '' })}
                className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium"
              >
                취소
              </button>
              <button
                onClick={handleReject}
                disabled={processing === rejectModal.id}
                className="flex-1 py-2 bg-red-500 text-white rounded-lg font-medium disabled:opacity-50"
              >
                {processing === rejectModal.id ? '처리 중...' : '거절하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
