'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  X,
  Edit2,
  Trash2,
  Warehouse,
  Thermometer,
  Droplets,
  Wifi,
  CheckCircle,
  XCircle,
  Calendar,
  RefreshCw,
  Settings,
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import toast from 'react-hot-toast';

// ============================================
// Types
// ============================================
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
  storage_area_setting_id?: string;
}

type TabType = 'management' | 'inspection';

// Form Data Types
interface SettingFormData {
  area_name: string;
  area_code: string;
  storage_type: StorageAreaSetting['storage_type'];
  description: string;
  temperature_min: number;
  temperature_max: number;
  temperature_unit: string;
  humidity_min: number;
  humidity_max: number;
  iot_sensor_id: string;
  iot_enabled: boolean;
  inspection_frequency: StorageAreaSetting['inspection_frequency'];
  is_active: boolean;
}

interface InspectionFormData {
  inspection_date: string;
  inspection_time: string;
  shift: StorageInspection['shift'];
  storage_area: string;
  storage_area_setting_id: string;
  storage_type: StorageInspection['storage_type'];
  temperature: string;
  temperature_min: string;
  temperature_max: string;
  humidity: string;
  humidity_min: string;
  humidity_max: string;
  cleanliness_check: boolean;
  organization_check: boolean;
  pest_check: boolean;
  damage_check: boolean;
  labeling_check: boolean;
  fifo_check: boolean;
  findings: string;
  corrective_action: string;
}

// ============================================
// Constants
// ============================================
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

// ============================================
// Main Component
// ============================================
export default function MaterialsStoragePage() {
  const [activeTab, setActiveTab] = useState<TabType>('management');
  const [loading, setLoading] = useState(true);

  // Storage Settings State
  const [settings, setSettings] = useState<StorageAreaSetting[]>([]);
  const [sensors, setSensors] = useState<IoTSensor[]>([]);
  const [showSettingModal, setShowSettingModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedSetting, setSelectedSetting] = useState<StorageAreaSetting | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Inspection State
  const [inspections, setInspections] = useState<StorageInspection[]>([]);
  const [showInspectionModal, setShowInspectionModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterArea, setFilterArea] = useState('');
  const [selectedInspectionSetting, setSelectedInspectionSetting] = useState<StorageAreaSetting | null>(null);

  // Setting Form Data
  const [settingFormData, setSettingFormData] = useState({
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

  // Inspection Form Data
  const [inspectionFormData, setInspectionFormData] = useState({
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
    pest_check: false,
    damage_check: false,
    labeling_check: true,
    fifo_check: true,
    findings: '',
    corrective_action: '',
  });

  // ============================================
  // Fetch Functions
  // ============================================
  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch('/api/haccp/storage-area-settings');
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('Failed to fetch storage settings:', error);
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

  const fetchInspections = useCallback(async () => {
    try {
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
    }
  }, [selectedDate, filterArea]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchSettings(), fetchSensors(), fetchInspections()]);
      setLoading(false);
    };
    loadData();
  }, [fetchSettings, fetchSensors, fetchInspections]);

  // ============================================
  // Setting Handlers
  // ============================================
  const handleStorageTypeChange = (type: StorageAreaSetting['storage_type']) => {
    const range = defaultTemperatureRanges[type];
    setSettingFormData({
      ...settingFormData,
      storage_type: type,
      temperature_min: range.min,
      temperature_max: range.max,
    });
  };

  const handleSettingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = '/api/haccp/storage-area-settings';
      const method = editMode ? 'PUT' : 'POST';
      const body = editMode ? { id: selectedSetting?.id, ...settingFormData } : settingFormData;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...body,
          iot_sensor_id: settingFormData.iot_sensor_id || null,
        }),
      });

      if (response.ok) {
        toast.success(editMode ? '수정되었습니다.' : '등록되었습니다.');
        setShowSettingModal(false);
        resetSettingForm();
        fetchSettings();
      } else {
        toast.error('저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to save storage setting:', error);
      toast.error('저장에 실패했습니다.');
    }
  };

  const handleSettingEdit = (setting: StorageAreaSetting) => {
    setSelectedSetting(setting);
    setSettingFormData({
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
    setShowSettingModal(true);
  };

  const handleSettingDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/haccp/storage-area-settings?id=${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        toast.success('삭제되었습니다.');
        setDeleteConfirm(null);
        fetchSettings();
      } else {
        toast.error('삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to delete storage setting:', error);
      toast.error('삭제에 실패했습니다.');
    }
  };

  const resetSettingForm = () => {
    setSettingFormData({
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

  // ============================================
  // Inspection Handlers
  // ============================================
  const handleAreaSettingSelect = (settingId: string) => {
    const setting = settings.find(s => s.id === settingId);
    if (setting) {
      setSelectedInspectionSetting(setting);
      setInspectionFormData({
        ...inspectionFormData,
        storage_area_setting_id: setting.id,
        storage_area: setting.area_name,
        storage_type: setting.storage_type,
        temperature_min: setting.temperature_min?.toString() || '',
        temperature_max: setting.temperature_max?.toString() || '',
        humidity_min: setting.humidity_min?.toString() || '',
        humidity_max: setting.humidity_max?.toString() || '',
        temperature: setting.sensor?.current_temperature?.toString() || '',
        humidity: setting.sensor?.current_humidity?.toString() || '',
      });
    } else {
      setSelectedInspectionSetting(null);
      setInspectionFormData({
        ...inspectionFormData,
        storage_area_setting_id: '',
        storage_area: '',
      });
    }
  };

  const handleInspectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/haccp/storage-inspections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...inspectionFormData,
          storage_area_setting_id: inspectionFormData.storage_area_setting_id || null,
          temperature: inspectionFormData.temperature ? parseFloat(inspectionFormData.temperature) : null,
          temperature_min: inspectionFormData.temperature_min ? parseFloat(inspectionFormData.temperature_min) : null,
          temperature_max: inspectionFormData.temperature_max ? parseFloat(inspectionFormData.temperature_max) : null,
          humidity: inspectionFormData.humidity ? parseFloat(inspectionFormData.humidity) : null,
          humidity_min: inspectionFormData.humidity_min ? parseFloat(inspectionFormData.humidity_min) : null,
          humidity_max: inspectionFormData.humidity_max ? parseFloat(inspectionFormData.humidity_max) : null,
        }),
      });

      if (response.ok) {
        toast.success('점검 기록이 저장되었습니다.');
        setShowInspectionModal(false);
        resetInspectionForm();
        fetchInspections();
      } else {
        toast.error('저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to save inspection:', error);
      toast.error('저장에 실패했습니다.');
    }
  };

  const refreshSensorData = async () => {
    if (!selectedInspectionSetting?.iot_sensor_id) return;
    await fetchSettings();
    const updated = settings.find(s => s.id === selectedInspectionSetting.id);
    if (updated?.sensor) {
      setInspectionFormData(prev => ({
        ...prev,
        temperature: updated.sensor?.current_temperature?.toString() || prev.temperature,
        humidity: updated.sensor?.current_humidity?.toString() || prev.humidity,
      }));
      toast.success('센서 데이터가 새로고침되었습니다.');
    }
  };

  const resetInspectionForm = () => {
    setSelectedInspectionSetting(null);
    setInspectionFormData({
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

  // ============================================
  // Stats
  // ============================================
  const activeCount = settings.filter(s => s.is_active).length;
  const iotEnabledCount = settings.filter(s => s.iot_enabled && s.iot_sensor_id).length;
  const passCount = inspections.filter(i => i.overall_result === 'PASS').length;
  const failCount = inspections.filter(i => i.overall_result === 'FAIL').length;
  const uniqueAreas = [...new Set(inspections.map(i => i.storage_area))];

  // ============================================
  // Tabs
  // ============================================
  const tabs = [
    { id: 'management' as TabType, label: '보관창고 관리', icon: Settings },
    { id: 'inspection' as TabType, label: '보관창고 점검', icon: CheckCircle },
  ];

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
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">원부재료 보관창고</h1>
        <p className="mt-1 text-sm text-gray-500">보관창고 등록/관리 및 일일 점검 기록</p>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b">
        <div className="flex gap-1">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'management' && (
        <ManagementTab
          settings={settings}
          sensors={sensors}
          showModal={showSettingModal}
          setShowModal={setShowSettingModal}
          formData={settingFormData}
          setFormData={setSettingFormData}
          editMode={editMode}
          deleteConfirm={deleteConfirm}
          setDeleteConfirm={setDeleteConfirm}
          activeCount={activeCount}
          iotEnabledCount={iotEnabledCount}
          onSubmit={handleSettingSubmit}
          onEdit={handleSettingEdit}
          onDelete={handleSettingDelete}
          onStorageTypeChange={handleStorageTypeChange}
          resetForm={resetSettingForm}
        />
      )}

      {activeTab === 'inspection' && (
        <InspectionTab
          inspections={inspections}
          settings={settings}
          showModal={showInspectionModal}
          setShowModal={setShowInspectionModal}
          formData={inspectionFormData}
          setFormData={setInspectionFormData}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          filterArea={filterArea}
          setFilterArea={setFilterArea}
          selectedSetting={selectedInspectionSetting}
          passCount={passCount}
          failCount={failCount}
          uniqueAreas={uniqueAreas}
          onSubmit={handleInspectionSubmit}
          onAreaSettingSelect={handleAreaSettingSelect}
          onRefreshSensor={refreshSensorData}
          resetForm={resetInspectionForm}
          fetchInspections={fetchInspections}
        />
      )}
    </div>
  );
}

// ============================================
// Management Tab Component
// ============================================
function ManagementTab({
  settings,
  sensors,
  showModal,
  setShowModal,
  formData,
  setFormData,
  editMode,
  deleteConfirm,
  setDeleteConfirm,
  activeCount,
  iotEnabledCount,
  onSubmit,
  onEdit,
  onDelete,
  onStorageTypeChange,
  resetForm,
}: {
  settings: StorageAreaSetting[];
  sensors: IoTSensor[];
  showModal: boolean;
  setShowModal: (show: boolean) => void;
  formData: SettingFormData;
  setFormData: (data: SettingFormData) => void;
  editMode: boolean;
  deleteConfirm: string | null;
  setDeleteConfirm: (id: string | null) => void;
  activeCount: number;
  iotEnabledCount: number;
  onSubmit: (e: React.FormEvent) => void;
  onEdit: (setting: StorageAreaSetting) => void;
  onDelete: (id: string) => void;
  onStorageTypeChange: (type: StorageAreaSetting['storage_type']) => void;
  resetForm: () => void;
}) {
  return (
    <>
      {/* Header Actions */}
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          보관창고 추가
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="flex items-center gap-2 mb-2">
            <Warehouse className="w-4 h-4 text-blue-500" />
            <p className="text-sm text-gray-500">등록된 창고</p>
          </div>
          <p className="text-2xl font-bold">{settings.length}개</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <p className="text-sm text-gray-500">활성 창고</p>
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
          <p className="text-gray-500 mb-4">등록된 보관창고가 없습니다</p>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            첫 보관창고 추가하기
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
                    onClick={() => onEdit(setting)}
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

                {setting.iot_enabled && setting.sensor && (
                  <div className="bg-purple-50 p-3 rounded-lg mb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Wifi className="w-4 h-4 text-purple-600" />
                        <span className="text-sm font-medium text-purple-700">{setting.sensor.name}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        {setting.sensor.current_temperature !== undefined && (
                          <span className="text-orange-600">{setting.sensor.current_temperature}°C</span>
                        )}
                        {setting.sensor.current_humidity !== undefined && (
                          <span className="text-blue-600">{setting.sensor.current_humidity}%</span>
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

              {deleteConfirm === setting.id && (
                <div className="p-4 bg-red-50 border-t border-red-200">
                  <p className="text-sm text-red-600 mb-3">이 보관창고를 삭제하시겠습니까?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="flex-1 px-3 py-1.5 text-sm border rounded hover:bg-white"
                    >
                      취소
                    </button>
                    <button
                      onClick={() => onDelete(setting.id)}
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

      {/* Setting Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">{editMode ? '보관창고 수정' : '보관창고 추가'}</h2>
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

            <form onSubmit={onSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label required>창고 이름</Label>
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
                  <Label>창고 코드</Label>
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
                  onChange={(e) => onStorageTypeChange(e.target.value as StorageAreaSetting['storage_type'])}
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
                      onChange={(e) => setFormData({ ...formData, temperature_min: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <Label>최대 온도 ({formData.temperature_unit})</Label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.temperature_max}
                      onChange={(e) => setFormData({ ...formData, temperature_max: parseFloat(e.target.value) || 0 })}
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
                      onChange={(e) => setFormData({ ...formData, humidity_min: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <Label>최대 습도 (%)</Label>
                    <input
                      type="number"
                      step="1"
                      value={formData.humidity_max}
                      onChange={(e) => setFormData({ ...formData, humidity_max: parseInt(e.target.value) || 0 })}
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
    </>
  );
}

// ============================================
// Inspection Tab Component
// ============================================
function InspectionTab({
  inspections,
  settings,
  showModal,
  setShowModal,
  formData,
  setFormData,
  selectedDate,
  setSelectedDate,
  filterArea,
  setFilterArea,
  selectedSetting,
  passCount,
  failCount,
  uniqueAreas,
  onSubmit,
  onAreaSettingSelect,
  onRefreshSensor,
  resetForm,
  fetchInspections,
}: {
  inspections: StorageInspection[];
  settings: StorageAreaSetting[];
  showModal: boolean;
  setShowModal: (show: boolean) => void;
  formData: InspectionFormData;
  setFormData: (data: InspectionFormData | ((prev: InspectionFormData) => InspectionFormData)) => void;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  filterArea: string;
  setFilterArea: (area: string) => void;
  selectedSetting: StorageAreaSetting | null;
  passCount: number;
  failCount: number;
  uniqueAreas: string[];
  onSubmit: (e: React.FormEvent) => void;
  onAreaSettingSelect: (settingId: string) => void;
  onRefreshSensor: () => void;
  resetForm: () => void;
  fetchInspections: () => void;
}) {
  useEffect(() => {
    fetchInspections();
  }, [selectedDate, filterArea, fetchInspections]);

  return (
    <>
      {/* Header Actions */}
      <div className="mb-4 flex justify-end">
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
            <p className="text-sm text-gray-500">점검 창고</p>
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
          <option value="">모든 창고</option>
          {uniqueAreas.map(area => (
            <option key={area} value={area}>{area}</option>
          ))}
        </select>
      </div>

      {/* Inspections List */}
      {inspections.length === 0 ? (
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

      {/* Inspection Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">보관창고 점검 기록</h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              {/* Pre-configured Area Selection */}
              {settings.length > 0 && (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <Label>등록된 보관창고 선택</Label>
                  <select
                    value={formData.storage_area_setting_id}
                    onChange={(e) => onAreaSettingSelect(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg bg-white mt-1"
                  >
                    <option value="">직접 입력...</option>
                    {settings.filter(s => s.is_active).map((setting) => (
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
                        onClick={onRefreshSensor}
                        className="p-1 hover:bg-gray-100 rounded"
                        title="센서 데이터 새로고침"
                      >
                        <RefreshCw className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Basic Info */}
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
                  <Label required>점검시간</Label>
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
                    onChange={(e) => setFormData({ ...formData, shift: e.target.value as StorageInspection['shift'] })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="morning">오전</option>
                    <option value="afternoon">오후</option>
                    <option value="night">야간</option>
                  </select>
                </div>
              </div>

              {!formData.storage_area_setting_id && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label required>창고명</Label>
                    <input
                      type="text"
                      value={formData.storage_area}
                      onChange={(e) => setFormData({ ...formData, storage_area: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="예: 냉장고-1"
                      required
                    />
                  </div>
                  <div>
                    <Label required>창고 유형</Label>
                    <select
                      value={formData.storage_type}
                      onChange={(e) => setFormData({ ...formData, storage_type: e.target.value as StorageInspection['storage_type'] })}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      {Object.entries(storageTypeText).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Temperature & Humidity */}
              <div className="border-t pt-4">
                <h3 className="font-medium mb-3">온습도 측정</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>온도 (°C)</Label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.temperature}
                      onChange={(e) => setFormData({ ...formData, temperature: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="측정 온도"
                    />
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.1"
                        value={formData.temperature_min}
                        onChange={(e) => setFormData({ ...formData, temperature_min: e.target.value })}
                        className="flex-1 px-2 py-1 border rounded text-sm"
                        placeholder="최소"
                      />
                      <span className="text-gray-400">~</span>
                      <input
                        type="number"
                        step="0.1"
                        value={formData.temperature_max}
                        onChange={(e) => setFormData({ ...formData, temperature_max: e.target.value })}
                        className="flex-1 px-2 py-1 border rounded text-sm"
                        placeholder="최대"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>습도 (%)</Label>
                    <input
                      type="number"
                      step="1"
                      value={formData.humidity}
                      onChange={(e) => setFormData({ ...formData, humidity: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="측정 습도"
                    />
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="1"
                        value={formData.humidity_min}
                        onChange={(e) => setFormData({ ...formData, humidity_min: e.target.value })}
                        className="flex-1 px-2 py-1 border rounded text-sm"
                        placeholder="최소"
                      />
                      <span className="text-gray-400">~</span>
                      <input
                        type="number"
                        step="1"
                        value={formData.humidity_max}
                        onChange={(e) => setFormData({ ...formData, humidity_max: e.target.value })}
                        className="flex-1 px-2 py-1 border rounded text-sm"
                        placeholder="최대"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Check Items */}
              <div className="border-t pt-4">
                <h3 className="font-medium mb-3">점검 항목</h3>
                <div className="grid grid-cols-3 gap-3">
                  <label className="flex items-center gap-2 p-2 border rounded hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.cleanliness_check}
                      onChange={(e) => setFormData({ ...formData, cleanliness_check: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm">청결상태 양호</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 border rounded hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.organization_check}
                      onChange={(e) => setFormData({ ...formData, organization_check: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm">정리정돈 양호</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 border rounded hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.labeling_check}
                      onChange={(e) => setFormData({ ...formData, labeling_check: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm">표시사항 양호</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 border rounded hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.fifo_check}
                      onChange={(e) => setFormData({ ...formData, fifo_check: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm">선입선출 준수</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 border rounded hover:bg-gray-50 cursor-pointer text-red-600">
                    <input
                      type="checkbox"
                      checked={formData.pest_check}
                      onChange={(e) => setFormData({ ...formData, pest_check: e.target.checked })}
                      className="rounded border-red-300"
                    />
                    <span className="text-sm">해충 발견</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 border rounded hover:bg-gray-50 cursor-pointer text-red-600">
                    <input
                      type="checkbox"
                      checked={formData.damage_check}
                      onChange={(e) => setFormData({ ...formData, damage_check: e.target.checked })}
                      className="rounded border-red-300"
                    />
                    <span className="text-sm">파손/변질 발견</span>
                  </label>
                </div>
              </div>

              {/* Findings & Actions */}
              <div className="border-t pt-4 space-y-3">
                <div>
                  <Label>발견사항</Label>
                  <textarea
                    value={formData.findings}
                    onChange={(e) => setFormData({ ...formData, findings: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    rows={2}
                    placeholder="특이사항이 있으면 입력하세요"
                  />
                </div>
                <div>
                  <Label>개선조치</Label>
                  <textarea
                    value={formData.corrective_action}
                    onChange={(e) => setFormData({ ...formData, corrective_action: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    rows={2}
                    placeholder="부적합 시 개선조치 내용"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
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
    </>
  );
}
