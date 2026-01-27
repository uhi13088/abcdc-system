'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Package, Clock, Users, CheckCircle, XCircle } from 'lucide-react';

interface SemiProduct {
  id: string;
  lotNumber: string;
  productCode: string;
  productName: string;
  productionDate: string;
  inputMaterials: Array<{
    materialCode: string;
    materialName: string;
    materialLot: string;
    quantity: number;
    unit: string;
  }>;
  production: {
    process: string;
    plannedQty: number;
    actualQty: number;
    unit: string;
    yield: number;
    startTime: string;
    endTime: string;
    workers: string[];
  };
  quality: {
    appearance: 'NORMAL' | 'ABNORMAL';
    texture: 'NORMAL' | 'ABNORMAL';
    color: 'NORMAL' | 'ABNORMAL';
    sampleTest: boolean;
    testResult: 'PASS' | 'FAIL' | null;
    inspectedBy: string;
  };
  storage: {
    location: string;
    temperature: number | null;
    storageCondition: string;
    storedAt: string;
  };
  usage: {
    used: number;
    remaining: number;
    usedFor: string[];
  };
  createdAt: string;
}

export default function SemiProductsPage() {
  const [semiProducts, setSemiProducts] = useState<SemiProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const [formData, setFormData] = useState<{
    product_code: string;
    product_name: string;
    production_date: string;
    production: {
      process: string;
      planned_qty: number;
      actual_qty: number;
      unit: string;
      start_time: string;
      end_time: string;
    };
    quality: {
      appearance: 'NORMAL' | 'ABNORMAL';
      texture: 'NORMAL' | 'ABNORMAL';
      color: 'NORMAL' | 'ABNORMAL';
    };
    storage: {
      location: string;
      temperature: number | null;
      storage_condition: string;
    };
  }>({
    product_code: '',
    product_name: '',
    production_date: new Date().toISOString().split('T')[0],
    production: {
      process: '',
      planned_qty: 0,
      actual_qty: 0,
      unit: 'kg',
      start_time: '',
      end_time: '',
    },
    quality: {
      appearance: 'NORMAL',
      texture: 'NORMAL',
      color: 'NORMAL',
    },
    storage: {
      location: '',
      temperature: null,
      storage_condition: '',
    },
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/haccp/semi-products');
      const result = await response.json();

      if (result.success && result.data) {
        setSemiProducts(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch semi-products:', error);
    } finally {
      setLoading(false);
    }
  };

  // 반제품코드 자동 생성 함수
  const generateSemiProductCode = () => {
    const prefix = 'SP'; // Semi Product
    const existingCodes = semiProducts
      .filter(p => p.productCode?.startsWith(prefix))
      .map(p => {
        const num = parseInt(p.productCode.replace(prefix + '-', ''));
        return isNaN(num) ? 0 : num;
      });
    const nextNum = existingCodes.length > 0 ? Math.max(...existingCodes) + 1 : 1;
    const newCode = `${prefix}-${String(nextNum).padStart(3, '0')}`;
    setFormData(prev => ({ ...prev, product_code: newCode }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const response = await fetch('/api/haccp/semi-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '반제품 등록에 실패했습니다.');
      }

      setShowAddModal(false);
      setFormData({
        product_code: '',
        product_name: '',
        production_date: new Date().toISOString().split('T')[0],
        production: {
          process: '',
          planned_qty: 0,
          actual_qty: 0,
          unit: 'kg',
          start_time: '',
          end_time: '',
        },
        quality: {
          appearance: 'NORMAL',
          texture: 'NORMAL',
          color: 'NORMAL',
        },
        storage: {
          location: '',
          temperature: null,
          storage_condition: '',
        },
      });
      fetchData();
    } catch (error) {
      console.error('Failed to create semi-product:', error);
      alert(error instanceof Error ? error.message : '반제품 등록에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProducts = semiProducts.filter(
    (product) =>
      product.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.lotNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.productCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const todayProducts = filteredProducts.filter(p => p.productionDate === selectedDate);
  const totalProduced = todayProducts.reduce((sum, p) => sum + p.production.actualQty, 0);
  const avgYield = todayProducts.length > 0
    ? Math.round(todayProducts.reduce((sum, p) => sum + p.production.yield, 0) / todayProducts.length)
    : 0;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">반제품 관리</h1>
          <p className="text-sm text-gray-500 mt-1">중간 공정 제품의 생산 및 사용 현황을 관리합니다</p>
        </div>
        <button
          onClick={() => {
            generateSemiProductCode();
            setShowAddModal(true);
          }}
          className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
        >
          <Plus className="w-5 h-5 mr-2" />
          반제품 등록
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">오늘 생산</p>
              <p className="text-2xl font-bold text-gray-900">{todayProducts.length}건</p>
            </div>
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">총 생산량</p>
              <p className="text-2xl font-bold text-gray-900">{totalProduced}</p>
            </div>
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">평균 수율</p>
              <p className="text-2xl font-bold text-gray-900">{avgYield}%</p>
            </div>
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
              <Clock className="w-5 h-5 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">재고 보유</p>
              <p className="text-2xl font-bold text-gray-900">
                {semiProducts.filter(p => p.usage.remaining > 0).length}종
              </p>
            </div>
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
              <Package className="w-5 h-5 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="반제품명, LOT번호, 제품코드 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </div>
          <div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Semi-products List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
      <div className="space-y-4">
        {filteredProducts.map((product) => (
          <div
            key={product.id}
            className="bg-white rounded-lg border border-gray-200 overflow-hidden"
          >
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mr-4">
                    <Package className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{product.productName}</h3>
                    <p className="text-sm text-gray-500">
                      {product.lotNumber} | {product.productCode}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {product.quality.testResult === 'PASS' ? (
                    <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full flex items-center">
                      <CheckCircle className="w-4 h-4 mr-1" />
                      적합
                    </span>
                  ) : product.quality.testResult === 'FAIL' ? (
                    <span className="px-3 py-1 bg-red-100 text-red-700 text-sm font-medium rounded-full flex items-center">
                      <XCircle className="w-4 h-4 mr-1" />
                      부적합
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-gray-100 text-gray-600 text-sm font-medium rounded-full">
                      검사 대기
                    </span>
                  )}
                  {product.usage.remaining > 0 ? (
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-full">
                      재고 있음
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-gray-100 text-gray-600 text-sm font-medium rounded-full">
                      소진
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Production Info */}
              <div>
                <p className="text-xs text-gray-500 mb-1">생산 정보</p>
                <p className="text-sm font-medium">{product.production.process}</p>
                <p className="text-sm text-gray-600">
                  생산량: {product.production.actualQty}{product.production.unit}
                  (수율 {product.production.yield}%)
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {product.production.startTime} - {product.production.endTime}
                </p>
              </div>

              {/* Input Materials */}
              <div>
                <p className="text-xs text-gray-500 mb-1">투입 원료</p>
                <div className="space-y-1">
                  {product.inputMaterials.slice(0, 2).map((material, idx) => (
                    <p key={idx} className="text-sm text-gray-600">
                      {material.materialName} {material.quantity}{material.unit}
                    </p>
                  ))}
                  {product.inputMaterials.length > 2 && (
                    <p className="text-xs text-gray-400">
                      +{product.inputMaterials.length - 2}개 더
                    </p>
                  )}
                </div>
              </div>

              {/* Storage Info */}
              <div>
                <p className="text-xs text-gray-500 mb-1">보관 정보</p>
                <p className="text-sm font-medium">{product.storage.location}</p>
                <p className="text-sm text-gray-600">
                  {product.storage.temperature !== null && `${product.storage.temperature}°C`}
                </p>
                <p className="text-xs text-gray-500">{product.storage.storageCondition}</p>
              </div>

              {/* Usage Info */}
              <div>
                <p className="text-xs text-gray-500 mb-1">사용 현황</p>
                <div className="flex items-center mb-1">
                  <div className="flex-1 bg-gray-200 rounded-full h-2 mr-2">
                    <div
                      className="bg-primary rounded-full h-2"
                      style={{
                        width: `${(product.usage.used / (product.usage.used + product.usage.remaining)) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium">
                    {product.usage.remaining}{product.production.unit}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  사용: {product.usage.used} / 잔량: {product.usage.remaining}
                </p>
                {product.usage.usedFor.length > 0 && (
                  <p className="text-xs text-gray-400 mt-1">
                    용도: {product.usage.usedFor.join(', ')}
                  </p>
                )}
              </div>
            </div>

            {/* Workers */}
            <div className="px-4 pb-4">
              <div className="flex items-center text-sm text-gray-500">
                <Users className="w-4 h-4 mr-1" />
                작업자: {product.production.workers.join(', ')}
                {product.quality.inspectedBy && (
                  <span className="ml-4">| 검사자: {product.quality.inspectedBy}</span>
                )}
              </div>
            </div>
          </div>
        ))}

        {filteredProducts.length === 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">등록된 반제품이 없습니다.</p>
          </div>
        )}
      </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">반제품 등록</h2>
              <p className="text-sm text-gray-500 mt-1">새로운 반제품 생산 기록을 등록합니다</p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Basic Info */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3">기본 정보</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">제품 코드</label>
                    <input
                      type="text"
                      placeholder="SP001"
                      value={formData.product_code}
                      onChange={(e) => setFormData({ ...formData, product_code: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">제품명</label>
                    <input
                      type="text"
                      placeholder="양념장 베이스"
                      value={formData.product_name}
                      onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">LOT 번호</label>
                    <input
                      type="text"
                      placeholder="자동 생성"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                      disabled
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">생산일</label>
                    <input
                      type="date"
                      value={formData.production_date}
                      onChange={(e) => setFormData({ ...formData, production_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Production Info */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3">생산 정보</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">공정명</label>
                    <input
                      type="text"
                      placeholder="혼합/숙성"
                      value={formData.production.process}
                      onChange={(e) => setFormData({ ...formData, production: { ...formData.production, process: e.target.value } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">단위</label>
                    <select
                      value={formData.production.unit}
                      onChange={(e) => setFormData({ ...formData, production: { ...formData.production, unit: e.target.value } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value="kg">kg</option>
                      <option value="L">L</option>
                      <option value="개">개</option>
                      <option value="팩">팩</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">계획 수량</label>
                    <input
                      type="number"
                      placeholder="50"
                      value={formData.production.planned_qty || ''}
                      onChange={(e) => setFormData({ ...formData, production: { ...formData.production, planned_qty: parseFloat(e.target.value) || 0 } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">실제 수량</label>
                    <input
                      type="number"
                      placeholder="48"
                      value={formData.production.actual_qty || ''}
                      onChange={(e) => setFormData({ ...formData, production: { ...formData.production, actual_qty: parseFloat(e.target.value) || 0 } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">시작 시간</label>
                    <input
                      type="time"
                      value={formData.production.start_time}
                      onChange={(e) => setFormData({ ...formData, production: { ...formData.production, start_time: e.target.value } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">종료 시간</label>
                    <input
                      type="time"
                      value={formData.production.end_time}
                      onChange={(e) => setFormData({ ...formData, production: { ...formData.production, end_time: e.target.value } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Quality Check */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3">품질 검사</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">외관</label>
                    <select
                      value={formData.quality.appearance}
                      onChange={(e) => setFormData({ ...formData, quality: { ...formData.quality, appearance: e.target.value as 'NORMAL' | 'ABNORMAL' } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value="NORMAL">정상</option>
                      <option value="ABNORMAL">이상</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">질감</label>
                    <select
                      value={formData.quality.texture}
                      onChange={(e) => setFormData({ ...formData, quality: { ...formData.quality, texture: e.target.value as 'NORMAL' | 'ABNORMAL' } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value="NORMAL">정상</option>
                      <option value="ABNORMAL">이상</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">색상</label>
                    <select
                      value={formData.quality.color}
                      onChange={(e) => setFormData({ ...formData, quality: { ...formData.quality, color: e.target.value as 'NORMAL' | 'ABNORMAL' } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value="NORMAL">정상</option>
                      <option value="ABNORMAL">이상</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Storage Info */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3">보관 정보</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">보관 위치</label>
                    <input
                      type="text"
                      placeholder="냉장고 A-1"
                      value={formData.storage.location}
                      onChange={(e) => setFormData({ ...formData, storage: { ...formData.storage, location: e.target.value } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">보관 온도 (°C)</label>
                    <input
                      type="number"
                      placeholder="4"
                      value={formData.storage.temperature ?? ''}
                      onChange={(e) => setFormData({ ...formData, storage: { ...formData.storage, temperature: e.target.value ? parseFloat(e.target.value) : null } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm text-gray-600 mb-1">보관 조건</label>
                    <input
                      type="text"
                      placeholder="냉장 보관 (0-10°C)"
                      value={formData.storage.storage_condition}
                      onChange={(e) => setFormData({ ...formData, storage: { ...formData.storage, storage_condition: e.target.value } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  disabled={submitting}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  disabled={submitting}
                >
                  {submitting ? '등록 중...' : '등록'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
