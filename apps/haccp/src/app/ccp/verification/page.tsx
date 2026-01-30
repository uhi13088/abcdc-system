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
  process_type?: ProcessType;
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

interface AllQuestionsData {
  processTypes: ProcessType[];
  questionsByProcess: Record<string, VerificationQuestion[]>;
  commonQuestions: VerificationQuestion[];
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

const PROCESS_ORDER = ['HEATING_OVEN', 'CREAM_WHIPPING', 'SYRUP_HEATING', 'WASHING', 'METAL_DETECTION'];

export default function CCPVerificationPage() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [processTypes, setProcessTypes] = useState<ProcessType[]>([]);
  const [verifications, setVerifications] = useState<CCPVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedStatus, setSelectedStatus] = useState<string>('');

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedVerification, setSelectedVerification] = useState<CCPVerification | null>(null);

  // Form states for unified checklist
  const [allQuestionsData, setAllQuestionsData] = useState<AllQuestionsData | null>(null);
  const [responses, setResponses] = useState<Record<string, { is_compliant: boolean | null; reason?: string; action?: string }>>({});
  const [expandedProcesses, setExpandedProcesses] = useState<Set<string>>(new Set());

  const [formData, setFormData] = useState<{
    verification_year: number;
    verification_month: number;
    special_notes: string;
    action_taken: string;
  }>({
    verification_year: currentYear,
    verification_month: currentMonth,
    special_notes: '',
    action_taken: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [loadingQuestions, setLoadingQuestions] = useState(false);

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

  // Fetch ALL questions for all process types (for unified checklist)
  const fetchAllQuestions = useCallback(async () => {
    setLoadingQuestions(true);
    try {
      // Fetch process types first
      const ptResponse = await fetch('/api/haccp/ccp/process-types');
      if (!ptResponse.ok) return;
      const allProcessTypes: ProcessType[] = await ptResponse.json();
      const activeProcessTypes = allProcessTypes.filter(p => p.is_active);

      // Sort by predefined order
      activeProcessTypes.sort((a, b) => {
        const aIdx = PROCESS_ORDER.indexOf(a.code);
        const bIdx = PROCESS_ORDER.indexOf(b.code);
        if (aIdx === -1 && bIdx === -1) return 0;
        if (aIdx === -1) return 1;
        if (bIdx === -1) return -1;
        return aIdx - bIdx;
      });

      // Fetch questions for each process type
      const questionsByProcess: Record<string, VerificationQuestion[]> = {};
      for (const pt of activeProcessTypes) {
        const qResponse = await fetch(`/api/haccp/ccp/verification-questions?process_type_id=${pt.id}`);
        if (qResponse.ok) {
          const qData = await qResponse.json();
          questionsByProcess[pt.id] = qData.questions || [];
        }
      }

      // Fetch common questions
      const commonResponse = await fetch('/api/haccp/ccp/verification-questions?include_common=true');
      let commonQuestions: VerificationQuestion[] = [];
      if (commonResponse.ok) {
        const commonData = await commonResponse.json();
        commonQuestions = commonData.commonQuestions || [];
      }

      setAllQuestionsData({
        processTypes: activeProcessTypes,
        questionsByProcess,
        commonQuestions,
      });

      // Initialize responses with all "예(정상)" as default
      const initialResponses: Record<string, { is_compliant: boolean | null; reason?: string; action?: string }> = {};

      // Process questions - default to compliant (true)
      for (const pt of activeProcessTypes) {
        const questions = questionsByProcess[pt.id] || [];
        questions.forEach(q => {
          initialResponses[`q_${q.id}`] = { is_compliant: true };
        });
      }

      // Common questions - default to compliant (true)
      commonQuestions.forEach(q => {
        initialResponses[`cq_${q.id}`] = { is_compliant: true };
      });

      setResponses(initialResponses);
    } catch (error) {
      console.error('Failed to fetch all questions:', error);
    } finally {
      setLoadingQuestions(false);
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
  }, [fetchProcessTypes]);

  useEffect(() => {
    fetchVerifications();
  }, [fetchVerifications]);

  // Load all questions when modal opens
  useEffect(() => {
    if (showModal && !allQuestionsData) {
      fetchAllQuestions();
    }
  }, [showModal, allQuestionsData, fetchAllQuestions]);

  // Handle response change
  const handleResponseChange = (questionId: string, isCompliant: boolean | null, reason?: string, action?: string) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: { is_compliant: isCompliant, reason, action },
    }));
  };

  // Handle form submit - save all at once
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allQuestionsData) return;

    setSubmitting(true);
    try {
      // Build responses array for all process types
      const allResponsesArray: Array<{
        process_type_id?: string;
        question_id?: string;
        common_question_id?: string;
        is_compliant: boolean | null;
        non_compliance_reason?: string;
        corrective_action?: string;
      }> = [];

      // Process questions
      for (const pt of allQuestionsData.processTypes) {
        const questions = allQuestionsData.questionsByProcess[pt.id] || [];
        questions.forEach(q => {
          const response = responses[`q_${q.id}`];
          if (response) {
            allResponsesArray.push({
              process_type_id: pt.id,
              question_id: q.id,
              is_compliant: response.is_compliant,
              non_compliance_reason: response.reason,
              corrective_action: response.action,
            });
          }
        });
      }

      // Common questions
      allQuestionsData.commonQuestions.forEach(q => {
        const response = responses[`cq_${q.id}`];
        if (response) {
          allResponsesArray.push({
            common_question_id: q.id,
            is_compliant: response.is_compliant,
            non_compliance_reason: response.reason,
            corrective_action: response.action,
          });
        }
      });

      // Calculate compliance status
      const nonCompliantCount = allResponsesArray.filter(r => r.is_compliant === false).length;
      const overallStatus = nonCompliantCount === 0 ? 'COMPLIANT' : nonCompliantCount <= 2 ? 'PARTIAL' : 'NON_COMPLIANT';

      const response = await fetch('/api/haccp/ccp/verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verification_year: formData.verification_year,
          verification_month: formData.verification_month,
          special_notes: formData.special_notes,
          action_taken: formData.action_taken,
          overall_compliance_status: overallStatus,
          deviations_found: nonCompliantCount,
          corrective_actions_taken: allResponsesArray.filter(r => r.corrective_action).length,
          records_reviewed: allResponsesArray.length,
          effectiveness_rating: nonCompliantCount === 0 ? 'EXCELLENT' : nonCompliantCount <= 2 ? 'GOOD' : 'FAIR',
          equipment_calibration_verified: true,
          responses: allResponsesArray,
          is_unified: true, // Flag to indicate this is a unified checklist
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
    setAllQuestionsData(null);
    setResponses({});
    setFormData({
      verification_year: currentYear,
      verification_month: currentMonth,
      special_notes: '',
      action_taken: '',
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

  // Get display name for process
  const getProcessDisplayName = (code: string) => {
    const names: Record<string, string> = {
      'HEATING_OVEN': '가열(오븐) 공정',
      'CREAM_WHIPPING': '크림제조(휘핑) 공정',
      'SYRUP_HEATING': '시럽가열 공정',
      'WASHING': '세척 공정',
      'METAL_DETECTION': '금속검출 공정',
      'COOLING': '냉각 공정',
      'PACKAGING': '포장 공정',
    };
    return names[code] || code;
  };

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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">검증 기간</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">상태</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">적합 여부</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">검증자</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">특이사항</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {verifications.map(verification => {
                const StatusIcon = STATUS_CONFIG[verification.status].icon;
                return (
                  <tr key={verification.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-medium">{verification.verification_year}년 {verification.verification_month}월</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${STATUS_CONFIG[verification.status].color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {STATUS_CONFIG[verification.status].label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${COMPLIANCE_CONFIG[verification.overall_compliance_status].color}`}>
                        {COMPLIANCE_CONFIG[verification.overall_compliance_status].label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {verification.verifier?.name || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                      {verification.special_notes || '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
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
                            className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                          >
                            제출
                          </button>
                        )}
                        {verification.status === 'SUBMITTED' && (
                          <>
                            <button
                              onClick={() => handleAction(verification.id, 'approve')}
                              className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700"
                            >
                              승인
                            </button>
                            <button
                              onClick={() => {
                                const reason = prompt('반려 사유를 입력하세요:');
                                if (reason) handleAction(verification.id, 'reject', reason);
                              }}
                              className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700"
                            >
                              반려
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Verification Modal - Unified Checklist */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b bg-blue-50">
              <div>
                <h2 className="text-xl font-bold text-gray-900">CCP 월간 검증점검표</h2>
                <p className="text-sm text-gray-600 mt-1">모든 항목은 기본 "예(정상)"으로 설정되어 있습니다. 부적합 항목만 변경하세요.</p>
              </div>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
              {loadingQuestions ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : allQuestionsData ? (
                <div className="p-6">
                  {/* Period Selection */}
                  <div className="flex items-center gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">검증 기간:</span>
                    </div>
                    <select
                      value={formData.verification_year}
                      onChange={(e) => setFormData({ ...formData, verification_year: parseInt(e.target.value) })}
                      className="px-3 py-2 border rounded-lg text-sm"
                    >
                      {[currentYear - 1, currentYear].map(year => (
                        <option key={year} value={year}>{year}년</option>
                      ))}
                    </select>
                    <select
                      value={formData.verification_month}
                      onChange={(e) => setFormData({ ...formData, verification_month: parseInt(e.target.value) })}
                      className="px-3 py-2 border rounded-lg text-sm"
                    >
                      {MONTHS.map((month, index) => (
                        <option key={index} value={index + 1}>{month}</option>
                      ))}
                    </select>
                  </div>

                  {/* Unified Checklist Table */}
                  <div className="border rounded-lg overflow-hidden mb-6">
                    <table className="w-full">
                      <thead className="bg-gray-800 text-white">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-medium" style={{ width: '60%' }}>점검내용</th>
                          <th className="px-4 py-3 text-center text-sm font-medium w-20">예</th>
                          <th className="px-4 py-3 text-center text-sm font-medium w-20">아니오</th>
                          <th className="px-4 py-3 text-left text-sm font-medium">이탈 및 개선조치 내용</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {/* Process Questions grouped by process type */}
                        {allQuestionsData.processTypes.map((pt, ptIdx) => {
                          const questions = allQuestionsData.questionsByProcess[pt.id] || [];
                          if (questions.length === 0) return null;

                          return questions.map((question, qIdx) => {
                            const responseKey = `q_${question.id}`;
                            const response = responses[responseKey] || { is_compliant: true };
                            const isFirstInGroup = qIdx === 0;

                            return (
                              <tr key={question.id} className={ptIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                <td className="px-4 py-3">
                                  <div className="text-sm">
                                    <span className="font-medium text-blue-700">[{getProcessDisplayName(pt.code)}]</span>
                                    <span className="ml-1 text-gray-900">{question.question_text}</span>
                                  </div>
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
                                      placeholder="이탈 및 개선조치 내용 입력"
                                      value={response.reason || ''}
                                      onChange={(e) => handleResponseChange(responseKey, false, e.target.value, response.action)}
                                      className="w-full px-2 py-1 text-sm border rounded"
                                    />
                                  )}
                                </td>
                              </tr>
                            );
                          });
                        })}

                        {/* Common Questions (Equipment Calibration) */}
                        {allQuestionsData.commonQuestions.length > 0 && (
                          <>
                            <tr className="bg-purple-100">
                              <td colSpan={4} className="px-4 py-2">
                                <span className="font-bold text-purple-800">[공통사항] 장비 검·교정</span>
                              </td>
                            </tr>
                            {allQuestionsData.commonQuestions.map((question, idx) => {
                              const responseKey = `cq_${question.id}`;
                              const response = responses[responseKey] || { is_compliant: true };

                              return (
                                <tr key={question.id} className={idx % 2 === 0 ? 'bg-purple-50/50' : 'bg-white'}>
                                  <td className="px-4 py-3">
                                    <div className="text-sm text-gray-900">{question.question_text}</div>
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
                          </>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Special Notes & Action Taken */}
                  <div className="grid grid-cols-2 gap-4">
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
                </div>
              ) : (
                <div className="flex items-center justify-center h-64 text-gray-500">
                  데이터를 불러올 수 없습니다.
                </div>
              )}
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
                disabled={submitting || !allQuestionsData}
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
                  {selectedVerification.verification_year}년 {selectedVerification.verification_month}월 검증
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

              {/* Checklist Responses */}
              {selectedVerification.responses && selectedVerification.responses.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-3">검증 체크리스트</h3>
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
                                  <span className="text-red-600">{response.non_compliance_reason}</span>
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
                      if (reason) handleAction(selectedVerification.id, 'reject', reason);
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
