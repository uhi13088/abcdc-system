'use client';

import { useState } from 'react';
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
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Mock data
  const semiProducts: SemiProduct[] = [
    {
      id: '1',
      lotNumber: 'SP-20260110-001',
      productCode: 'SP001',
      productName: '양념장 베이스',
      productionDate: '2026-01-10',
      inputMaterials: [
        { materialCode: 'M001', materialName: '고춧가루', materialLot: 'ML-001', quantity: 10, unit: 'kg' },
        { materialCode: 'M002', materialName: '마늘', materialLot: 'ML-002', quantity: 5, unit: 'kg' },
        { materialCode: 'M003', materialName: '간장', materialLot: 'ML-003', quantity: 20, unit: 'L' },
      ],
      production: {
        process: '혼합/숙성',
        plannedQty: 50,
        actualQty: 48,
        unit: 'kg',
        yield: 96,
        startTime: '09:00',
        endTime: '11:30',
        workers: ['김생산', '이품질'],
      },
      quality: {
        appearance: 'NORMAL',
        texture: 'NORMAL',
        color: 'NORMAL',
        sampleTest: true,
        testResult: 'PASS',
        inspectedBy: '박검사',
      },
      storage: {
        location: '냉장고 A-2',
        temperature: 4,
        storageCondition: '냉장 보관 (0-10°C)',
        storedAt: '2026-01-10T11:45:00',
      },
      usage: {
        used: 20,
        remaining: 28,
        usedFor: ['김치찌개용', '비빔밥용'],
      },
      createdAt: '2026-01-10T09:00:00',
    },
    {
      id: '2',
      lotNumber: 'SP-20260110-002',
      productCode: 'SP002',
      productName: '육수 원액',
      productionDate: '2026-01-10',
      inputMaterials: [
        { materialCode: 'M004', materialName: '사골', materialLot: 'ML-004', quantity: 30, unit: 'kg' },
        { materialCode: 'M005', materialName: '채소류', materialLot: 'ML-005', quantity: 10, unit: 'kg' },
      ],
      production: {
        process: '끓이기/여과',
        plannedQty: 100,
        actualQty: 95,
        unit: 'L',
        yield: 95,
        startTime: '06:00',
        endTime: '14:00',
        workers: ['최조리'],
      },
      quality: {
        appearance: 'NORMAL',
        texture: 'NORMAL',
        color: 'NORMAL',
        sampleTest: true,
        testResult: 'PASS',
        inspectedBy: '박검사',
      },
      storage: {
        location: '냉장고 B-1',
        temperature: 2,
        storageCondition: '냉장 보관 (0-5°C)',
        storedAt: '2026-01-10T14:30:00',
      },
      usage: {
        used: 50,
        remaining: 45,
        usedFor: ['설렁탕', '곰탕'],
      },
      createdAt: '2026-01-10T06:00:00',
    },
    {
      id: '3',
      lotNumber: 'SP-20260109-001',
      productCode: 'SP003',
      productName: '반죽 (밀가루)',
      productionDate: '2026-01-09',
      inputMaterials: [
        { materialCode: 'M006', materialName: '밀가루', materialLot: 'ML-006', quantity: 25, unit: 'kg' },
        { materialCode: 'M007', materialName: '물', materialLot: '-', quantity: 15, unit: 'L' },
        { materialCode: 'M008', materialName: '소금', materialLot: 'ML-008', quantity: 0.5, unit: 'kg' },
      ],
      production: {
        process: '반죽/숙성',
        plannedQty: 40,
        actualQty: 38,
        unit: 'kg',
        yield: 95,
        startTime: '07:00',
        endTime: '09:00',
        workers: ['정반죽'],
      },
      quality: {
        appearance: 'NORMAL',
        texture: 'NORMAL',
        color: 'NORMAL',
        sampleTest: false,
        testResult: null,
        inspectedBy: '',
      },
      storage: {
        location: '냉장고 C-1',
        temperature: 5,
        storageCondition: '냉장 보관',
        storedAt: '2026-01-09T09:15:00',
      },
      usage: {
        used: 38,
        remaining: 0,
        usedFor: ['만두피', '국수면'],
      },
      createdAt: '2026-01-09T07:00:00',
    },
  ];

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
          onClick={() => setShowAddModal(true)}
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

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">반제품 등록</h2>
              <p className="text-sm text-gray-500 mt-1">새로운 반제품 생산 기록을 등록합니다</p>
            </div>

            <form className="p-6 space-y-6">
              {/* Basic Info */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3">기본 정보</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">제품 코드</label>
                    <input
                      type="text"
                      placeholder="SP001"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">제품명</label>
                    <input
                      type="text"
                      placeholder="양념장 베이스"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
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
                      defaultValue={new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">단위</label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent">
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">실제 수량</label>
                    <input
                      type="number"
                      placeholder="48"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">시작 시간</label>
                    <input
                      type="time"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">종료 시간</label>
                    <input
                      type="time"
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
                    <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent">
                      <option value="NORMAL">정상</option>
                      <option value="ABNORMAL">이상</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">질감</label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent">
                      <option value="NORMAL">정상</option>
                      <option value="ABNORMAL">이상</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">색상</label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent">
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">보관 온도 (°C)</label>
                    <input
                      type="number"
                      placeholder="4"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm text-gray-600 mb-1">보관 조건</label>
                    <input
                      type="text"
                      placeholder="냉장 보관 (0-10°C)"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            </form>

            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="submit"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
              >
                등록
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
