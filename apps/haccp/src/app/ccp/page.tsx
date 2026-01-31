'use client';

import { useState, useEffect } from 'react';
import { Plus, AlertTriangle, Edit, Trash2, X, ClipboardCheck, TrendingUp, ChevronDown } from 'lucide-react';
import Link from 'next/link';

interface CriticalLimit {
  code: string;
  parameter: string;
  min?: number | null;
  max?: number | null;
  unit: string;
}

interface CCPDefinition {
  id: string;
  ccp_number: string;
  process: string;
  hazard: string;
  control_measure: string;
  critical_limit: CriticalLimit;
  critical_limits?: CriticalLimit[];
  monitoring_method: string;
  monitoring_frequency: string;
  corrective_action: string;
  status: string;
}

// CCP 프리셋 데이터 (공정별 기본 설정)
const CCP_PRESETS: Record<string, {
  process: string;
  hazard: string;
  control_measure: string;
  corrective_action: string;
  monitoring_frequency: string;
  critical_limits: CriticalLimit[];
}> = {
  'CCP-1B-COOKIE': {
    process: '오븐(굽기)-과자',
    hazard: '가열 불충분으로 인한 병원성 미생물 생존',
    control_measure: '가열온도/시간 관리',
    corrective_action: '재가열 또는 폐기 처리',
    monitoring_frequency: '시작전/2시간마다/변경시/종료',
    critical_limits: [
      { code: 'TEMP', parameter: '가열온도', min: 180, max: 210, unit: '°C' },
      { code: 'TIME', parameter: '가열시간', min: 50, max: 60, unit: '분' },
      { code: 'CORE', parameter: '가열 후 품온', min: 80, max: 210, unit: '°C' },
    ],
  },
  'CCP-1B-BREAD': {
    process: '오븐(굽기)-빵류',
    hazard: '가열 불충분으로 인한 병원성 미생물 생존',
    control_measure: '가열온도/시간 관리',
    corrective_action: '재가열 또는 폐기 처리',
    monitoring_frequency: '시작전/2시간마다/변경시/종료',
    critical_limits: [
      { code: 'TEMP', parameter: '가열온도', min: 145, max: 225, unit: '°C' },
      { code: 'TIME', parameter: '가열시간', min: 30, max: 60, unit: '분' },
      { code: 'CORE', parameter: '가열 후 품온', min: 90, max: 200, unit: '°C' },
    ],
  },
  'CCP-2B-CREAM': {
    process: '크림(휘핑)',
    hazard: '냉장 온도 미준수로 인한 미생물 증식',
    control_measure: '냉장 보관 및 사용시간 관리',
    corrective_action: '폐기 처리',
    monitoring_frequency: '제조 직후/소진 직전/작업 중',
    critical_limits: [
      { code: 'MASS', parameter: '배합량', min: 0, max: 3.5, unit: 'kg' },
      { code: 'TEMP-START', parameter: '품온(제조직후)', min: null, max: 15, unit: '°C' },
      { code: 'TEMP-END', parameter: '품온(소진직전)', min: null, max: 15, unit: '°C' },
      { code: 'USE-TIME', parameter: '소진시간', min: 34, max: 40, unit: '분' },
      { code: 'ROOM-TEMP', parameter: '작업장 온도', min: 0, max: 23, unit: '°C' },
    ],
  },
  'CCP-3B-SYRUP': {
    process: '시럽가열',
    hazard: '가열 불충분으로 인한 병원성 미생물 생존',
    control_measure: '가열온도/시간 관리',
    corrective_action: '재가열 또는 폐기 처리',
    monitoring_frequency: '매작업시',
    critical_limits: [
      { code: 'TEMP', parameter: '가열온도', min: 85, max: 95, unit: '°C' },
      { code: 'TIME', parameter: '가열시간', min: 5, max: 62, unit: '분' },
      { code: 'CORE', parameter: '가열 후 품온', min: 80, max: null, unit: '°C' },
    ],
  },
  'CCP-4B-WASH': {
    process: '세척원료',
    hazard: '세척 불충분으로 인한 이물질 잔류',
    control_measure: '세척 조건 관리',
    corrective_action: '재세척 실시',
    monitoring_frequency: '매작업시',
    critical_limits: [
      { code: 'RAWWT', parameter: '원료량', min: 0, max: 500, unit: 'g' },
      { code: 'VOL', parameter: '세척수량', min: 3, max: null, unit: 'L' },
      { code: 'TIME', parameter: '세척시간', min: 5, max: null, unit: '분' },
    ],
  },
  'CCP-5P-METAL': {
    process: '금속검출',
    hazard: '금속 이물질 혼입',
    control_measure: '금속검출기 작동 확인',
    corrective_action: '제품 격리 및 재검사, 장비 점검',
    monitoring_frequency: '작업시작/2시간/변경/종료',
    critical_limits: [
      { code: 'FE20', parameter: '테스트피스 Fe2.0mm 통과', min: 1, max: 1, unit: 'Bool' },
      { code: 'SUS25', parameter: '테스트피스 SUS2.5mm 통과', min: 1, max: 1, unit: 'Bool' },
      { code: 'PROD', parameter: '제품 불검출', min: 1, max: 1, unit: 'Bool' },
    ],
  },
};

const defaultCriticalLimit: CriticalLimit = { code: '', parameter: '', min: 0, max: 0, unit: '' };

export default function CCPPage() {
  const [ccps, setCcps] = useState<CCPDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPresetDropdown, setShowPresetDropdown] = useState(false);
  const [formData, setFormData] = useState({
    ccp_number: '',
    process: '',
    hazard: '',
    control_measure: '',
    critical_limits: [{ ...defaultCriticalLimit }] as CriticalLimit[],
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

      // critical_limit은 첫 번째 항목으로 설정 (호환성 유지)
      const submitData = {
        ...formData,
        critical_limit: formData.critical_limits[0] || defaultCriticalLimit,
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      });

      if (response.ok) {
        setShowModal(false);
        setEditingId(null);
        fetchCCPs();
        resetForm();
      }
    } catch (error) {
      console.error('Failed to save CCP:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      ccp_number: '',
      process: '',
      hazard: '',
      control_measure: '',
      critical_limits: [{ ...defaultCriticalLimit }],
      monitoring_method: '',
      monitoring_frequency: '',
      corrective_action: '',
    });
  };

  const handleEdit = (ccp: CCPDefinition) => {
    setEditingId(ccp.id);
    // critical_limits 배열 우선, 없으면 critical_limit을 배열로
    const limits = ccp.critical_limits && ccp.critical_limits.length > 0
      ? ccp.critical_limits
      : ccp.critical_limit ? [ccp.critical_limit] : [{ ...defaultCriticalLimit }];

    setFormData({
      ccp_number: ccp.ccp_number,
      process: ccp.process,
      hazard: ccp.hazard,
      control_measure: ccp.control_measure,
      critical_limits: limits.map(l => ({
        code: l.code || '',
        parameter: l.parameter || '',
        min: l.min ?? null,
        max: l.max ?? null,
        unit: l.unit || '',
      })),
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

  const generateCCPNumber = () => {
    const prefix = 'CCP';
    const existingNumbers = ccps
      .filter(c => c.ccp_number?.startsWith(prefix))
      .map(c => {
        const num = parseInt(c.ccp_number.replace(prefix + '-', ''));
        return isNaN(num) ? 0 : num;
      });
    const nextNum = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
    return `${prefix}-${nextNum}`;
  };

  const openNewModal = () => {
    setEditingId(null);
    setFormData({
      ccp_number: generateCCPNumber(),
      process: '',
      hazard: '',
      control_measure: '',
      critical_limits: [{ ...defaultCriticalLimit }],
      monitoring_method: '',
      monitoring_frequency: '',
      corrective_action: '',
    });
    setShowModal(true);
  };

  const applyPreset = (presetKey: string) => {
    const preset = CCP_PRESETS[presetKey];
    if (preset) {
      setFormData({
        ...formData,
        ccp_number: presetKey,
        process: preset.process,
        hazard: preset.hazard,
        control_measure: preset.control_measure,
        corrective_action: preset.corrective_action,
        monitoring_frequency: preset.monitoring_frequency,
        monitoring_method: preset.process,
        critical_limits: preset.critical_limits.map(l => ({ ...l })),
      });
    }
    setShowPresetDropdown(false);
  };

  const addCriticalLimit = () => {
    setFormData({
      ...formData,
      critical_limits: [...formData.critical_limits, { ...defaultCriticalLimit }],
    });
  };

  const removeCriticalLimit = (index: number) => {
    if (formData.critical_limits.length <= 1) return;
    setFormData({
      ...formData,
      critical_limits: formData.critical_limits.filter((_, i) => i !== index),
    });
  };

  const updateCriticalLimit = (index: number, field: keyof CriticalLimit, value: string | number | null) => {
    const updated = [...formData.critical_limits];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, critical_limits: updated });
  };

  // 한계기준 표시 함수
  const formatLimit = (limit: CriticalLimit) => {
    const minStr = limit.min !== null && limit.min !== undefined ? `${limit.min}` : '';
    const maxStr = limit.max !== null && limit.max !== undefined ? `${limit.max}` : '';

    if (limit.unit === 'Bool') {
      return `${limit.parameter}: 확인`;
    }
    if (minStr && maxStr) {
      return `${limit.parameter}: ${minStr}~${maxStr}${limit.unit}`;
    }
    if (minStr) {
      return `${limit.parameter}: ${minStr}${limit.unit} 이상`;
    }
    if (maxStr) {
      return `${limit.parameter}: ${maxStr}${limit.unit} 이하`;
    }
    return limit.parameter;
  };

  // CCP에서 표시할 limits 가져오기
  const getLimits = (ccp: CCPDefinition): CriticalLimit[] => {
    if (ccp.critical_limits && ccp.critical_limits.length > 0) {
      return ccp.critical_limits;
    }
    if (ccp.critical_limit && ccp.critical_limit.parameter) {
      return [ccp.critical_limit];
    }
    return [];
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
            onClick={openNewModal}
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
          {ccps.map((ccp) => {
            const limits = getLimits(ccp);
            return (
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
                    <h4 className="text-xs font-medium text-red-600 uppercase mb-2">한계기준 (Critical Limits)</h4>
                    <div className="space-y-1">
                      {limits.map((limit, idx) => (
                        <p key={idx} className="text-sm font-medium text-red-700">
                          {formatLimit(limit)}
                        </p>
                      ))}
                      {limits.length === 0 && (
                        <p className="text-sm text-red-400">설정된 한계기준 없음</p>
                      )}
                    </div>
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
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setShowModal(false); setEditingId(null); }}>
          <div className="bg-white rounded-xl w-full max-w-3xl mx-4 p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">{editingId ? 'CCP 수정' : 'CCP 등록'}</h2>
              <button onClick={() => { setShowModal(false); setEditingId(null); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 프리셋 선택 */}
            {!editingId && (
              <div className="mb-6 relative">
                <label className="block text-sm font-medium text-gray-700 mb-2">프리셋 선택 (선택사항)</label>
                <button
                  type="button"
                  onClick={() => setShowPresetDropdown(!showPresetDropdown)}
                  className="w-full px-4 py-3 border rounded-lg text-left flex items-center justify-between bg-blue-50 border-blue-200 hover:bg-blue-100"
                >
                  <span className="text-blue-700">공정별 기본 설정 불러오기</span>
                  <ChevronDown className="w-4 h-4 text-blue-600" />
                </button>
                {showPresetDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-64 overflow-y-auto">
                    {Object.entries(CCP_PRESETS).map(([key, preset]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => applyPreset(key)}
                        className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b last:border-b-0"
                      >
                        <span className="font-medium text-gray-900">{key}</span>
                        <span className="text-sm text-gray-500 ml-2">{preset.process}</span>
                        <div className="text-xs text-gray-400 mt-1">
                          {preset.critical_limits.map(l => l.parameter).join(', ')}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CCP 번호</label>
                  <input
                    type="text"
                    value={formData.ccp_number}
                    onChange={(e) => setFormData({ ...formData, ccp_number: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="예: CCP-1B-BREAD"
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
                    placeholder="예: 오븐(굽기)-빵류"
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
                  placeholder="예: 가열 불충분으로 인한 병원성 미생물 생존"
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
                  placeholder="예: 가열온도/시간 관리"
                  required
                />
              </div>

              {/* 다중 한계기준 */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-gray-700">한계기준 (Critical Limits)</label>
                  <button
                    type="button"
                    onClick={addCriticalLimit}
                    className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    항목 추가
                  </button>
                </div>
                <div className="space-y-3">
                  {formData.critical_limits.map((limit, index) => (
                    <div key={index} className="bg-white rounded-lg p-3 border relative">
                      {formData.critical_limits.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeCriticalLimit(index)}
                          className="absolute top-2 right-2 p-1 hover:bg-red-100 rounded text-red-500"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                      <div className="grid grid-cols-5 gap-2">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">코드</label>
                          <input
                            type="text"
                            value={limit.code}
                            onChange={(e) => updateCriticalLimit(index, 'code', e.target.value)}
                            className="w-full px-2 py-1.5 border rounded text-sm"
                            placeholder="TEMP"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">측정항목</label>
                          <input
                            type="text"
                            value={limit.parameter}
                            onChange={(e) => updateCriticalLimit(index, 'parameter', e.target.value)}
                            className="w-full px-2 py-1.5 border rounded text-sm"
                            placeholder="가열온도"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">최소값</label>
                          <input
                            type="number"
                            value={limit.min ?? ''}
                            onChange={(e) => updateCriticalLimit(index, 'min', e.target.value ? parseFloat(e.target.value) : null)}
                            className="w-full px-2 py-1.5 border rounded text-sm"
                            placeholder="없음"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">최대값</label>
                          <input
                            type="number"
                            value={limit.max ?? ''}
                            onChange={(e) => updateCriticalLimit(index, 'max', e.target.value ? parseFloat(e.target.value) : null)}
                            className="w-full px-2 py-1.5 border rounded text-sm"
                            placeholder="없음"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">단위</label>
                          <input
                            type="text"
                            value={limit.unit}
                            onChange={(e) => updateCriticalLimit(index, 'unit', e.target.value)}
                            className="w-full px-2 py-1.5 border rounded text-sm"
                            placeholder="°C"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
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
                    placeholder="예: 오븐(굽기)-빵류"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">점검 주기</label>
                  <input
                    type="text"
                    value={formData.monitoring_frequency}
                    onChange={(e) => setFormData({ ...formData, monitoring_frequency: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="예: 시작전/2시간마다/변경시/종료"
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
