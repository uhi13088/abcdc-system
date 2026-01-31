'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Check, X, AlertTriangle, Calendar, Filter, ExternalLink, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';

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
  critical_limit: CriticalLimit;
  critical_limits?: CriticalLimit[];
  status?: string;
}

interface Product {
  id: string;
  code: string;
  name: string;
  category: string;
}

interface MeasurementValue {
  code: string;
  parameter: string;
  value: number;
  unit: string;
  min?: number | null;
  max?: number | null;
  is_within_limit: boolean;
}

interface CCPRecord {
  id: string;
  ccp_id: string;
  record_date: string;
  record_time: string;
  recorded_by: string;
  lot_number: string;
  batch_number?: string;
  product_id?: string;
  product?: Product;
  measurement: {
    value: number;
    unit: string;
    batch_number?: string;
    product_name?: string;
    product_category?: string;
  };
  measurements?: MeasurementValue[];
  is_within_limit: boolean;
  deviation_action?: string;
  verified_by?: string;
  verified_at?: string;
  ccp_definitions?: CCPDefinition;
  recorder?: { name: string };
  verifier?: { name: string };
  corrective_action?: {
    id: string;
    action_number: string;
    status: string;
  };
}

// 로트번호 자동 생성
function generateLotNumber(): string {
  const today = new Date();
  const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  const seq = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
  return `LOT-${dateStr}-${seq}`;
}

// 배치번호 자동 생성 (제품코드 포함)
function generateBatchNumber(productCode?: string): string {
  const today = new Date();
  const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  const seq = String(Math.floor(Math.random() * 99) + 1).padStart(2, '0');
  if (productCode) {
    return `${productCode}-${dateStr}-${seq}`;
  }
  return `B${dateStr}-${seq}`;
}

function CCPRecordsContent() {
  const searchParams = useSearchParams();
  const selectedCcpId = searchParams.get('ccp');

  const [ccpList, setCcpList] = useState<CCPDefinition[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [records, setRecords] = useState<CCPRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedCcp, setSelectedCcp] = useState<string>(selectedCcpId || '');
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [deleteTarget, setDeleteTarget] = useState<CCPRecord | null>(null);

  const [formData, setFormData] = useState({
    ccp_id: selectedCcpId || '',
    record_date: new Date().toISOString().split('T')[0],
    record_time: new Date().toTimeString().slice(0, 5),
    lot_number: '',
    batch_number: '',
    product_id: '',
    measurements: [] as { code: string; parameter: string; value: number; unit: string; min?: number | null; max?: number | null }[],
    deviation_action: '',
  });

  // 선택된 제품 정보
  const selectedProduct = products.find(p => p.id === formData.product_id);

  // 선택된 CCP 정보 (제품 정보 표시용)
  const _selectedCcpDef = ccpList.find(c => c.id === formData.ccp_id);

  useEffect(() => {
    fetchCCPs();
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedCcp || dateFilter) {
      fetchRecords();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCcp, dateFilter]);

  const fetchCCPs = async () => {
    try {
      const response = await fetch('/api/haccp/ccp');
      if (response.ok) {
        const data = await response.json();
        setCcpList(data);
        // URL 파라미터로 CCP가 지정된 경우에만 해당 CCP 선택
        if (selectedCcpId) {
          setSelectedCcp(selectedCcpId);
          setFormData(prev => ({ ...prev, ccp_id: selectedCcpId }));
        }
        // 필터는 "전체 CCP"를 기본값으로 유지 (첫 번째 CCP 자동 선택 안함)
      }
    } catch (error) {
      console.error('Failed to fetch CCPs:', error);
      toast.error('CCP 목록을 불러오는데 실패했습니다.');
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

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedCcp) params.append('ccp_id', selectedCcp);
      if (dateFilter) params.append('date', dateFilter);

      const response = await fetch(`/api/haccp/ccp/records?${params}`);
      if (response.ok) {
        const data = await response.json();
        setRecords(data);
      }
    } catch (error) {
      console.error('Failed to fetch records:', error);
      toast.error('CCP 기록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const productInfo = products.find(p => p.id === formData.product_id);

      // 각 측정값에 대해 한계 기준 체크
      const measurementsWithLimit = formData.measurements.map(m => {
        let isWithin = true;
        if (m.min !== undefined && m.min !== null && m.value < m.min) {
          isWithin = false;
        }
        if (m.max !== undefined && m.max !== null && m.value > m.max) {
          isWithin = false;
        }
        return {
          ...m,
          is_within_limit: isWithin,
        };
      });

      // 전체 적합 여부 (모든 측정값이 한계 내여야 적합)
      const allWithinLimit = measurementsWithLimit.every(m => m.is_within_limit);

      // 첫 번째 측정값을 기존 measurement 필드에도 저장 (하위 호환성)
      const firstMeasurement = measurementsWithLimit[0] || { value: 0, unit: '' };

      const response = await fetch('/api/haccp/ccp/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ccp_id: formData.ccp_id,
          record_date: formData.record_date,
          record_time: formData.record_time,
          lot_number: formData.lot_number,
          product_id: formData.product_id || null,
          is_within_limit: allWithinLimit,
          deviation_action: formData.deviation_action,
          measurement: {
            value: firstMeasurement.value,
            unit: firstMeasurement.unit,
            batch_number: formData.batch_number,
            product_name: productInfo?.name,
            product_category: productInfo?.category,
          },
          measurements: measurementsWithLimit,
        }),
      });

      if (response.ok) {
        setShowModal(false);
        fetchRecords();
        setFormData({
          ccp_id: selectedCcp,
          record_date: new Date().toISOString().split('T')[0],
          record_time: new Date().toTimeString().slice(0, 5),
          lot_number: '',
          batch_number: '',
          product_id: '',
          measurements: [],
          deviation_action: '',
        });
        toast.success('CCP 기록이 저장되었습니다.');
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'CCP 기록 저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to create record:', error);
      toast.error('CCP 기록 저장에 실패했습니다.');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const response = await fetch(`/api/haccp/ccp/records?id=${deleteTarget.id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        toast.success('CCP 기록이 삭제되었습니다.');
        setDeleteTarget(null);
        fetchRecords();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'CCP 기록 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to delete record:', error);
      toast.error('CCP 기록 삭제에 실패했습니다.');
    }
  };

  // 필터용 selectedCcpDef (ccpList에서 선택된 CCP)
  const filterCcpDef = ccpList.find(c => c.id === selectedCcp);

  // 자동 입력 기능
  const handleAutoFill = () => {
    const ccpData = ccpList.find(c => c.id === formData.ccp_id);
    if (!ccpData) {
      // CCP가 선택되지 않은 경우 첫 번째 CCP 선택
      if (ccpList.length > 0) {
        setFormData(prev => ({ ...prev, ccp_id: ccpList[0].id }));
      }
      return;
    }

    // critical_limits 배열 사용 (없으면 critical_limit 단일 값 사용)
    const limits = ccpData.critical_limits || (ccpData.critical_limit ? [ccpData.critical_limit] : []);

    // 각 측정 항목에 대해 적정 값 생성
    const autoMeasurements = limits.map(limit => {
      let value = 0;
      const minVal = limit.min ?? undefined;
      const maxVal = limit.max ?? undefined;

      if (minVal !== undefined && maxVal !== undefined) {
        const range = maxVal - minVal;
        value = minVal + range * 0.2 + Math.random() * range * 0.6;
      } else if (minVal !== undefined) {
        value = minVal + 5 + Math.random() * 10;
      } else if (maxVal !== undefined) {
        value = maxVal - 5 - Math.random() * 10;
      }
      value = Math.round(value * 10) / 10;

      return {
        code: limit.code || '',
        parameter: limit.parameter,
        value,
        unit: limit.unit,
        min: limit.min,
        max: limit.max,
      };
    });

    // 제품 자동 선택 (첫 번째 제품)
    const autoProduct = products.length > 0 ? products[0] : null;

    const today = new Date();
    setFormData(prev => ({
      ...prev,
      record_date: today.toISOString().split('T')[0],
      record_time: today.toTimeString().slice(0, 5),
      lot_number: generateLotNumber(),
      batch_number: autoProduct ? generateBatchNumber(autoProduct.code) : generateBatchNumber(),
      product_id: autoProduct?.id || '',
      measurements: autoMeasurements,
      deviation_action: '',
    }));
  };

  // CCP 선택 시 측정 항목 초기화
  const handleCcpChange = (ccpId: string) => {
    const ccpData = ccpList.find(c => c.id === ccpId);
    const limits = ccpData?.critical_limits || (ccpData?.critical_limit ? [ccpData.critical_limit] : []);

    setFormData(prev => ({
      ...prev,
      ccp_id: ccpId,
      measurements: limits.map(limit => ({
        code: limit.code || '',
        parameter: limit.parameter,
        value: 0,
        unit: limit.unit,
        min: limit.min,
        max: limit.max,
      })),
    }));
  };

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href="/ccp" className="hover:text-primary">CCP 관리</Link>
            <span>/</span>
            <span>모니터링 기록</span>
          </div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">CCP 모니터링 기록</h1>
          <p className="mt-1 text-sm text-gray-500">중요관리점 모니터링 결과를 기록하고 관리합니다</p>
        </div>
        <button
          onClick={() => {
            // 기본 CCP 선택 (첫 번째 CCP)
            const defaultCcp = ccpList.filter(ccp => ccp.status !== 'MERGED')[0];
            const ccpId = defaultCcp?.id || '';

            // 선택된 CCP의 한계기준으로 측정값 필드 초기화
            const limits = defaultCcp?.critical_limits || (defaultCcp?.critical_limit ? [defaultCcp.critical_limit] : []);
            const initialMeasurements = limits.map(limit => ({
              code: limit.code || '',
              parameter: limit.parameter,
              value: 0,
              unit: limit.unit,
              min: limit.min,
              max: limit.max,
            }));

            setFormData({
              ccp_id: ccpId,
              record_date: new Date().toISOString().split('T')[0],
              record_time: new Date().toTimeString().slice(0, 5),
              lot_number: generateLotNumber(),
              batch_number: generateBatchNumber(),
              product_id: '',
              measurements: initialMeasurements,
              deviation_action: '',
            });
            setShowModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          기록 추가
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <span className="text-sm font-medium text-gray-700 whitespace-nowrap">필터:</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            <select
              value={selectedCcp}
              onChange={(e) => setSelectedCcp(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm flex-1 min-w-0"
            >
              <option value="">전체 CCP</option>
              {ccpList.map((ccp) => (
                <option key={ccp.id} value={ccp.id}>
                  {ccp.ccp_number} - {ccp.process}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500 flex-shrink-0" />
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Selected CCP Info */}
      {filterCcpDef && (
        <div className="bg-gradient-to-r from-red-500 to-orange-500 rounded-xl p-4 mb-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold">{filterCcpDef.ccp_number}</h3>
              <p className="text-white/90">{filterCcpDef.process}</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {(filterCcpDef.critical_limits || [filterCcpDef.critical_limit]).map((limit, idx) => (
                <div key={idx} className="bg-white/20 rounded-lg px-3 py-2">
                  <p className="text-xs text-white/80">{limit.parameter}</p>
                  <p className="font-bold text-sm">
                    {limit.min !== undefined && limit.min !== null && `${limit.min}`}
                    {limit.min !== undefined && limit.min !== null && limit.max !== undefined && limit.max !== null && ' ~ '}
                    {limit.max !== undefined && limit.max !== null && `${limit.max}`}
                    {limit.unit}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Records Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : records.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">기록된 모니터링 데이터가 없습니다</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 text-blue-600 hover:underline"
          >
            새 기록 추가하기
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">날짜/시간</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">CCP</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">LOT/배치</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">제품</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">측정값</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">결과</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">기록자</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">검증</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.map((record) => (
                <tr key={record.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-900">{record.record_date}</p>
                    <p className="text-xs text-gray-500">{record.record_time}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-900">
                      {record.ccp_definitions?.ccp_number || '-'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {record.ccp_definitions?.process || '-'}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-900">{record.lot_number || '-'}</p>
                    {record.measurement?.batch_number && (
                      <p className="text-xs text-gray-500">{record.measurement.batch_number}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {record.measurement?.product_name ? (
                      <>
                        <p className="text-sm font-medium text-gray-900">{record.measurement.product_name}</p>
                        <p className="text-xs text-gray-500">{record.measurement.product_category}</p>
                      </>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {record.measurements && record.measurements.length > 0 ? (
                      <div className="space-y-1">
                        {record.measurements.map((m, idx) => (
                          <div key={idx} className="flex items-center gap-1">
                            <span className="text-xs text-gray-500">{m.parameter}:</span>
                            <span className={`text-sm font-bold ${m.is_within_limit ? 'text-green-600' : 'text-red-600'}`}>
                              {m.value}{m.unit}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className={`text-sm font-bold ${record.is_within_limit ? 'text-green-600' : 'text-red-600'}`}>
                        {record.measurement?.value}{record.measurement?.unit}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {record.is_within_limit ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                        <Check className="w-3 h-3" />
                        적합
                      </span>
                    ) : (
                      <div>
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                          <X className="w-3 h-3" />
                          이탈
                        </span>
                        {record.corrective_action && (
                          <Link
                            href="/corrective-actions"
                            className="mt-1 inline-flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700"
                          >
                            <ExternalLink className="w-3 h-3" />
                            {record.corrective_action.action_number}
                          </Link>
                        )}
                      </div>
                    )}
                    {!record.is_within_limit && record.deviation_action && (
                      <p className="text-xs text-red-500 mt-1">{record.deviation_action}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {record.recorder?.name || '-'}
                  </td>
                  <td className="px-4 py-3">
                    {record.verified_at ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-600">
                        <Check className="w-3 h-3" />
                        {record.verifier?.name || '검증완료'}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">미검증</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => setDeleteTarget(record)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">CCP 기록 삭제</h3>
            <p className="text-gray-600 mb-4">
              정말로 이 기록을 삭제하시겠습니까?<br/>
              <span className="text-sm text-gray-500">
                {deleteTarget.record_date} {deleteTarget.record_time} - {deleteTarget.ccp_definitions?.ccp_number}
              </span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Record Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 pb-4 border-b">
              <h2 className="text-xl font-bold">CCP 모니터링 기록</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form id="ccp-record-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* 자동 입력 버튼 */}
              <button
                type="button"
                onClick={handleAutoFill}
                className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all shadow-md"
              >
                ✨ 자동 입력 (적합 데이터 생성)
              </button>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CCP 선택</label>
                <select
                  value={formData.ccp_id}
                  onChange={(e) => handleCcpChange(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                >
                  <option value="">CCP를 선택하세요</option>
                  {ccpList.filter(ccp => ccp.status !== 'MERGED').map((ccp) => (
                    <option key={ccp.id} value={ccp.id}>
                      {ccp.ccp_number} - {ccp.process}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">측정일</label>
                  <input
                    type="date"
                    value={formData.record_date}
                    onChange={(e) => setFormData({ ...formData, record_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">측정시간</label>
                  <input
                    type="time"
                    value={formData.record_time}
                    onChange={(e) => setFormData({ ...formData, record_time: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">LOT 번호 *</label>
                  <input
                    type="text"
                    value={formData.lot_number}
                    onChange={(e) => setFormData({ ...formData, lot_number: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg bg-gray-50"
                    placeholder="자동 생성됨"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">배치번호 *</label>
                  <input
                    type="text"
                    value={formData.batch_number}
                    onChange={(e) => setFormData({ ...formData, batch_number: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg bg-gray-50"
                    placeholder="자동 생성됨"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">제품 선택 *</label>
                <select
                  value={formData.product_id}
                  onChange={(e) => {
                    const selectedProd = products.find(p => p.id === e.target.value);
                    setFormData({
                      ...formData,
                      product_id: e.target.value,
                      batch_number: selectedProd ? generateBatchNumber(selectedProd.code) : formData.batch_number,
                    });
                  }}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                >
                  <option value="">제품을 선택하세요</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      [{product.category}] {product.name} ({product.code})
                    </option>
                  ))}
                </select>
              </div>

              {selectedProduct && (
                <div className="grid grid-cols-2 gap-4 bg-blue-50 rounded-lg p-3">
                  <div>
                    <label className="block text-xs font-medium text-blue-600 mb-1">제품군</label>
                    <p className="text-sm font-semibold text-blue-800">{selectedProduct.category}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-blue-600 mb-1">제품명</label>
                    <p className="text-sm font-semibold text-blue-800">{selectedProduct.name}</p>
                  </div>
                </div>
              )}

              {/* 측정값 입력 섹션 - 여러 측정 항목 */}
              {formData.measurements.length > 0 && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">측정값 입력</label>
                  <div className="bg-gray-50 rounded-lg p-3 space-y-3">
                    {formData.measurements.map((measurement, idx) => {
                      // 한계기준 체크
                      const isWithinLimit = (() => {
                        if (measurement.value === 0) return true;
                        if (measurement.min !== undefined && measurement.min !== null && measurement.value < measurement.min) return false;
                        if (measurement.max !== undefined && measurement.max !== null && measurement.value > measurement.max) return false;
                        return true;
                      })();

                      return (
                        <div key={idx} className="bg-white rounded-lg p-3 border">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-800">{measurement.parameter}</span>
                            <span className="text-xs text-gray-500">
                              {measurement.min !== undefined && measurement.min !== null && `${measurement.min}`}
                              {measurement.min !== undefined && measurement.min !== null && measurement.max !== undefined && measurement.max !== null && ' ~ '}
                              {measurement.max !== undefined && measurement.max !== null && `${measurement.max}`}
                              {measurement.unit}
                            </span>
                          </div>
                          <div className="flex gap-2 items-center">
                            <input
                              type="number"
                              step="0.01"
                              value={measurement.value || ''}
                              onChange={(e) => {
                                const newMeasurements = [...formData.measurements];
                                newMeasurements[idx] = {
                                  ...newMeasurements[idx],
                                  value: parseFloat(e.target.value) || 0,
                                };
                                setFormData({ ...formData, measurements: newMeasurements });
                              }}
                              className={`flex-1 px-3 py-2 border rounded-lg ${!isWithinLimit && measurement.value !== 0 ? 'border-red-500 bg-red-50' : ''}`}
                              placeholder={`${measurement.parameter} 입력`}
                              required
                            />
                            <span className="px-3 py-2 bg-gray-100 border rounded-lg text-gray-600 text-sm">
                              {measurement.unit}
                            </span>
                            {measurement.value !== 0 && (
                              <span className={`px-2 py-1 rounded text-xs font-medium ${isWithinLimit ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {isWithinLimit ? '적합' : '이탈'}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {formData.ccp_id && formData.measurements.length === 0 && (
                <div className="text-center py-4 text-gray-500 text-sm">
                  CCP를 선택하면 측정 항목이 표시됩니다
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이탈 시 조치사항</label>
                <textarea
                  value={formData.deviation_action}
                  onChange={(e) => setFormData({ ...formData, deviation_action: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                  placeholder="한계기준 이탈 시 취한 조치를 기록하세요"
                />
              </div>

            </form>
            <div className="flex gap-3 p-6 pt-4 border-t">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="submit"
                form="ccp-record-form"
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                기록 저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CCPRecordsPage() {
  return (
    <React.Suspense fallback={
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    }>
      <CCPRecordsContent />
    </React.Suspense>
  );
}
