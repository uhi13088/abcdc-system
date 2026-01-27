'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Cpu,
  Wifi,
  WifiOff,
  Settings,
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  X,
  Link as LinkIcon
} from 'lucide-react';
import Link from 'next/link';
import { Label } from '@/components/ui/label';

interface CCPDefinition {
  id: string;
  ccp_number: string;
  process: string;
}

interface Sensor {
  id: string;
  name: string;
  sensor_code: string;
  status: string;
  last_reading_at: string | null;
  last_value: number | null;
  unit: string;
  ccp_definition_id: string | null;
}

interface Device {
  id: string;
  device_serial: string;
  device_type: string;
  status: string;
  firmware_version: string;
  last_seen_at: string | null;
  wifi_ssid: string | null;
  wifi_signal_strength: number | null;
  reading_interval_seconds: number;
  registered_at: string;
  sensor: Sensor | null;
}

const DEVICE_TYPE_LABELS: Record<string, string> = {
  TEMPERATURE: '온도 센서',
  HUMIDITY: '습도 센서',
  TEMPERATURE_HUMIDITY: '온습도 센서',
  PH: 'pH 센서',
  PRESSURE: '압력 센서',
  CO2: 'CO2 센서',
  DOOR: '도어 센서',
  WATER_LEAK: '누수 센서',
  OTHER: '기타',
};

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [ccpDefinitions, setCcpDefinitions] = useState<CCPDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [registerCode, setRegisterCode] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [deviceLocation, setDeviceLocation] = useState('');
  const [selectedCcpId, setSelectedCcpId] = useState('');
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchDevices = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const response = await fetch('/api/haccp/devices');
      if (response.ok) {
        const result = await response.json();
        setDevices(result.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch devices:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchCcpDefinitions = async () => {
    try {
      const response = await fetch('/api/haccp/ccp');
      if (response.ok) {
        const data = await response.json();
        setCcpDefinitions(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Failed to fetch CCP definitions:', error);
    }
  };

  useEffect(() => {
    fetchDevices();
    fetchCcpDefinitions();
    // 30초마다 자동 새로고침
    const interval = setInterval(() => fetchDevices(false), 30 * 1000);
    return () => clearInterval(interval);
  }, [fetchDevices]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setRegistering(true);

    try {
      const response = await fetch('/api/haccp/devices/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registration_code: registerCode,
          device_name: deviceName,
          location: deviceLocation,
          ccp_definition_id: selectedCcpId || null,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setSuccess('기기가 성공적으로 등록되었습니다!');
        setRegisterCode('');
        setDeviceName('');
        setDeviceLocation('');
        setSelectedCcpId('');
        fetchDevices();
        setTimeout(() => {
          setShowRegisterModal(false);
          setSuccess('');
        }, 2000);
      } else {
        setError(result.error || '기기 등록에 실패했습니다.');
      }
    } catch {
      setError('기기 등록에 실패했습니다.');
    } finally {
      setRegistering(false);
    }
  };

  const handleUpdateDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDevice) return;

    setError('');
    try {
      const response = await fetch(`/api/haccp/devices/${selectedDevice.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_name: deviceName,
          location: deviceLocation,
          ccp_definition_id: selectedCcpId || null,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setShowEditModal(false);
        fetchDevices();
      } else {
        setError(result.error || '수정에 실패했습니다.');
      }
    } catch {
      setError('수정에 실패했습니다.');
    }
  };

  const handleDelete = async (deviceId: string) => {
    try {
      const response = await fetch(`/api/haccp/devices/${deviceId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchDevices();
      } else {
        alert('삭제에 실패했습니다.');
      }
    } catch {
      alert('삭제에 실패했습니다.');
    }
    setDeleteConfirm(null);
  };

  const openEditModal = (device: Device) => {
    setSelectedDevice(device);
    setDeviceName(device.sensor?.name || '');
    setDeviceLocation(device.sensor?.sensor_code || '');
    setSelectedCcpId(device.sensor?.ccp_definition_id || '');
    setError('');
    setShowEditModal(true);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      REGISTERED: 'bg-blue-100 text-blue-800',
      ACTIVE: 'bg-green-100 text-green-800',
      OFFLINE: 'bg-yellow-100 text-yellow-800',
      MAINTENANCE: 'bg-orange-100 text-orange-800',
      DEACTIVATED: 'bg-red-100 text-red-800',
    };
    const labels: Record<string, string> = {
      REGISTERED: '등록완료',
      ACTIVE: '활성',
      OFFLINE: '오프라인',
      MAINTENANCE: '유지보수',
      DEACTIVATED: '비활성',
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {labels[status] || status}
      </span>
    );
  };

  const getWifiIcon = (device: Device) => {
    if (device.status === 'ACTIVE') {
      return <Wifi className="w-5 h-5 text-green-500" />;
    }
    if (device.status === 'OFFLINE') {
      return <WifiOff className="w-5 h-5 text-yellow-500" />;
    }
    return <Wifi className="w-5 h-5 text-gray-400" />;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('ko-KR');
  };

  const stats = {
    total: devices.length,
    active: devices.filter(d => d.status === 'ACTIVE').length,
    offline: devices.filter(d => d.status === 'OFFLINE').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">IoT 기기 관리</h1>
          <p className="text-gray-600">등록된 IoT 기기를 관리하고 새 기기를 등록합니다</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => fetchDevices(true)}
            disabled={refreshing}
            className="p-2 text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => {
              setRegisterCode('');
              setDeviceName('');
              setDeviceLocation('');
              setSelectedCcpId('');
              setError('');
              setSuccess('');
              setShowRegisterModal(true);
            }}
            className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-700"
          >
            <Plus className="w-5 h-5 mr-2" />
            기기 등록
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">전체 기기</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <Cpu className="w-8 h-8 text-gray-400" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">활성 기기</p>
              <p className="text-2xl font-bold text-green-600">{stats.active}</p>
            </div>
            <Wifi className="w-8 h-8 text-green-400" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">오프라인</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.offline}</p>
            </div>
            <WifiOff className="w-8 h-8 text-yellow-400" />
          </div>
        </div>
      </div>

      {/* Devices Grid */}
      {devices.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <Cpu className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">등록된 기기가 없습니다</h3>
          <p className="text-gray-500 mb-4">
            IoT 기기를 등록하여 실시간 모니터링을 시작하세요
          </p>
          <button
            onClick={() => setShowRegisterModal(true)}
            className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-700"
          >
            <Plus className="w-5 h-5 mr-2" />
            첫 기기 등록하기
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {devices.map((device) => (
            <div key={device.id} className="bg-white rounded-lg shadow p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center">
                  {getWifiIcon(device)}
                  <div className="ml-3">
                    <h3 className="font-medium text-gray-900">
                      {device.sensor?.name || device.device_serial}
                    </h3>
                    <p className="text-sm text-gray-500">{device.device_serial}</p>
                  </div>
                </div>
                {getStatusBadge(device.status)}
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">타입</span>
                  <span className="text-gray-900">
                    {DEVICE_TYPE_LABELS[device.device_type] || device.device_type}
                  </span>
                </div>
                {device.sensor && device.sensor.last_value !== null && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">현재값</span>
                    <span className="text-gray-900 font-medium">
                      {device.sensor.last_value}{device.sensor.unit}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">마지막 연결</span>
                  <span className="text-gray-900">{formatDate(device.last_seen_at)}</span>
                </div>
                {device.wifi_ssid && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">WiFi</span>
                    <span className="text-gray-900">
                      {device.wifi_ssid}
                      {device.wifi_signal_strength && ` (${device.wifi_signal_strength}dBm)`}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-2 mt-4 pt-4 border-t">
                <Link
                  href={`/devices/${device.id}`}
                  className="p-2 text-gray-500 hover:text-primary hover:bg-gray-100 rounded"
                >
                  <Settings className="w-5 h-5" />
                </Link>
                <button
                  onClick={() => openEditModal(device)}
                  className="p-2 text-gray-500 hover:text-primary hover:bg-gray-100 rounded"
                >
                  <LinkIcon className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setDeleteConfirm(device.id)}
                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-gray-100 rounded"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              {deleteConfirm === device.id && (
                <div className="mt-3 p-3 bg-red-50 rounded-lg">
                  <p className="text-sm text-red-600 mb-2">정말 이 기기를 등록 해제하시겠습니까?</p>
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-200 rounded"
                    >
                      취소
                    </button>
                    <button
                      onClick={() => handleDelete(device.id)}
                      className="px-3 py-1 text-sm text-white bg-red-600 hover:bg-red-700 rounded"
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

      {/* Register Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">새 기기 등록</h2>
              <button
                onClick={() => setShowRegisterModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-md text-sm flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2" />
                {error}
              </div>
            )}

            {success && (
              <div className="mb-4 p-3 bg-green-50 text-green-600 rounded-md text-sm flex items-center">
                <CheckCircle className="w-5 h-5 mr-2" />
                {success}
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <Label required>등록코드</Label>
                <input
                  type="text"
                  required
                  value={registerCode}
                  onChange={(e) => setRegisterCode(e.target.value.toUpperCase())}
                  placeholder="예: ABC123"
                  maxLength={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono text-lg tracking-widest text-center"
                />
                <p className="mt-1 text-xs text-gray-500">
                  기기 구매 시 제공받은 6자리 등록코드를 입력하세요
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">기기 이름</label>
                <input
                  type="text"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  placeholder="예: 냉장고 온도센서"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">설치 위치</label>
                <input
                  type="text"
                  value={deviceLocation}
                  onChange={(e) => setDeviceLocation(e.target.value)}
                  placeholder="예: 주방 냉장고"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CCP 연결 (선택)</label>
                <select
                  value={selectedCcpId}
                  onChange={(e) => setSelectedCcpId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="">선택 안함</option>
                  {ccpDefinitions.map((ccp) => (
                    <option key={ccp.id} value={ccp.id}>
                      {ccp.ccp_number} - {ccp.process}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  CCP에 연결하면 측정값이 자동으로 CCP 기록에 반영됩니다
                </p>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={registering || !registerCode}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {registering ? '등록 중...' : '기기 등록'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedDevice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">기기 설정</h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-md text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleUpdateDevice} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">시리얼번호</label>
                <input
                  type="text"
                  value={selectedDevice.device_serial}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">기기 이름</label>
                <input
                  type="text"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">설치 위치</label>
                <input
                  type="text"
                  value={deviceLocation}
                  onChange={(e) => setDeviceLocation(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CCP 연결</label>
                <select
                  value={selectedCcpId}
                  onChange={(e) => setSelectedCcpId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="">선택 안함</option>
                  {ccpDefinitions.map((ccp) => (
                    <option key={ccp.id} value={ccp.id}>
                      {ccp.ccp_number} - {ccp.process}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-700"
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
