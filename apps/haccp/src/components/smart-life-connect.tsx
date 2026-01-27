'use client';

import { useState, useEffect, useCallback } from 'react';
import { Wifi, WifiOff, RefreshCw, X, Plus, Loader2, Smartphone, ThermometerSun } from 'lucide-react';

interface TuyaDevice {
  id: string;
  tuya_device_id: string;
  device_name: string;
  category: string;
  product_name: string;
  is_online: boolean;
  icon: string;
  linked_sensor_id: string | null;
  last_status: Array<{ code: string; value: unknown }>;
  synced_at: string;
}

interface CCPDefinition {
  id: string;
  ccp_number: string;
  process: string;
}

interface SmartLifeConnectProps {
  onDeviceRegistered?: () => void;
}

export default function SmartLifeConnect({ onDeviceRegistered }: SmartLifeConnectProps) {
  const [connectionStatus, setConnectionStatus] = useState<{
    available: boolean;
    connected: boolean;
    tuya_uid: string | null;
    device_count: number;
    message?: string;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showDevicesModal, setShowDevicesModal] = useState(false);
  const [devices, setDevices] = useState<TuyaDevice[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [ccpDefinitions, setCcpDefinitions] = useState<CCPDefinition[]>([]);

  // Login form
  const [loginForm, setLoginForm] = useState({
    country_code: '82',
    username: '',
    password: '',
  });
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Device registration
  const [selectedDevice, setSelectedDevice] = useState<TuyaDevice | null>(null);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    sensor_name: '',
    sensor_type: 'TEMPERATURE',
    location: '',
    ccp_definition_id: '',
  });
  const [registerLoading, setRegisterLoading] = useState(false);

  const fetchConnectionStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/tuya/oauth');
      if (response.ok) {
        const data = await response.json();
        setConnectionStatus(data);
      }
    } catch (error) {
      console.error('Failed to fetch connection status:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDevices = useCallback(async (sync = false) => {
    if (sync) setSyncing(true);
    try {
      const url = sync ? '/api/tuya/devices?sync=true' : '/api/tuya/devices';
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setDevices(data.devices || []);
      }
    } catch (error) {
      console.error('Failed to fetch devices:', error);
    } finally {
      setSyncing(false);
    }
  }, []);

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
    fetchConnectionStatus();
    fetchCcpDefinitions();
  }, [fetchConnectionStatus]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');

    try {
      const response = await fetch('/api/tuya/oauth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '로그인 실패');
      }

      setShowLoginModal(false);
      fetchConnectionStatus();
      setLoginForm({ country_code: '82', username: '', password: '' });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '로그인 실패';
      setLoginError(errorMessage);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Smart Life 연결을 해제하시겠습니까?\n연결된 모든 기기 정보도 함께 삭제됩니다.')) {
      return;
    }

    try {
      await fetch('/api/tuya/oauth', { method: 'DELETE' });
      fetchConnectionStatus();
      setDevices([]);
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  };

  const handleOpenDevices = async () => {
    setShowDevicesModal(true);
    await fetchDevices(true);
  };

  const handleRegisterDevice = (device: TuyaDevice) => {
    setSelectedDevice(device);
    setRegisterForm({
      sensor_name: device.device_name,
      sensor_type: device.category === 'wsdcg' ? 'TEMPERATURE' : 'OTHER',
      location: '',
      ccp_definition_id: '',
    });
    setShowRegisterModal(true);
  };

  const handleSubmitRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDevice) return;

    setRegisterLoading(true);
    try {
      const response = await fetch('/api/tuya/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tuya_device_id: selectedDevice.tuya_device_id,
          ...registerForm,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '등록 실패');
      }

      setShowRegisterModal(false);
      setSelectedDevice(null);
      fetchDevices();
      onDeviceRegistered?.();
    } catch (error) {
      console.error('Failed to register device:', error);
      alert(error instanceof Error ? error.message : '등록 실패');
    } finally {
      setRegisterLoading(false);
    }
  };

  const getCategoryText = (category: string) => {
    const categories: Record<string, string> = {
      wsdcg: '온습도 센서',
      mcs: '자석 센서',
      pir: '동작 센서',
      ldcg: '누수 센서',
      kg: '가스 경보기',
      ywbj: '연기 감지기',
      wk: '온도조절기',
    };
    return categories[category] || category;
  };

  const getDeviceTemperature = (device: TuyaDevice) => {
    const tempStatus = device.last_status?.find(
      (s) => s.code === 'va_temperature' || s.code === 'temp_current'
    );
    if (tempStatus && typeof tempStatus.value === 'number') {
      return (tempStatus.value / 10).toFixed(1) + '°C';
    }
    return null;
  };

  const getDeviceHumidity = (device: TuyaDevice) => {
    const humidStatus = device.last_status?.find(
      (s) => s.code === 'va_humidity' || s.code === 'humidity_value'
    );
    if (humidStatus && typeof humidStatus.value === 'number') {
      return humidStatus.value + '%';
    }
    return null;
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

  if (!connectionStatus?.available) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
        <Smartphone className="w-10 h-10 mx-auto mb-3 text-gray-300" />
        <p className="text-gray-500 text-sm">
          {connectionStatus?.message || 'Smart Life 연동이 비활성화 되어있습니다.'}
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Connection Card */}
      <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/30">
              <ThermometerSun className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Smart Life IoT</h3>
              {connectionStatus.connected ? (
                <p className="text-sm text-green-600 flex items-center gap-1">
                  <Wifi className="w-3 h-3" />
                  연결됨 · 기기 {connectionStatus.device_count}개
                </p>
              ) : (
                <p className="text-sm text-gray-500">Smart Life 앱 기기를 연결하세요</p>
              )}
            </div>
          </div>

          {connectionStatus.connected ? (
            <div className="flex gap-2">
              <button
                onClick={handleOpenDevices}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-sm font-medium"
              >
                기기 관리
              </button>
              <button
                onClick={handleDisconnect}
                className="px-3 py-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg text-sm"
              >
                연결 해제
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowLoginModal(true)}
              className="px-6 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 text-sm font-medium shadow-lg shadow-orange-500/30 flex items-center gap-2"
            >
              <Smartphone className="w-4 h-4" />
              Smart Life 로그인
            </button>
          )}
        </div>

        {!connectionStatus.connected && (
          <div className="mt-4 pt-4 border-t border-orange-200">
            <p className="text-xs text-orange-700">
              Smart Life 또는 Tuya Smart 앱 계정으로 로그인하면 앱에 등록된 온도/습도 센서를 자동으로 가져옵니다.
            </p>
          </div>
        )}
      </div>

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ThermometerSun className="w-8 h-8" />
                  <div>
                    <h2 className="text-xl font-bold">Smart Life 로그인</h2>
                    <p className="text-orange-100 text-sm">계정 정보를 입력하세요</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowLoginModal(false)}
                  className="text-white/80 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleLogin} className="p-6 space-y-4">
              {loginError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
                  {loginError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  국가 코드
                </label>
                <select
                  value={loginForm.country_code}
                  onChange={(e) => setLoginForm({ ...loginForm, country_code: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="82">대한민국 (+82)</option>
                  <option value="1">미국 (+1)</option>
                  <option value="86">중국 (+86)</option>
                  <option value="81">일본 (+81)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이메일 또는 전화번호
                </label>
                <input
                  type="text"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                  placeholder="smart@life.com"
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  비밀번호
                </label>
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-medium flex items-center justify-center gap-2"
              >
                {loginLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Smartphone className="w-4 h-4" />
                    로그인
                  </>
                )}
              </button>

              <p className="text-xs text-gray-500 text-center">
                Smart Life 또는 Tuya Smart 앱과 동일한 계정 정보를 사용하세요
              </p>
            </form>
          </div>
        </div>
      )}

      {/* Devices Modal */}
      {showDevicesModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-2xl mx-4 max-h-[85vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Smart Life 기기</h2>
                <p className="text-sm text-gray-500">
                  기기를 HACCP 센서로 등록하세요
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchDevices(true)}
                  disabled={syncing}
                  className="px-3 py-2 border rounded-lg text-sm flex items-center gap-2 hover:bg-gray-50"
                >
                  <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                  동기화
                </button>
                <button
                  onClick={() => setShowDevicesModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {devices.length === 0 ? (
                <div className="text-center py-12">
                  <Smartphone className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-gray-500">등록된 기기가 없습니다</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Smart Life 앱에서 기기를 먼저 추가하세요
                  </p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {devices.map((device) => (
                    <div
                      key={device.id}
                      className={`border rounded-xl p-4 ${
                        device.is_online ? 'bg-white' : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          {device.icon ? (
                            <img
                              src={device.icon}
                              alt={device.device_name}
                              className="w-10 h-10 rounded-lg"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                              <ThermometerSun className="w-5 h-5 text-gray-400" />
                            </div>
                          )}
                          <div>
                            <h3 className="font-medium">{device.device_name}</h3>
                            <p className="text-sm text-gray-500">
                              {getCategoryText(device.category)}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              {device.is_online ? (
                                <span className="text-xs text-green-600 flex items-center gap-1">
                                  <Wifi className="w-3 h-3" /> 온라인
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400 flex items-center gap-1">
                                  <WifiOff className="w-3 h-3" /> 오프라인
                                </span>
                              )}
                              {getDeviceTemperature(device) && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                  {getDeviceTemperature(device)}
                                </span>
                              )}
                              {getDeviceHumidity(device) && (
                                <span className="text-xs bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded">
                                  {getDeviceHumidity(device)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {device.linked_sensor_id ? (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                            센서 등록됨
                          </span>
                        ) : (
                          <button
                            onClick={() => handleRegisterDevice(device)}
                            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            센서 등록
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Register Device Modal */}
      {showRegisterModal && selectedDevice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-md mx-4">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold">센서로 등록</h2>
              <p className="text-sm text-gray-500">
                {selectedDevice.device_name}을(를) IoT 센서로 등록합니다
              </p>
            </div>

            <form onSubmit={handleSubmitRegister} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  센서 이름
                </label>
                <input
                  type="text"
                  value={registerForm.sensor_name}
                  onChange={(e) =>
                    setRegisterForm({ ...registerForm, sensor_name: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  센서 유형
                </label>
                <select
                  value={registerForm.sensor_type}
                  onChange={(e) =>
                    setRegisterForm({ ...registerForm, sensor_type: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="TEMPERATURE">온도 센서</option>
                  <option value="HUMIDITY">습도 센서</option>
                  <option value="OTHER">기타</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  설치 위치
                </label>
                <input
                  type="text"
                  value={registerForm.location}
                  onChange={(e) =>
                    setRegisterForm({ ...registerForm, location: e.target.value })
                  }
                  placeholder="예: 냉장창고 1번"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  연결할 CCP (선택)
                </label>
                <select
                  value={registerForm.ccp_definition_id}
                  onChange={(e) =>
                    setRegisterForm({ ...registerForm, ccp_definition_id: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">선택 안함</option>
                  {ccpDefinitions.map((ccp) => (
                    <option key={ccp.id} value={ccp.id}>
                      {ccp.ccp_number} - {ccp.process}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowRegisterModal(false);
                    setSelectedDevice(null);
                  }}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={registerLoading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  {registerLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      등록
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
