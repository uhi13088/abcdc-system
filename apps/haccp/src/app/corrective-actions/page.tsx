'use client';

import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Search,
  Filter,
  ChevronRight,
  X,
  AlertCircle,
  Loader2,
} from 'lucide-react';

interface CorrectiveAction {
  id: string;
  action_number: string;
  action_date: string;
  source_type: string;
  source_id?: string;
  problem_description: string;
  root_cause?: string;
  immediate_action?: string;
  corrective_action: string;
  preventive_action?: string;
  responsible_person?: string | null;
  responsible?: { id: string; name: string };
  due_date?: string;
  verification_method?: string;
  verification_date?: string;
  verifier?: { id: string; name: string };
  verification_result?: string;
  status: string;
  created_at: string;
}

interface User {
  id: string;
  name: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  OPEN: { label: '미처리', color: 'text-red-700', bgColor: 'bg-red-100' },
  IN_PROGRESS: { label: '진행중', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  COMPLETED: { label: '완료', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  VERIFIED: { label: '검증됨', color: 'text-green-700', bgColor: 'bg-green-100' },
  CLOSED: { label: '종결', color: 'text-gray-700', bgColor: 'bg-gray-100' },
};

const SOURCE_TYPE_LABELS: Record<string, string> = {
  CCP: 'CCP 이탈',
  HYGIENE: '위생점검',
  INSPECTION: '정기점검',
  AUDIT: '감사',
  CUSTOMER_COMPLAINT: '고객불만',
  OTHER: '기타',
};

export default function CorrectiveActionsPage() {
  const [actions, setActions] = useState<CorrectiveAction[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [selectedAction, setSelectedAction] = useState<CorrectiveAction | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchActions();
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, sourceFilter]);

  const fetchActions = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (sourceFilter) params.append('source_type', sourceFilter);

      const res = await fetch(`/api/haccp/corrective-actions?${params}`);
      if (res.ok) {
        setActions(await res.json());
      }
    } catch (error) {
      console.error('Failed to fetch actions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/haccp/users');
      if (res.ok) {
        setUsers(await res.json());
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const handleUpdateAction = async (updates: Partial<CorrectiveAction>) => {
    if (!selectedAction) return;

    try {
      setSaving(true);
      const res = await fetch('/api/haccp/corrective-actions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedAction.id, ...updates }),
      });

      if (res.ok) {
        const updated = await res.json();
        setActions(prev => prev.map(a => a.id === updated.id ? { ...a, ...updated } : a));
        setSelectedAction({ ...selectedAction, ...updated });
      }
    } catch (error) {
      console.error('Failed to update action:', error);
    } finally {
      setSaving(false);
    }
  };

  const filteredActions = actions.filter(action => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        action.action_number.toLowerCase().includes(query) ||
        action.problem_description.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const openActions = actions.filter(a => a.status === 'OPEN' || a.status === 'IN_PROGRESS');
  const overdueActions = actions.filter(a => {
    if (!a.due_date || a.status === 'CLOSED' || a.status === 'VERIFIED') return false;
    return new Date(a.due_date) < new Date();
  });

  // 자동 입력 핸들러 (상세 모달에서 사용)
  const handleAutoFill = () => {
    if (!selectedAction) return;

    const immediateActions = [
      '해당 제품 즉시 격리 조치 및 재가공 실시',
      '문제 공정 일시 중단 및 원인 파악 진행',
      '관련 장비 긴급 점검 및 세척 실시',
      '해당 LOT 전량 보류 조치',
      '작업자 재교육 후 작업 재개',
    ];
    const rootCauses = [
      '장비 노후화로 인한 온도 센서 오작동',
      '작업자 부주의로 인한 모니터링 누락',
      '원료 입고 시 품질 검사 미흡',
      '정비 주기 미준수로 인한 장비 이상',
      '작업 절차 미숙지로 인한 공정 오류',
    ];
    const correctiveActions = [
      '온도 센서 교체 및 정기 점검 주기 단축 (월 1회 → 주 1회)',
      '체크리스트 개선 및 작업자 교육 강화',
      '입고 검사 기준 강화 및 검사 항목 추가',
      '예방 정비 프로그램 도입 및 일정 관리 시스템 구축',
      '작업 표준서 개정 및 전 작업자 대상 재교육 실시',
    ];
    const preventiveActions = [
      '정기 교육 프로그램 운영 (분기 1회)',
      '실시간 모니터링 시스템 도입 검토',
      '2인 확인 체계 도입',
      '공급업체 품질 관리 강화',
      'IoT 센서 기반 자동 알림 시스템 구축',
    ];
    const verificationMethods = [
      '1개월간 일일 점검 기록 확인',
      '해당 공정 샘플 검사 (주 2회, 4주간)',
      '내부 감사 실시',
      '고객 클레임 발생 여부 모니터링',
      '재발 여부 추적 (3개월간)',
    ];

    const randomIdx = Math.floor(Math.random() * 5);
    const today = new Date();
    const dueDate = new Date(today);
    dueDate.setDate(dueDate.getDate() + 14); // 2주 후

    setSelectedAction({
      ...selectedAction,
      immediate_action: immediateActions[randomIdx],
      root_cause: rootCauses[randomIdx],
      corrective_action: correctiveActions[randomIdx],
      preventive_action: preventiveActions[randomIdx],
      verification_method: verificationMethods[randomIdx],
      due_date: dueDate.toISOString().split('T')[0],
    });
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <AlertTriangle className="w-7 h-7 text-orange-500" />
          개선조치 관리
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          CCP 이탈 및 부적합 사항에 대한 개선조치를 관리합니다
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">전체 건수</p>
              <p className="text-2xl font-bold">{actions.length}</p>
            </div>
            <FileText className="w-8 h-8 text-gray-300" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">미처리</p>
              <p className="text-2xl font-bold text-red-600">{openActions.length}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-red-300" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">기한 초과</p>
              <p className="text-2xl font-bold text-orange-600">{overdueActions.length}</p>
            </div>
            <Clock className="w-8 h-8 text-orange-300" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">완료/종결</p>
              <p className="text-2xl font-bold text-green-600">
                {actions.filter(a => a.status === 'VERIFIED' || a.status === 'CLOSED').length}
              </p>
            </div>
            <CheckCircle2 className="w-8 h-8 text-green-300" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="번호 또는 내용 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-3 py-2 border rounded-lg"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border rounded-lg"
            >
              <option value="">전체 상태</option>
              <option value="OPEN">미처리</option>
              <option value="IN_PROGRESS">진행중</option>
              <option value="COMPLETED">완료</option>
              <option value="VERIFIED">검증됨</option>
              <option value="CLOSED">종결</option>
            </select>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="px-3 py-2 border rounded-lg"
            >
              <option value="">전체 유형</option>
              <option value="CCP">CCP 이탈</option>
              <option value="HYGIENE">위생점검</option>
              <option value="INSPECTION">정기점검</option>
              <option value="AUDIT">감사</option>
              <option value="OTHER">기타</option>
            </select>
          </div>
        </div>
      </div>

      {/* Actions List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredActions.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-300" />
          <p className="text-gray-500">등록된 개선조치가 없습니다</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">번호</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">유형</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">문제 내용</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">발생일</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">기한</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">담당자</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredActions.map((action) => {
                const isOverdue = action.due_date &&
                  new Date(action.due_date) < new Date() &&
                  !['VERIFIED', 'CLOSED'].includes(action.status);
                const statusConfig = STATUS_CONFIG[action.status] || STATUS_CONFIG.OPEN;

                return (
                  <tr
                    key={action.id}
                    className={`hover:bg-gray-50 cursor-pointer ${isOverdue ? 'bg-red-50' : ''}`}
                    onClick={() => {
                      setSelectedAction(action);
                      setShowDetailModal(true);
                    }}
                  >
                    <td className="px-4 py-3">
                      <span className="text-sm font-mono font-medium text-blue-600">
                        {action.action_number}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm">
                        {SOURCE_TYPE_LABELS[action.source_type] || action.source_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-900 line-clamp-2 max-w-md">
                        {action.problem_description}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {action.action_date}
                    </td>
                    <td className="px-4 py-3">
                      {action.due_date ? (
                        <span className={`text-sm ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                          {action.due_date}
                          {isOverdue && ' (초과)'}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {action.responsible?.name || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusConfig.bgColor} ${statusConfig.color}`}>
                        {statusConfig.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-orange-500" />
                  개선조치 상세
                </h2>
                <p className="text-sm text-gray-500">{selectedAction.action_number}</p>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <button
                type="button"
                onClick={handleAutoFill}
                className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all shadow-md"
              >
                ✨ 자동 입력 (샘플 데이터)
              </button>

              {/* 기본 정보 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">발생 유형</label>
                  <p className="px-3 py-2 bg-gray-50 rounded-lg text-sm">
                    {SOURCE_TYPE_LABELS[selectedAction.source_type] || selectedAction.source_type}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
                  <select
                    value={selectedAction.status}
                    onChange={(e) => handleUpdateAction({ status: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    disabled={saving}
                  >
                    <option value="OPEN">미처리</option>
                    <option value="IN_PROGRESS">진행중</option>
                    <option value="COMPLETED">완료</option>
                    <option value="VERIFIED">검증됨</option>
                    <option value="CLOSED">종결</option>
                  </select>
                </div>
              </div>

              {/* 문제 내용 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">문제 내용</label>
                <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm whitespace-pre-wrap">
                  {selectedAction.problem_description}
                </div>
              </div>

              {/* 즉각 조치 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">즉각 조치</label>
                <textarea
                  value={selectedAction.immediate_action || ''}
                  onChange={(e) => setSelectedAction({ ...selectedAction, immediate_action: e.target.value })}
                  onBlur={() => handleUpdateAction({ immediate_action: selectedAction.immediate_action })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                  placeholder="이탈 발생 시 취한 즉각적인 조치"
                />
              </div>

              {/* 원인 분석 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">원인 분석</label>
                <textarea
                  value={selectedAction.root_cause || ''}
                  onChange={(e) => setSelectedAction({ ...selectedAction, root_cause: e.target.value })}
                  onBlur={() => handleUpdateAction({ root_cause: selectedAction.root_cause })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                  placeholder="문제 발생의 근본 원인"
                />
              </div>

              {/* 개선 조치 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">개선 조치 *</label>
                <textarea
                  value={selectedAction.corrective_action || ''}
                  onChange={(e) => setSelectedAction({ ...selectedAction, corrective_action: e.target.value })}
                  onBlur={() => handleUpdateAction({ corrective_action: selectedAction.corrective_action })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={3}
                  placeholder="재발 방지를 위한 개선 조치 내용"
                />
              </div>

              {/* 예방 조치 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">예방 조치</label>
                <textarea
                  value={selectedAction.preventive_action || ''}
                  onChange={(e) => setSelectedAction({ ...selectedAction, preventive_action: e.target.value })}
                  onBlur={() => handleUpdateAction({ preventive_action: selectedAction.preventive_action })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                  placeholder="유사 문제 예방을 위한 조치"
                />
              </div>

              {/* 담당자 및 기한 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">담당자</label>
                  <select
                    value={selectedAction.responsible?.id || ''}
                    onChange={(e) => handleUpdateAction({ responsible_person: e.target.value || null })}
                    className="w-full px-3 py-2 border rounded-lg"
                    disabled={saving}
                  >
                    <option value="">담당자 선택</option>
                    {users.map(user => (
                      <option key={user.id} value={user.id}>{user.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">완료 기한</label>
                  <input
                    type="date"
                    value={selectedAction.due_date || ''}
                    onChange={(e) => handleUpdateAction({ due_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    disabled={saving}
                  />
                </div>
              </div>

              {/* 검증 */}
              <div className="border-t pt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">검증 정보</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">검증 방법</label>
                    <input
                      type="text"
                      value={selectedAction.verification_method || ''}
                      onChange={(e) => setSelectedAction({ ...selectedAction, verification_method: e.target.value })}
                      onBlur={() => handleUpdateAction({ verification_method: selectedAction.verification_method })}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      placeholder="효과성 검증 방법"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">검증 결과</label>
                    <input
                      type="text"
                      value={selectedAction.verification_result || ''}
                      onChange={(e) => setSelectedAction({ ...selectedAction, verification_result: e.target.value })}
                      onBlur={() => handleUpdateAction({ verification_result: selectedAction.verification_result })}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      placeholder="검증 결과"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4 flex justify-end gap-3">
              {saving && (
                <span className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  저장 중...
                </span>
              )}
              <button
                onClick={() => setShowDetailModal(false)}
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
