'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Cpu,
  Plus,
  X,
  Loader2,
  Wifi,
  WifiOff,
  Thermometer,
  CheckCircle2,
  AlertCircle,
  Trash2,
  QrCode,
  Settings,
} from 'lucide-react';

interface RegisteredDevice {
  id: string;
  device_code: string;
  device_name: string;
  status: string;
  last_seen_at: string | null;
  wifi_ssid: string | null;
  wifi_signal_strength: number | null;
  sensor: {
    id: string;
    name: string;
    location: string | null;
    last_value: number | null;
    last_reading_at: string | null;
    alert_threshold_min: number | null;
    alert_threshold_max: number | null;
    status: string;
  } | null;
}

interface DeviceRegisterProps {
  onDeviceRegistered?: () => void;
}

export default function DeviceRegister({ onDeviceRegistered }: DeviceRegisterProps) {
  const [devices, setDevices] = useState<RegisteredDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  // 등록 폼
  const [deviceCode, setDeviceCode] = useState('');
  const [sensorName, setSensorName] = useState('');
  const [location, setLocation] = useState('');
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState('');
  const [registerSuccess, setRegisterSuccess] = useState<{
    device: { device_code: string };
    next_steps: string[];
  } | null>(null);

  const fetchDevices = useCallback(async () => {
    try {
      const response = await fetch('/api/devices/register');
      if (response.ok) {
        const data = await response.json();
        setDevices(data.devices || []);
      }
    } catch (error) {
      console.error('Failed to fetch devices:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices();
    // 30초마다 상태 갱신
    const interval = setInterval(fetchDevices, 30000);
    return () => clearInterval(interval);
  }, [fetchDevices]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegistering(true);
    setRegisterError('');
    setRegisterSuccess(null);

    try {
      const response = await fetch('/api/devices/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_code: deviceCode,
          sensor_name: sensorName || undefined,
          location: location || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '등록 실패');
      }

      setRegisterSuccess(result);
      setDeviceCode('');
      setSensorName('');
      setLocation('');
      fetchDevices();
      onDeviceRegistered?.();
    } catch (error) {
      setRegisterError(error instanceof Error ? error.message : '등록 실패');
    } finally {
      setRegistering(false);
    }
  };

  const handleDelete = async (deviceId: string, deviceCode: string) => {
    if (!confirm(`"${deviceCode}" 기기를 등록 해제하시겠습니까?\n연결된 센서 데이터도 함께 삭제됩니다.`)) {
      return;
    }

    try {
      const response = await fetch('/api/devices/register', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: deviceId }),
      });

      if (response.ok) {
        fetchDevices();
      }
    } catch (error) {
      console.error('Failed to delete device:', error);
    }
  };

  const formatCode = (code: string) => {
    // 입력값 정규화 (XXX-XXX-XXX 형식으로)
    const cleaned = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const parts = cleaned.match(/.{1,3}/g) || [];
    return parts.slice(0, 3).join('-');
  };

  const getStatusBadge = (device: RegisteredDevice) => {
    const isOnline = device.status === 'ACTIVE' &&
      device.last_seen_at &&
      new Date(device.last_seen_at) > new Date(Date.now() - 5 * 60 * 1000);

    if (isOnline) {
      return (
        <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
          <Wifi className="w-3 h-3" /> 온라인
        </span>
      );
    } else if (device.status === 'CLAIMED') {
      return (
        <span className="flex items-center gap-1 text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded-full">
          <WifiOff className="w-3 h-3" /> WiFi 설정 대기
        </span>
      );
    } else {
      return (
        <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
          <WifiOff className="w-3 h-3" /> 오프라인
        </span>
      );
    }
  };

  const getTimeSince = (dateString: string | null) => {
    if (!dateString) return '없음';
    const diff = Date.now() - new Date(dateString).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return '방금 전';
    if (minutes < 60) return `${minutes}분 전`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24);
    return `${days}일 전`;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold">IoT 센서 기기</h2>
          <p className="text-sm text-gray-500">등록된 기기 {devices.length}개</p>
        </div>
        <button
          onClick={() => {
            setShowRegisterModal(true);
            setRegisterSuccess(null);
            setRegisterError('');
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          기기 등록
        </button>
      </div>

      {/* 기기 목록 */}
      {devices.length === 0 ? (
        <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-12 text-center">
          <Cpu className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <h3 className="font-medium text-gray-600 mb-2">등록된 기기가 없습니다</h3>
          <p className="text-sm text-gray-500 mb-4">
            배송받은 센서 기기의 등록 코드를 입력하여 등록하세요
          </p>
          <button
            onClick={() => setShowRegisterModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            기기 등록하기
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {devices.map((device) => (
            <div
              key={device.id}
              className="bg-white border rounded-xl p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    device.status === 'ACTIVE' ? 'bg-blue-100' : 'bg-gray-100'
                  }`}>
                    <Thermometer className={`w-5 h-5 ${
                      device.status === 'ACTIVE' ? 'text-blue-600' : 'text-gray-400'
                    }`} />
                  </div>
                  <div>
                    <h3 className="font-medium">{device.sensor?.name || device.device_name}</h3>
                    <p className="text-xs text-gray-500">{device.device_code}</p>
                  </div>
                </div>
                {getStatusBadge(device)}
              </div>

              {device.sensor && (
                <div className="bg-gray-50 rounded-lg p-3 mb-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">현재 온도</span>
                    <span className={`text-lg font-bold ${
                      device.sensor.last_value !== null &&
                      ((device.sensor.alert_threshold_min !== null && device.sensor.last_value < device.sensor.alert_threshold_min) ||
                       (device.sensor.alert_threshold_max !== null && device.sensor.last_value > device.sensor.alert_threshold_max))
                        ? 'text-red-600'
                        : 'text-blue-600'
                    }`}>
                      {device.sensor.last_value !== null
                        ? `${device.sensor.last_value.toFixed(1)}°C`
                        : '--'}
                    </span>
                  </div>
                  {device.sensor.location && (
                    <p className="text-xs text-gray-500 mt-1">위치: {device.sensor.location}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    마지막 측정: {getTimeSince(device.sensor.last_reading_at)}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>
                  {device.wifi_ssid && (
                    <span className="flex items-center gap-1">
                      <Wifi className="w-3 h-3" />
                      {device.wifi_ssid}
                      {device.wifi_signal_strength && ` (${device.wifi_signal_strength}dBm)`}
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDelete(device.id, device.device_code)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                    title="등록 해제"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 등록 모달 */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-indigo-500 p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Cpu className="w-8 h-8" />
                  <div>
                    <h2 className="text-xl font-bold">기기 등록</h2>
                    <p className="text-blue-100 text-sm">센서 기기의 등록 코드를 입력하세요</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowRegisterModal(false)}
                  className="text-white/80 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {registerSuccess ? (
              <div className="p-6">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="text-lg font-bold text-green-600">등록 완료!</h3>
                  <p className="text-gray-600 mt-2">
                    기기 코드: <span className="font-mono font-bold">{registerSuccess.device.device_code}</span>
                  </p>
                </div>

                <div className="bg-blue-50 rounded-lg p-4 mb-6">
                  <h4 className="font-medium text-blue-800 mb-2 flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    다음 단계
                  </h4>
                  <ol className="text-sm text-blue-700 space-y-2">
                    {registerSuccess.next_steps.map((step, idx) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ol>
                </div>

                <button
                  onClick={() => setShowRegisterModal(false)}
                  className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  확인
                </button>
              </div>
            ) : (
              <form onSubmit={handleRegister} className="p-6 space-y-4">
                {registerError && (
                  <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    {registerError}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    등록 코드 *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={deviceCode}
                      onChange={(e) => setDeviceCode(formatCode(e.target.value))}
                      placeholder="ABC-123-XYZ"
                      className="w-full px-4 py-3 border rounded-lg text-center text-xl font-mono tracking-widest uppercase"
                      maxLength={11}
                      required
                      autoFocus
                    />
                    <QrCode className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    기기 뒷면 또는 포장지에 있는 9자리 코드
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    센서 이름
                  </label>
                  <input
                    type="text"
                    value={sensorName}
                    onChange={(e) => setSensorName(e.target.value)}
                    placeholder="예: 주방 냉장고 센서"
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    설치 위치
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="예: 1층 주방 냉장고"
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>

                <button
                  type="submit"
                  disabled={registering || deviceCode.length < 11}
                  className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {registering ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      기기 등록
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
