'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Check, X, AlertTriangle, Calendar, FileText, Settings,
  ChevronDown, ChevronRight, Send, CheckCircle, XCircle, Clock,
  ClipboardCheck, Shield, Thermometer, Scale, Timer, Search, Eye
} from 'lucide-react';
import Link from 'next/link';

// Types
interface ProcessType {
  id: string;
  code: string;
  name: string;
  description?: string;
  parameters?: Array<{ key: string; label: string; unit: string }>;
  is_active: boolean;
}

interface VerificationQuestion {
  id: string;
  process_type_id?: string;
  question_code: string;
  question_text: string;
  question_category: string;
  help_text?: string;
  is_required: boolean;
  equipment_type?: string;
}

interface VerificationResponse {
  id?: string;
  question_id?: string;
  common_question_id?: string;
  is_compliant: boolean | null;
  non_compliance_reason?: string;
  corrective_action?: string;
  evidence_notes?: string;
  question?: VerificationQuestion;
  common_question?: VerificationQuestion;
  checker?: { id: string; name: string };
}

interface CCPVerification {
  id: string;
  process_type_id?: string;
  ccp_id?: string;
  verification_year: number;
  verification_month: number;
  records_reviewed: number;
  deviations_found: number;
  corrective_actions_taken: number;
  effectiveness_rating: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
  findings?: string;
  recommendations?: string;
  special_notes?: string;
  action_taken?: string;
  equipment_calibration_verified: boolean;
  overall_compliance_status: 'PENDING' | 'COMPLIANT' | 'PARTIAL' | 'NON_COMPLIANT';
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  rejection_reason?: string;
  verified_by?: string;
  verified_at?: string;
  submitted_at?: string;
  approved_by?: string;
  approved_at?: string;
  process_type?: ProcessType;
  verifier?: { name: string };
  approver?: { name: string };
  responses?: VerificationResponse[];
}

interface CalibrationSummary {
  total: number;
  expired: number;
  expiringSoon: number;
  valid: number;
}

const MONTHS = [
  '1월', '2월', '3월', '4월', '5월', '6월',
  '7월', '8월', '9월', '10월', '11월', '12월'
];

const STATUS_CONFIG = {
  DRAFT: { label: '작성중', color: 'bg-gray-100 text-gray-700', icon: Clock },
  SUBMITTED: { label: '제출됨', color: 'bg-blue-100 text-blue-700', icon: Send },
  APPROVED: { label: '승인완료', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  REJECTED: { label: '반려', color: 'bg-red-100 text-red-700', icon: XCircle },
};

const COMPLIANCE_CONFIG = {
  PENDING: { label: '대기', color: 'bg-gray-100 text-gray-700' },
  COMPLIANT: { label: '적합', color: 'bg-green-100 text-green-700' },
  PARTIAL: { label: '부분적합', color: 'bg-yellow-100 text-yellow-700' },
  NON_COMPLIANT: { label: '부적합', color: 'bg-red-100 text-red-700' },
};

const EQUIPMENT_ICONS: Record<string, typeof Thermometer> = {
  THERMOMETER: Thermometer,
  SCALE: Scale,
  TIMER: Timer,
  WASH_TANK: Shield,
  METAL_DETECTOR: Search,
};

export default function CCPVerificationPage() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [processTypes, setProcessTypes] = useState<ProcessType[]>([]);
  const [verifications, setVerifications] = useState<CCPVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [calibrationSummary, setCalibrationSummary] = useState<CalibrationSummary | null>(null);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedVerification, setSelectedVerification] = useState<CCPVerification | null>(null);

  // Form states
  const [selectedProcessType, setSelectedProcessType] = useState<string>('');
  const [processQuestions, setProcessQuestions] = useState<VerificationQuestion[]>([]);
  const [commonQuestions, setCommonQuestions] = useState<VerificationQuestion[]>([]);
  const [responses, setResponses] = useState<Record<string, { is_compliant: boolean | null; reason?: string; action?: string }>>({});
  const [expandedProcesses, setExpandedProcesses] = useState<Set<string>>(new Set());

  const [formData, setFormData] = useState<{
    verification_year: number;
    verification_month: number;
    records_reviewed: number;
    deviations_found: number;
    corrective_actions_taken: number;
    effectiveness_rating: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
    findings: string;
    recommendations: string;
    special_notes: string;
    action_taken: string;
    equipment_calibration_verified: boolean;
  }>({
    verification_year: currentYear,
    verification_month: currentMonth,
    records_reviewed: 0,
    deviations_found: 0,
    corrective_actions_taken: 0,
    effectiveness_rating: 'GOOD',
    findings: '',
    recommendations: '',
    special_notes: '',
    action_taken: '',
    equipment_calibration_verified: false,
  });

  const [submitting, setSubmitting] = useState(false);

  // Fetch process types
  const fetchProcessTypes = useCallback(async () => {
    try {
      const response = await fetch('/api/haccp/ccp/process-types');
      if (response.ok) {
        const data = await response.json();
        setProcessTypes(data.filter((p: ProcessType) => p.is_active));
      }
    } catch (error) {
      console.error('Failed to fetch process types:', error);
    }
  }, []);

  // Fetch verifications
  const fetchVerifications = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        year: selectedYear.toString(),
        month: selectedMonth.toString(),
      });
      if (selectedStatus) {
        params.append('status', selectedStatus);
      }

      const response = await fetch(`/api/haccp/ccp/verification?${params}`);
      if (response.ok) {
        const data = await response.json();
        setVerifications(data);
      }
    } catch (error) {
      console.error('Failed to fetch verifications:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMonth, selectedStatus]);

  // Fetch calibration summary
  const fetchCalibrationSummary = useCallback(async () => {
    try {
      const response = await fetch('/api/haccp/equipment-calibration');
      if (response.ok) {
        const data = await response.json();
        setCalibrationSummary(data.summary);
      }
    } catch (error) {
      console.error('Failed to fetch calibration summary:', error);
    }
  }, []);

  // Fetch questions for selected process type
  const fetchQuestions = useCallback(async (processTypeId: string) => {
    try {
      const params = new URLSearchParams({
        process_type_id: processTypeId,
        include_common: 'true',
      });
      const response = await fetch(`/api/haccp/ccp/verification-questions?${params}`);
      if (response.ok) {
        const data = await response.json();
        setProcessQuestions(data.questions || []);
        setCommonQuestions(data.commonQuestions || []);

        // Initialize responses
        const initialResponses: Record<string, { is_compliant: boolean | null; reason?: string; action?: string }> = {};
        data.questions?.forEach((q: VerificationQuestion) => {
          initialResponses[`q_${q.id}`] = { is_compliant: null };
        });
        data.commonQuestions?.forEach((q: VerificationQuestion) => {
          initialResponses[`cq_${q.id}`] = { is_compliant: null };
        });
        setResponses(initialResponses);
      }
    } catch (error) {
      console.error('Failed to fetch questions:', error);
    }
  }, []);

  // Fetch verification detail
  const fetchVerificationDetail = async (id: string) => {
    try {
      const response = await fetch(`/api/haccp/ccp/verification?id=${id}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedVerification(data);
        setShowDetailModal(true);
      }
    } catch (error) {
      console.error('Failed to fetch verification detail:', error);
    }
  };

  useEffect(() => {
    fetchProcessTypes();
    fetchCalibrationSummary();
  }, [fetchProcessTypes, fetchCalibrationSummary]);

  useEffect(() => {
    fetchVerifications();
  }, [fetchVerifications]);

  useEffect(() => {
    if (selectedProcessType) {
      fetchQuestions(selectedProcessType);
    } else {
      setProcessQuestions([]);
      setCommonQuestions([]);
      setResponses({});
    }
  }, [selectedProcessType, fetchQuestions]);

  // Handle response change
  const handleResponseChange = (questionId: string, isCompliant: boolean | null, reason?: string, action?: string) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: { is_compliant: isCompliant, reason, action },
    }));
  };

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProcessType) {
      alert('공정 유형을 선택하세요.');
      return;
    }

    setSubmitting(true);
    try {
      // Build responses array
      const responseArray: Array<{
        question_id?: string;
        common_question_id?: string;
        is_compliant: boolean | null;
        non_compliance_reason?: string;
        corrective_action?: string;
      }> = [];

      Object.entries(responses).forEach(([key, value]) => {
        if (key.startsWith('q_')) {
          responseArray.push({
            question_id: key.replace('q_', ''),
            is_compliant: value.is_compliant,
            non_compliance_reason: value.reason,
            corrective_action: value.action,
          });
        } else if (key.startsWith('cq_')) {
          responseArray.push({
            common_question_id: key.replace('cq_', ''),
            is_compliant: value.is_compliant,
            non_compliance_reason: value.reason,
            corrective_action: value.action,
          });
        }
      });

      const response = await fetch('/api/haccp/ccp/verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          process_type_id: selectedProcessType,
          ...formData,
          responses: responseArray,
        }),
      });

      if (response.ok) {
        setShowModal(false);
        fetchVerifications();
        resetForm();
      } else {
        const error = await response.json();
        alert(error.message || '저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to create verification:', error);
      alert('저장에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle verification action (submit, approve, reject)
  const handleAction = async (id: string, action: 'submit' | 'approve' | 'reject', reason?: string) => {
    try {
      const response = await fetch('/api/haccp/ccp/verification', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, rejection_reason: reason }),
      });

      if (response.ok) {
        fetchVerifications();
        if (selectedVerification?.id === id) {
          fetchVerificationDetail(id);
        }
      }
    } catch (error) {
      console.error(`Failed to ${action} verification:`, error);
    }
  };

  const resetForm = () => {
    setSelectedProcessType('');
    setProcessQuestions([]);
    setCommonQuestions([]);
    setResponses({});
    setFormData({
      verification_year: currentYear,
      verification_month: currentMonth,
      records_reviewed: 0,
      deviations_found: 0,
      corrective_actions_taken: 0,
      effectiveness_rating: 'GOOD',
      findings: '',
      recommendations: '',
      special_notes: '',
      action_taken: '',
      equipment_calibration_verified: false,
    });
  };

  const toggleProcess = (processId: string) => {
    setExpandedProcesses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(processId)) {
        newSet.delete(processId);
      } else {
        newSet.add(processId);
      }
      return newSet;
    });
  };

  // Calculate summary
  const completedCount = verifications.filter(v => v.status === 'APPROVED').length;
  const pendingCount = verifications.filter(v => v.status === 'SUBMITTED').length;
  const draftCount = verifications.filter(v => v.status === 'DRAFT').length;
  const compliantCount = verifications.filter(v => v.overall_compliance_status === 'COMPLIANT').length;

  // Group verifications by process type
  const verificationsByProcess = verifications.reduce((acc, v) => {
    const key = v.process_type_id || 'unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(v);
    return acc;
  }, {} as Record<string, CCPVerification[]>);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href="/ccp" className="hover:text-primary">CCP 관리</Link>
            <span>/</span>
            <span>월간 검증점검표</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">CCP 월간 검증점검표</h1>
          <p className="mt-1 text-sm text-gray-500">공정별 CCP 관리 현황을 월간 단위로 검증합니다</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/ccp/verification/settings"
            className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            <Settings className="w-4 h-4" />
            설정
          </Link>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            검증 작성
          </button>
        </div>
      </div>

      {/* Period & Filter Selector */}
      <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">검증 기간:</span>
          </div>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            {[currentYear - 2, currentYear - 1, currentYear].map(year => (
              <option key={year} value={year}>{year}년</option>
            ))}
          </select>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            {MONTHS.map((month, index) => (
              <option key={index} value={index + 1}>{month}</option>
            ))}
          </select>
          <div className="w-px h-6 bg-gray-200 mx-2" />
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">상태:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm"
            >
              <option value="">전체</option>
              <option value="DRAFT">작성중</option>
              <option value="SUBMITTED">제출됨</option>
              <option value="APPROVED">승인완료</option>
              <option value="REJECTED">반려</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">전체 검증</p>
              <p className="text-xl font-bold text-gray-900">{verifications.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">승인 완료</p>
              <p className="text-xl font-bold text-green-600">{completedCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">대기중</p>
              <p className="text-xl font-bold text-yellow-600">{pendingCount + draftCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">적합 판정</p>
              <p className="text-xl font-bold text-emerald-600">{compliantCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              calibrationSummary && (calibrationSummary.expired > 0 || calibrationSummary.expiringSoon > 0)
                ? 'bg-orange-100' : 'bg-green-100'
            }`}>
              <Shield className={`w-5 h-5 ${
                calibrationSummary && (calibrationSummary.expired > 0 || calibrationSummary.expiringSoon > 0)
                  ? 'text-orange-600' : 'text-green-600'
              }`} />
            </div>
            <div>
              <p className="text-xs text-gray-500">장비 검교정</p>
              {calibrationSummary ? (
                <p className="text-sm font-bold">
                  {calibrationSummary.expired > 0 && (
                    <span className="text-red-600">{calibrationSummary.expired}개 만료 </span>
                  )}
                  {calibrationSummary.expiringSoon > 0 && (
                    <span className="text-orange-600">{calibrationSummary.expiringSoon}개 임박</span>
                  )}
                  {calibrationSummary.expired === 0 && calibrationSummary.expiringSoon === 0 && (
                    <span className="text-green-600">정상</span>
                  )}
                </p>
              ) : (
                <p className="text-sm text-gray-400">로딩중...</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Verifications List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : verifications.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">{selectedYear}년 {selectedMonth}월 검증 기록이 없습니다</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 text-blue-600 hover:underline"
          >
            검증 작성하기
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Group by process type */}
          {processTypes.map(processType => {
            const processVerifications = verificationsByProcess[processType.id] || [];
            if (processVerifications.length === 0 && selectedStatus) return null;

            const isExpanded = expandedProcesses.has(processType.id);

            return (
              <div key={processType.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <button
                  onClick={() => toggleProcess(processType.id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                    <div className="text-left">
                      <h3 className="font-bold text-gray-900">{processType.name}</h3>
                      <p className="text-sm text-gray-500">{processType.code}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {processVerifications.length > 0 ? (
                      <>
                        <span className="text-sm text-gray-500">{processVerifications.length}건</span>
                        {processVerifications.some(v => v.status === 'APPROVED') && (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                            승인완료
                          </span>
                        )}
                        {processVerifications.some(v => v.status === 'SUBMITTED') && (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                            검토중
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-500">
                        미작성
                      </span>
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t">
                    {processVerifications.length === 0 ? (
                      <div className="p-8 text-center text-gray-500">
                        <p>이 공정의 검증 기록이 없습니다.</p>
                        <button
                          onClick={() => {
                            setSelectedProcessType(processType.id);
                            setShowModal(true);
                          }}
                          className="mt-2 text-blue-600 hover:underline"
                        >
                          검증 작성하기
                        </button>
                      </div>
                    ) : (
                      <div className="divide-y">
                        {processVerifications.map(verification => {
                          const StatusIcon = STATUS_CONFIG[verification.status].icon;
                          return (
                            <div key={verification.id} className="p-4 hover:bg-gray-50">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-2">
                                    <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${STATUS_CONFIG[verification.status].color}`}>
                                      <StatusIcon className="w-3 h-3" />
                                      {STATUS_CONFIG[verification.status].label}
                                    </span>
                                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${COMPLIANCE_CONFIG[verification.overall_compliance_status].color}`}>
                                      {COMPLIANCE_CONFIG[verification.overall_compliance_status].label}
                                    </span>
                                    {verification.equipment_calibration_verified && (
                                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-700">
                                        검교정 확인
                                      </span>
                                    )}
                                  </div>

                                  <div className="grid grid-cols-4 gap-4 text-sm mb-2">
                                    <div>
                                      <span className="text-gray-500">검토 기록:</span>
                                      <span className="ml-1 font-medium">{verification.records_reviewed}건</span>
                                    </div>
                                    <div>
                                      <span className="text-gray-500">이탈:</span>
                                      <span className={`ml-1 font-medium ${verification.deviations_found > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        {verification.deviations_found}건
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-gray-500">개선조치:</span>
                                      <span className="ml-1 font-medium">{verification.corrective_actions_taken}건</span>
                                    </div>
                                    <div>
                                      <span className="text-gray-500">검증자:</span>
                                      <span className="ml-1 font-medium">{verification.verifier?.name || '-'}</span>
                                    </div>
                                  </div>

                                  {verification.special_notes && (
                                    <div className="text-sm bg-yellow-50 rounded p-2 mb-2">
                                      <span className="font-medium text-yellow-700">특이사항:</span>
                                      <span className="ml-1 text-gray-700">{verification.special_notes}</span>
                                    </div>
                                  )}

                                  {verification.rejection_reason && verification.status === 'REJECTED' && (
                                    <div className="text-sm bg-red-50 rounded p-2 mb-2">
                                      <span className="font-medium text-red-700">반려사유:</span>
                                      <span className="ml-1 text-gray-700">{verification.rejection_reason}</span>
                                    </div>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 ml-4">
                                  <button
                                    onClick={() => fetchVerificationDetail(verification.id)}
                                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                                    title="상세보기"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>

                                  {verification.status === 'DRAFT' && (
                                    <button
                                      onClick={() => handleAction(verification.id, 'submit')}
                                      className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                    >
                                      제출
                                    </button>
                                  )}

                                  {verification.status === 'SUBMITTED' && (
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => handleAction(verification.id, 'approve')}
                                        className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                                      >
                                        승인
                                      </button>
                                      <button
                                        onClick={() => {
                                          const reason = prompt('반려 사유를 입력하세요:');
                                          if (reason) {
                                            handleAction(verification.id, 'reject', reason);
                                          }
                                        }}
                                        className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
                                      >
                                        반려
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Verification Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold">CCP 월간 검증점검표 작성</h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
              {/* Basic Info */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">공정 유형 *</label>
                  <select
                    value={selectedProcessType}
                    onChange={(e) => setSelectedProcessType(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  >
                    <option value="">공정을 선택하세요</option>
                    {processTypes.map(pt => (
                      <option key={pt.id} value={pt.id}>{pt.name} ({pt.code})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">검증 연도</label>
                  <select
                    value={formData.verification_year}
                    onChange={(e) => setFormData({ ...formData, verification_year: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    {[currentYear - 1, currentYear].map(year => (
                      <option key={year} value={year}>{year}년</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">검증 월</label>
                  <select
                    value={formData.verification_month}
                    onChange={(e) => setFormData({ ...formData, verification_month: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    {MONTHS.map((month, index) => (
                      <option key={index} value={index + 1}>{month}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Process-specific Questions */}
              {selectedProcessType && processQuestions.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <ClipboardCheck className="w-5 h-5 text-blue-600" />
                    공정별 검증 항목
                  </h3>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 w-2/5">검증 항목</th>
                          <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 w-20">예</th>
                          <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 w-20">아니오</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">부적합 사유 / 조치</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {processQuestions.map((question, idx) => {
                          const responseKey = `q_${question.id}`;
                          const response = responses[responseKey] || { is_compliant: null };
                          return (
                            <tr key={question.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="px-4 py-3">
                                <div className="text-sm font-medium text-gray-900">{question.question_text}</div>
                                {question.help_text && (
                                  <div className="text-xs text-gray-500 mt-1">{question.help_text}</div>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleResponseChange(responseKey, true)}
                                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                                    response.is_compliant === true
                                      ? 'bg-green-600 text-white'
                                      : 'bg-gray-200 text-gray-500 hover:bg-green-100'
                                  }`}
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleResponseChange(responseKey, false)}
                                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                                    response.is_compliant === false
                                      ? 'bg-red-600 text-white'
                                      : 'bg-gray-200 text-gray-500 hover:bg-red-100'
                                  }`}
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </td>
                              <td className="px-4 py-3">
                                {response.is_compliant === false && (
                                  <div className="space-y-2">
                                    <input
                                      type="text"
                                      placeholder="부적합 사유"
                                      value={response.reason || ''}
                                      onChange={(e) => handleResponseChange(responseKey, false, e.target.value, response.action)}
                                      className="w-full px-2 py-1 text-sm border rounded"
                                    />
                                    <input
                                      type="text"
                                      placeholder="개선 조치"
                                      value={response.action || ''}
                                      onChange={(e) => handleResponseChange(responseKey, false, response.reason, e.target.value)}
                                      className="w-full px-2 py-1 text-sm border rounded"
                                    />
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Common Questions (Equipment Calibration) */}
              {commonQuestions.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-purple-600" />
                    공통 검증 항목 (장비 검교정)
                  </h3>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-purple-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 w-2/5">검증 항목</th>
                          <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 w-20">예</th>
                          <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 w-20">아니오</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">비고</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {commonQuestions.map((question, idx) => {
                          const responseKey = `cq_${question.id}`;
                          const response = responses[responseKey] || { is_compliant: null };
                          const EquipIcon = EQUIPMENT_ICONS[question.equipment_type || ''] || Shield;
                          return (
                            <tr key={question.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-purple-50/50'}>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <EquipIcon className="w-4 h-4 text-purple-500" />
                                  <span className="text-sm font-medium text-gray-900">{question.question_text}</span>
                                </div>
                                {question.help_text && (
                                  <div className="text-xs text-gray-500 mt-1 ml-6">{question.help_text}</div>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleResponseChange(responseKey, true)}
                                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                                    response.is_compliant === true
                                      ? 'bg-green-600 text-white'
                                      : 'bg-gray-200 text-gray-500 hover:bg-green-100'
                                  }`}
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleResponseChange(responseKey, false)}
                                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                                    response.is_compliant === false
                                      ? 'bg-red-600 text-white'
                                      : 'bg-gray-200 text-gray-500 hover:bg-red-100'
                                  }`}
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </td>
                              <td className="px-4 py-3">
                                {response.is_compliant === false && (
                                  <input
                                    type="text"
                                    placeholder="미검교정 사유 및 계획"
                                    value={response.reason || ''}
                                    onChange={(e) => handleResponseChange(responseKey, false, e.target.value)}
                                    className="w-full px-2 py-1 text-sm border rounded"
                                  />
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="equipment_calibration_verified"
                      checked={formData.equipment_calibration_verified}
                      onChange={(e) => setFormData({ ...formData, equipment_calibration_verified: e.target.checked })}
                      className="w-4 h-4 text-purple-600 rounded"
                    />
                    <label htmlFor="equipment_calibration_verified" className="text-sm text-gray-700">
                      모든 장비 검교정 현황을 확인하였습니다
                    </label>
                  </div>
                </div>
              )}

              {/* Summary Statistics */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">검토 기록 수</label>
                  <input
                    type="number"
                    value={formData.records_reviewed}
                    onChange={(e) => setFormData({ ...formData, records_reviewed: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">발견 이탈</label>
                  <input
                    type="number"
                    value={formData.deviations_found}
                    onChange={(e) => setFormData({ ...formData, deviations_found: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">개선 조치</label>
                  <input
                    type="number"
                    value={formData.corrective_actions_taken}
                    onChange={(e) => setFormData({ ...formData, corrective_actions_taken: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg"
                    min="0"
                  />
                </div>
              </div>

              {/* Special Notes & Action Taken */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">특이사항</label>
                  <textarea
                    value={formData.special_notes}
                    onChange={(e) => setFormData({ ...formData, special_notes: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    rows={3}
                    placeholder="특이사항을 기록하세요"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">조치내용</label>
                  <textarea
                    value={formData.action_taken}
                    onChange={(e) => setFormData({ ...formData, action_taken: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    rows={3}
                    placeholder="조치내용을 기록하세요"
                  />
                </div>
              </div>

              {/* Findings & Recommendations */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">검증 결과</label>
                  <textarea
                    value={formData.findings}
                    onChange={(e) => setFormData({ ...formData, findings: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    rows={3}
                    placeholder="검증 결과 및 주요 발견 사항"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">권고사항</label>
                  <textarea
                    value={formData.recommendations}
                    onChange={(e) => setFormData({ ...formData, recommendations: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    rows={3}
                    placeholder="개선 권고사항"
                  />
                </div>
              </div>

              {/* Effectiveness Rating */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">효과성 평가</label>
                <div className="flex gap-3">
                  {(['EXCELLENT', 'GOOD', 'FAIR', 'POOR'] as const).map(rating => (
                    <button
                      key={rating}
                      type="button"
                      onClick={() => setFormData({ ...formData, effectiveness_rating: rating })}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        formData.effectiveness_rating === rating
                          ? rating === 'EXCELLENT' ? 'bg-green-600 text-white'
                            : rating === 'GOOD' ? 'bg-blue-600 text-white'
                            : rating === 'FAIR' ? 'bg-yellow-500 text-white'
                            : 'bg-red-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {rating === 'EXCELLENT' ? '우수' : rating === 'GOOD' ? '양호' : rating === 'FAIR' ? '보통' : '미흡'}
                    </button>
                  ))}
                </div>
              </div>
            </form>

            {/* Footer */}
            <div className="flex gap-3 p-6 border-t bg-gray-50">
              <button
                type="button"
                onClick={() => { setShowModal(false); resetForm(); }}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-100"
              >
                취소
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !selectedProcessType}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedVerification && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-xl font-bold">검증 상세</h2>
                <p className="text-sm text-gray-500">
                  {selectedVerification.process_type?.name} - {selectedVerification.verification_year}년 {selectedVerification.verification_month}월
                </p>
              </div>
              <button onClick={() => { setShowDetailModal(false); setSelectedVerification(null); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {/* Status */}
              <div className="flex items-center gap-3 mb-6">
                <span className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-full ${STATUS_CONFIG[selectedVerification.status].color}`}>
                  {(() => { const Icon = STATUS_CONFIG[selectedVerification.status].icon; return <Icon className="w-4 h-4" />; })()}
                  {STATUS_CONFIG[selectedVerification.status].label}
                </span>
                <span className={`px-3 py-1.5 text-sm font-medium rounded-full ${COMPLIANCE_CONFIG[selectedVerification.overall_compliance_status].color}`}>
                  {COMPLIANCE_CONFIG[selectedVerification.overall_compliance_status].label}
                </span>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">검토 기록 수</p>
                  <p className="text-xl font-bold text-gray-900">{selectedVerification.records_reviewed}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">발견 이탈</p>
                  <p className={`text-xl font-bold ${selectedVerification.deviations_found > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {selectedVerification.deviations_found}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">개선 조치</p>
                  <p className="text-xl font-bold text-gray-900">{selectedVerification.corrective_actions_taken}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">효과성</p>
                  <p className="text-xl font-bold text-gray-900">
                    {selectedVerification.effectiveness_rating === 'EXCELLENT' ? '우수'
                      : selectedVerification.effectiveness_rating === 'GOOD' ? '양호'
                      : selectedVerification.effectiveness_rating === 'FAIR' ? '보통' : '미흡'}
                  </p>
                </div>
              </div>

              {/* Checklist Responses */}
              {selectedVerification.responses && selectedVerification.responses.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-3">검증 체크리스트 응답</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">항목</th>
                          <th className="px-4 py-2 text-center text-sm font-medium text-gray-700 w-24">결과</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">비고</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {selectedVerification.responses.map((response, idx) => {
                          const question = response.question || response.common_question;
                          return (
                            <tr key={response.id || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="px-4 py-2 text-sm">{question?.question_text || '-'}</td>
                              <td className="px-4 py-2 text-center">
                                {response.is_compliant === true && (
                                  <span className="inline-flex items-center justify-center w-6 h-6 bg-green-100 text-green-600 rounded-full">
                                    <Check className="w-4 h-4" />
                                  </span>
                                )}
                                {response.is_compliant === false && (
                                  <span className="inline-flex items-center justify-center w-6 h-6 bg-red-100 text-red-600 rounded-full">
                                    <X className="w-4 h-4" />
                                  </span>
                                )}
                                {response.is_compliant === null && (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-600">
                                {response.non_compliance_reason && (
                                  <div><span className="text-red-600">사유:</span> {response.non_compliance_reason}</div>
                                )}
                                {response.corrective_action && (
                                  <div><span className="text-blue-600">조치:</span> {response.corrective_action}</div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Special Notes & Action Taken */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                {selectedVerification.special_notes && (
                  <div className="bg-yellow-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-yellow-700 mb-2">특이사항</h4>
                    <p className="text-sm text-gray-700">{selectedVerification.special_notes}</p>
                  </div>
                )}
                {selectedVerification.action_taken && (
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-blue-700 mb-2">조치내용</h4>
                    <p className="text-sm text-gray-700">{selectedVerification.action_taken}</p>
                  </div>
                )}
              </div>

              {/* Findings & Recommendations */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                {selectedVerification.findings && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">검증 결과</h4>
                    <p className="text-sm text-gray-700">{selectedVerification.findings}</p>
                  </div>
                )}
                {selectedVerification.recommendations && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">권고사항</h4>
                    <p className="text-sm text-gray-700">{selectedVerification.recommendations}</p>
                  </div>
                )}
              </div>

              {/* Rejection Reason */}
              {selectedVerification.status === 'REJECTED' && selectedVerification.rejection_reason && (
                <div className="bg-red-50 rounded-lg p-4 mb-6">
                  <h4 className="text-sm font-medium text-red-700 mb-2">반려 사유</h4>
                  <p className="text-sm text-gray-700">{selectedVerification.rejection_reason}</p>
                </div>
              )}

              {/* Metadata */}
              <div className="border-t pt-4 text-sm text-gray-500">
                <div className="flex items-center gap-6">
                  <span>검증자: {selectedVerification.verifier?.name || '-'}</span>
                  {selectedVerification.verified_at && (
                    <span>검증일: {new Date(selectedVerification.verified_at).toLocaleDateString('ko-KR')}</span>
                  )}
                  {selectedVerification.approver?.name && (
                    <span>승인자: {selectedVerification.approver.name}</span>
                  )}
                  {selectedVerification.approved_at && (
                    <span>승인일: {new Date(selectedVerification.approved_at).toLocaleDateString('ko-KR')}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
              {selectedVerification.status === 'DRAFT' && (
                <button
                  onClick={() => handleAction(selectedVerification.id, 'submit')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  제출
                </button>
              )}
              {selectedVerification.status === 'SUBMITTED' && (
                <>
                  <button
                    onClick={() => {
                      const reason = prompt('반려 사유를 입력하세요:');
                      if (reason) {
                        handleAction(selectedVerification.id, 'reject', reason);
                      }
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    반려
                  </button>
                  <button
                    onClick={() => handleAction(selectedVerification.id, 'approve')}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    승인
                  </button>
                </>
              )}
              <button
                onClick={() => { setShowDetailModal(false); setSelectedVerification(null); }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-100"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
