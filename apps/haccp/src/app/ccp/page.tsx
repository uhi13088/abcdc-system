'use client';

import { useState, useEffect } from 'react';
import { Plus, AlertTriangle, Edit, Trash2, X, ClipboardCheck, TrendingUp } from 'lucide-react';
import Link from 'next/link';

interface CCPDefinition {
  id: string;
  ccp_number: string;
  process: string;
  hazard: string;
  control_measure: string;
  critical_limit: {
    parameter: string;
    min?: number;
    max?: number;
    unit: string;
  };
  monitoring_method: string;
  monitoring_frequency: string;
  corrective_action: string;
  status: string;
}

export default function CCPPage() {
  const [ccps, setCcps] = useState<CCPDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    ccp_number: '',
    process: '',
    hazard: '',
    control_measure: '',
    critical_limit: { parameter: '', min: 0, max: 0, unit: '' },
    monitoring_method: '',
    monitoring_frequency: '',
    corrective_action: '',
  });

  useEffect(() => {
    fetchCCPs();
  }, []);

  const fetchCCPs = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/haccp/ccp');
      if (response.ok) {
        const data = await response.json();
        setCcps(data);
      }
    } catch (error) {
      console.error('Failed to fetch CCPs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingId ? `/api/haccp/ccp/${editingId}` : '/api/haccp/ccp';
      const method = editingId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setShowModal(false);
        setEditingId(null);
        fetchCCPs();
        setFormData({
          ccp_number: '',
          process: '',
          hazard: '',
          control_measure: '',
          critical_limit: { parameter: '', min: 0, max: 0, unit: '' },
          monitoring_method: '',
          monitoring_frequency: '',
          corrective_action: '',
        });
      }
    } catch (error) {
      console.error('Failed to save CCP:', error);
    }
  };

  const handleEdit = (ccp: CCPDefinition) => {
    setEditingId(ccp.id);
    setFormData({
      ccp_number: ccp.ccp_number,
      process: ccp.process,
      hazard: ccp.hazard,
      control_measure: ccp.control_measure,
      critical_limit: {
        parameter: ccp.critical_limit.parameter,
        min: ccp.critical_limit.min ?? 0,
        max: ccp.critical_limit.max ?? 0,
        unit: ccp.critical_limit.unit,
      },
      monitoring_method: ccp.monitoring_method,
      monitoring_frequency: ccp.monitoring_frequency,
      corrective_action: ccp.corrective_action,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
      await fetch(`/api/haccp/ccp/${id}`, { method: 'DELETE' });
      fetchCCPs();
    } catch (error) {
      console.error('Failed to delete CCP:', error);
    }
  };

  // 자동 입력 기능
  const handleAutoFill = () => {
    const ccpTemplates = [
      {
        ccp_number: 'CCP-1',
        process: '원료 입고 검수',
        hazard: '생물학적 위해요소 - 병원성 미생물 오염',
        control_measure: '입고 시 온도 확인 및 관능검사 실시',
        critical_limit: { parameter: '온도', min: -18, max: 5, unit: '°C' },
        monitoring_method: '중심온도계 측정',
        monitoring_frequency: '매 입고 시',
        corrective_action: '한계기준 이탈 시 반품 또는 폐기',
      },
      {
        ccp_number: 'CCP-2',
        process: '가열 살균',
        hazard: '생물학적 위해요소 - 병원성 미생물 잔존',
        control_measure: '중심온도 85°C 이상 1분간 가열',
        critical_limit: { parameter: '중심온도', min: 85, max: 100, unit: '°C' },
        monitoring_method: '중심온도계로 측정',
        monitoring_frequency: '매 배치',
        corrective_action: '재가열 또는 폐기 처리',
      },
      {
        ccp_number: 'CCP-3',
        process: '냉각',
        hazard: '생물학적 위해요소 - 미생물 증식',
        control_measure: '60분 이내 10°C 이하로 냉각',
        critical_limit: { parameter: '냉각시간/온도', min: 0, max: 10, unit: '°C/60분' },
        monitoring_method: '온도계 및 타이머',
        monitoring_frequency: '매 냉각 공정',
        corrective_action: '폐기 처리',
      },
    ];

    // 아직 등록되지 않은 CCP 템플릿 찾기
    const existingNumbers = ccps.map(c => c.ccp_number);
    const nextTemplate = ccpTemplates.find(t => !existingNumbers.includes(t.ccp_number));

    if (nextTemplate) {
      setFormData(nextTemplate);
    } else {
      // 모두 등록된 경우 새 번호로 생성
      const nextNum = ccps.length + 1;
      setFormData({
        ccp_number: `CCP-${nextNum}`,
        process: '신규 공정',
        hazard: '생물학적/화학적/물리적 위해요소',
        control_measure: '관리 기준에 따른 모니터링',
        critical_limit: { parameter: '온도', min: 0, max: 10, unit: '°C' },
        monitoring_method: '측정 장비 사용',
        monitoring_frequency: '정기 점검',
        corrective_action: '기준 이탈 시 조치',
      });
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CCP 관리</h1>
          <p className="mt-1 text-sm text-gray-500">중요관리점(Critical Control Point)을 정의하고 관리합니다</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/ccp/records"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            <ClipboardCheck className="w-4 h-4" />
            모니터링 기록
          </Link>
          <Link
            href="/ccp/verification"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            <TrendingUp className="w-4 h-4" />
            월간 검증
          </Link>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            CCP 등록
          </button>
        </div>
      </div>

      {/* CCP Cards */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : ccps.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">등록된 CCP가 없습니다</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {ccps.map((ccp) => (
            <div key={ccp.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className="bg-gradient-to-r from-red-500 to-orange-500 px-5 py-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-white">{ccp.ccp_number}</h3>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    ccp.status === 'ACTIVE' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {ccp.status === 'ACTIVE' ? '운영중' : '비활성'}
                  </span>
                </div>
                <p className="text-white/90 text-sm">{ccp.process}</p>
              </div>

              <div className="p-5 space-y-4">
                <div>
                  <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">위해요소</h4>
                  <p className="text-sm text-gray-900">{ccp.hazard}</p>
                </div>

                <div>
                  <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">관리방법</h4>
                  <p className="text-sm text-gray-900">{ccp.control_measure}</p>
                </div>

                <div className="bg-red-50 rounded-lg p-3">
                  <h4 className="text-xs font-medium text-red-600 uppercase mb-1">한계기준 (Critical Limit)</h4>
                  <p className="text-sm font-semibold text-red-700">
                    {ccp.critical_limit.parameter}: {ccp.critical_limit.min !== undefined && `${ccp.critical_limit.min}${ccp.critical_limit.unit}`}
                    {ccp.critical_limit.min !== undefined && ccp.critical_limit.max !== undefined && ' ~ '}
                    {ccp.critical_limit.max !== undefined && `${ccp.critical_limit.max}${ccp.critical_limit.unit}`}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">모니터링 방법</h4>
                    <p className="text-gray-900">{ccp.monitoring_method}</p>
                  </div>
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">점검 주기</h4>
                    <p className="text-gray-900">{ccp.monitoring_frequency}</p>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">개선조치</h4>
                  <p className="text-sm text-gray-900">{ccp.corrective_action}</p>
                </div>
              </div>

              <div className="flex justify-end gap-1 px-5 py-3 border-t bg-gray-50">
                <Link
                  href={`/ccp/records?ccp=${ccp.id}`}
                  className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded"
                >
                  기록하기
                </Link>
                <button onClick={() => handleEdit(ccp)} className="p-2 hover:bg-gray-200 rounded">
                  <Edit className="w-4 h-4 text-gray-500" />
                </button>
                <button onClick={() => handleDelete(ccp.id)} className="p-2 hover:bg-red-100 rounded">
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">{editingId ? 'CCP 수정' : 'CCP 등록'}</h2>
              <button onClick={() => { setShowModal(false); setEditingId(null); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 자동 입력 버튼 */}
              <button
                type="button"
                onClick={handleAutoFill}
                className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all shadow-md"
              >
                ✨ 자동 입력 (샘플 CCP 데이터)
              </button>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CCP 번호</label>
                  <input
                    type="text"
                    value={formData.ccp_number}
                    onChange={(e) => setFormData({ ...formData, ccp_number: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="예: CCP-1"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">공정명</label>
                  <input
                    type="text"
                    value={formData.process}
                    onChange={(e) => setFormData({ ...formData, process: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="예: 가열 살균"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">위해요소</label>
                <textarea
                  value={formData.hazard}
                  onChange={(e) => setFormData({ ...formData, hazard: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                  placeholder="예: 생물학적 위해요소 - 병원성 미생물 잔존"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">관리방법</label>
                <textarea
                  value={formData.control_measure}
                  onChange={(e) => setFormData({ ...formData, control_measure: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                  placeholder="예: 중심온도 85°C 이상 1분간 가열"
                  required
                />
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <label className="block text-sm font-medium text-gray-700 mb-3">한계기준</label>
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">측정항목</label>
                    <input
                      type="text"
                      value={formData.critical_limit.parameter}
                      onChange={(e) => setFormData({ ...formData, critical_limit: { ...formData.critical_limit, parameter: e.target.value } })}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="온도"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">최소값</label>
                    <input
                      type="number"
                      value={formData.critical_limit.min}
                      onChange={(e) => setFormData({ ...formData, critical_limit: { ...formData.critical_limit, min: parseFloat(e.target.value) } })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">최대값</label>
                    <input
                      type="number"
                      value={formData.critical_limit.max}
                      onChange={(e) => setFormData({ ...formData, critical_limit: { ...formData.critical_limit, max: parseFloat(e.target.value) } })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">단위</label>
                    <input
                      type="text"
                      value={formData.critical_limit.unit}
                      onChange={(e) => setFormData({ ...formData, critical_limit: { ...formData.critical_limit, unit: e.target.value } })}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="°C"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">모니터링 방법</label>
                  <input
                    type="text"
                    value={formData.monitoring_method}
                    onChange={(e) => setFormData({ ...formData, monitoring_method: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="예: 중심온도계로 측정"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">점검 주기</label>
                  <input
                    type="text"
                    value={formData.monitoring_frequency}
                    onChange={(e) => setFormData({ ...formData, monitoring_frequency: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="예: 매 배치"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">개선조치</label>
                <textarea
                  value={formData.corrective_action}
                  onChange={(e) => setFormData({ ...formData, corrective_action: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                  placeholder="예: 재가열 또는 폐기 처리"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowModal(false); setEditingId(null); }} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">
                  취소
                </button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  {editingId ? '수정' : '등록'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
