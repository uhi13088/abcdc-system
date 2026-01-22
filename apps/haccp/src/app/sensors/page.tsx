'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Wifi, WifiOff, Settings, AlertTriangle, X, Edit2, Trash2, RefreshCw, Activity } from 'lucide-react';
import { Label } from '@/components/ui/label';
import Link from 'next/link';

interface CCPDefinition {
  id: string;
  ccp_number: string;
  process: string;
}

interface IoTSensor {
  id: string;
  sensor_name: string;
  sensor_type: 'TEMPERATURE' | 'HUMIDITY' | 'PH' | 'PRESSURE' | 'FLOW' | 'WEIGHT' | 'OTHER';
  protocol: 'MQTT' | 'HTTP' | 'BLE' | 'MODBUS' | 'SERIAL';
  connection_string?: string;
  device_id?: string;
  location?: string;
  ccp_definition_id?: string;
  ccp_definition?: CCPDefinition;
  reading_interval_seconds: number;
  alert_enabled: boolean;
  calibration_offset: number;
  last_calibrated_at?: string;
  calibration_due_at?: string;
  is_active: boolean;
  last_reading_at?: string;
  last_reading_value?: number;
  status: 'ONLINE' | 'OFFLINE' | 'UNKNOWN';
  created_at: string;
}

export default function SensorsPage() {
  const [sensors, setSensors] = useState<IoTSensor[]>([]);
  const [ccpDefinitions, setCcpDefinitions] = useState<CCPDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedSensor, setSelectedSensor] = useState<IoTSensor | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    sensor_name: '',
    sensor_type: 'TEMPERATURE' as IoTSensor['sensor_type'],
    protocol: 'HTTP' as IoTSensor['protocol'],
    connection_string: '',
    device_id: '',
    location: '',
    ccp_definition_id: '',
    reading_interval_seconds: 60,
    alert_enabled: true,
    calibration_offset: 0,
    calibration_due_at: '',
    is_active: true,
  });

  const fetchSensors = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      params.set('include_readings', 'false');

      const response = await fetch(`/api/haccp/sensors?${params}`);
      if (response.ok) {
        const data = await response.json();
        setSensors(data);
      }
    } catch (error) {
      console.error('Failed to fetch sensors:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filterStatus]);

  const fetchCcpDefinitions = async () => {
    try {
      const response = await fetch('/api/haccp/ccp');
      if (response.ok) {
        const data = await response.json();
        setCcpDefinitions(data);
      }
    } catch (error) {
      console.error('Failed to fetch CCP definitions:', error);
    }
  };

  useEffect(() => {
    fetchSensors();
    fetchCcpDefinitions();
    // 30초마다 자동 새로고침
    const interval = setInterval(() => fetchSensors(false), 30 * 1000);
    return () => clearInterval(interval);
  }, [fetchSensors]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editMode ? 'PUT' : 'POST';
      const url = editMode ? `/api/haccp/sensors/${selectedSensor?.id}` : '/api/haccp/sensors';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          ccp_definition_id: formData.ccp_definition_id || null,
          calibration_due_at: formData.calibration_due_at || null,
        }),
      });

      if (response.ok) {
        setShowModal(false);
        fetchSensors();
        resetForm();
      }
    } catch (error) {
      console.error('Failed to save sensor:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/haccp/sensors/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchSensors();
        setDeleteConfirm(null);
      }
    } catch (error) {
      console.error('Failed to delete sensor:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      sensor_name: '',
      sensor_type: 'TEMPERATURE',
      protocol: 'HTTP',
      connection_string: '',
      device_id: '',
      location: '',
      ccp_definition_id: '',
      reading_interval_seconds: 60,
      alert_enabled: true,
      calibration_offset: 0,
      calibration_due_at: '',
      is_active: true,
    });
    setEditMode(false);
    setSelectedSensor(null);
  };

  const handleEdit = (sensor: IoTSensor) => {
    setSelectedSensor(sensor);
    setFormData({
      sensor_name: sensor.sensor_name,
      sensor_type: sensor.sensor_type,
      protocol: sensor.protocol,
      connection_string: sensor.connection_string || '',
      device_id: sensor.device_id || '',
      location: sensor.location || '',
      ccp_definition_id: sensor.ccp_definition_id || '',
      reading_interval_seconds: sensor.reading_interval_seconds,
      alert_enabled: sensor.alert_enabled,
      calibration_offset: sensor.calibration_offset,
      calibration_due_at: sensor.calibration_due_at?.split('T')[0] || '',
      is_active: sensor.is_active,
    });
    setEditMode(true);
    setShowModal(true);
  };

  const sensorTypeText: Record<string, string> = {
    'TEMPERATURE': '온도 센서',
    'HUMIDITY': '습도 센서',
    'PH': 'pH 센서',
    'PRESSURE': '압력 센서',
    'FLOW': '유량 센서',
    'WEIGHT': '중량 센서',
    'OTHER': '기타',
  };

  const protocolText: Record<string, string> = {
    'MQTT': 'MQTT',
    'HTTP': 'HTTP/REST',
    'BLE': 'Bluetooth LE',
    'MODBUS': 'Modbus TCP',
    'SERIAL': 'Serial',
  };

  const statusColors: Record<string, string> = {
    'ONLINE': 'bg-green-100 text-green-700',
    'OFFLINE': 'bg-red-100 text-red-700',
    'UNKNOWN': 'bg-gray-100 text-gray-700',
  };

  const statusText: Record<string, string> = {
    'ONLINE': '온라인',
    'OFFLINE': '오프라인',
    'UNKNOWN': '알 수 없음',
  };

  const getUnit = (type: string) => {
    switch (type) {
      case 'TEMPERATURE': return '°C';
      case 'HUMIDITY': return '%';
      case 'PH': return 'pH';
      case 'PRESSURE': return 'bar';
      case 'FLOW': return 'L/min';
      case 'WEIGHT': return 'kg';
      default: return '';
    }
  };

  const formatLastReading = (sensor: IoTSensor) => {
    if (sensor.last_reading_value === null || sensor.last_reading_value === undefined) {
      return '-';
    }
    return `${sensor.last_reading_value.toFixed(1)}${getUnit(sensor.sensor_type)}`;
  };

  const formatTime = (isoString: string | undefined) => {
    if (!isoString) return '-';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return '방금 전';
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}시간 전`;
    return date.toLocaleDateString('ko-KR');
  };

  const onlineCount = sensors.filter(s => s.status === 'ONLINE').length;
  const offlineCount = sensors.filter(s => s.status === 'OFFLINE').length;
  const alertEnabledCount = sensors.filter(s => s.alert_enabled).length;

  const filteredSensors = filterStatus
    ? sensors.filter(s => {
        if (filterStatus === 'active') return s.is_active;
        if (filterStatus === 'inactive') return !s.is_active;
        return true;
      })
    : sensors;

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">IoT 센서 관리</h1>
          <p className="mt-1 text-sm text-gray-500">실시간 센서 모니터링 및 관리</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => fetchSensors(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            새로고침
          </button>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            센서 등록
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="flex items-center gap-2 mb-2">
            <Settings className="w-4 h-4 text-blue-500" />
            <p className="text-sm text-gray-500">전체 센서</p>
          </div>
          <p className="text-2xl font-bold">{sensors.length}개</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="flex items-center gap-2 mb-2">
            <Wifi className="w-4 h-4 text-green-500" />
            <p className="text-sm text-gray-500">온라인</p>
          </div>
          <p className="text-2xl font-bold text-green-600">{onlineCount}개</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="flex items-center gap-2 mb-2">
            <WifiOff className="w-4 h-4 text-red-500" />
            <p className="text-sm text-gray-500">오프라인</p>
          </div>
          <p className="text-2xl font-bold text-red-600">{offlineCount}개</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-yellow-500" />
            <p className="text-sm text-gray-500">알림 활성화</p>
          </div>
          <p className="text-2xl font-bold">{alertEnabledCount}개</p>
        </div>
      </div>

      {/* Offline Alert */}
      {offlineCount > 0 && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <WifiOff className="w-5 h-5 text-red-600" />
            <span className="font-medium text-red-800">오프라인 센서 감지 ({offlineCount}개)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {sensors.filter(s => s.status === 'OFFLINE').map(s => (
              <span key={s.id} className="text-sm bg-red-100 text-red-700 px-2 py-1 rounded">
                {s.sensor_name} - {s.location || '위치 미지정'}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex gap-4 items-center">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm"
        >
          <option value="">모든 센서</option>
          <option value="active">활성 센서만</option>
          <option value="inactive">비활성 센서만</option>
        </select>
      </div>

      {/* Sensors Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredSensors.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <Wifi className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">등록된 센서가 없습니다</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 text-blue-600 hover:text-blue-700"
          >
            새 센서 등록하기
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSensors.map((sensor) => (
            <div
              key={sensor.id}
              className={`bg-white rounded-xl shadow-sm border p-4 hover:shadow-md transition-shadow ${
                sensor.status === 'OFFLINE' ? 'border-red-200' : ''
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {sensor.status === 'ONLINE' ? (
                    <Wifi className="w-5 h-5 text-green-500" />
                  ) : sensor.status === 'OFFLINE' ? (
                    <WifiOff className="w-5 h-5 text-red-500" />
                  ) : (
                    <Wifi className="w-5 h-5 text-gray-400" />
                  )}
                  <div>
                    <h3 className="font-semibold">{sensor.sensor_name}</h3>
                    <p className="text-xs text-gray-500">{sensor.device_id || '-'}</p>
                  </div>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${statusColors[sensor.status]}`}>
                  {statusText[sensor.status]}
                </span>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">유형</span>
                  <span>{sensorTypeText[sensor.sensor_type]}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">위치</span>
                  <span>{sensor.location || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">프로토콜</span>
                  <span>{protocolText[sensor.protocol]}</span>
                </div>
                {sensor.ccp_definition && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">연결 CCP</span>
                    <span className="text-blue-600">{sensor.ccp_definition.ccp_number}</span>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">최근 측정값</p>
                    <p className="text-lg font-bold">{formatLastReading(sensor)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">마지막 수신</p>
                    <p className="text-sm">{formatTime(sensor.last_reading_at)}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t flex gap-2">
                <Link
                  href={`/sensors/${sensor.id}`}
                  className="flex-1 text-center py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
                >
                  <Activity className="w-4 h-4 inline mr-1" />
                  상세보기
                </Link>
                <button
                  onClick={() => handleEdit(sensor)}
                  className="flex-1 text-center py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg"
                >
                  <Edit2 className="w-4 h-4 inline mr-1" />
                  수정
                </button>
                <button
                  onClick={() => setDeleteConfirm(sensor.id)}
                  className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-bold mb-2">센서 삭제</h3>
            <p className="text-gray-600 mb-4">
              이 센서를 삭제하시겠습니까? 관련된 모든 측정 기록도 함께 삭제됩니다.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">{editMode ? '센서 수정' : '새 센서 등록'}</h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label required>센서 이름</Label>
                  <input
                    type="text"
                    value={formData.sensor_name}
                    onChange={(e) => setFormData({ ...formData, sensor_name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="예: 냉장고 #1 온도센서"
                    required
                  />
                </div>
                <div>
                  <Label>디바이스 ID</Label>
                  <input
                    type="text"
                    value={formData.device_id}
                    onChange={(e) => setFormData({ ...formData, device_id: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="예: TEMP-001"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label required>센서 유형</Label>
                  <select
                    value={formData.sensor_type}
                    onChange={(e) => setFormData({ ...formData, sensor_type: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    {Object.entries(sensorTypeText).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label required>통신 프로토콜</Label>
                  <select
                    value={formData.protocol}
                    onChange={(e) => setFormData({ ...formData, protocol: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    {Object.entries(protocolText).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <Label>설치 위치</Label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="예: 1공장 냉장창고"
                />
              </div>

              <div>
                <Label>연결 문자열 / URL</Label>
                <input
                  type="text"
                  value={formData.connection_string}
                  onChange={(e) => setFormData({ ...formData, connection_string: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="예: mqtt://broker:1883 또는 http://sensor-api/data"
                />
              </div>

              <div>
                <Label>연결할 CCP</Label>
                <select
                  value={formData.ccp_definition_id}
                  onChange={(e) => setFormData({ ...formData, ccp_definition_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">선택 안함</option>
                  {ccpDefinitions.map((ccp) => (
                    <option key={ccp.id} value={ccp.id}>
                      {ccp.ccp_number} - {ccp.process}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  CCP에 연결하면 측정값이 자동으로 한계기준과 비교됩니다
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>측정 주기 (초)</Label>
                  <input
                    type="number"
                    min="10"
                    value={formData.reading_interval_seconds}
                    onChange={(e) => setFormData({ ...formData, reading_interval_seconds: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <Label>보정 오프셋</Label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.calibration_offset}
                    onChange={(e) => setFormData({ ...formData, calibration_offset: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    측정값에 이 값이 더해집니다
                  </p>
                </div>
              </div>

              <div>
                <Label>다음 교정일</Label>
                <input
                  type="date"
                  value={formData.calibration_due_at}
                  onChange={(e) => setFormData({ ...formData, calibration_due_at: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.alert_enabled}
                    onChange={(e) => setFormData({ ...formData, alert_enabled: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm">한계 이탈 시 알림 활성화</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm">센서 활성화</span>
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
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
