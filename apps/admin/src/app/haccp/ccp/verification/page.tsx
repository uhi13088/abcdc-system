'use client';

import { useState, useEffect } from 'react';
import { Plus, Check, X, AlertTriangle, Calendar, FileText, TrendingUp, BarChart3 } from 'lucide-react';
import Link from 'next/link';

interface CCPDefinition {
  id: string;
  ccp_number: string;
  process: string;
  critical_limit: {
    parameter: string;
    min?: number;
    max?: number;
    unit: string;
  };
}

interface CCPVerification {
  id: string;
  ccp_id: string;
  verification_year: number;
  verification_month: number;
  records_reviewed: number;
  deviations_found: number;
  corrective_actions_taken: number;
  effectiveness_rating: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
  findings: string;
  recommendations: string;
  verified_by?: string;
  verified_at?: string;
  approved_by?: string;
  approved_at?: string;
  ccp_definitions?: CCPDefinition;
  verifier?: { name: string };
  approver?: { name: string };
}

const MONTHS = [
  '1월', '2월', '3월', '4월', '5월', '6월',
  '7월', '8월', '9월', '10월', '11월', '12월'
];

const RATING_COLORS = {
  EXCELLENT: 'bg-green-100 text-green-700',
  GOOD: 'bg-blue-100 text-blue-700',
  FAIR: 'bg-yellow-100 text-yellow-700',
  POOR: 'bg-red-100 text-red-700',
};

const RATING_LABELS = {
  EXCELLENT: '우수',
  GOOD: '양호',
  FAIR: '보통',
  POOR: '미흡',
};

export default function CCPVerificationPage() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [ccpList, setCcpList] = useState<CCPDefinition[]>([]);
  const [verifications, setVerifications] = useState<CCPVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const [formData, setFormData] = useState({
    ccp_id: '',
    verification_year: currentYear,
    verification_month: currentMonth,
    records_reviewed: 0,
    deviations_found: 0,
    corrective_actions_taken: 0,
    effectiveness_rating: 'GOOD' as const,
    findings: '',
    recommendations: '',
  });

  useEffect(() => {
    fetchCCPs();
  }, []);

  useEffect(() => {
    fetchVerifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, selectedMonth]);

  const fetchCCPs = async () => {
    try {
      const response = await fetch('/api/haccp/ccp');
      if (response.ok) {
        const data = await response.json();
        setCcpList(data);
        if (data.length > 0) {
          setFormData(prev => ({ ...prev, ccp_id: data[0].id }));
        }
      }
    } catch (error) {
      console.error('Failed to fetch CCPs:', error);
    }
  };

  const fetchVerifications = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        year: selectedYear.toString(),
        month: selectedMonth.toString(),
      });

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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/haccp/ccp/verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setShowModal(false);
        fetchVerifications();
        setFormData({
          ccp_id: ccpList[0]?.id || '',
          verification_year: currentYear,
          verification_month: currentMonth,
          records_reviewed: 0,
          deviations_found: 0,
          corrective_actions_taken: 0,
          effectiveness_rating: 'GOOD',
          findings: '',
          recommendations: '',
        });
      }
    } catch (error) {
      console.error('Failed to create verification:', error);
    }
  };

  // Calculate statistics
  const totalRecordsReviewed = verifications.reduce((sum, v) => sum + v.records_reviewed, 0);
  const totalDeviations = verifications.reduce((sum, v) => sum + v.deviations_found, 0);
  const avgEffectiveness = verifications.length > 0
    ? verifications.filter(v => v.effectiveness_rating === 'EXCELLENT' || v.effectiveness_rating === 'GOOD').length / verifications.length * 100
    : 0;

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href="/haccp/ccp" className="hover:text-primary">CCP 관리</Link>
            <span>/</span>
            <span>월간 검증</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">CCP 월간 검증</h1>
          <p className="mt-1 text-sm text-gray-500">HACCP 시스템의 효과성을 월간 단위로 검증합니다</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          검증 기록 추가
        </button>
      </div>

      {/* Period Selector */}
      <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">검증 기간:</span>
          </div>
          <div>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-3 py-2 border rounded-lg text-sm"
            >
              {[currentYear - 2, currentYear - 1, currentYear].map(year => (
                <option key={year} value={year}>{year}년</option>
              ))}
            </select>
          </div>
          <div>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="px-3 py-2 border rounded-lg text-sm"
            >
              {MONTHS.map((month, index) => (
                <option key={index} value={index + 1}>{month}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">검토 기록 수</p>
              <p className="text-xl font-bold text-gray-900">{totalRecordsReviewed}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">발견된 이탈</p>
              <p className="text-xl font-bold text-gray-900">{totalDeviations}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">효과성 (양호 이상)</p>
              <p className="text-xl font-bold text-gray-900">{avgEffectiveness.toFixed(0)}%</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">검증 완료 CCP</p>
              <p className="text-xl font-bold text-gray-900">{verifications.length} / {ccpList.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Verifications Table */}
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
            검증 기록 추가하기
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {verifications.map((verification) => (
            <div key={verification.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      {verification.ccp_definitions?.ccp_number} - {verification.ccp_definitions?.process}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {verification.verification_year}년 {verification.verification_month}월 검증
                    </p>
                  </div>
                  <span className={`px-3 py-1 text-sm font-medium rounded-full ${RATING_COLORS[verification.effectiveness_rating]}`}>
                    {RATING_LABELS[verification.effectiveness_rating]}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-6 mb-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">검토 기록 수</p>
                    <p className="text-xl font-bold text-gray-900">{verification.records_reviewed}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">발견 이탈</p>
                    <p className={`text-xl font-bold ${verification.deviations_found > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {verification.deviations_found}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">개선조치</p>
                    <p className="text-xl font-bold text-gray-900">{verification.corrective_actions_taken}</p>
                  </div>
                </div>

                {verification.findings && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-1">검증 결과</h4>
                    <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{verification.findings}</p>
                  </div>
                )}

                {verification.recommendations && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-1">권고사항</h4>
                    <p className="text-sm text-gray-600 bg-blue-50 rounded-lg p-3">{verification.recommendations}</p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between px-5 py-3 border-t bg-gray-50 text-sm">
                <div className="flex items-center gap-4 text-gray-500">
                  <span>검증: {verification.verifier?.name || '-'}</span>
                  {verification.approved_at && (
                    <span className="flex items-center gap-1 text-green-600">
                      <Check className="w-4 h-4" />
                      승인: {verification.approver?.name}
                    </span>
                  )}
                </div>
                <button className="text-blue-600 hover:underline">상세보기</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Verification Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">CCP 월간 검증 기록</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CCP 선택</label>
                <select
                  value={formData.ccp_id}
                  onChange={(e) => setFormData({ ...formData, ccp_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                >
                  <option value="">CCP를 선택하세요</option>
                  {ccpList.map((ccp) => (
                    <option key={ccp.id} value={ccp.id}>
                      {ccp.ccp_number} - {ccp.process}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
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

              <div className="grid grid-cols-3 gap-4">
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">개선조치</label>
                  <input
                    type="number"
                    value={formData.corrective_actions_taken}
                    onChange={(e) => setFormData({ ...formData, corrective_actions_taken: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg"
                    min="0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">효과성 평가</label>
                <select
                  value={formData.effectiveness_rating}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  onChange={(e) => setFormData({ ...formData, effectiveness_rating: e.target.value as any })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="EXCELLENT">우수</option>
                  <option value="GOOD">양호</option>
                  <option value="FAIR">보통</option>
                  <option value="POOR">미흡</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">검증 결과</label>
                <textarea
                  value={formData.findings}
                  onChange={(e) => setFormData({ ...formData, findings: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={3}
                  placeholder="검증 결과 및 주요 발견 사항을 기록하세요"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">권고사항</label>
                <textarea
                  value={formData.recommendations}
                  onChange={(e) => setFormData({ ...formData, recommendations: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={3}
                  placeholder="개선 권고사항을 기록하세요"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
