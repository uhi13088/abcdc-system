'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Calendar, CheckCircle, XCircle, AlertCircle, ClipboardCheck, Settings, RefreshCw, Filter, Eye } from 'lucide-react';
import { Label } from '@/components/ui/label';
import Link from 'next/link';

// 검사 항목 정의
const ALL_CHECK_ITEMS = {
  // 공통 항목
  appearance_check: { label: '외관검사', short: '외', category: 'common', description: '제품 외관 상태 확인' },
  packaging_check: { label: '포장상태', short: '포', category: 'common', description: '포장 파손/오염 확인' },
  label_check: { label: '표시사항', short: '표', category: 'common', description: '라벨 표시 정확성 확인' },
  temp_check: { label: '온도검사', short: '온', category: 'common', description: '입고 온도 측정' },
  expiry_check: { label: '유통기한', short: '기', category: 'common', description: '유통기한 확인' },
  document_check: { label: '서류확인', short: '서', category: 'common', description: '거래명세서/성적서 확인' },
  foreign_matter_check: { label: '이물혼입', short: '이', category: 'common', description: '이물질 혼입 여부' },
  odor_check: { label: '이취/변질', short: '취', category: 'common', description: '이취/변질 여부' },
  weight_check: { label: '중량확인', short: '중', category: 'common', description: '수량/중량 일치 확인' },
  sensory_check: { label: '관능검사', short: '관', category: 'common', description: '색상/형태/냄새 등' },

  // 원료 전용
  freshness_check: { label: '신선도', short: '신', category: '원료', description: '신선도 확인' },
  color_check: { label: '색상', short: '색', category: '원료', description: '색상 정상 여부' },
  texture_check: { label: '질감', short: '질', category: '원료', description: '질감 정상 여부' },

  // 포장재 전용
  packaging_integrity_check: { label: '완전성', short: '완', category: '포장재', description: '포장재 완전성' },
  printing_check: { label: '인쇄상태', short: '인', category: '포장재', description: '인쇄 상태 확인' },
  specification_check: { label: '규격확인', short: '규', category: '포장재', description: '규격 일치 확인' },

  // 서류 관련
  test_report_check: { label: '시험성적서', short: '성', category: 'document', description: '시험성적서 확인' },
  certificate_check: { label: '인증서', short: '인', category: 'document', description: '인증서 확인' },
};

type CheckItemKey = keyof typeof ALL_CHECK_ITEMS;

interface InspectionStandard {
  id: string;
  material_type: '원료' | '부재료' | '포장재';
  required_checks: Record<string, boolean>;
  default_temp_min: number | null;
  default_temp_max: number | null;
  pass_threshold: number;
  conditional_threshold: number;
}

interface MaterialInspection {
  id: string;
  inspection_date: string;
  inspected_by_name?: string;
  material_id: string;
  material_name?: string;
  material_code?: string;
  material_type?: '원료' | '부재료' | '포장재';
  material_storage_temp?: string;
  supplier_name?: string;
  lot_number: string;
  quantity: number;
  unit: string;
  expiry_date?: string;
  manufacture_date?: string;
  received_quantity?: number;
  accepted_quantity?: number;
  rejected_quantity?: number;
  invoice_number?: string;
  storage_location?: string;
  // 검사 항목들
  appearance_check: boolean;
  packaging_check: boolean;
  label_check: boolean;
  temp_check: { value: number; passed: boolean } | null;
  expiry_check: boolean;
  document_check: boolean;
  foreign_matter_check?: boolean;
  odor_check?: boolean;
  weight_check?: boolean;
  sensory_check?: boolean;
  freshness_check?: boolean;
  color_check?: boolean;
  texture_check?: boolean;
  packaging_integrity_check?: boolean;
  printing_check?: boolean;
  specification_check?: boolean;
  test_report_check?: boolean;
  certificate_check?: boolean;
  // 결과
  overall_result: 'PASS' | 'FAIL' | 'CONDITIONAL';
  rejection_reason?: string;
  corrective_action?: string;
  remarks?: string;
  verified_by_name?: string;
  verified_at?: string;
}

interface Material {
  id: string;
  name: string;
  code: string;
  type: '원료' | '부재료' | '포장재';
  supplier_id: string;
  storage_temp?: string;
}

interface Supplier {
  id: string;
  name: string;
}

const initialFormData = {
  material_id: '',
  supplier_id: '',
  lot_number: '',
  quantity: 0,
  unit: 'kg',
  expiry_date: '',
  manufacture_date: '',
  received_quantity: 0,
  accepted_quantity: 0,
  rejected_quantity: 0,
  invoice_number: '',
  storage_location: '',
  // 검사 항목들
  appearance_check: false,
  packaging_check: false,
  label_check: false,
  temp_check: { value: 0, passed: false },
  expiry_check: false,
  document_check: false,
  foreign_matter_check: false,
  odor_check: false,
  weight_check: false,
  sensory_check: false,
  freshness_check: false,
  color_check: false,
  texture_check: false,
  packaging_integrity_check: false,
  printing_check: false,
  specification_check: false,
  test_report_check: false,
  certificate_check: false,
  // 기타
  rejection_reason: '',
  corrective_action: '',
  remarks: '',
};

export default function InspectionsPage() {
  const [inspections, setInspections] = useState<MaterialInspection[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [standards, setStandards] = useState<InspectionStandard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState<MaterialInspection | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterType, setFilterType] = useState<string>('');
  const [filterResult, setFilterResult] = useState<string>('');
  const [formData, setFormData] = useState(initialFormData);
  const [selectedMaterialType, setSelectedMaterialType] = useState<'원료' | '부재료' | '포장재' | null>(null);

  // 데이터 로드
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [inspectionsRes, materialsRes, suppliersRes, standardsRes] = await Promise.all([
        fetch(`/api/haccp/inspections?date=${selectedDate}${filterType ? `&material_type=${filterType}` : ''}${filterResult ? `&result=${filterResult}` : ''}`),
        fetch('/api/haccp/materials'),
        fetch('/api/haccp/suppliers'),
        fetch('/api/haccp/inspections/standards'),
      ]);

      if (inspectionsRes.ok) {
        const data = await inspectionsRes.json();
        setInspections(data);
      }
      if (materialsRes.ok) {
        const data = await materialsRes.json();
        setMaterials(data);
      }
      if (suppliersRes.ok) {
        const data = await suppliersRes.json();
        setSuppliers(data);
      }
      if (standardsRes.ok) {
        const data = await standardsRes.json();
        setStandards(data);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, filterType, filterResult]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 선택한 원부재료에 따른 검사 기준 가져오기
  const getStandardForMaterial = (materialType: string | null): InspectionStandard | undefined => {
    return standards.find(s => s.material_type === materialType);
  };

  // 원부재료 선택 시 타입 설정
  const handleMaterialChange = (materialId: string) => {
    const material = materials.find(m => m.id === materialId);
    setFormData({ ...formData, material_id: materialId });
    if (material) {
      setSelectedMaterialType(material.type);
      // 공급업체 자동 설정
      if (material.supplier_id) {
        setFormData(prev => ({ ...prev, material_id: materialId, supplier_id: material.supplier_id }));
      }
    } else {
      setSelectedMaterialType(null);
    }
  };

  // 검사 결과 자동 계산
  const calculateResult = (): 'PASS' | 'FAIL' | 'CONDITIONAL' => {
    if (!selectedMaterialType) return 'PASS';

    const standard = getStandardForMaterial(selectedMaterialType);
    if (!standard) return 'PASS';

    const requiredChecks = standard.required_checks;
    let passCount = 0;
    let totalRequired = 0;

    Object.keys(requiredChecks).forEach(key => {
      if (requiredChecks[key]) {
        totalRequired++;
        if (key === 'temp_check') {
          if (formData.temp_check.passed) passCount++;
        } else {
          const fieldKey = key as keyof typeof formData;
          if (formData[fieldKey] === true) passCount++;
        }
      }
    });

    if (passCount === totalRequired || passCount >= standard.pass_threshold) {
      return 'PASS';
    } else if (passCount >= standard.conditional_threshold) {
      return 'CONDITIONAL';
    }
    return 'FAIL';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const overall_result = calculateResult();

    try {
      const response = await fetch('/api/haccp/inspections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inspection_date: selectedDate,
          ...formData,
          overall_result,
        }),
      });

      if (response.ok) {
        setShowModal(false);
        fetchData();
        setFormData(initialFormData);
        setSelectedMaterialType(null);
      }
    } catch (error) {
      console.error('Failed to create inspection:', error);
    }
  };

  // 검증 처리
  const handleVerify = async (id: string) => {
    try {
      const response = await fetch('/api/haccp/inspections', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, verify: true }),
      });

      if (response.ok) {
        fetchData();
        setShowDetailModal(false);
      }
    } catch (error) {
      console.error('Failed to verify inspection:', error);
    }
  };

  const resultColors = {
    'PASS': 'bg-green-100 text-green-700 border-green-200',
    'FAIL': 'bg-red-100 text-red-700 border-red-200',
    'CONDITIONAL': 'bg-yellow-100 text-yellow-700 border-yellow-200',
  };

  const resultText = {
    'PASS': '적합',
    'FAIL': '부적합',
    'CONDITIONAL': '조건부',
  };

  const resultIcons = {
    'PASS': CheckCircle,
    'FAIL': XCircle,
    'CONDITIONAL': AlertCircle,
  };

  const materialTypeColors = {
    '원료': 'bg-blue-100 text-blue-700',
    '부재료': 'bg-purple-100 text-purple-700',
    '포장재': 'bg-amber-100 text-amber-700',
  };

  // 현재 선택된 재료 타입에 따른 필수 검사 항목
  const currentStandard = getStandardForMaterial(selectedMaterialType);
  const requiredChecks = currentStandard?.required_checks || {};

  // 검사 항목 렌더링 (필수 항목만)
  const renderCheckItems = () => {
    if (!selectedMaterialType || !currentStandard) {
      return (
        <div className="text-center py-8 text-gray-500">
          원부재료를 선택하면 검사 항목이 표시됩니다
        </div>
      );
    }

    const items = Object.entries(ALL_CHECK_ITEMS)
      .filter(([key]) => requiredChecks[key])
      .sort((a, b) => a[1].label.localeCompare(b[1].label));

    return (
      <div className="space-y-4">
        {/* 일반 체크 항목 */}
        <div className="grid grid-cols-2 gap-3">
          {items.filter(([key]) => key !== 'temp_check').map(([key, item]) => (
            <label key={key} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50">
              <input
                type="checkbox"
                checked={formData[key as keyof typeof formData] === true}
                onChange={(e) => setFormData({ ...formData, [key]: e.target.checked })}
                className="rounded w-5 h-5"
              />
              <div>
                <span className="text-sm font-medium">{item.label}</span>
                <p className="text-xs text-gray-500">{item.description}</p>
              </div>
            </label>
          ))}
        </div>

        {/* 온도 검사 (별도 처리) */}
        {requiredChecks.temp_check && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.temp_check.passed}
                  onChange={(e) => setFormData({
                    ...formData,
                    temp_check: { ...formData.temp_check, passed: e.target.checked }
                  })}
                  className="rounded w-5 h-5"
                />
                <span className="font-medium">온도검사</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.1"
                  value={formData.temp_check.value}
                  onChange={(e) => setFormData({
                    ...formData,
                    temp_check: { ...formData.temp_check, value: parseFloat(e.target.value) || 0 }
                  })}
                  className="w-24 px-3 py-1 border rounded text-sm"
                  placeholder="온도"
                />
                <span className="text-sm text-gray-500">°C</span>
              </div>
              {currentStandard?.default_temp_min !== null && currentStandard?.default_temp_max !== null && (
                <span className="text-xs text-blue-600">
                  기준: {currentStandard.default_temp_min}°C ~ {currentStandard.default_temp_max}°C
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // 검사 결과 표시
  const renderCheckBadges = (inspection: MaterialInspection) => {
    const standard = getStandardForMaterial(inspection.material_type || null);
    if (!standard) return null;

    const checks = Object.entries(ALL_CHECK_ITEMS)
      .filter(([key]) => standard.required_checks[key])
      .slice(0, 8); // 최대 8개만 표시

    return (
      <div className="flex gap-1 flex-wrap">
        {checks.map(([key, item]) => {
          let passed = false;
          if (key === 'temp_check') {
            passed = inspection.temp_check?.passed || false;
          } else {
            passed = inspection[key as keyof MaterialInspection] === true;
          }
          return (
            <span
              key={key}
              className={`w-6 h-6 flex items-center justify-center rounded text-xs font-medium ${
                passed ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
              }`}
              title={item.label}
            >
              {item.short}
            </span>
          );
        })}
        {Object.keys(standard.required_checks).filter(k => standard.required_checks[k]).length > 8 && (
          <span className="text-xs text-gray-500">+{Object.keys(standard.required_checks).filter(k => standard.required_checks[k]).length - 8}</span>
        )}
      </div>
    );
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">원·부재료 입고검사</h1>
          <p className="mt-1 text-sm text-gray-500">원부재료 및 포장재 육안검사 기록을 관리합니다</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => fetchData()}
            className="inline-flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-gray-50"
            title="새로고침"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link
            href="/inspections/settings"
            className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            <Settings className="w-4 h-4" />
            검사기준 설정
          </Link>
          <button
            onClick={() => {
              setFormData(initialFormData);
              setSelectedMaterialType(null);
              setShowModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            검사 기록
          </button>
        </div>
      </div>

      {/* 필터 */}
      <div className="mb-6 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-gray-400" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border rounded-lg"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            <option value="">전체 유형</option>
            <option value="원료">원료</option>
            <option value="부재료">부재료</option>
            <option value="포장재">포장재</option>
          </select>
          <select
            value={filterResult}
            onChange={(e) => setFilterResult(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            <option value="">전체 결과</option>
            <option value="PASS">적합</option>
            <option value="CONDITIONAL">조건부</option>
            <option value="FAIL">부적합</option>
          </select>
        </div>
        {/* 요약 통계 */}
        <div className="ml-auto flex gap-3 text-sm">
          <span className="px-2 py-1 bg-gray-100 rounded">
            전체: <strong>{inspections.length}</strong>건
          </span>
          <span className="px-2 py-1 bg-green-100 text-green-700 rounded">
            적합: <strong>{inspections.filter(i => i.overall_result === 'PASS').length}</strong>
          </span>
          <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded">
            조건부: <strong>{inspections.filter(i => i.overall_result === 'CONDITIONAL').length}</strong>
          </span>
          <span className="px-2 py-1 bg-red-100 text-red-700 rounded">
            부적합: <strong>{inspections.filter(i => i.overall_result === 'FAIL').length}</strong>
          </span>
        </div>
      </div>

      {/* 검사 기록 목록 */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : inspections.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <ClipboardCheck className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">해당 날짜의 입고검사 기록이 없습니다</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">유형</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">원부재료</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">공급업체</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">LOT/수량</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">유통기한</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">검사항목</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">결과</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">검사자</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">상세</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {inspections.map((inspection) => {
                const ResultIcon = resultIcons[inspection.overall_result];
                return (
                  <tr key={inspection.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${materialTypeColors[inspection.material_type || '원료']}`}>
                        {inspection.material_type || '원료'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-sm">{inspection.material_name}</div>
                      <div className="text-xs text-gray-500">{inspection.material_code}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{inspection.supplier_name || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-mono">{inspection.lot_number}</div>
                      <div className="text-xs text-gray-500">{inspection.quantity} {inspection.unit}</div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {inspection.expiry_date || '-'}
                    </td>
                    <td className="px-4 py-3">
                      {renderCheckBadges(inspection)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full border ${resultColors[inspection.overall_result]}`}>
                        <ResultIcon className="w-3 h-3" />
                        {resultText[inspection.overall_result]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">{inspection.inspected_by_name || '-'}</div>
                      {inspection.verified_by_name && (
                        <div className="text-xs text-green-600">✓ {inspection.verified_by_name}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => {
                          setSelectedInspection(inspection);
                          setShowDetailModal(true);
                        }}
                        className="p-1 text-gray-400 hover:text-blue-600"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 입고검사 등록 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-3xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold">입고검사 기록</h2>
                {selectedMaterialType && (
                  <p className="text-sm text-gray-500 mt-1">
                    <span className={`px-2 py-0.5 rounded text-xs ${materialTypeColors[selectedMaterialType]}`}>
                      {selectedMaterialType}
                    </span>
                    {' '}검사 양식
                  </p>
                )}
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                닫기
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 기본 정보 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label required>원부재료</Label>
                  <select
                    value={formData.material_id}
                    onChange={(e) => handleMaterialChange(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  >
                    <option value="">선택하세요</option>
                    {materials.map(m => (
                      <option key={m.id} value={m.id}>
                        [{m.type}] {m.name} ({m.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label>공급업체</Label>
                  <select
                    value={formData.supplier_id}
                    onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="">선택하세요</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 입고 정보 */}
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <Label required>LOT 번호</Label>
                  <input
                    type="text"
                    value={formData.lot_number}
                    onChange={(e) => setFormData({ ...formData, lot_number: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <Label>입고수량</Label>
                  <input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <Label>단위</Label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="ea">ea</option>
                    <option value="box">box</option>
                    <option value="L">L</option>
                    <option value="mL">mL</option>
                  </select>
                </div>
                <div>
                  <Label>거래명세서 번호</Label>
                  <input
                    type="text"
                    value={formData.invoice_number}
                    onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              {/* 날짜 정보 */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>제조일자</Label>
                  <input
                    type="date"
                    value={formData.manufacture_date}
                    onChange={(e) => setFormData({ ...formData, manufacture_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <Label>유통기한</Label>
                  <input
                    type="date"
                    value={formData.expiry_date}
                    onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <Label>보관위치</Label>
                  <input
                    type="text"
                    value={formData.storage_location}
                    onChange={(e) => setFormData({ ...formData, storage_location: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="예: 냉장고 A-1"
                  />
                </div>
              </div>

              {/* 검사 항목 */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-4">검사 항목</h4>
                {renderCheckItems()}
              </div>

              {/* 검사 결과 미리보기 */}
              {selectedMaterialType && (
                <div className="bg-gray-100 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">예상 검사 결과</span>
                    <span className={`px-3 py-1 rounded-full text-sm border ${resultColors[calculateResult()]}`}>
                      {resultText[calculateResult()]}
                    </span>
                  </div>
                </div>
              )}

              {/* 부적합 시 조치사항 */}
              {calculateResult() !== 'PASS' && (
                <div className="space-y-4 p-4 bg-red-50 rounded-lg">
                  <div>
                    <Label>부적합 사유</Label>
                    <textarea
                      value={formData.rejection_reason}
                      onChange={(e) => setFormData({ ...formData, rejection_reason: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                      rows={2}
                      placeholder="부적합 판정 사유를 입력하세요"
                    />
                  </div>
                  <div>
                    <Label>개선조치</Label>
                    <textarea
                      value={formData.corrective_action}
                      onChange={(e) => setFormData({ ...formData, corrective_action: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                      rows={2}
                      placeholder="조치 내용을 입력하세요 (반품, 폐기, 조건부 사용 등)"
                    />
                  </div>
                </div>
              )}

              {/* 비고 */}
              <div>
                <Label>비고</Label>
                <textarea
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                  placeholder="특이사항이 있으면 입력하세요"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">
                  취소
                </button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 상세 보기 모달 */}
      {showDetailModal && selectedInspection && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">입고검사 상세</h2>
              <button onClick={() => setShowDetailModal(false)} className="text-gray-500 hover:text-gray-700">
                닫기
              </button>
            </div>

            <div className="space-y-6">
              {/* 기본 정보 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">원부재료</p>
                  <p className="font-medium">{selectedInspection.material_name}</p>
                  <p className="text-xs text-gray-400">{selectedInspection.material_code}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">유형</p>
                  <span className={`px-2 py-1 text-xs rounded-full ${materialTypeColors[selectedInspection.material_type || '원료']}`}>
                    {selectedInspection.material_type || '원료'}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">공급업체</p>
                  <p className="font-medium">{selectedInspection.supplier_name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">LOT 번호</p>
                  <p className="font-mono">{selectedInspection.lot_number}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">수량</p>
                  <p>{selectedInspection.quantity} {selectedInspection.unit}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">유통기한</p>
                  <p>{selectedInspection.expiry_date || '-'}</p>
                </div>
              </div>

              {/* 검사 결과 */}
              <div className={`p-4 rounded-lg border ${resultColors[selectedInspection.overall_result]}`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">검사 결과</span>
                  <span className="text-lg font-bold">{resultText[selectedInspection.overall_result]}</span>
                </div>
              </div>

              {/* 검사 항목 상세 */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium mb-3">검사 항목</h4>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(ALL_CHECK_ITEMS).map(([key, item]) => {
                    let value: boolean | undefined;
                    if (key === 'temp_check') {
                      value = selectedInspection.temp_check?.passed;
                    } else {
                      value = selectedInspection[key as keyof MaterialInspection] as boolean | undefined;
                    }
                    if (value === undefined) return null;

                    return (
                      <div key={key} className={`p-2 rounded text-sm ${value ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {item.label}: {value ? '적합' : '부적합'}
                        {key === 'temp_check' && selectedInspection.temp_check && (
                          <span className="ml-1">({selectedInspection.temp_check.value}°C)</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 부적합 사유/조치 */}
              {selectedInspection.rejection_reason && (
                <div className="bg-red-50 rounded-lg p-4">
                  <h4 className="font-medium text-red-800 mb-2">부적합 사유</h4>
                  <p className="text-sm text-red-700">{selectedInspection.rejection_reason}</p>
                </div>
              )}
              {selectedInspection.corrective_action && (
                <div className="bg-yellow-50 rounded-lg p-4">
                  <h4 className="font-medium text-yellow-800 mb-2">개선조치</h4>
                  <p className="text-sm text-yellow-700">{selectedInspection.corrective_action}</p>
                </div>
              )}

              {/* 검사자/검증자 정보 */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">검사자</p>
                  <p className="font-medium">{selectedInspection.inspected_by_name || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">검증자</p>
                  {selectedInspection.verified_by_name ? (
                    <p className="font-medium text-green-600">
                      ✓ {selectedInspection.verified_by_name}
                      <span className="text-xs text-gray-400 ml-2">
                        {selectedInspection.verified_at && new Date(selectedInspection.verified_at).toLocaleString()}
                      </span>
                    </p>
                  ) : (
                    <button
                      onClick={() => handleVerify(selectedInspection.id)}
                      className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                    >
                      검증하기
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t flex justify-end">
              <button onClick={() => setShowDetailModal(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
