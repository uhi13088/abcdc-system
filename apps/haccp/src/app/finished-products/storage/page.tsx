'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Warehouse, Plus, Thermometer, Droplets, Search,
  MapPin, CheckCircle, AlertTriangle, Clock, RefreshCw,
  ChevronDown, ChevronUp, Edit2, Trash2
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import toast from 'react-hot-toast';

interface StorageLocation {
  id: string;
  name: string;
  storage_type: 'cold' | 'frozen' | 'room_temp' | 'cool';
  temp_min: number;
  temp_max: number;
  humidity_min?: number;
  humidity_max?: number;
  description?: string;
  is_active: boolean;
  sensor_id?: string;
}

interface StorageInspection {
  id: string;
  storage_id: string;
  storage_name?: string;
  inspection_date: string;
  inspection_time: string;
  temperature: number;
  humidity?: number;
  temp_status: 'normal' | 'warning' | 'critical';
  humidity_status?: 'normal' | 'warning' | 'critical';
  cleanliness_check: boolean;
  organization_check: boolean;
  pest_check: boolean;
  notes?: string;
  inspected_by: string;
  inspected_by_name?: string;
}

interface Sensor {
  id: string;
  name: string;
  current_temp?: number;
  current_humidity?: number;
}

const STORAGE_TYPE_LABELS: Record<string, string> = {
  cold: '냉장',
  frozen: '냉동',
  room_temp: '상온',
  cool: '서늘한곳',
};

const STORAGE_TYPE_COLORS: Record<string, string> = {
  cold: 'bg-blue-100 text-blue-700',
  frozen: 'bg-indigo-100 text-indigo-700',
  room_temp: 'bg-amber-100 text-amber-700',
  cool: 'bg-teal-100 text-teal-700',
};

export default function FinishedProductStoragePage() {
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [inspections, setInspections] = useState<StorageInspection[]>([]);
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'locations' | 'inspections'>('locations');
  const [showModal, setShowModal] = useState(false);
  const [showInspectionModal, setShowInspectionModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<StorageLocation | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');

  const [locationForm, setLocationForm] = useState({
    name: '',
    storage_type: 'cold' as 'cold' | 'frozen' | 'room_temp' | 'cool',
    temp_min: 0,
    temp_max: 10,
    humidity_min: 0,
    humidity_max: 100,
    description: '',
    sensor_id: '',
  });

  const [inspectionForm, setInspectionForm] = useState({
    storage_id: '',
    temperature: 0,
    humidity: 0,
    cleanliness_check: true,
    organization_check: true,
    pest_check: true,
    notes: '',
  });

  const fetchLocations = useCallback(async () => {
    try {
      const response = await fetch('/api/haccp/finished-products/storage-locations');
      if (response.ok) {
        const data = await response.json();
        setLocations(data || []);
      }
    } catch (error) {
      console.error('Failed to fetch storage locations:', error);
    }
  }, []);

  const fetchInspections = useCallback(async () => {
    try {
      const response = await fetch(`/api/haccp/finished-products/storage-inspections?date=${selectedDate}`);
      if (response.ok) {
        const data = await response.json();
        setInspections(data || []);
      }
    } catch (error) {
      console.error('Failed to fetch inspections:', error);
    }
  }, [selectedDate]);

  const fetchSensors = async () => {
    try {
      const response = await fetch('/api/haccp/equipment');
      if (response.ok) {
        const data = await response.json();
        setSensors(data || []);
      }
    } catch (error) {
      console.error('Failed to fetch sensors:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchLocations(), fetchInspections(), fetchSensors()]);
      setLoading(false);
    };
    loadData();
  }, [fetchLocations, fetchInspections]);

  // 센서 데이터와 창고 설정 결합
  const locationsWithSensorData = useMemo(() => {
    return locations.map(loc => {
      const sensor = sensors.find(s => s.id === loc.sensor_id);
      return {
        ...loc,
        currentTemp: sensor?.current_temp,
        currentHumidity: sensor?.current_humidity,
      };
    });
  }, [locations, sensors]);

  const handleSubmitLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingLocation
        ? `/api/haccp/finished-products/storage-locations?id=${editingLocation.id}`
        : '/api/haccp/finished-products/storage-locations';
      const method = editingLocation ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(locationForm),
      });

      if (response.ok) {
        toast.success(editingLocation ? '보관창고가 수정되었습니다.' : '보관창고가 등록되었습니다.');
        setShowModal(false);
        resetLocationForm();
        fetchLocations();
      } else {
        toast.error('저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to save location:', error);
      toast.error('저장에 실패했습니다.');
    }
  };

  const handleSubmitInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const now = new Date();
      const response = await fetch('/api/haccp/finished-products/storage-inspections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...inspectionForm,
          inspection_date: selectedDate,
          inspection_time: `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`,
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

  const handleDeleteLocation = async (id: string) => {
    if (!confirm('이 보관창고를 삭제하시겠습니까?')) return;
    try {
      const response = await fetch(`/api/haccp/finished-products/storage-locations?id=${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        toast.success('보관창고가 삭제되었습니다.');
        fetchLocations();
      } else {
        toast.error('삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to delete location:', error);
      toast.error('삭제에 실패했습니다.');
    }
  };

  const resetLocationForm = () => {
    setLocationForm({
      name: '',
      storage_type: 'cold',
      temp_min: 0,
      temp_max: 10,
      humidity_min: 0,
      humidity_max: 100,
      description: '',
      sensor_id: '',
    });
    setEditingLocation(null);
  };

  const resetInspectionForm = () => {
    setInspectionForm({
      storage_id: '',
      temperature: 0,
      humidity: 0,
      cleanliness_check: true,
      organization_check: true,
      pest_check: true,
      notes: '',
    });
  };

  const openEditModal = (location: StorageLocation) => {
    setEditingLocation(location);
    setLocationForm({
      name: location.name,
      storage_type: location.storage_type,
      temp_min: location.temp_min,
      temp_max: location.temp_max,
      humidity_min: location.humidity_min || 0,
      humidity_max: location.humidity_max || 100,
      description: location.description || '',
      sensor_id: location.sensor_id || '',
    });
    setShowModal(true);
  };

  const openInspectionModal = (storageId?: string) => {
    if (storageId) {
      const location = locationsWithSensorData.find(l => l.id === storageId);
      setInspectionForm({
        storage_id: storageId,
        temperature: location?.currentTemp || 0,
        humidity: location?.currentHumidity || 0,
        cleanliness_check: true,
        organization_check: true,
        pest_check: true,
        notes: '',
      });
    } else {
      resetInspectionForm();
    }
    setShowInspectionModal(true);
  };

  const handleAutoFillFromSensor = () => {
    const location = locationsWithSensorData.find(l => l.id === inspectionForm.storage_id);
    if (location?.currentTemp !== undefined) {
      setInspectionForm(prev => ({
        ...prev,
        temperature: location.currentTemp || 0,
        humidity: location.currentHumidity || 0,
      }));
      toast.success('센서 데이터를 가져왔습니다.');
    } else {
      toast.error('연결된 센서가 없거나 데이터가 없습니다.');
    }
  };

  const getTempStatus = (temp: number, min: number, max: number): 'normal' | 'warning' | 'critical' => {
    if (temp >= min && temp <= max) return 'normal';
    if (temp < min - 2 || temp > max + 2) return 'critical';
    return 'warning';
  };

  const filteredLocations = locationsWithSensorData.filter(
    loc => loc.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Warehouse className="w-7 h-7 text-blue-600" />
            완제품 보관창고
          </h1>
          <p className="text-gray-500 mt-1">완제품 보관창고 관리 및 점검</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => openInspectionModal()}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            점검 기록
          </button>
          <button
            onClick={() => {
              resetLocationForm();
              setShowModal(true);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            창고 추가
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab('locations')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'locations'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          창고 목록
        </button>
        <button
          onClick={() => setActiveTab('inspections')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'inspections'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          점검 기록
        </button>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="창고명 검색..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg"
          />
        </div>
        {activeTab === 'inspections' && (
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-4 py-2 border rounded-lg"
          />
        )}
      </div>

      {/* Content */}
      {activeTab === 'locations' ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredLocations.map((location) => {
            const tempStatus = location.currentTemp !== undefined
              ? getTempStatus(location.currentTemp, location.temp_min, location.temp_max)
              : null;

            return (
              <div key={location.id} className="bg-white rounded-xl shadow-sm border p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-medium text-gray-900">{location.name}</h3>
                    <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full ${STORAGE_TYPE_COLORS[location.storage_type]}`}>
                      {STORAGE_TYPE_LABELS[location.storage_type]}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEditModal(location)}
                      className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteLocation(location.id)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 flex items-center gap-1">
                      <Thermometer className="w-4 h-4" /> 온도 기준
                    </span>
                    <span>{location.temp_min}~{location.temp_max}°C</span>
                  </div>
                  {location.currentTemp !== undefined && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">현재 온도</span>
                      <span className={`font-medium ${
                        tempStatus === 'normal' ? 'text-green-600' :
                        tempStatus === 'warning' ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {location.currentTemp}°C
                        {tempStatus === 'critical' && <AlertTriangle className="inline w-4 h-4 ml-1" />}
                      </span>
                    </div>
                  )}
                  {location.description && (
                    <p className="text-gray-500 text-xs mt-2">{location.description}</p>
                  )}
                </div>

                <button
                  onClick={() => openInspectionModal(location.id)}
                  className="w-full mt-4 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  점검 기록하기
                </button>
              </div>
            );
          })}

          {filteredLocations.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-500">
              <Warehouse className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>등록된 보관창고가 없습니다</p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">창고</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">시간</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">온도</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">습도</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">점검항목</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">점검자</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">비고</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {inspections.map((inspection) => (
                <tr key={inspection.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{inspection.storage_name}</td>
                  <td className="px-4 py-3 text-sm">{inspection.inspection_time}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`font-medium ${
                      inspection.temp_status === 'normal' ? 'text-green-600' :
                      inspection.temp_status === 'warning' ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {inspection.temperature}°C
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">{inspection.humidity}%</td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex gap-1">
                      <span className={`px-1.5 py-0.5 text-xs rounded ${inspection.cleanliness_check ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        청결
                      </span>
                      <span className={`px-1.5 py-0.5 text-xs rounded ${inspection.organization_check ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        정리
                      </span>
                      <span className={`px-1.5 py-0.5 text-xs rounded ${inspection.pest_check ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        방충
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">{inspection.inspected_by_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{inspection.notes || '-'}</td>
                </tr>
              ))}
              {inspections.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    해당 날짜의 점검 기록이 없습니다
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Location Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-6">
              {editingLocation ? '보관창고 수정' : '보관창고 등록'}
            </h2>
            <form onSubmit={handleSubmitLocation} className="space-y-4">
              <div>
                <Label>창고명 *</Label>
                <input
                  type="text"
                  value={locationForm.name}
                  onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <Label>보관 유형 *</Label>
                <select
                  value={locationForm.storage_type}
                  onChange={(e) => {
                    const type = e.target.value as 'cold' | 'frozen' | 'room_temp' | 'cool';
                    let tempMin = 0, tempMax = 10;
                    if (type === 'frozen') { tempMin = -25; tempMax = -18; }
                    else if (type === 'room_temp') { tempMin = 15; tempMax = 25; }
                    else if (type === 'cool') { tempMin = 10; tempMax = 15; }
                    setLocationForm({ ...locationForm, storage_type: type, temp_min: tempMin, temp_max: tempMax });
                  }}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="cold">냉장</option>
                  <option value="frozen">냉동</option>
                  <option value="room_temp">상온</option>
                  <option value="cool">서늘한곳</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>최저 온도 (°C)</Label>
                  <input
                    type="number"
                    value={locationForm.temp_min}
                    onChange={(e) => setLocationForm({ ...locationForm, temp_min: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <Label>최고 온도 (°C)</Label>
                  <input
                    type="number"
                    value={locationForm.temp_max}
                    onChange={(e) => setLocationForm({ ...locationForm, temp_max: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
              <div>
                <Label>연결 센서</Label>
                <select
                  value={locationForm.sensor_id}
                  onChange={(e) => setLocationForm({ ...locationForm, sensor_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">선택 안함</option>
                  {sensors.map((sensor) => (
                    <option key={sensor.id} value={sensor.id}>{sensor.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>설명</Label>
                <textarea
                  value={locationForm.description}
                  onChange={(e) => setLocationForm({ ...locationForm, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetLocationForm();
                  }}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingLocation ? '수정' : '등록'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inspection Modal */}
      {showInspectionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-6">보관창고 점검</h2>
            <form onSubmit={handleSubmitInspection} className="space-y-4">
              <div>
                <Label>보관창고 *</Label>
                <select
                  value={inspectionForm.storage_id}
                  onChange={(e) => {
                    const location = locationsWithSensorData.find(l => l.id === e.target.value);
                    setInspectionForm({
                      ...inspectionForm,
                      storage_id: e.target.value,
                      temperature: location?.currentTemp || 0,
                      humidity: location?.currentHumidity || 0,
                    });
                  }}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                >
                  <option value="">창고 선택</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                </select>
              </div>

              {inspectionForm.storage_id && (
                <button
                  type="button"
                  onClick={handleAutoFillFromSensor}
                  className="w-full px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  현재값 자동입력
                </button>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>온도 (°C) *</Label>
                  <input
                    type="number"
                    step="0.1"
                    value={inspectionForm.temperature}
                    onChange={(e) => setInspectionForm({ ...inspectionForm, temperature: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <Label>습도 (%)</Label>
                  <input
                    type="number"
                    value={inspectionForm.humidity}
                    onChange={(e) => setInspectionForm({ ...inspectionForm, humidity: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>점검 항목</Label>
                <div className="grid grid-cols-3 gap-2">
                  <label className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer ${inspectionForm.cleanliness_check ? 'bg-green-50 border-green-300' : ''}`}>
                    <input
                      type="checkbox"
                      checked={inspectionForm.cleanliness_check}
                      onChange={(e) => setInspectionForm({ ...inspectionForm, cleanliness_check: e.target.checked })}
                    />
                    <span className="text-sm">청결상태</span>
                  </label>
                  <label className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer ${inspectionForm.organization_check ? 'bg-green-50 border-green-300' : ''}`}>
                    <input
                      type="checkbox"
                      checked={inspectionForm.organization_check}
                      onChange={(e) => setInspectionForm({ ...inspectionForm, organization_check: e.target.checked })}
                    />
                    <span className="text-sm">정리정돈</span>
                  </label>
                  <label className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer ${inspectionForm.pest_check ? 'bg-green-50 border-green-300' : ''}`}>
                    <input
                      type="checkbox"
                      checked={inspectionForm.pest_check}
                      onChange={(e) => setInspectionForm({ ...inspectionForm, pest_check: e.target.checked })}
                    />
                    <span className="text-sm">방충방서</span>
                  </label>
                </div>
              </div>

              <div>
                <Label>비고</Label>
                <textarea
                  value={inspectionForm.notes}
                  onChange={(e) => setInspectionForm({ ...inspectionForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowInspectionModal(false);
                    resetInspectionForm();
                  }}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
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
