'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Calendar, Clock, FileText, Send, CheckCircle, UserMinus } from 'lucide-react';
import { BottomNav } from '@/components/bottom-nav';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type RequestType = 'LEAVE' | 'OVERTIME' | 'SCHEDULE_CHANGE' | 'RESIGNATION';

interface LeaveType {
  id: string;
  name: string;
  description: string;
}

interface UserInfo {
  id: string;
  name: string;
  role: string;
  company_id: string | null;
  brand_id: string | null;
  store_id: string | null;
}

const leaveTypes: LeaveType[] = [
  { id: 'ANNUAL', name: '연차', description: '연차휴가' },
  { id: 'SICK', name: '병가', description: '질병으로 인한 휴가' },
  { id: 'PERSONAL', name: '개인사유', description: '개인 사유 휴가' },
  { id: 'FAMILY', name: '가족돌봄', description: '가족 돌봄 휴가' },
  { id: 'BEREAVEMENT', name: '경조사', description: '경조사 휴가' },
];

export default function RequestPage() {
  const router = useRouter();
  const [requestType, setRequestType] = useState<RequestType>('LEAVE');
  const [showSuccess, setShowSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [remainingAnnualLeave, setRemainingAnnualLeave] = useState(0);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  // Leave request state
  const [leaveType, setLeaveType] = useState('ANNUAL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  // Overtime request state
  const [overtimeDate, setOvertimeDate] = useState('');
  const [overtimeHours, setOvertimeHours] = useState('');
  const [overtimeReason, setOvertimeReason] = useState('');

  // Schedule change state
  const [originalDate, setOriginalDate] = useState('');
  const [requestedDate, setRequestedDate] = useState('');
  const [changeReason, setChangeReason] = useState('');

  // Resignation state
  const [resignationDate, setResignationDate] = useState('');
  const [resignationReason, setResignationReason] = useState('');

  const supabase = createClient();

  const fetchUserInfo = useCallback(async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        router.push('/auth/login');
        return;
      }

      // Fetch user info including contract for leave days (query by auth_id, not id)
      const { data: userData } = await supabase
        .from('users')
        .select('id, name, role, company_id, brand_id, store_id')
        .eq('auth_id', authUser.id)
        .single();

      if (userData) {
        setUserInfo(userData);
      }

      // Fetch user's remaining annual leave from active contract (use userData.id as staff_id)
      if (!userData) return;

      const { data: contractData } = await supabase
        .from('contracts')
        .select('annual_leave_days')
        .eq('staff_id', userData.id)
        .eq('status', 'SIGNED')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (contractData?.annual_leave_days) {
        // Calculate used leave days from approved leave requests
        const currentYear = new Date().getFullYear();
        const { data: usedLeave } = await supabase
          .from('approval_requests')
          .select('details')
          .eq('requester_id', userData.id)
          .eq('type', 'LEAVE')
          .eq('final_status', 'APPROVED');

        let usedDays = 0;
        if (usedLeave) {
          usedLeave.forEach((req) => {
            const details = req.details as { leave_type?: string; start_date?: string; end_date?: string };
            if (details.leave_type === 'ANNUAL' && details.start_date) {
              const start = new Date(details.start_date);
              if (start.getFullYear() === currentYear) {
                const end = details.end_date ? new Date(details.end_date) : start;
                const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                usedDays += days;
              }
            }
          });
        }

        setRemainingAnnualLeave(contractData.annual_leave_days - usedDays);
      }
    } catch (error) {
      console.error('Error fetching user info:', error);
    }
  }, [supabase, router]);

  useEffect(() => {
    fetchUserInfo();
  }, [fetchUserInfo]);

  const handleSubmit = async () => {
    if (submitting || !userInfo) return;
    setSubmitting(true);

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      // Build details object based on request type
      let details: Record<string, unknown> = {};

      if (requestType === 'LEAVE') {
        details = {
          leave_type: leaveType,
          leave_type_name: leaveTypes.find(t => t.id === leaveType)?.name || leaveType,
          start_date: startDate,
          end_date: endDate,
          reason: reason,
        };
      } else if (requestType === 'OVERTIME') {
        details = {
          overtime_date: overtimeDate,
          overtime_hours: parseInt(overtimeHours),
          reason: overtimeReason,
        };
      } else if (requestType === 'SCHEDULE_CHANGE') {
        details = {
          original_date: originalDate,
          requested_date: requestedDate,
          reason: changeReason,
        };
      } else if (requestType === 'RESIGNATION') {
        details = {
          resignationDate: resignationDate,
          reason: resignationReason,
        };
      }

      // Create approval request with approval line (auto-approve for now, can be enhanced)
      const approvalLine = [{
        order: 1,
        approverId: null, // Will be set by admin
        approverRole: 'store_manager',
        status: 'PENDING',
      }];

      // Use userInfo.id (staff_id) not authUser.id (auth_id)
      const { error } = await supabase
        .from('approval_requests')
        .insert({
          type: requestType,
          requester_id: userInfo.id,
          requester_name: userInfo.name,
          requester_role: userInfo.role,
          company_id: userInfo.company_id,
          brand_id: userInfo.brand_id,
          store_id: userInfo.store_id,
          approval_line: approvalLine,
          current_step: 1,
          final_status: 'PENDING',
          details: details,
        });

      if (error) throw error;

      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        router.push('/home');
      }, 2000);
    } catch (error) {
      console.error('Error submitting request:', error);
      alert('신청 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const isFormValid = () => {
    switch (requestType) {
      case 'LEAVE':
        return startDate && endDate && reason;
      case 'OVERTIME':
        return overtimeDate && overtimeHours && overtimeReason;
      case 'SCHEDULE_CHANGE':
        return originalDate && requestedDate && changeReason;
      case 'RESIGNATION':
        return resignationDate && resignationReason;
      default:
        return false;
    }
  };

  if (showSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 text-center max-w-sm w-full shadow-lg">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">신청 완료</h2>
          <p className="text-gray-500">
            {requestType === 'LEAVE' && '휴가 신청이 완료되었습니다.'}
            {requestType === 'OVERTIME' && '초과근무 신청이 완료되었습니다.'}
            {requestType === 'SCHEDULE_CHANGE' && '근무조정 신청이 완료되었습니다.'}
            {requestType === 'RESIGNATION' && '사직서 제출이 완료되었습니다.'}
          </p>
          <p className="text-sm text-gray-400 mt-2">관리자 승인 후 확정됩니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 safe-top">
        <div className="flex items-center">
          <button onClick={() => router.back()} className="mr-3">
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">신청하기</h1>
        </div>
      </div>

      {/* Request Type Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="flex">
          <button
            onClick={() => setRequestType('LEAVE')}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              requestType === 'LEAVE' ? 'border-primary text-primary' : 'border-transparent text-gray-500'
            }`}
          >
            휴가 신청
          </button>
          <button
            onClick={() => setRequestType('OVERTIME')}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              requestType === 'OVERTIME' ? 'border-primary text-primary' : 'border-transparent text-gray-500'
            }`}
          >
            초과근무
          </button>
          <button
            onClick={() => setRequestType('SCHEDULE_CHANGE')}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              requestType === 'SCHEDULE_CHANGE' ? 'border-primary text-primary' : 'border-transparent text-gray-500'
            }`}
          >
            근무조정
          </button>
          <button
            onClick={() => setRequestType('RESIGNATION')}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              requestType === 'RESIGNATION' ? 'border-primary text-primary' : 'border-transparent text-gray-500'
            }`}
          >
            사직서
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Leave Request Form */}
        {requestType === 'LEAVE' && (
          <>
            {/* Remaining Leave Info */}
            <div className="bg-primary/10 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-primary/70">남은 연차</p>
                  <p className="text-2xl font-bold text-primary">{remainingAnnualLeave}일</p>
                </div>
                <Calendar className="w-10 h-10 text-primary/50" />
              </div>
            </div>

            {/* Leave Type */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <label className="block text-sm font-medium text-gray-700 mb-3">휴가 유형</label>
              <div className="grid grid-cols-3 gap-2">
                {leaveTypes.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setLeaveType(type.id)}
                    className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      leaveType === type.id ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {type.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Date Selection */}
            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">시작일</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">종료일</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Reason */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <label className="block text-sm font-medium text-gray-700 mb-2">사유</label>
              <div className="relative">
                <FileText className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="휴가 사유를 입력해주세요"
                  rows={3}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                />
              </div>
            </div>
          </>
        )}

        {/* Overtime Request Form */}
        {requestType === 'OVERTIME' && (
          <>
            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">초과근무일</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="date"
                    value={overtimeDate}
                    onChange={(e) => setOvertimeDate(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">초과근무 시간</label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <select
                    value={overtimeHours}
                    onChange={(e) => setOvertimeHours(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent appearance-none"
                  >
                    <option value="">시간 선택</option>
                    <option value="1">1시간</option>
                    <option value="2">2시간</option>
                    <option value="3">3시간</option>
                    <option value="4">4시간</option>
                    <option value="5">5시간 이상</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <label className="block text-sm font-medium text-gray-700 mb-2">사유</label>
              <div className="relative">
                <FileText className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                <textarea
                  value={overtimeReason}
                  onChange={(e) => setOvertimeReason(e.target.value)}
                  placeholder="초과근무 사유를 입력해주세요"
                  rows={3}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                />
              </div>
            </div>

            {/* Overtime Info */}
            <div className="bg-amber-50 rounded-2xl p-4">
              <p className="text-sm text-amber-700">
                <strong>참고:</strong> 초과근무는 사전 승인 후 진행되어야 합니다. 연장근로수당은 통상시급의 150%로
                지급됩니다.
              </p>
            </div>
          </>
        )}

        {/* Schedule Change Request Form */}
        {requestType === 'SCHEDULE_CHANGE' && (
          <>
            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">기존 근무일</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="date"
                    value={originalDate}
                    onChange={(e) => setOriginalDate(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">변경 희망일</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="date"
                    value={requestedDate}
                    onChange={(e) => setRequestedDate(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <label className="block text-sm font-medium text-gray-700 mb-2">변경 사유</label>
              <div className="relative">
                <FileText className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                <textarea
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                  placeholder="근무조정 사유를 입력해주세요"
                  rows={3}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                />
              </div>
            </div>

            {/* Schedule Change Info */}
            <div className="bg-blue-50 rounded-2xl p-4">
              <p className="text-sm text-blue-700">
                <strong>참고:</strong> 근무조정 신청은 최소 3일 전에 해주세요. 동료와 스케줄 교환이 필요한 경우 먼저
                협의 후 신청해주세요.
              </p>
            </div>
          </>
        )}

        {/* Resignation Request Form */}
        {requestType === 'RESIGNATION' && (
          <>
            <div className="bg-red-50 rounded-2xl p-4">
              <div className="flex items-center">
                <UserMinus className="w-10 h-10 text-red-400 mr-3" />
                <div>
                  <p className="text-sm text-red-600 font-medium">사직서 제출</p>
                  <p className="text-xs text-red-500">신중하게 결정해 주세요</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">퇴사 예정일</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="date"
                    value={resignationDate}
                    onChange={(e) => setResignationDate(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <label className="block text-sm font-medium text-gray-700 mb-2">퇴사 사유</label>
              <div className="relative">
                <FileText className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                <textarea
                  value={resignationReason}
                  onChange={(e) => setResignationReason(e.target.value)}
                  placeholder="퇴사 사유를 입력해주세요"
                  rows={4}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                />
              </div>
            </div>

            {/* Resignation Info */}
            <div className="bg-amber-50 rounded-2xl p-4">
              <p className="text-sm text-amber-700">
                <strong>참고:</strong> 사직서는 최소 1개월 전에 제출해주세요. 사직 승인 후에는 취소가 어려울 수 있습니다.
                퇴직금 및 정산에 대해서는 관리자에게 문의해주세요.
              </p>
            </div>
          </>
        )}

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={!isFormValid() || submitting}
          className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center transition-colors ${
            isFormValid() && !submitting ? 'bg-primary text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          <Send className="w-5 h-5 mr-2" />
          {submitting ? '처리 중...' : '신청하기'}
        </button>
      </div>

      <BottomNav />
    </div>
  );
}
