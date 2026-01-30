'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Warehouse, Thermometer, Droplets, CheckCircle, XCircle, X, Calendar, Settings, Wifi, RefreshCw } from 'lucide-react';
import { Label } from '@/components/ui/label';
import Link from 'next/link';

interface StorageAreaSetting {
  id: string;
  area_name: string;
  area_code?: string;
  storage_type: 'REFRIGERATOR' | 'FREEZER' | 'DRY_STORAGE' | 'CHEMICAL_STORAGE' | 'PACKAGING_STORAGE' | 'OTHER';
  temperature_min?: number;
  temperature_max?: number;
  humidity_min?: number;
  humidity_max?: number;
  iot_sensor_id?: string;
  iot_enabled: boolean;
  sensor?: {
    id: string;
    name: string;
    current_temperature?: number;
    current_humidity?: number;
    last_reading_at?: string;
  };
}

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
  storage_area_setting_id?: string;
}

export default function StorageInspectionsPage() {
  const [inspections, setInspections] = useState<StorageInspection[]>([]);
  const [areaSettings, setAreaSettings] = useState<StorageAreaSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterArea, setFilterArea] = useState('');
  const [selectedSetting, setSelectedSetting] = useState<StorageAreaSetting | null>(null);
  const [formData, setFormData] = useState({
    inspection_date: new Date().toISOString().split('T')[0],
    inspection_time: new Date().toTimeString().split(' ')[0].slice(0, 5),
    shift: 'morning' as StorageInspection['shift'],
    storage_area: '',
    storage_area_setting_id: '',
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

  const fetchAreaSettings = useCallback(async () => {
    try {
      const response = await fetch('/api/haccp/storage-area-settings?activeOnly=true');
      if (response.ok) {
        const data = await response.json();
        setAreaSettings(data);
      }
    } catch (error) {
      console.error('Failed to fetch area settings:', error);
    }
  }, []);

  useEffect(() => {
    fetchInspections();
    fetchAreaSettings();
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
          storage_area_setting_id: formData.storage_area_setting_id || null,
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

  const handleAreaSettingSelect = (settingId: string) => {
    const setting = areaSettings.find(s => s.id === settingId);
    if (setting) {
      setSelectedSetting(setting);
      setFormData({
        ...formData,
        storage_area_setting_id: setting.id,
        storage_area: setting.area_name,
        storage_type: setting.storage_type,
        temperature_min: setting.temperature_min?.toString() || '',
        temperature_max: setting.temperature_max?.toString() || '',
        humidity_min: setting.humidity_min?.toString() || '',
        humidity_max: setting.humidity_max?.toString() || '',
        // If IoT sensor is connected, auto-fill current readings
        temperature: setting.sensor?.current_temperature?.toString() || '',
        humidity: setting.sensor?.current_humidity?.toString() || '',
      });
    } else {
      setSelectedSetting(null);
      setFormData({
        ...formData,
        storage_area_setting_id: '',
        storage_area: '',
      });
    }
  };

  const refreshSensorData = async () => {
    if (!selectedSetting?.iot_sensor_id) return;
    await fetchAreaSettings();
    const updated = areaSettings.find(s => s.id === selectedSetting.id);
    if (updated?.sensor) {
      setFormData(prev => ({
        ...prev,
        temperature: updated.sensor?.current_temperature?.toString() || prev.temperature,
        humidity: updated.sensor?.current_humidity?.toString() || prev.humidity,
      }));
    }
  };

  const resetForm = () => {
    setSelectedSetting(null);
    setFormData({
      inspection_date: new Date().toISOString().split('T')[0],
      inspection_time: new Date().toTimeString().split(' ')[0].slice(0, 5),
      shift: 'morning',
      storage_area: '',
      storage_area_setting_id: '',
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

  // 자동 입력 핸들러
  const handleAutoFill = () => {
    const storageTypes = ['REFRIGERATOR', 'FREEZER', 'DRY_STORAGE', 'CHEMICAL_STORAGE', 'PACKAGING_STORAGE'] as const;
    const storageAreas = ['원료창고 A', '냉장실 1', '냉동실 1', '상온창고 B', '포장재 창고'];
    const shifts = ['morning', 'afternoon', 'night'] as const;

    const randomIndex = Math.floor(Math.random() * storageTypes.length);
    const selectedType = storageTypes[randomIndex];
    const selectedArea = storageAreas[randomIndex];
    const selectedShift = shifts[Math.floor(Math.random() * shifts.length)];

    // 온도 기준 설정
    const tempPresets: Record<string, { min: string; max: string; value: string }> = {
      'REFRIGERATOR': { min: '0', max: '10', value: (Math.random() * 5 + 2).toFixed(1) },
      'FREEZER': { min: '-25', max: '-18', value: (-(Math.random() * 5 + 19)).toFixed(1) },
      'DRY_STORAGE': { min: '10', max: '25', value: (Math.random() * 10 + 15).toFixed(1) },
      'CHEMICAL_STORAGE': { min: '15', max: '25', value: (Math.random() * 5 + 18).toFixed(1) },
      'PACKAGING_STORAGE': { min: '10', max: '30', value: (Math.random() * 10 + 15).toFixed(1) },
    };

    const temp = tempPresets[selectedType];
    const humidity = Math.floor(Math.random() * 20 + 40); // 40-60%

    setFormData({
      inspection_date: new Date().toISOString().split('T')[0],
      inspection_time: new Date().toTimeString().split(' ')[0].slice(0, 5),
      shift: selectedShift,
      storage_area: selectedArea,
      storage_area_setting_id: '',
      storage_type: selectedType,
      temperature: temp.value,
      temperature_min: temp.min,
      temperature_max: temp.max,
      humidity: humidity.toString(),
      humidity_min: '30',
      humidity_max: '70',
      cleanliness_check: true,
      organization_check: true,
      pest_check: false, // 해충 미발견
      damage_check: false, // 파손 미발견
      labeling_check: true,
      fifo_check: true,
      findings: '점검 결과 양호. 온습도 정상 범위 내 유지.',
      corrective_action: '',
    });
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">보관 창고 점검</h1>
          <p className="mt-1 text-sm text-gray-500">냉장/냉동/상온 창고 온습도 및 위생 점검</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/storage-inspections/settings"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50"
          >
            <Settings className="w-4 h-4" />
            구역 설정
          </Link>
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
              {/* Pre-configured Area Selection */}
              {areaSettings.length > 0 && (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <Label>사전 설정된 구역 선택</Label>
                  <select
                    value={formData.storage_area_setting_id}
                    onChange={(e) => handleAreaSettingSelect(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg bg-white mt-1"
                  >
                    <option value="">직접 입력...</option>
                    {areaSettings.map((setting) => (
                      <option key={setting.id} value={setting.id}>
                        {setting.area_name} ({storageTypeText[setting.storage_type]})
                        {setting.iot_enabled && setting.sensor ? ' [IoT 연동]' : ''}
                      </option>
                    ))}
                  </select>
                  {selectedSetting?.iot_enabled && selectedSetting?.sensor && (
                    <div className="mt-2 p-2 bg-white rounded border flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <Wifi className="w-4 h-4 text-purple-600" />
                          <span className="text-sm text-purple-700">{selectedSetting.sensor.name}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          {selectedSetting.sensor.current_temperature !== undefined && (
                            <span className="text-orange-600">
                              <Thermometer className="w-3 h-3 inline mr-1" />
                              {selectedSetting.sensor.current_temperature}°C
                            </span>
                          )}
                          {selectedSetting.sensor.current_humidity !== undefined && (
                            <span className="text-blue-600">
                              <Droplets className="w-3 h-3 inline mr-1" />
                              {selectedSetting.sensor.current_humidity}%
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={refreshSensorData}
                        className="p-1.5 text-purple-600 hover:bg-purple-100 rounded"
                        title="센서 데이터 새로고침"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  {areaSettings.length === 0 && (
                    <p className="text-sm text-blue-600 mt-2">
                      <Link href="/storage-inspections/settings" className="underline">구역 설정</Link>에서 점검 구역을 미리 등록하면 편리합니다.
                    </p>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={handleAutoFill}
                className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all shadow-md"
              >
                ✨ 자동 입력 (샘플 데이터)
              </button>

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
                    onChange={(e) => setFormData({ ...formData, storage_area: e.target.value, storage_area_setting_id: '' })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="예: 원료창고 A, 냉장실 1"
                    required
                    disabled={!!formData.storage_area_setting_id}
                  />
                </div>
                <div>
                  <Label required>창고 유형</Label>
                  <select
                    value={formData.storage_type}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    onChange={(e) => setTemperaturePreset(e.target.value as any)}
                    className="w-full px-3 py-2 border rounded-lg"
                    disabled={!!formData.storage_area_setting_id}
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
