'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Check, X, AlertTriangle, Calendar, Filter, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

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

interface CCPRecord {
  id: string;
  ccp_id: string;
  record_date: string;
  record_time: string;
  recorded_by: string;
  lot_number: string;
  measurement: {
    value: number;
    unit: string;
  };
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

function CCPRecordsContent() {
  const searchParams = useSearchParams();
  const selectedCcpId = searchParams.get('ccp');

  const [ccpList, setCcpList] = useState<CCPDefinition[]>([]);
  const [records, setRecords] = useState<CCPRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedCcp, setSelectedCcp] = useState<string>(selectedCcpId || '');
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);

  const [formData, setFormData] = useState({
    ccp_id: selectedCcpId || '',
    record_date: new Date().toISOString().split('T')[0],
    record_time: new Date().toTimeString().slice(0, 5),
    lot_number: '',
    measurement: { value: 0, unit: '' },
    is_within_limit: true,
    deviation_action: '',
  });

  useEffect(() => {
    fetchCCPs();
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
        if (selectedCcpId) {
          setSelectedCcp(selectedCcpId);
          setFormData(prev => ({ ...prev, ccp_id: selectedCcpId }));
        } else if (data.length > 0 && !selectedCcp) {
          setSelectedCcp(data[0].id);
          setFormData(prev => ({ ...prev, ccp_id: data[0].id }));
        }
      }
    } catch (error) {
      console.error('Failed to fetch CCPs:', error);
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
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const selectedCcpDef = ccpList.find(c => c.id === formData.ccp_id);
      const limit = selectedCcpDef?.critical_limit;

      // Auto-determine if within limit
      let isWithinLimit = true;
      if (limit) {
        if (limit.min !== undefined && formData.measurement.value < limit.min) {
          isWithinLimit = false;
        }
        if (limit.max !== undefined && formData.measurement.value > limit.max) {
          isWithinLimit = false;
        }
      }

      const response = await fetch('/api/haccp/ccp/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          is_within_limit: isWithinLimit,
          measurement: {
            ...formData.measurement,
            unit: limit?.unit || formData.measurement.unit,
          },
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
          measurement: { value: 0, unit: '' },
          is_within_limit: true,
          deviation_action: '',
        });
      }
    } catch (error) {
      console.error('Failed to create record:', error);
    }
  };

  const selectedCcpDef = ccpList.find(c => c.id === selectedCcp);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href="/ccp" className="hover:text-primary">CCP 관리</Link>
            <span>/</span>
            <span>모니터링 기록</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">CCP 모니터링 기록</h1>
          <p className="mt-1 text-sm text-gray-500">중요관리점 모니터링 결과를 기록하고 관리합니다</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          기록 추가
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">필터:</span>
          </div>
          <div>
            <select
              value={selectedCcp}
              onChange={(e) => setSelectedCcp(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm"
            >
              <option value="">전체 CCP</option>
              {ccpList.map((ccp) => (
                <option key={ccp.id} value={ccp.id}>
                  {ccp.ccp_number} - {ccp.process}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm"
            />
          </div>
        </div>
      </div>

      {/* Selected CCP Info */}
      {selectedCcpDef && (
        <div className="bg-gradient-to-r from-red-500 to-orange-500 rounded-xl p-4 mb-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold">{selectedCcpDef.ccp_number}</h3>
              <p className="text-white/90">{selectedCcpDef.process}</p>
            </div>
            <div className="bg-white/20 rounded-lg px-4 py-2">
              <p className="text-xs text-white/80">한계기준</p>
              <p className="font-bold">
                {selectedCcpDef.critical_limit.parameter}: {selectedCcpDef.critical_limit.min !== undefined && `${selectedCcpDef.critical_limit.min}`}
                {selectedCcpDef.critical_limit.min !== undefined && selectedCcpDef.critical_limit.max !== undefined && ' ~ '}
                {selectedCcpDef.critical_limit.max !== undefined && `${selectedCcpDef.critical_limit.max}`}
                {selectedCcpDef.critical_limit.unit}
              </p>
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
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">LOT 번호</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">측정값</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">결과</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">기록자</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">검증</th>
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
                  <td className="px-4 py-3 text-sm text-gray-900">{record.lot_number || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-sm font-bold ${record.is_within_limit ? 'text-green-600' : 'text-red-600'}`}>
                      {record.measurement.value}{record.measurement.unit}
                    </span>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Record Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">CCP 모니터링 기록</h2>
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">LOT 번호</label>
                <input
                  type="text"
                  value={formData.lot_number}
                  onChange={(e) => setFormData({ ...formData, lot_number: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="예: LOT-20240110-001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">측정값</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    value={formData.measurement.value}
                    onChange={(e) => setFormData({
                      ...formData,
                      measurement: { ...formData.measurement, value: parseFloat(e.target.value) || 0 }
                    })}
                    className="flex-1 px-3 py-2 border rounded-lg"
                    required
                  />
                  <span className="px-3 py-2 bg-gray-100 border rounded-lg text-gray-600">
                    {ccpList.find(c => c.id === formData.ccp_id)?.critical_limit.unit || '단위'}
                  </span>
                </div>
                {formData.ccp_id && (
                  <p className="text-xs text-gray-500 mt-1">
                    한계기준: {ccpList.find(c => c.id === formData.ccp_id)?.critical_limit.min}
                    {' ~ '}
                    {ccpList.find(c => c.id === formData.ccp_id)?.critical_limit.max}
                    {ccpList.find(c => c.id === formData.ccp_id)?.critical_limit.unit}
                  </p>
                )}
              </div>

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
                  기록 저장
                </button>
              </div>
            </form>
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
