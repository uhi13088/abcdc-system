'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus, X, AlertTriangle, Thermometer, Scale, Timer,
  Shield, Search, RefreshCw, Check, AlertCircle, Clock, Edit2, Trash2
} from 'lucide-react';
import Link from 'next/link';

interface CalibrationRecord {
  id: string;
  equipment_type: string;
  equipment_name: string;
  equipment_code?: string;
  location?: string;
  last_calibration_date?: string;
  next_calibration_date?: string;
  calibration_frequency: 'YEARLY' | 'QUARTERLY' | 'MONTHLY' | 'WEEKLY';
  calibration_provider?: string;
  certificate_number?: string;
  calibration_result: 'PASS' | 'FAIL' | 'PENDING';
  notes?: string;
  is_active: boolean;
}

interface CalibrationSummary {
  total: number;
  expired: number;
  expiringSoon: number;
  valid: number;
}

const EQUIPMENT_TYPES = [
  { value: 'THERMOMETER', label: '온도계', icon: Thermometer },
  { value: 'SCALE', label: '저울', icon: Scale },
  { value: 'TIMER', label: '타이머', icon: Timer },
  { value: 'WASH_TANK', label: '세척조', icon: Shield },
  { value: 'METAL_DETECTOR', label: '금속검출기', icon: Search },
  { value: 'PH_METER', label: 'pH미터', icon: Shield },
  { value: 'OTHER', label: '기타', icon: Shield },
];

const FREQUENCY_OPTIONS = [
  { value: 'YEARLY', label: '연간' },
  { value: 'QUARTERLY', label: '분기별' },
  { value: 'MONTHLY', label: '월간' },
  { value: 'WEEKLY', label: '주간' },
];

const RESULT_COLORS = {
  PASS: 'bg-green-100 text-green-700',
  FAIL: 'bg-red-100 text-red-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
};

const RESULT_LABELS = {
  PASS: '합격',
  FAIL: '불합격',
  PENDING: '대기',
};

export default function EquipmentCalibrationPage() {
  const [records, setRecords] = useState<CalibrationRecord[]>([]);
  const [summary, setSummary] = useState<CalibrationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('');
  const [showExpiring, setShowExpiring] = useState(false);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<CalibrationRecord | null>(null);

  // Form data
  const [formData, setFormData] = useState<{
    equipment_type: string;
    equipment_name: string;
    equipment_code: string;
    location: string;
    last_calibration_date: string;
    calibration_frequency: 'YEARLY' | 'QUARTERLY' | 'MONTHLY' | 'WEEKLY';
    calibration_provider: string;
    certificate_number: string;
    calibration_result: 'PASS' | 'FAIL' | 'PENDING';
    notes: string;
  }>({
    equipment_type: 'THERMOMETER',
    equipment_name: '',
    equipment_code: '',
    location: '',
    last_calibration_date: '',
    calibration_frequency: 'YEARLY',
    calibration_provider: '',
    certificate_number: '',
    calibration_result: 'PASS',
    notes: '',
  });

  const [renewFormData, setRenewFormData] = useState<{
    id: string;
    last_calibration_date: string;
    calibration_frequency: 'YEARLY' | 'QUARTERLY' | 'MONTHLY' | 'WEEKLY';
    calibration_provider: string;
    certificate_number: string;
    calibration_result: 'PASS' | 'FAIL' | 'PENDING';
    notes: string;
  }>({
    id: '',
    last_calibration_date: '',
    calibration_frequency: 'YEARLY',
    calibration_provider: '',
    certificate_number: '',
    calibration_result: 'PASS',
    notes: '',
  });

  const [submitting, setSubmitting] = useState(false);

  // Fetch records
  const fetchRecords = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterType) {
        params.append('equipment_type', filterType);
      }
      if (showExpiring) {
        params.append('check_expiring', 'true');
      }

      const response = await fetch(`/api/haccp/equipment-calibration?${params}`);
      if (response.ok) {
        const data = await response.json();
        setRecords(data.records || []);
        setSummary(data.summary);
      }
    } catch (error) {
      console.error('Failed to fetch calibration records:', error);
    } finally {
      setLoading(false);
    }
  }, [filterType, showExpiring]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Get status of calibration
  const getCalibrationStatus = (record: CalibrationRecord) => {
    if (!record.next_calibration_date) return 'valid';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextDate = new Date(record.next_calibration_date);
    const diffDays = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'expired';
    if (diffDays <= 30) return 'expiring';
    return 'valid';
  };

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const url = '/api/haccp/equipment-calibration';
      const method = editingRecord ? 'PUT' : 'POST';
      const body = editingRecord
        ? { id: editingRecord.id, ...formData }
        : formData;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        setShowModal(false);
        setEditingRecord(null);
        resetForm();
        fetchRecords();
      } else {
        const error = await response.json();
        alert(error.message || '저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to save calibration record:', error);
      alert('저장에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle renew submit
  const handleRenewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch('/api/haccp/equipment-calibration', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...renewFormData,
          action: 'renew',
        }),
      });

      if (response.ok) {
        setShowRenewModal(false);
        resetRenewForm();
        fetchRecords();
      } else {
        const error = await response.json();
        alert(error.message || '갱신에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to renew calibration:', error);
      alert('갱신에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
      const response = await fetch(`/api/haccp/equipment-calibration?id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchRecords();
      }
    } catch (error) {
      console.error('Failed to delete calibration record:', error);
    }
  };

  // Open edit modal
  const openEditModal = (record: CalibrationRecord) => {
    setEditingRecord(record);
    setFormData({
      equipment_type: record.equipment_type,
      equipment_name: record.equipment_name,
      equipment_code: record.equipment_code || '',
      location: record.location || '',
      last_calibration_date: record.last_calibration_date || '',
      calibration_frequency: record.calibration_frequency,
      calibration_provider: record.calibration_provider || '',
      certificate_number: record.certificate_number || '',
      calibration_result: record.calibration_result,
      notes: record.notes || '',
    });
    setShowModal(true);
  };

  // Open renew modal
  const openRenewModal = (record: CalibrationRecord) => {
    setRenewFormData({
      id: record.id,
      last_calibration_date: new Date().toISOString().split('T')[0],
      calibration_frequency: record.calibration_frequency,
      calibration_provider: record.calibration_provider || '',
      certificate_number: '',
      calibration_result: 'PASS',
      notes: '',
    });
    setShowRenewModal(true);
  };

  const resetForm = () => {
    setFormData({
      equipment_type: 'THERMOMETER',
      equipment_name: '',
      equipment_code: '',
      location: '',
      last_calibration_date: '',
      calibration_frequency: 'YEARLY',
      calibration_provider: '',
      certificate_number: '',
      calibration_result: 'PASS',
      notes: '',
    });
  };

  const resetRenewForm = () => {
    setRenewFormData({
      id: '',
      last_calibration_date: '',
      calibration_frequency: 'YEARLY',
      calibration_provider: '',
      certificate_number: '',
      calibration_result: 'PASS',
      notes: '',
    });
  };

  // Get equipment icon
  const getEquipmentIcon = (type: string) => {
    const config = EQUIPMENT_TYPES.find(t => t.value === type);
    return config?.icon || Shield;
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href="/ccp" className="hover:text-primary">CCP 관리</Link>
            <span>/</span>
            <span>장비 검교정</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">장비 검교정 관리</h1>
          <p className="mt-1 text-sm text-gray-500">CCP 모니터링 장비의 검교정 현황을 관리합니다</p>
        </div>
        <button
          onClick={() => {
            setEditingRecord(null);
            resetForm();
            setShowModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          장비 등록
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">전체 장비</p>
              <p className="text-xl font-bold text-gray-900">{summary?.total || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Check className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">유효</p>
              <p className="text-xl font-bold text-green-600">{summary?.valid || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">30일내 만료</p>
              <p className="text-xl font-bold text-yellow-600">{summary?.expiringSoon || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">만료됨</p>
              <p className="text-xl font-bold text-red-600">{summary?.expired || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">장비 유형:</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm"
            >
              <option value="">전체</option>
              {EQUIPMENT_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showExpiring}
              onChange={(e) => setShowExpiring(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <span className="text-sm text-gray-700">만료 임박 장비만 보기</span>
          </label>
        </div>
      </div>

      {/* Records List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : records.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">등록된 장비가 없습니다</p>
          <button
            onClick={() => {
              setEditingRecord(null);
              resetForm();
              setShowModal(true);
            }}
            className="mt-4 text-blue-600 hover:underline"
          >
            장비 등록하기
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">장비</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">장비코드</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">위치</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">최근 검교정</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">다음 검교정</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">주기</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">상태</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">결과</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {records.map((record) => {
                const status = getCalibrationStatus(record);
                const EquipIcon = getEquipmentIcon(record.equipment_type);
                const typeConfig = EQUIPMENT_TYPES.find(t => t.value === record.equipment_type);

                return (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          status === 'expired' ? 'bg-red-100' :
                          status === 'expiring' ? 'bg-yellow-100' : 'bg-green-100'
                        }`}>
                          <EquipIcon className={`w-4 h-4 ${
                            status === 'expired' ? 'text-red-600' :
                            status === 'expiring' ? 'text-yellow-600' : 'text-green-600'
                          }`} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{record.equipment_name}</p>
                          <p className="text-xs text-gray-500">{typeConfig?.label || record.equipment_type}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{record.equipment_code || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{record.location || '-'}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-600">
                      {record.last_calibration_date || '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-sm font-medium ${
                        status === 'expired' ? 'text-red-600' :
                        status === 'expiring' ? 'text-yellow-600' : 'text-gray-600'
                      }`}>
                        {record.next_calibration_date || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-600">
                      {FREQUENCY_OPTIONS.find(f => f.value === record.calibration_frequency)?.label || record.calibration_frequency}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
                        status === 'expired' ? 'bg-red-100 text-red-700' :
                        status === 'expiring' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {status === 'expired' ? (
                          <><AlertCircle className="w-3 h-3" /> 만료</>
                        ) : status === 'expiring' ? (
                          <><Clock className="w-3 h-3" /> 임박</>
                        ) : (
                          <><Check className="w-3 h-3" /> 유효</>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${RESULT_COLORS[record.calibration_result]}`}>
                        {RESULT_LABELS[record.calibration_result]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openRenewModal(record)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                          title="검교정 갱신"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEditModal(record)}
                          className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
                          title="수정"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(record.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                          title="삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold">{editingRecord ? '장비 수정' : '장비 등록'}</h2>
              <button
                onClick={() => { setShowModal(false); setEditingRecord(null); resetForm(); }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">장비 유형 *</label>
                  <select
                    value={formData.equipment_type}
                    onChange={(e) => setFormData({ ...formData, equipment_type: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  >
                    {EQUIPMENT_TYPES.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">장비명 *</label>
                  <input
                    type="text"
                    value={formData.equipment_name}
                    onChange={(e) => setFormData({ ...formData, equipment_name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">장비코드</label>
                  <input
                    type="text"
                    value={formData.equipment_code}
                    onChange={(e) => setFormData({ ...formData, equipment_code: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="예: THERM-001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">설치 위치</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="예: 가열실"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">최근 검교정일</label>
                  <input
                    type="date"
                    value={formData.last_calibration_date}
                    onChange={(e) => setFormData({ ...formData, last_calibration_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">검교정 주기</label>
                  <select
                    value={formData.calibration_frequency}
                    onChange={(e) => setFormData({ ...formData, calibration_frequency: e.target.value as typeof formData.calibration_frequency })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    {FREQUENCY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">검교정 업체</label>
                  <input
                    type="text"
                    value={formData.calibration_provider}
                    onChange={(e) => setFormData({ ...formData, calibration_provider: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">성적서 번호</label>
                  <input
                    type="text"
                    value={formData.certificate_number}
                    onChange={(e) => setFormData({ ...formData, certificate_number: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">검교정 결과</label>
                <div className="flex gap-3">
                  {(['PASS', 'FAIL', 'PENDING'] as const).map(result => (
                    <button
                      key={result}
                      type="button"
                      onClick={() => setFormData({ ...formData, calibration_result: result })}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        formData.calibration_result === result
                          ? result === 'PASS' ? 'bg-green-600 text-white'
                            : result === 'FAIL' ? 'bg-red-600 text-white'
                            : 'bg-yellow-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {RESULT_LABELS[result]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">비고</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setEditingRecord(null); resetForm(); }}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? '저장 중...' : '저장'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Renew Modal */}
      {showRenewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-blue-600" />
                검교정 갱신
              </h2>
              <button
                onClick={() => { setShowRenewModal(false); resetRenewForm(); }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRenewSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">검교정일 *</label>
                <input
                  type="date"
                  value={renewFormData.last_calibration_date}
                  onChange={(e) => setRenewFormData({ ...renewFormData, last_calibration_date: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">검교정 주기</label>
                <select
                  value={renewFormData.calibration_frequency}
                  onChange={(e) => setRenewFormData({ ...renewFormData, calibration_frequency: e.target.value as typeof renewFormData.calibration_frequency })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  {FREQUENCY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">검교정 업체</label>
                <input
                  type="text"
                  value={renewFormData.calibration_provider}
                  onChange={(e) => setRenewFormData({ ...renewFormData, calibration_provider: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">성적서 번호</label>
                <input
                  type="text"
                  value={renewFormData.certificate_number}
                  onChange={(e) => setRenewFormData({ ...renewFormData, certificate_number: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">검교정 결과</label>
                <div className="flex gap-3">
                  {(['PASS', 'FAIL'] as const).map(result => (
                    <button
                      key={result}
                      type="button"
                      onClick={() => setRenewFormData({ ...renewFormData, calibration_result: result })}
                      className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        renewFormData.calibration_result === result
                          ? result === 'PASS' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {RESULT_LABELS[result]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">비고</label>
                <textarea
                  value={renewFormData.notes}
                  onChange={(e) => setRenewFormData({ ...renewFormData, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowRenewModal(false); resetRenewForm(); }}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? '갱신 중...' : '갱신'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
