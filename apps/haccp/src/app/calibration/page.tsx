'use client';

import { useState, useEffect } from 'react';
import { Plus, Settings, AlertTriangle, CheckCircle, Clock, X, Edit2 } from 'lucide-react';
import { Label } from '@/components/ui/label';

interface CalibrationRecord {
  id: string;
  equipment_name: string;
  equipment_code?: string;
  equipment_type: 'THERMOMETER' | 'SCALE' | 'PH_METER' | 'HYGROMETER' | 'PRESSURE_GAUGE' | 'TIMER' | 'OTHER';
  manufacturer?: string;
  model?: string;
  serial_number?: string;
  location?: string;
  calibration_date: string;
  next_calibration_date?: string;
  calibration_cycle_months: number;
  calibration_type: 'INTERNAL' | 'EXTERNAL' | 'SELF_CHECK';
  calibration_agency?: string;
  certificate_number?: string;
  certificate_url?: string;
  standard_value?: number;
  measured_value?: number;
  tolerance?: number;
  unit?: string;
  result: 'PASS' | 'FAIL' | 'CONDITIONAL';
  deviation_action?: string;
  notes?: string;
  status: 'ACTIVE' | 'EXPIRED' | 'OUT_OF_SERVICE';
  calibrated_by_name?: string;
  verified_by_name?: string;
}

export default function CalibrationPage() {
  const [records, setRecords] = useState<CalibrationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<CalibrationRecord | null>(null);
  const [filterType, setFilterType] = useState<string>('');
  const [showExpiringSoon, setShowExpiringSoon] = useState(false);
  const [formData, setFormData] = useState({
    equipment_name: '',
    equipment_code: '',
    equipment_type: 'THERMOMETER' as CalibrationRecord['equipment_type'],
    manufacturer: '',
    model: '',
    serial_number: '',
    location: '',
    calibration_date: new Date().toISOString().split('T')[0],
    calibration_cycle_months: 12,
    calibration_type: 'INTERNAL' as CalibrationRecord['calibration_type'],
    calibration_agency: '',
    certificate_number: '',
    standard_value: '',
    measured_value: '',
    tolerance: '',
    unit: '',
    result: 'PASS' as CalibrationRecord['result'],
    deviation_action: '',
    notes: '',
  });

  useEffect(() => {
    fetchRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showExpiringSoon]);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (showExpiringSoon) params.set('expiringSoon', 'true');
      const response = await fetch(`/api/haccp/calibration?${params}`);
      if (response.ok) {
        const data = await response.json();
        setRecords(data);
      }
    } catch (error) {
      console.error('Failed to fetch calibration records:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editMode ? 'PUT' : 'POST';
      const body = editMode
        ? { id: selectedRecord?.id, ...formData }
        : formData;

      const response = await fetch('/api/haccp/calibration', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...body,
          standard_value: body.standard_value ? parseFloat(body.standard_value as string) : null,
          measured_value: body.measured_value ? parseFloat(body.measured_value as string) : null,
          tolerance: body.tolerance ? parseFloat(body.tolerance as string) : null,
        }),
      });

      if (response.ok) {
        setShowModal(false);
        fetchRecords();
        resetForm();
      }
    } catch (error) {
      console.error('Failed to save calibration record:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      equipment_name: '',
      equipment_code: '',
      equipment_type: 'THERMOMETER',
      manufacturer: '',
      model: '',
      serial_number: '',
      location: '',
      calibration_date: new Date().toISOString().split('T')[0],
      calibration_cycle_months: 12,
      calibration_type: 'INTERNAL',
      calibration_agency: '',
      certificate_number: '',
      standard_value: '',
      measured_value: '',
      tolerance: '',
      unit: '',
      result: 'PASS',
      deviation_action: '',
      notes: '',
    });
    setEditMode(false);
    setSelectedRecord(null);
  };

  const handleEdit = (record: CalibrationRecord) => {
    setSelectedRecord(record);
    setFormData({
      equipment_name: record.equipment_name,
      equipment_code: record.equipment_code || '',
      equipment_type: record.equipment_type,
      manufacturer: record.manufacturer || '',
      model: record.model || '',
      serial_number: record.serial_number || '',
      location: record.location || '',
      calibration_date: record.calibration_date,
      calibration_cycle_months: record.calibration_cycle_months,
      calibration_type: record.calibration_type,
      calibration_agency: record.calibration_agency || '',
      certificate_number: record.certificate_number || '',
      standard_value: record.standard_value?.toString() || '',
      measured_value: record.measured_value?.toString() || '',
      tolerance: record.tolerance?.toString() || '',
      unit: record.unit || '',
      result: record.result,
      deviation_action: record.deviation_action || '',
      notes: record.notes || '',
    });
    setEditMode(true);
    setShowModal(true);
  };

  const equipmentTypeText: Record<string, string> = {
    'THERMOMETER': '온도계',
    'SCALE': '저울',
    'PH_METER': 'pH 미터',
    'HYGROMETER': '습도계',
    'PRESSURE_GAUGE': '압력계',
    'TIMER': '타이머',
    'OTHER': '기타',
  };

  const calibrationTypeText: Record<string, string> = {
    'INTERNAL': '내부 검교정',
    'EXTERNAL': '외부 검교정',
    'SELF_CHECK': '자체 점검',
  };

  const resultColors: Record<string, string> = {
    'PASS': 'bg-green-100 text-green-700',
    'FAIL': 'bg-red-100 text-red-700',
    'CONDITIONAL': 'bg-yellow-100 text-yellow-700',
  };

  const resultText: Record<string, string> = {
    'PASS': '적합',
    'FAIL': '부적합',
    'CONDITIONAL': '조건부 적합',
  };

  const statusColors: Record<string, string> = {
    'ACTIVE': 'bg-green-100 text-green-700',
    'EXPIRED': 'bg-red-100 text-red-700',
    'OUT_OF_SERVICE': 'bg-gray-100 text-gray-700',
  };

  const statusText: Record<string, string> = {
    'ACTIVE': '사용중',
    'EXPIRED': '만료',
    'OUT_OF_SERVICE': '사용중지',
  };

  const isExpiringSoon = (nextDate: string | undefined) => {
    if (!nextDate) return false;
    const next = new Date(nextDate);
    const today = new Date();
    const diffDays = Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 30 && diffDays > 0;
  };

  const isExpired = (nextDate: string | undefined) => {
    if (!nextDate) return false;
    const next = new Date(nextDate);
    const today = new Date();
    return next < today;
  };

  const filteredRecords = filterType
    ? records.filter(r => r.equipment_type === filterType)
    : records;

  const expiringSoonCount = records.filter(r => isExpiringSoon(r.next_calibration_date)).length;
  const expiredCount = records.filter(r => isExpired(r.next_calibration_date)).length;

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">검교정 관리</h1>
          <p className="mt-1 text-sm text-gray-500">측정장비 검교정 기록을 관리합니다</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          검교정 등록
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="flex items-center gap-2 mb-2">
            <Settings className="w-4 h-4 text-blue-500" />
            <p className="text-sm text-gray-500">전체 장비</p>
          </div>
          <p className="text-2xl font-bold">{records.length}대</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <p className="text-sm text-gray-500">적합</p>
          </div>
          <p className="text-2xl font-bold">{records.filter(r => r.result === 'PASS').length}대</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-yellow-500" />
            <p className="text-sm text-gray-500">만료 임박 (30일 이내)</p>
          </div>
          <p className="text-2xl font-bold text-yellow-600">{expiringSoonCount}대</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <p className="text-sm text-gray-500">만료됨</p>
          </div>
          <p className="text-2xl font-bold text-red-600">{expiredCount}대</p>
        </div>
      </div>

      {/* Expiring Soon Alert */}
      {expiringSoonCount > 0 && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            <span className="font-medium text-yellow-800">검교정 만료 임박 ({expiringSoonCount}건)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {records.filter(r => isExpiringSoon(r.next_calibration_date)).map(r => (
              <span key={r.id} className="text-sm bg-yellow-100 text-yellow-700 px-2 py-1 rounded">
                {r.equipment_name} ({r.equipment_code}) - {r.next_calibration_date}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex gap-4 items-center">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm"
        >
          <option value="">모든 장비 유형</option>
          {Object.entries(equipmentTypeText).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showExpiringSoon}
            onChange={(e) => setShowExpiringSoon(e.target.checked)}
            className="rounded"
          />
          만료 임박만 보기
        </label>
      </div>

      {/* Records List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <Settings className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">등록된 검교정 기록이 없습니다</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">장비</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">유형</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">검교정일</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">다음 검교정</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">결과</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredRecords.map((record) => {
                const expiring = isExpiringSoon(record.next_calibration_date);
                const expired = isExpired(record.next_calibration_date);
                return (
                  <tr key={record.id} className={`hover:bg-gray-50 ${expiring ? 'bg-yellow-50' : expired ? 'bg-red-50' : ''}`}>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium">{record.equipment_name}</p>
                      <p className="text-xs text-gray-500">{record.equipment_code}</p>
                      {record.location && <p className="text-xs text-gray-400">위치: {record.location}</p>}
                    </td>
                    <td className="px-6 py-4 text-sm">{equipmentTypeText[record.equipment_type]}</td>
                    <td className="px-6 py-4">
                      <p className="text-sm">{record.calibration_date}</p>
                      <p className="text-xs text-gray-500">{calibrationTypeText[record.calibration_type]}</p>
                    </td>
                    <td className={`px-6 py-4 text-sm ${expired ? 'text-red-600 font-medium' : expiring ? 'text-yellow-600 font-medium' : ''}`}>
                      {record.next_calibration_date || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${resultColors[record.result]}`}>
                        {resultText[record.result]}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${statusColors[record.status]}`}>
                        {statusText[record.status]}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleEdit(record)}
                        className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                      >
                        <Edit2 className="w-4 h-4" />
                        수정
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">{editMode ? '검교정 수정' : '검교정 등록'}</h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label required>장비명</Label>
                  <input
                    type="text"
                    value={formData.equipment_name}
                    onChange={(e) => setFormData({ ...formData, equipment_name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <Label>관리번호</Label>
                  <input
                    type="text"
                    value={formData.equipment_code}
                    onChange={(e) => setFormData({ ...formData, equipment_code: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label required>장비 유형</Label>
                  <select
                    value={formData.equipment_type}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    onChange={(e) => setFormData({ ...formData, equipment_type: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    {Object.entries(equipmentTypeText).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>제조사</Label>
                  <input
                    type="text"
                    value={formData.manufacturer}
                    onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <Label>모델명</Label>
                  <input
                    type="text"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>시리얼번호</Label>
                  <input
                    type="text"
                    value={formData.serial_number}
                    onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <Label>설치 위치</Label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div className="border-t pt-4 mt-4">
                <h3 className="font-medium mb-3">검교정 정보</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label required>검교정일</Label>
                    <input
                      type="date"
                      value={formData.calibration_date}
                      onChange={(e) => setFormData({ ...formData, calibration_date: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                      required
                    />
                  </div>
                  <div>
                    <Label>검교정 주기 (개월)</Label>
                    <input
                      type="number"
                      min="1"
                      value={formData.calibration_cycle_months}
                      onChange={(e) => setFormData({ ...formData, calibration_cycle_months: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <Label required>검교정 유형</Label>
                    <select
                      value={formData.calibration_type}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      onChange={(e) => setFormData({ ...formData, calibration_type: e.target.value as any })}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      {Object.entries(calibrationTypeText).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {formData.calibration_type === 'EXTERNAL' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>검교정 기관</Label>
                    <input
                      type="text"
                      value={formData.calibration_agency}
                      onChange={(e) => setFormData({ ...formData, calibration_agency: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <Label>성적서 번호</Label>
                    <input
                      type="text"
                      value={formData.certificate_number}
                      onChange={(e) => setFormData({ ...formData, certificate_number: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                </div>
              )}

              <div className="border-t pt-4 mt-4">
                <h3 className="font-medium mb-3">측정 결과</h3>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <Label>기준값</Label>
                    <input
                      type="number"
                      step="0.001"
                      value={formData.standard_value}
                      onChange={(e) => setFormData({ ...formData, standard_value: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <Label>측정값</Label>
                    <input
                      type="number"
                      step="0.001"
                      value={formData.measured_value}
                      onChange={(e) => setFormData({ ...formData, measured_value: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <Label>허용오차</Label>
                    <input
                      type="number"
                      step="0.001"
                      value={formData.tolerance}
                      onChange={(e) => setFormData({ ...formData, tolerance: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <Label>단위</Label>
                    <input
                      type="text"
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="예: C, kg, pH"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label required>판정 결과</Label>
                  <select
                    value={formData.result}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    onChange={(e) => setFormData({ ...formData, result: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="PASS">적합</option>
                    <option value="FAIL">부적합</option>
                    <option value="CONDITIONAL">조건부 적합</option>
                  </select>
                </div>
                {formData.result !== 'PASS' && (
                  <div>
                    <Label>조치사항</Label>
                    <input
                      type="text"
                      value={formData.deviation_action}
                      onChange={(e) => setFormData({ ...formData, deviation_action: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                )}
              </div>

              <div>
                <Label>비고</Label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">
                  취소
                </button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  {editMode ? '수정' : '저장'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
