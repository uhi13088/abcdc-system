'use client';

import { useState, useEffect } from 'react';
import {
  ArrowLeft, Plus, Save, Trash2, ThermometerSun, Droplets,
  CheckCircle2, Settings, Package
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import Link from 'next/link';

interface Product {
  id: string;
  name: string;
  code?: string;
}

interface ProductionStandard {
  id: string;
  product_id: string;
  product_name?: string;
  product_code?: string;
  temp_min: number;
  temp_max: number;
  humidity_min: number;
  humidity_max: number;
  quality_checks: Record<string, boolean>;
  pass_threshold: number;
  conditional_threshold: number;
  is_active: boolean;
}

const QUALITY_CHECK_LABELS: Record<string, string> = {
  appearance_check: '외관검사',
  weight_check: '중량검사',
  packaging_check: '포장상태',
  label_check: '라벨표시',
  metal_detection_check: '금속검출',
  taste_check: '맛검사',
  smell_check: '냄새검사',
  color_check: '색상검사',
};

const defaultQualityChecks: Record<string, boolean> = {
  appearance_check: true,
  weight_check: true,
  packaging_check: true,
  label_check: true,
  metal_detection_check: true,
  taste_check: false,
  smell_check: false,
  color_check: false,
};

export default function ProductionSettingsPage() {
  const [standards, setStandards] = useState<ProductionStandard[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStandard, setEditingStandard] = useState<ProductionStandard | null>(null);

  const [formData, setFormData] = useState({
    product_id: '',
    temp_min: 15,
    temp_max: 25,
    humidity_min: 40,
    humidity_max: 70,
    quality_checks: { ...defaultQualityChecks },
    pass_threshold: 5,
    conditional_threshold: 4,
  });

  useEffect(() => {
    fetchStandards();
    fetchProducts();
  }, []);

  const fetchStandards = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/haccp/production/standards');
      if (response.ok) {
        const data = await response.json();
        setStandards(data);
      }
    } catch (error) {
      console.error('Failed to fetch standards:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/haccp/products');
      if (response.ok) {
        const data = await response.json();
        setProducts(data);
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const url = '/api/haccp/production/standards';
      const method = editingStandard ? 'PUT' : 'POST';
      const body = editingStandard
        ? { id: editingStandard.id, ...formData }
        : formData;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        setShowAddModal(false);
        setEditingStandard(null);
        resetForm();
        fetchStandards();
      }
    } catch (error) {
      console.error('Failed to save standard:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 생산기준을 삭제하시겠습니까?')) return;

    try {
      const response = await fetch(`/api/haccp/production/standards?id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchStandards();
      }
    } catch (error) {
      console.error('Failed to delete standard:', error);
    }
  };

  const openEditModal = (standard: ProductionStandard) => {
    setEditingStandard(standard);
    setFormData({
      product_id: standard.product_id,
      temp_min: standard.temp_min,
      temp_max: standard.temp_max,
      humidity_min: standard.humidity_min,
      humidity_max: standard.humidity_max,
      quality_checks: standard.quality_checks || { ...defaultQualityChecks },
      pass_threshold: standard.pass_threshold,
      conditional_threshold: standard.conditional_threshold,
    });
    setShowAddModal(true);
  };

  const resetForm = () => {
    setFormData({
      product_id: '',
      temp_min: 15,
      temp_max: 25,
      humidity_min: 40,
      humidity_max: 70,
      quality_checks: { ...defaultQualityChecks },
      pass_threshold: 5,
      conditional_threshold: 4,
    });
  };

  const toggleQualityCheck = (key: string) => {
    setFormData({
      ...formData,
      quality_checks: {
        ...formData.quality_checks,
        [key]: !formData.quality_checks[key],
      },
    });
  };

  const requiredChecksCount = Object.values(formData.quality_checks).filter(Boolean).length;

  // 설정되지 않은 제품 목록
  const configuredProductIds = new Set(standards.map(s => s.product_id));
  const unconfiguredProducts = products.filter(p => !configuredProductIds.has(p.id));

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/production"
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">생산기준 설정</h1>
            <p className="mt-1 text-sm text-gray-500">
              제품별 생산조건 및 품질검사 기준을 설정합니다
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setEditingStandard(null);
            resetForm();
            setShowAddModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          기준 추가
        </button>
      </div>

      {/* Info Card */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-3">
          <Settings className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <p className="font-medium text-blue-900">생산기준 설정 안내</p>
            <ul className="mt-1 text-sm text-blue-700 list-disc list-inside">
              <li>제품별로 생산 온도/습도 기준을 설정할 수 있습니다</li>
              <li>품질검사 필수 항목을 선택하면 해당 항목을 기준으로 자동 평가됩니다</li>
              <li>합격 기준: 필수 항목 중 합격 수가 합격 임계값 이상이면 합격</li>
              <li>조건부합격: 합격 임계값 미만, 조건부 임계값 이상이면 조건부합격</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Standards List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : standards.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500 mb-4">설정된 생산기준이 없습니다</p>
          <button
            onClick={() => {
              resetForm();
              setShowAddModal(true);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            기준 추가하기
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {standards.map((standard) => (
            <div key={standard.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Package className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="font-medium">
                      {standard.product_name}
                      {standard.product_code && (
                        <span className="text-gray-500 ml-2">({standard.product_code})</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditModal(standard)}
                    className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-100"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => handleDelete(standard.id)}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* 온도 기준 */}
                <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
                  <ThermometerSun className="w-5 h-5 text-orange-600" />
                  <div>
                    <p className="text-xs text-orange-600">온도 기준</p>
                    <p className="font-medium">
                      {standard.temp_min}°C ~ {standard.temp_max}°C
                    </p>
                  </div>
                </div>

                {/* 습도 기준 */}
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                  <Droplets className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="text-xs text-blue-600">습도 기준</p>
                    <p className="font-medium">
                      {standard.humidity_min}% ~ {standard.humidity_max}%
                    </p>
                  </div>
                </div>

                {/* 합격 기준 */}
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="text-xs text-green-600">합격 기준</p>
                    <p className="font-medium">
                      {standard.pass_threshold}개 이상
                    </p>
                  </div>
                </div>

                {/* 조건부합격 기준 */}
                <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-yellow-600" />
                  <div>
                    <p className="text-xs text-yellow-600">조건부합격</p>
                    <p className="font-medium">
                      {standard.conditional_threshold}개 이상
                    </p>
                  </div>
                </div>
              </div>

              {/* 필수 검사 항목 */}
              <div className="px-4 pb-4">
                <p className="text-xs text-gray-500 mb-2">필수 검사 항목</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(QUALITY_CHECK_LABELS).map(([key, label]) => {
                    const isRequired = standard.quality_checks?.[key];
                    return (
                      <span
                        key={key}
                        className={`px-2 py-1 text-xs rounded-full ${
                          isRequired
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        {label}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">
                {editingStandard ? '생산기준 수정' : '생산기준 추가'}
              </h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingStandard(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                닫기
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
              {/* 제품 선택 */}
              <div>
                <Label required>제품</Label>
                <select
                  value={formData.product_id}
                  onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                  disabled={!!editingStandard}
                >
                  <option value="">선택하세요</option>
                  {editingStandard ? (
                    <option value={editingStandard.product_id}>
                      {editingStandard.product_name}
                    </option>
                  ) : (
                    unconfiguredProducts.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.code && `(${p.code})`}
                      </option>
                    ))
                  )}
                </select>
                {!editingStandard && unconfiguredProducts.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    모든 제품에 대한 기준이 이미 설정되어 있습니다
                  </p>
                )}
              </div>

              {/* 온도 기준 */}
              <div className="space-y-3">
                <h3 className="font-medium text-gray-900 border-b pb-2 flex items-center gap-2">
                  <ThermometerSun className="w-4 h-4 text-orange-500" />
                  온도 기준 (°C)
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>최저 온도</Label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.temp_min}
                      onChange={(e) => setFormData({ ...formData, temp_min: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <Label>최고 온도</Label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.temp_max}
                      onChange={(e) => setFormData({ ...formData, temp_max: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* 습도 기준 */}
              <div className="space-y-3">
                <h3 className="font-medium text-gray-900 border-b pb-2 flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-blue-500" />
                  습도 기준 (%)
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>최저 습도</Label>
                    <input
                      type="number"
                      step="1"
                      value={formData.humidity_min}
                      onChange={(e) => setFormData({ ...formData, humidity_min: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <Label>최고 습도</Label>
                    <input
                      type="number"
                      step="1"
                      value={formData.humidity_max}
                      onChange={(e) => setFormData({ ...formData, humidity_max: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* 품질검사 항목 */}
              <div className="space-y-3">
                <h3 className="font-medium text-gray-900 border-b pb-2 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  필수 품질검사 항목
                </h3>
                <p className="text-sm text-gray-500">
                  선택한 항목이 품질검사 시 필수 평가 항목으로 적용됩니다
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(QUALITY_CHECK_LABELS).map(([key, label]) => (
                    <label
                      key={key}
                      className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer ${
                        formData.quality_checks[key]
                          ? 'bg-blue-50 border-blue-300'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formData.quality_checks[key] || false}
                        onChange={() => toggleQualityCheck(key)}
                        className="w-5 h-5 rounded"
                      />
                      <span className="font-medium">{label}</span>
                    </label>
                  ))}
                </div>
                <p className="text-sm text-gray-600">
                  선택된 필수 항목: <span className="font-medium">{requiredChecksCount}개</span>
                </p>
              </div>

              {/* 합격 기준 */}
              <div className="space-y-3">
                <h3 className="font-medium text-gray-900 border-b pb-2">합격 기준</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>합격 임계값</Label>
                    <input
                      type="number"
                      value={formData.pass_threshold}
                      onChange={(e) => setFormData({ ...formData, pass_threshold: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg"
                      min={1}
                      max={requiredChecksCount}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      필수 항목 중 이 개수 이상 합격 시 &apos;합격&apos;
                    </p>
                  </div>
                  <div>
                    <Label>조건부합격 임계값</Label>
                    <input
                      type="number"
                      value={formData.conditional_threshold}
                      onChange={(e) => setFormData({ ...formData, conditional_threshold: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg"
                      min={1}
                      max={formData.pass_threshold - 1}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      이 개수 이상, 합격 임계값 미만 시 &apos;조건부합격&apos;
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingStandard(null);
                  }}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={saving || (!editingStandard && unconfiguredProducts.length === 0)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      저장중...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      저장
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
