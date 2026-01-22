'use client';

import { useState, useEffect } from 'react';
import { Plus, Warehouse, Thermometer, Droplets, CheckCircle, XCircle, X, Calendar } from 'lucide-react';
import { Label } from '@/components/ui/label';

interface StorageInspection {
  id: string;
  inspection_date: string;
  inspection_time: string;
  shift?: 'morning' | 'afternoon' | 'night';
  storage_area: string;
  storage_type: 'REFRIGERATOR' | 'FREEZER' | 'DRY_STORAGE' | 'CHEMICAL_STORAGE' | 'PACKAGING_STORAGE' | 'OTHER';
  temperature?: number;
  temperature_unit: string;
  temperature_min?: number;
  temperature_max?: number;
  temperature_result?: 'PASS' | 'FAIL' | 'NA';
  humidity?: number;
  humidity_min?: number;
  humidity_max?: number;
  humidity_result?: 'PASS' | 'FAIL' | 'NA';
  cleanliness_check: boolean;
  organization_check: boolean;
  pest_check: boolean;
  damage_check: boolean;
  labeling_check: boolean;
  fifo_check: boolean;
  overall_result: 'PASS' | 'FAIL';
  findings?: string;
  corrective_action?: string;
  inspected_by_name?: string;
  verified_by_name?: string;
}

export default function StorageInspectionsPage() {
  const [inspections, setInspections] = useState<StorageInspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterArea, setFilterArea] = useState('');
  const [formData, setFormData] = useState({
    inspection_date: new Date().toISOString().split('T')[0],
    inspection_time: new Date().toTimeString().split(' ')[0].slice(0, 5),
    shift: 'morning' as StorageInspection['shift'],
    storage_area: '',
    storage_type: 'REFRIGERATOR' as StorageInspection['storage_type'],
    temperature: '',
    temperature_min: '',
    temperature_max: '',
    humidity: '',
    humidity_min: '',
    humidity_max: '',
    cleanliness_check: true,
    organization_check: true,
    pest_check: false, // false means no pests found (good)
    damage_check: false, // false means no damage found (good)
    labeling_check: true,
    fifo_check: true,
    findings: '',
    corrective_action: '',
  });

  useEffect(() => {
    fetchInspections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, filterArea]);

  const fetchInspections = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('date', selectedDate);
      if (filterArea) params.set('storageArea', filterArea);

      const response = await fetch(`/api/haccp/storage-inspections?${params}`);
      if (response.ok) {
        const data = await response.json();
        setInspections(data);
      }
    } catch (error) {
      console.error('Failed to fetch inspections:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/haccp/storage-inspections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          temperature: formData.temperature ? parseFloat(formData.temperature) : null,
          temperature_min: formData.temperature_min ? parseFloat(formData.temperature_min) : null,
          temperature_max: formData.temperature_max ? parseFloat(formData.temperature_max) : null,
          humidity: formData.humidity ? parseFloat(formData.humidity) : null,
          humidity_min: formData.humidity_min ? parseFloat(formData.humidity_min) : null,
          humidity_max: formData.humidity_max ? parseFloat(formData.humidity_max) : null,
        }),
      });

      if (response.ok) {
        setShowModal(false);
        fetchInspections();
        resetForm();
      }
    } catch (error) {
      console.error('Failed to save inspection:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      inspection_date: new Date().toISOString().split('T')[0],
      inspection_time: new Date().toTimeString().split(' ')[0].slice(0, 5),
      shift: 'morning',
      storage_area: '',
      storage_type: 'REFRIGERATOR',
      temperature: '',
      temperature_min: '',
      temperature_max: '',
      humidity: '',
      humidity_min: '',
      humidity_max: '',
      cleanliness_check: true,
      organization_check: true,
      pest_check: false,
      damage_check: false,
      labeling_check: true,
      fifo_check: true,
      findings: '',
      corrective_action: '',
    });
  };

  // Preset temperature ranges based on storage type
  const setTemperaturePreset = (storageType: StorageInspection['storage_type']) => {
    const presets: Record<string, { min: string; max: string }> = {
      'REFRIGERATOR': { min: '0', max: '10' },
      'FREEZER': { min: '-25', max: '-18' },
      'DRY_STORAGE': { min: '10', max: '25' },
      'CHEMICAL_STORAGE': { min: '15', max: '25' },
      'PACKAGING_STORAGE': { min: '10', max: '30' },
      'OTHER': { min: '', max: '' },
    };
    const preset = presets[storageType] || { min: '', max: '' };
    setFormData({
      ...formData,
      storage_type: storageType,
      temperature_min: preset.min,
      temperature_max: preset.max,
    });
  };

  const storageTypeText: Record<string, string> = {
    'REFRIGERATOR': '냉장고',
    'FREEZER': '냉동고',
    'DRY_STORAGE': '상온창고',
    'CHEMICAL_STORAGE': '화학물질 보관',
    'PACKAGING_STORAGE': '포장재 창고',
    'OTHER': '기타',
  };

  const _shiftText: Record<string, string> = {
    'morning': '오전',
    'afternoon': '오후',
    'night': '야간',
  };

  const passCount = inspections.filter(i => i.overall_result === 'PASS').length;
  const failCount = inspections.filter(i => i.overall_result === 'FAIL').length;

  const uniqueAreas = [...new Set(inspections.map(i => i.storage_area))];

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">보관 창고 점검</h1>
          <p className="mt-1 text-sm text-gray-500">냉장/냉동/상온 창고 온습도 및 위생 점검</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          점검 기록
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="flex items-center gap-2 mb-2">
            <Warehouse className="w-4 h-4 text-blue-500" />
            <p className="text-sm text-gray-500">오늘 점검</p>
          </div>
          <p className="text-2xl font-bold">{inspections.length}건</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <p className="text-sm text-gray-500">적합</p>
          </div>
          <p className="text-2xl font-bold text-green-600">{passCount}건</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-4 h-4 text-red-500" />
            <p className="text-sm text-gray-500">부적합</p>
          </div>
          <p className="text-2xl font-bold text-red-600">{failCount}건</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="flex items-center gap-2 mb-2">
            <Thermometer className="w-4 h-4 text-orange-500" />
            <p className="text-sm text-gray-500">점검 구역</p>
          </div>
          <p className="text-2xl font-bold">{uniqueAreas.length}곳</p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-500" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm"
          />
        </div>
        <select
          value={filterArea}
          onChange={(e) => setFilterArea(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm"
        >
          <option value="">모든 구역</option>
          {uniqueAreas.map(area => (
            <option key={area} value={area}>{area}</option>
          ))}
        </select>
      </div>

      {/* Inspections List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : inspections.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <Warehouse className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">선택한 날짜에 점검 기록이 없습니다</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {inspections.map((inspection) => (
            <div key={inspection.id} className={`bg-white rounded-xl shadow-sm border overflow-hidden ${inspection.overall_result === 'FAIL' ? 'border-red-300' : ''}`}>
              <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-medium">{inspection.storage_area}</span>
                  <span className="text-sm text-gray-500">{storageTypeText[inspection.storage_type]}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">{inspection.inspection_time}</span>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    inspection.overall_result === 'PASS' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {inspection.overall_result === 'PASS' ? '적합' : '부적합'}
                  </span>
                </div>
              </div>

              <div className="p-4">
                {/* Temperature and Humidity */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  {inspection.temperature !== null && inspection.temperature !== undefined && (
                    <div className="flex items-center gap-2">
                      <Thermometer className={`w-5 h-5 ${inspection.temperature_result === 'PASS' ? 'text-green-500' : 'text-red-500'}`} />
                      <div>
                        <p className="text-sm text-gray-500">온도</p>
                        <p className={`font-bold ${inspection.temperature_result === 'PASS' ? 'text-green-600' : 'text-red-600'}`}>
                          {inspection.temperature}{inspection.temperature_unit}
                        </p>
                        <p className="text-xs text-gray-400">
                          기준: {inspection.temperature_min}~{inspection.temperature_max}{inspection.temperature_unit}
                        </p>
                      </div>
                    </div>
                  )}
                  {inspection.humidity !== null && inspection.humidity !== undefined && (
                    <div className="flex items-center gap-2">
                      <Droplets className={`w-5 h-5 ${inspection.humidity_result === 'PASS' ? 'text-blue-500' : 'text-red-500'}`} />
                      <div>
                        <p className="text-sm text-gray-500">습도</p>
                        <p className={`font-bold ${inspection.humidity_result === 'PASS' ? 'text-blue-600' : 'text-red-600'}`}>
                          {inspection.humidity}%
                        </p>
                        <p className="text-xs text-gray-400">
                          기준: {inspection.humidity_min}~{inspection.humidity_max}%
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Check Items */}
                <div className="flex flex-wrap gap-2 mb-3">
                  <span className={`px-2 py-1 text-xs rounded ${inspection.cleanliness_check ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    청결상태 {inspection.cleanliness_check ? 'O' : 'X'}
                  </span>
                  <span className={`px-2 py-1 text-xs rounded ${inspection.organization_check ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    정리정돈 {inspection.organization_check ? 'O' : 'X'}
                  </span>
                  <span className={`px-2 py-1 text-xs rounded ${!inspection.pest_check ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    해충 {!inspection.pest_check ? '무' : '발견'}
                  </span>
                  <span className={`px-2 py-1 text-xs rounded ${!inspection.damage_check ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    파손/변질 {!inspection.damage_check ? '무' : '발견'}
                  </span>
                  <span className={`px-2 py-1 text-xs rounded ${inspection.labeling_check ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    표시사항 {inspection.labeling_check ? 'O' : 'X'}
                  </span>
                  <span className={`px-2 py-1 text-xs rounded ${inspection.fifo_check ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    선입선출 {inspection.fifo_check ? 'O' : 'X'}
                  </span>
                </div>

                {/* Findings */}
                {inspection.findings && (
                  <div className="bg-yellow-50 p-2 rounded text-sm mb-2">
                    <span className="text-yellow-700 font-medium">발견사항: </span>
                    <span className="text-yellow-600">{inspection.findings}</span>
                  </div>
                )}

                {inspection.corrective_action && (
                  <div className="bg-blue-50 p-2 rounded text-sm">
                    <span className="text-blue-700 font-medium">개선조치: </span>
                    <span className="text-blue-600">{inspection.corrective_action}</span>
                  </div>
                )}

                {inspection.inspected_by_name && (
                  <p className="text-xs text-gray-400 mt-2">점검자: {inspection.inspected_by_name}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">창고 점검 기록</h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label required>점검일</Label>
                  <input
                    type="date"
                    value={formData.inspection_date}
                    onChange={(e) => setFormData({ ...formData, inspection_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <Label required>점검 시간</Label>
                  <input
                    type="time"
                    value={formData.inspection_time}
                    onChange={(e) => setFormData({ ...formData, inspection_time: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <Label>교대</Label>
                  <select
                    value={formData.shift}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    onChange={(e) => setFormData({ ...formData, shift: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="morning">오전</option>
                    <option value="afternoon">오후</option>
                    <option value="night">야간</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label required>점검 구역</Label>
                  <input
                    type="text"
                    value={formData.storage_area}
                    onChange={(e) => setFormData({ ...formData, storage_area: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="예: 원료창고 A, 냉장실 1"
                    required
                  />
                </div>
                <div>
                  <Label required>창고 유형</Label>
                  <select
                    value={formData.storage_type}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    onChange={(e) => setTemperaturePreset(e.target.value as any)}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    {Object.entries(storageTypeText).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <Thermometer className="w-4 h-4" />
                  온도 점검
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>측정 온도 (C)</Label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.temperature}
                      onChange={(e) => setFormData({ ...formData, temperature: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <Label>기준 최소 (C)</Label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.temperature_min}
                      onChange={(e) => setFormData({ ...formData, temperature_min: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <Label>기준 최대 (C)</Label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.temperature_max}
                      onChange={(e) => setFormData({ ...formData, temperature_max: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <Droplets className="w-4 h-4" />
                  습도 점검 (선택)
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>측정 습도 (%)</Label>
                    <input
                      type="number"
                      step="1"
                      value={formData.humidity}
                      onChange={(e) => setFormData({ ...formData, humidity: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <Label>기준 최소 (%)</Label>
                    <input
                      type="number"
                      step="1"
                      value={formData.humidity_min}
                      onChange={(e) => setFormData({ ...formData, humidity_min: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <Label>기준 최대 (%)</Label>
                    <input
                      type="number"
                      step="1"
                      value={formData.humidity_max}
                      onChange={(e) => setFormData({ ...formData, humidity_max: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-medium mb-3">위생 점검 항목</h3>
                <div className="grid grid-cols-3 gap-4">
                  <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={formData.cleanliness_check}
                      onChange={(e) => setFormData({ ...formData, cleanliness_check: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm">청결상태 양호</span>
                  </label>
                  <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={formData.organization_check}
                      onChange={(e) => setFormData({ ...formData, organization_check: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm">정리정돈 양호</span>
                  </label>
                  <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={formData.labeling_check}
                      onChange={(e) => setFormData({ ...formData, labeling_check: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm">표시사항 양호</span>
                  </label>
                  <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={formData.fifo_check}
                      onChange={(e) => setFormData({ ...formData, fifo_check: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm">선입선출 준수</span>
                  </label>
                  <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 border-red-200">
                    <input
                      type="checkbox"
                      checked={formData.pest_check}
                      onChange={(e) => setFormData({ ...formData, pest_check: e.target.checked })}
                      className="rounded border-red-300"
                    />
                    <span className="text-sm text-red-600">해충 흔적 발견</span>
                  </label>
                  <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 border-red-200">
                    <input
                      type="checkbox"
                      checked={formData.damage_check}
                      onChange={(e) => setFormData({ ...formData, damage_check: e.target.checked })}
                      className="rounded border-red-300"
                    />
                    <span className="text-sm text-red-600">파손/변질 발견</span>
                  </label>
                </div>
              </div>

              <div>
                <Label>발견사항</Label>
                <textarea
                  value={formData.findings}
                  onChange={(e) => setFormData({ ...formData, findings: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                  placeholder="특이사항이 있으면 기록하세요"
                />
              </div>

              <div>
                <Label>개선조치</Label>
                <textarea
                  value={formData.corrective_action}
                  onChange={(e) => setFormData({ ...formData, corrective_action: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                  placeholder="조치한 내용이 있으면 기록하세요"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">
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
    </div>
  );
}
