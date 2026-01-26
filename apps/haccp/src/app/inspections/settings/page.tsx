'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Save, RefreshCw, Info } from 'lucide-react';
import Link from 'next/link';

// 검사 항목 정의
const ALL_CHECK_ITEMS: Record<string, { label: string; description: string; category: string }> = {
  // 공통 항목
  appearance_check: { label: '외관검사', description: '제품 외관 상태 확인', category: 'common' },
  packaging_check: { label: '포장상태', description: '포장 파손/오염 확인', category: 'common' },
  label_check: { label: '표시사항', description: '라벨 표시 정확성 확인', category: 'common' },
  temp_check: { label: '온도검사', description: '입고 온도 측정', category: 'common' },
  expiry_check: { label: '유통기한', description: '유통기한 확인', category: 'common' },
  document_check: { label: '서류확인', description: '거래명세서/성적서 확인', category: 'common' },
  foreign_matter_check: { label: '이물혼입', description: '이물질 혼입 여부', category: 'common' },
  odor_check: { label: '이취/변질', description: '이취/변질 여부', category: 'common' },
  weight_check: { label: '중량확인', description: '수량/중량 일치 확인', category: 'common' },
  sensory_check: { label: '관능검사', description: '색상/형태/냄새 등', category: 'common' },

  // 원료 전용
  freshness_check: { label: '신선도', description: '신선도 확인', category: '원료' },
  color_check: { label: '색상', description: '색상 정상 여부', category: '원료' },
  texture_check: { label: '질감', description: '질감 정상 여부', category: '원료' },

  // 포장재 전용
  packaging_integrity_check: { label: '포장재 완전성', description: '포장재 완전성', category: '포장재' },
  printing_check: { label: '인쇄상태', description: '인쇄 상태 확인', category: '포장재' },
  specification_check: { label: '규격확인', description: '규격 일치 확인', category: '포장재' },

  // 서류 관련
  test_report_check: { label: '시험성적서', description: '시험성적서 확인', category: 'document' },
  certificate_check: { label: '인증서', description: '인증서 확인', category: 'document' },
};

interface InspectionStandard {
  id?: string;
  material_type: '원료' | '부재료' | '포장재';
  required_checks: Record<string, boolean>;
  default_temp_min: number | null;
  default_temp_max: number | null;
  pass_threshold: number;
  conditional_threshold: number;
}

export default function InspectionSettingsPage() {
  const [standards, setStandards] = useState<InspectionStandard[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'원료' | '부재료' | '포장재'>('원료');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchStandards = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/haccp/inspections/standards');
      if (response.ok) {
        const data = await response.json();
        setStandards(data);
      }
    } catch (error) {
      console.error('Failed to fetch standards:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStandards();
  }, [fetchStandards]);

  const getCurrentStandard = (): InspectionStandard => {
    const existing = standards.find(s => s.material_type === activeTab);
    if (existing) return existing;

    // 기본값
    return {
      material_type: activeTab,
      required_checks: {},
      default_temp_min: null,
      default_temp_max: null,
      pass_threshold: 9,
      conditional_threshold: 7,
    };
  };

  const updateStandard = (updates: Partial<InspectionStandard>) => {
    setStandards(prev => {
      const existing = prev.find(s => s.material_type === activeTab);
      if (existing) {
        return prev.map(s =>
          s.material_type === activeTab
            ? { ...s, ...updates }
            : s
        );
      } else {
        return [...prev, { ...getCurrentStandard(), ...updates }];
      }
    });
  };

  const toggleCheck = (checkKey: string) => {
    const current = getCurrentStandard();
    const newChecks = { ...current.required_checks };
    newChecks[checkKey] = !newChecks[checkKey];
    updateStandard({ required_checks: newChecks });
  };

  const handleSave = async () => {
    const current = getCurrentStandard();
    try {
      setSaving(true);
      const response = await fetch('/api/haccp/inspections/standards', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(current),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: '저장되었습니다.' });
        fetchStandards();
      } else {
        setMessage({ type: 'error', text: '저장에 실패했습니다.' });
      }
    } catch (error) {
      console.error('Failed to save standard:', error);
      setMessage({ type: 'error', text: '저장에 실패했습니다.' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const currentStandard = getCurrentStandard();
  const selectedChecksCount = Object.values(currentStandard.required_checks).filter(Boolean).length;

  // 카테고리별 검사 항목 그룹핑
  const groupedItems = {
    common: Object.entries(ALL_CHECK_ITEMS).filter(([, item]) => item.category === 'common'),
    specific: Object.entries(ALL_CHECK_ITEMS).filter(([, item]) => item.category === activeTab),
    document: Object.entries(ALL_CHECK_ITEMS).filter(([, item]) => item.category === 'document'),
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/inspections" className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">입고검사 기준 설정</h1>
            <p className="mt-1 text-sm text-gray-500">원료/부재료/포장재별 검사 항목을 설정합니다</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchStandards}
            className="inline-flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      {/* 메시지 */}
      {message && (
        <div className={`mb-4 p-3 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {message.text}
        </div>
      )}

      {/* 탭 */}
      <div className="mb-6 flex gap-2">
        {(['원료', '부재료', '포장재'] as const).map((type) => (
          <button
            key={type}
            onClick={() => setActiveTab(type)}
            className={`px-4 py-2 rounded-lg font-medium ${
              activeTab === type
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* 검사 항목 선택 */}
        <div className="col-span-2 space-y-6">
          {/* 공통 항목 */}
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <h3 className="font-medium text-gray-900 mb-4">공통 검사 항목</h3>
            <div className="grid grid-cols-2 gap-3">
              {groupedItems.common.map(([key, item]) => (
                <label
                  key={key}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    currentStandard.required_checks[key]
                      ? 'bg-blue-50 border-blue-200'
                      : 'bg-white hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={currentStandard.required_checks[key] || false}
                    onChange={() => toggleCheck(key)}
                    className="mt-1 rounded w-5 h-5"
                  />
                  <div>
                    <p className="font-medium text-sm">{item.label}</p>
                    <p className="text-xs text-gray-500">{item.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* 유형별 전용 항목 */}
          {groupedItems.specific.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <h3 className="font-medium text-gray-900 mb-4">{activeTab} 전용 검사 항목</h3>
              <div className="grid grid-cols-2 gap-3">
                {groupedItems.specific.map(([key, item]) => (
                  <label
                    key={key}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      currentStandard.required_checks[key]
                        ? 'bg-blue-50 border-blue-200'
                        : 'bg-white hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={currentStandard.required_checks[key] || false}
                      onChange={() => toggleCheck(key)}
                      className="mt-1 rounded w-5 h-5"
                    />
                    <div>
                      <p className="font-medium text-sm">{item.label}</p>
                      <p className="text-xs text-gray-500">{item.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* 서류 관련 항목 */}
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <h3 className="font-medium text-gray-900 mb-4">서류 확인 항목</h3>
            <div className="grid grid-cols-2 gap-3">
              {groupedItems.document.map(([key, item]) => (
                <label
                  key={key}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    currentStandard.required_checks[key]
                      ? 'bg-blue-50 border-blue-200'
                      : 'bg-white hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={currentStandard.required_checks[key] || false}
                    onChange={() => toggleCheck(key)}
                    className="mt-1 rounded w-5 h-5"
                  />
                  <div>
                    <p className="font-medium text-sm">{item.label}</p>
                    <p className="text-xs text-gray-500">{item.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* 설정 */}
        <div className="space-y-6">
          {/* 선택된 항목 요약 */}
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <h3 className="font-medium text-gray-900 mb-4">선택된 검사 항목</h3>
            <div className="text-center py-4">
              <div className="text-4xl font-bold text-blue-600">{selectedChecksCount}</div>
              <p className="text-sm text-gray-500 mt-1">개 항목 선택됨</p>
            </div>
          </div>

          {/* 합격 기준 설정 */}
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <h3 className="font-medium text-gray-900 mb-4">합격 기준 설정</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  적합 기준 (PASS)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max={selectedChecksCount || 20}
                    value={currentStandard.pass_threshold}
                    onChange={(e) => updateStandard({ pass_threshold: parseInt(e.target.value) || 9 })}
                    className="w-20 px-3 py-2 border rounded-lg"
                  />
                  <span className="text-sm text-gray-500">개 이상 적합 시</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  조건부 기준 (CONDITIONAL)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max={currentStandard.pass_threshold - 1 || 10}
                    value={currentStandard.conditional_threshold}
                    onChange={(e) => updateStandard({ conditional_threshold: parseInt(e.target.value) || 7 })}
                    className="w-20 px-3 py-2 border rounded-lg"
                  />
                  <span className="text-sm text-gray-500">개 이상 적합 시</span>
                </div>
              </div>
              <div className="pt-2 border-t">
                <p className="text-xs text-gray-500">
                  • 적합 기준 이상: <span className="text-green-600 font-medium">적합 (PASS)</span><br />
                  • 조건부 기준 이상: <span className="text-yellow-600 font-medium">조건부 (CONDITIONAL)</span><br />
                  • 조건부 기준 미만: <span className="text-red-600 font-medium">부적합 (FAIL)</span>
                </p>
              </div>
            </div>
          </div>

          {/* 온도 기준 (온도검사 선택 시) */}
          {currentStandard.required_checks.temp_check && (
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <h3 className="font-medium text-gray-900 mb-4">온도 기준 설정</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      최소 온도
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.1"
                        value={currentStandard.default_temp_min ?? ''}
                        onChange={(e) => updateStandard({
                          default_temp_min: e.target.value ? parseFloat(e.target.value) : null
                        })}
                        className="w-full px-3 py-2 border rounded-lg"
                        placeholder="-"
                      />
                      <span className="text-sm">°C</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      최대 온도
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.1"
                        value={currentStandard.default_temp_max ?? ''}
                        onChange={(e) => updateStandard({
                          default_temp_max: e.target.value ? parseFloat(e.target.value) : null
                        })}
                        className="w-full px-3 py-2 border rounded-lg"
                        placeholder="-"
                      />
                      <span className="text-sm">°C</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
                  <Info className="w-4 h-4 text-blue-600 mt-0.5" />
                  <p className="text-xs text-blue-700">
                    온도 기준을 설정하면 검사 시 기준 범위가 표시됩니다.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 빠른 선택 */}
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <h3 className="font-medium text-gray-900 mb-4">빠른 선택</h3>
            <div className="space-y-2">
              <button
                onClick={() => {
                  const allChecks: Record<string, boolean> = {};
                  Object.keys(ALL_CHECK_ITEMS).forEach(key => {
                    const item = ALL_CHECK_ITEMS[key];
                    if (item.category === 'common' || item.category === activeTab || item.category === 'document') {
                      allChecks[key] = true;
                    }
                  });
                  updateStandard({ required_checks: allChecks });
                }}
                className="w-full px-4 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
              >
                모든 해당 항목 선택
              </button>
              <button
                onClick={() => {
                  updateStandard({ required_checks: {} });
                }}
                className="w-full px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                모두 해제
              </button>
              <button
                onClick={() => {
                  // 기본 필수 항목만 선택
                  const defaultChecks: Record<string, boolean> = {
                    appearance_check: true,
                    packaging_check: true,
                    label_check: true,
                    expiry_check: true,
                    document_check: true,
                    foreign_matter_check: true,
                    weight_check: true,
                  };
                  if (activeTab === '원료') {
                    defaultChecks.temp_check = true;
                    defaultChecks.odor_check = true;
                    defaultChecks.freshness_check = true;
                  } else if (activeTab === '포장재') {
                    defaultChecks.packaging_integrity_check = true;
                    defaultChecks.printing_check = true;
                    defaultChecks.specification_check = true;
                  }
                  updateStandard({ required_checks: defaultChecks });
                }}
                className="w-full px-4 py-2 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
              >
                권장 항목 선택
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
