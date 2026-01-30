'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Settings,
  X,
  Edit2,
  Trash2,
  Warehouse,
  Thermometer,
  Droplets,
  ArrowLeft,
  Wifi,
  WifiOff,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import { Label } from '@/components/ui/label';

interface IoTSensor {
  id: string;
  name: string;
  sensor_type: string;
  current_temperature?: number;
  current_humidity?: number;
  last_reading_at?: string;
}

interface StorageAreaSetting {
  id: string;
  area_name: string;
  area_code?: string;
  storage_type: 'REFRIGERATOR' | 'FREEZER' | 'DRY_STORAGE' | 'CHEMICAL_STORAGE' | 'PACKAGING_STORAGE' | 'OTHER';
  description?: string;
  temperature_min?: number;
  temperature_max?: number;
  temperature_unit: string;
  humidity_min?: number;
  humidity_max?: number;
  iot_sensor_id?: string;
  iot_enabled: boolean;
  inspection_frequency: 'HOURLY' | 'TWICE_DAILY' | 'DAILY' | 'WEEKLY';
  is_active: boolean;
  sort_order: number;
  sensor?: IoTSensor;
}

const storageTypeText: Record<string, string> = {
  REFRIGERATOR: '냉장고',
  FREEZER: '냉동고',
  DRY_STORAGE: '상온창고',
  CHEMICAL_STORAGE: '화학물질 보관',
  PACKAGING_STORAGE: '포장재 창고',
  OTHER: '기타',
};

const frequencyText: Record<string, string> = {
  HOURLY: '1시간마다',
  TWICE_DAILY: '하루 2회',
  DAILY: '하루 1회',
  WEEKLY: '주 1회',
};

const defaultTemperatureRanges: Record<string, { min: number; max: number }> = {
  REFRIGERATOR: { min: 0, max: 10 },
  FREEZER: { min: -25, max: -18 },
  DRY_STORAGE: { min: 10, max: 25 },
  CHEMICAL_STORAGE: { min: 15, max: 25 },
  PACKAGING_STORAGE: { min: 10, max: 30 },
  OTHER: { min: 0, max: 30 },
};

export default function StorageSettingsPage() {
  const [settings, setSettings] = useState<StorageAreaSetting[]>([]);
  const [sensors, setSensors] = useState<IoTSensor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedSetting, setSelectedSetting] = useState<StorageAreaSetting | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    area_name: '',
    area_code: '',
    storage_type: 'REFRIGERATOR' as StorageAreaSetting['storage_type'],
    description: '',
    temperature_min: 0,
    temperature_max: 10,
    temperature_unit: 'C',
    humidity_min: 40,
    humidity_max: 70,
    iot_sensor_id: '',
    iot_enabled: false,
    inspection_frequency: 'DAILY' as StorageAreaSetting['inspection_frequency'],
    is_active: true,
  });

  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch('/api/haccp/storage-area-settings');
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('Failed to fetch storage settings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSensors = useCallback(async () => {
    try {
      const response = await fetch('/api/haccp/sensors?status=ONLINE');
      if (response.ok) {
        const data = await response.json();
        setSensors(data);
      }
    } catch (error) {
      console.error('Failed to fetch sensors:', error);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchSensors();
  }, [fetchSettings, fetchSensors]);

  const handleStorageTypeChange = (type: StorageAreaSetting['storage_type']) => {
    const range = defaultTemperatureRanges[type];
    setFormData({
      ...formData,
      storage_type: type,
      temperature_min: range.min,
      temperature_max: range.max,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = '/api/haccp/storage-area-settings';
      const method = editMode ? 'PUT' : 'POST';
      const body = editMode ? { id: selectedSetting?.id, ...formData } : formData;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...body,
          iot_sensor_id: formData.iot_sensor_id || null,
        }),
      });

      if (response.ok) {
        setShowModal(false);
        resetForm();
        fetchSettings();
      }
    } catch (error) {
      console.error('Failed to save storage setting:', error);
    }
  };

  const handleEdit = (setting: StorageAreaSetting) => {
    setSelectedSetting(setting);
    setFormData({
      area_name: setting.area_name,
      area_code: setting.area_code || '',
      storage_type: setting.storage_type,
      description: setting.description || '',
      temperature_min: setting.temperature_min ?? 0,
      temperature_max: setting.temperature_max ?? 10,
      temperature_unit: setting.temperature_unit || 'C',
      humidity_min: setting.humidity_min ?? 40,
      humidity_max: setting.humidity_max ?? 70,
      iot_sensor_id: setting.iot_sensor_id || '',
      iot_enabled: setting.iot_enabled,
      inspection_frequency: setting.inspection_frequency,
      is_active: setting.is_active,
    });
    setEditMode(true);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/haccp/storage-area-settings?id=${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setDeleteConfirm(null);
        fetchSettings();
      }
    } catch (error) {
      console.error('Failed to delete storage setting:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      area_name: '',
      area_code: '',
      storage_type: 'REFRIGERATOR',
      description: '',
      temperature_min: 0,
      temperature_max: 10,
      temperature_unit: 'C',
      humidity_min: 40,
      humidity_max: 70,
      iot_sensor_id: '',
      iot_enabled: false,
      inspection_frequency: 'DAILY',
      is_active: true,
    });
    setEditMode(false);
    setSelectedSetting(null);
  };

  const activeCount = settings.filter(s => s.is_active).length;
  const iotEnabledCount = settings.filter(s => s.iot_enabled && s.iot_sensor_id).length;

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/storage-inspections" className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">창고 점검 설정</h1>
            <p className="mt-1 text-sm text-gray-500">점검 구역, 온습도 기준값, IoT 센서 연동 설정</p>
          </div>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          구역 추가
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="flex items-center gap-2 mb-2">
            <Warehouse className="w-4 h-4 text-blue-500" />
            <p className="text-sm text-gray-500">등록된 구역</p>
          </div>
          <p className="text-2xl font-bold">{settings.length}개</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="flex items-center gap-2 mb-2">
            <Settings className="w-4 h-4 text-green-500" />
            <p className="text-sm text-gray-500">활성 구역</p>
          </div>
          <p className="text-2xl font-bold text-green-600">{activeCount}개</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="flex items-center gap-2 mb-2">
            <Wifi className="w-4 h-4 text-purple-500" />
            <p className="text-sm text-gray-500">IoT 연동</p>
          </div>
          <p className="text-2xl font-bold text-purple-600">{iotEnabledCount}개</p>
        </div>
      </div>

      {/* Settings List */}
      {settings.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <Warehouse className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500 mb-4">등록된 점검 구역이 없습니다</p>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            첫 구역 추가하기
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {settings.map((setting) => (
            <div
              key={setting.id}
              className={`bg-white rounded-xl shadow-sm border overflow-hidden ${
                !setting.is_active ? 'opacity-60' : ''
              }`}
            >
              <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-medium">{setting.area_name}</span>
                  {setting.area_code && (
                    <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
                      {setting.area_code}
                    </span>
                  )}
                  <span className="text-sm text-gray-500">{storageTypeText[setting.storage_type]}</span>
                </div>
                <div className="flex items-center gap-2">
                  {setting.iot_enabled && setting.iot_sensor_id && (
                    <span className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded-full flex items-center gap-1">
                      <Wifi className="w-3 h-3" />
                      IoT
                    </span>
                  )}
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      setting.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {setting.is_active ? '활성' : '비활성'}
                  </span>
                  <button
                    onClick={() => handleEdit(setting)}
                    className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(setting.id)}
                    className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-4">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  {/* Temperature Range */}
                  <div className="flex items-center gap-2">
                    <Thermometer className="w-5 h-5 text-orange-500" />
                    <div>
                      <p className="text-sm text-gray-500">온도 기준</p>
                      <p className="font-medium">
                        {setting.temperature_min ?? '-'}~{setting.temperature_max ?? '-'}
                        {setting.temperature_unit}
                      </p>
                    </div>
                  </div>

                  {/* Humidity Range */}
                  <div className="flex items-center gap-2">
                    <Droplets className="w-5 h-5 text-blue-500" />
                    <div>
                      <p className="text-sm text-gray-500">습도 기준</p>
                      <p className="font-medium">
                        {setting.humidity_min ?? '-'}~{setting.humidity_max ?? '-'}%
                      </p>
                    </div>
                  </div>
                </div>

                {/* IoT Sensor Info */}
                {setting.iot_enabled && setting.sensor && (
                  <div className="bg-purple-50 p-3 rounded-lg mb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Wifi className="w-4 h-4 text-purple-600" />
                        <span className="text-sm font-medium text-purple-700">{setting.sensor.name}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        {setting.sensor.current_temperature !== undefined && (
                          <span className="text-orange-600">
                            {setting.sensor.current_temperature}°C
                          </span>
                        )}
                        {setting.sensor.current_humidity !== undefined && (
                          <span className="text-blue-600">
                            {setting.sensor.current_humidity}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>점검 주기: {frequencyText[setting.inspection_frequency]}</span>
                  {setting.description && <span className="truncate max-w-[200px]">{setting.description}</span>}
                </div>
              </div>

              {/* Delete Confirmation */}
              {deleteConfirm === setting.id && (
                <div className="p-4 bg-red-50 border-t border-red-200">
                  <p className="text-sm text-red-600 mb-3">이 구역 설정을 삭제하시겠습니까?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="flex-1 px-3 py-1.5 text-sm border rounded hover:bg-white"
                    >
                      취소
                    </button>
                    <button
                      onClick={() => handleDelete(setting.id)}
                      className="flex-1 px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">{editMode ? '구역 설정 수정' : '점검 구역 추가'}</h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label required>구역 이름</Label>
                  <input
                    type="text"
                    value={formData.area_name}
                    onChange={(e) => setFormData({ ...formData, area_name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="예: 냉장고-1"
                    required
                  />
                </div>
                <div>
                  <Label>구역 코드</Label>
                  <input
                    type="text"
                    value={formData.area_code}
                    onChange={(e) => setFormData({ ...formData, area_code: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="예: REF-01"
                  />
                </div>
              </div>

              <div>
                <Label required>창고 유형</Label>
                <select
                  value={formData.storage_type}
                  onChange={(e) => handleStorageTypeChange(e.target.value as StorageAreaSetting['storage_type'])}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  {Object.entries(storageTypeText).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label>설명</Label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="예: 주원재료 보관"
                />
              </div>

              <div className="border-t pt-4">
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <Thermometer className="w-4 h-4" />
                  온도 기준 설정
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>최소 온도 ({formData.temperature_unit})</Label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.temperature_min}
                      onChange={(e) =>
                        setFormData({ ...formData, temperature_min: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <Label>최대 온도 ({formData.temperature_unit})</Label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.temperature_max}
                      onChange={(e) =>
                        setFormData({ ...formData, temperature_max: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <Droplets className="w-4 h-4" />
                  습도 기준 설정
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>최소 습도 (%)</Label>
                    <input
                      type="number"
                      step="1"
                      value={formData.humidity_min}
                      onChange={(e) =>
                        setFormData({ ...formData, humidity_min: parseInt(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <Label>최대 습도 (%)</Label>
                    <input
                      type="number"
                      step="1"
                      value={formData.humidity_max}
                      onChange={(e) =>
                        setFormData({ ...formData, humidity_max: parseInt(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <Wifi className="w-4 h-4" />
                  IoT 센서 연동
                </h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.iot_enabled}
                      onChange={(e) => setFormData({ ...formData, iot_enabled: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm">IoT 센서 자동 기록 사용</span>
                  </label>

                  {formData.iot_enabled && (
                    <div>
                      <Label>연동할 센서 선택</Label>
                      <select
                        value={formData.iot_sensor_id}
                        onChange={(e) => setFormData({ ...formData, iot_sensor_id: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg"
                      >
                        <option value="">센서 선택...</option>
                        {sensors.map((sensor) => (
                          <option key={sensor.id} value={sensor.id}>
                            {sensor.name} ({sensor.sensor_type})
                          </option>
                        ))}
                      </select>
                      {sensors.length === 0 && (
                        <p className="text-sm text-gray-500 mt-1">
                          등록된 센서가 없습니다.{' '}
                          <Link href="/equipment/sensors" className="text-blue-600 hover:underline">
                            센서 등록하기
                          </Link>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t pt-4">
                <div>
                  <Label>점검 주기</Label>
                  <select
                    value={formData.inspection_frequency}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        inspection_frequency: e.target.value as StorageAreaSetting['inspection_frequency'],
                      })
                    }
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    {Object.entries(frequencyText).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer p-2">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm">활성화</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
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
