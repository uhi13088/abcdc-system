'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Cpu,
  Wifi,
  WifiOff,
  Activity,
  Settings,
  RefreshCw,
  Thermometer,
  Clock,
  AlertTriangle
} from 'lucide-react';
import Link from 'next/link';

interface Reading {
  id: string;
  value: number;
  unit: string;
  secondary_value: number | null;
  secondary_unit: string | null;
  is_within_range: boolean;
  is_alert: boolean;
  reading_time: string;
}

interface Event {
  id: string;
  event_type: string;
  event_data: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

interface Sensor {
  id: string;
  name: string;
  sensor_code: string;
  status: string;
  last_reading_at: string | null;
  last_value: number | null;
  unit: string;
  min_value: number | null;
  max_value: number | null;
  alert_enabled: boolean;
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
  events: Event[];
  recent_readings: Reading[];
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

const EVENT_TYPE_LABELS: Record<string, string> = {
  CREATED: '기기 생성',
  REGISTERED: '등록 완료',
  ACTIVATED: '활성화',
  DEACTIVATED: '비활성화',
  CONNECTED: '연결됨',
  DISCONNECTED: '연결 끊김',
  FIRMWARE_UPDATE: '펌웨어 업데이트',
  CONFIG_CHANGED: '설정 변경',
  ERROR: '오류 발생',
  MAINTENANCE_START: '유지보수 시작',
  MAINTENANCE_END: '유지보수 종료',
};

export default function DeviceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [device, setDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDevice = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const response = await fetch(`/api/haccp/devices/${resolvedParams.id}`);
      if (response.ok) {
        const result = await response.json();
        setDevice(result.data || null);
      } else if (response.status === 404) {
        router.push('/devices');
      }
    } catch (error) {
      console.error('Failed to fetch device:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [resolvedParams.id, router]);

  useEffect(() => {
    fetchDevice();
    // 30초마다 자동 새로고침
    const interval = setInterval(() => fetchDevice(false), 30 * 1000);
    return () => clearInterval(interval);
  }, [fetchDevice]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('ko-KR');
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
      <span className={`px-3 py-1 text-sm font-medium rounded-full ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {labels[status] || status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!device) {
    return (
      <div className="text-center py-12">
        <Cpu className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">기기를 찾을 수 없습니다</p>
        <Link href="/devices" className="mt-4 text-primary hover:underline">
          기기 목록으로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link
            href="/devices"
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {device.sensor?.name || device.device_serial}
            </h1>
            <p className="text-gray-500">{device.device_serial}</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => fetchDevice(true)}
            disabled={refreshing}
            className="p-2 text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          {getStatusBadge(device.status)}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Current Value & Info */}
        <div className="lg:col-span-1 space-y-6">
          {/* Current Value Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">현재 측정값</h2>
              {device.status === 'ACTIVE' ? (
                <Wifi className="w-6 h-6 text-green-500" />
              ) : (
                <WifiOff className="w-6 h-6 text-yellow-500" />
              )}
            </div>

            <div className="text-center py-6">
              {device.sensor && device.sensor.last_value !== null ? (
                <>
                  <div className="text-5xl font-bold text-gray-900">
                    {device.sensor.last_value}
                    <span className="text-2xl text-gray-500">{device.sensor.unit}</span>
                  </div>
                  {device.sensor.min_value !== null && device.sensor.max_value !== null && (
                    <div className="mt-2 text-sm text-gray-500">
                      허용 범위: {device.sensor.min_value} ~ {device.sensor.max_value}{device.sensor.unit}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-gray-400">데이터 없음</div>
              )}
            </div>

            <div className="text-center text-sm text-gray-500">
              마지막 업데이트: {formatDate(device.last_seen_at)}
            </div>
          </div>

          {/* Device Info Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">기기 정보</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">타입</span>
                <span className="text-gray-900">
                  {DEVICE_TYPE_LABELS[device.device_type] || device.device_type}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">펌웨어</span>
                <span className="text-gray-900">v{device.firmware_version}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">측정 주기</span>
                <span className="text-gray-900">{device.reading_interval_seconds}초</span>
              </div>
              {device.wifi_ssid && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">WiFi</span>
                    <span className="text-gray-900">{device.wifi_ssid}</span>
                  </div>
                  {device.wifi_signal_strength && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">신호 강도</span>
                      <span className="text-gray-900">{device.wifi_signal_strength} dBm</span>
                    </div>
                  )}
                </>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">등록일</span>
                <span className="text-gray-900">{formatDate(device.registered_at)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Readings & Events */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Readings */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">최근 측정 기록</h2>
            </div>
            {device.recent_readings && device.recent_readings.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        시간
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        측정값
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        상태
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {device.recent_readings.slice(0, 20).map((reading) => (
                      <tr key={reading.id} className="hover:bg-gray-50">
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(reading.reading_time)}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap">
                          <span className="text-sm font-medium text-gray-900">
                            {reading.value}{reading.unit}
                          </span>
                          {reading.secondary_value !== null && (
                            <span className="text-sm text-gray-500 ml-2">
                              / {reading.secondary_value}{reading.secondary_unit}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap">
                          {reading.is_alert ? (
                            <span className="flex items-center text-red-600">
                              <AlertTriangle className="w-4 h-4 mr-1" />
                              이탈
                            </span>
                          ) : reading.is_within_range ? (
                            <span className="text-green-600">정상</span>
                          ) : (
                            <span className="text-yellow-600">확인필요</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">
                측정 기록이 없습니다
              </div>
            )}
          </div>

          {/* Events Log */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">이벤트 로그</h2>
            </div>
            {device.events && device.events.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {device.events.slice(0, 10).map((event) => (
                  <div key={event.id} className="px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 rounded-full bg-primary"></div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {EVENT_TYPE_LABELS[event.event_type] || event.event_type}
                        </p>
                        {event.ip_address && (
                          <p className="text-xs text-gray-500">IP: {event.ip_address}</p>
                        )}
                      </div>
                    </div>
                    <span className="text-sm text-gray-500">{formatDate(event.created_at)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">
                이벤트 기록이 없습니다
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
