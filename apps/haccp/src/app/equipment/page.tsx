'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Thermometer,
  Wifi,
  WifiOff,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Clock,
  Plus,
  Settings,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import Link from 'next/link';

interface TemperatureRecord {
  id: string;
  record_date: string;
  record_time: string;
  equipment_location: string;
  temperature: number;
  input_type: 'manual' | 'iot';
  is_within_limit?: boolean;
}

interface IoTSensor {
  id: string;
  sensor_name: string;
  sensor_type: string;
  location?: string;
  is_active: boolean;
  last_reading_at?: string;
  last_reading_value?: number;
  status: 'ONLINE' | 'OFFLINE' | 'UNKNOWN';
}

interface EquipmentStatus {
  key: string;
  label: string;
  target: number;
  type: 'freezer' | 'fridge';
  currentTemp: number | null;
  lastUpdate: string | null;
  inputType: 'manual' | 'iot' | null;
  isWithinLimit: boolean;
  sensorId?: string;
  sensorStatus?: 'ONLINE' | 'OFFLINE' | 'UNKNOWN';
}

interface EquipmentSetting {
  id: string;
  key: string;
  name: string;
  type: 'freezer' | 'fridge';
  target_temp: number;
  enabled: boolean;
}

export default function EquipmentDashboardPage() {
  const [equipmentStatus, setEquipmentStatus] = useState<EquipmentStatus[]>([]);
  const [equipmentSettings, setEquipmentSettings] = useState<EquipmentSetting[]>([]);
  const [sensors, setSensors] = useState<IoTSensor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const today = new Date().toISOString().split('T')[0];

  const fetchData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      // Fetch equipment settings
      const settingsResponse = await fetch('/api/haccp/equipment-settings');
      const settingsData: EquipmentSetting[] = settingsResponse.ok ? await settingsResponse.json() : [];
      setEquipmentSettings(settingsData);

      // Filter to only enabled equipment
      const enabledEquipment = settingsData.filter(eq => eq.enabled);

      // Fetch temperature records for today
      const tempResponse = await fetch(`/api/haccp/equipment-temperature?date=${today}`);
      const tempRecords: TemperatureRecord[] = tempResponse.ok ? await tempResponse.json() : [];

      // Fetch IoT sensors
      const sensorResponse = await fetch('/api/haccp/sensors?include_readings=false');
      const sensorData: IoTSensor[] = sensorResponse.ok ? await sensorResponse.json() : [];
      setSensors(sensorData);

      // Combine data for equipment status
      const status: EquipmentStatus[] = enabledEquipment.map((eq) => {
        const loc = { key: eq.key, label: eq.name, target: eq.target_temp, type: eq.type };
        // Find matching sensor by location
        const matchingSensor = sensorData.find(
          (s) => s.location?.includes(loc.label) || s.sensor_name.includes(loc.label)
        );

        // Find latest manual record
        const manualRecords = tempRecords.filter((r) => r.equipment_location === loc.key);
        const latestManual = manualRecords.length > 0 ? manualRecords[0] : null;

        // Determine current temperature (prefer IoT if online)
        let currentTemp: number | null = null;
        let lastUpdate: string | null = null;
        let inputType: 'manual' | 'iot' | null = null;

        if (matchingSensor?.status === 'ONLINE' && matchingSensor.last_reading_value != null) {
          currentTemp = matchingSensor.last_reading_value ?? null;
          lastUpdate = matchingSensor.last_reading_at || null;
          inputType = 'iot';
        } else if (latestManual) {
          currentTemp = latestManual.temperature;
          lastUpdate = latestManual.record_time;
          inputType = 'manual';
        }

        // Check if within limit
        let isWithinLimit = true;
        if (currentTemp !== null) {
          if (loc.type === 'freezer') {
            isWithinLimit = currentTemp <= loc.target + 3;
          } else {
            isWithinLimit = currentTemp >= 0 && currentTemp <= loc.target + 5;
          }
        }

        return {
          ...loc,
          currentTemp,
          lastUpdate,
          inputType,
          isWithinLimit,
          sensorId: matchingSensor?.id,
          sensorStatus: matchingSensor?.status,
        };
      });

      setEquipmentStatus(status);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [today]);

  useEffect(() => {
    fetchData();
    // Auto refresh every 30 seconds
    const interval = setInterval(() => fetchData(false), 30 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return '-';
    if (timeStr.includes('T')) {
      const date = new Date(timeStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return '방금 전';
      if (diffMins < 60) return `${diffMins}분 전`;
      return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    }
    return timeStr.substring(0, 5);
  };

  const onlineCount = sensors.filter((s) => s.status === 'ONLINE').length;
  const offlineCount = sensors.filter((s) => s.status === 'OFFLINE').length;
  const alertCount = equipmentStatus.filter((e) => e.currentTemp !== null && !e.isWithinLimit).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">장비 모니터링</h1>
          <p className="mt-1 text-sm text-gray-500">
            냉장/냉동 장비 온도 실시간 현황
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            새로고침
          </button>
          <Link
            href="/equipment/records"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            온도 기록
          </Link>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="flex items-center gap-2 mb-2">
            <Thermometer className="w-4 h-4 text-blue-500" />
            <p className="text-sm text-gray-500">모니터링 장비</p>
          </div>
          <p className="text-2xl font-bold">{equipmentStatus.length}대</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="flex items-center gap-2 mb-2">
            <Wifi className="w-4 h-4 text-green-500" />
            <p className="text-sm text-gray-500">IoT 연결</p>
          </div>
          <p className="text-2xl font-bold text-green-600">{onlineCount}대</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="flex items-center gap-2 mb-2">
            <WifiOff className="w-4 h-4 text-gray-400" />
            <p className="text-sm text-gray-500">오프라인</p>
          </div>
          <p className="text-2xl font-bold text-gray-500">{offlineCount}대</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <p className="text-sm text-gray-500">온도 이탈</p>
          </div>
          <p className={`text-2xl font-bold ${alertCount > 0 ? 'text-red-600' : 'text-gray-500'}`}>
            {alertCount}건
          </p>
        </div>
      </div>

      {/* Alert Banner */}
      {alertCount > 0 && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <span className="font-medium text-red-800">온도 이탈 경고 ({alertCount}건)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {equipmentStatus
              .filter((e) => e.currentTemp !== null && !e.isWithinLimit)
              .map((e) => (
                <span key={e.key} className="text-sm bg-red-100 text-red-700 px-2 py-1 rounded">
                  {e.label}: {e.currentTemp}°C (기준: {e.target}°C)
                </span>
              ))}
          </div>
        </div>
      )}

      {/* Equipment Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {equipmentStatus.map((equipment) => (
          <div
            key={equipment.key}
            className={`bg-white rounded-xl shadow-sm border overflow-hidden ${
              equipment.currentTemp !== null
                ? equipment.isWithinLimit
                  ? 'border-green-200'
                  : 'border-red-200'
                : 'border-gray-200'
            }`}
          >
            {/* Header */}
            <div
              className={`px-4 py-3 ${
                equipment.type === 'freezer' ? 'bg-blue-50' : 'bg-cyan-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Thermometer
                    className={`w-5 h-5 ${
                      equipment.type === 'freezer' ? 'text-blue-600' : 'text-cyan-600'
                    }`}
                  />
                  <span className="font-medium text-gray-900">{equipment.label}</span>
                </div>
                <span
                  title={
                    equipment.sensorStatus === 'ONLINE'
                      ? 'IoT 연결됨'
                      : equipment.inputType === 'manual'
                      ? '수동 입력'
                      : '연결 없음'
                  }
                >
                  {equipment.sensorStatus === 'ONLINE' ? (
                    <Wifi className="w-4 h-4 text-green-500" />
                  ) : (
                    <WifiOff className="w-4 h-4 text-gray-300" />
                  )}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">기준: {equipment.target}°C</p>
            </div>

            {/* Current Temperature */}
            <div className="p-4">
              {equipment.currentTemp !== null ? (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-3xl font-bold ${
                          equipment.isWithinLimit ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {equipment.currentTemp}°C
                      </span>
                      {equipment.currentTemp < equipment.target ? (
                        <TrendingDown className="w-5 h-5 text-blue-500" />
                      ) : (
                        <TrendingUp className="w-5 h-5 text-orange-500" />
                      )}
                    </div>
                    {equipment.isWithinLimit ? (
                      <CheckCircle className="w-6 h-6 text-green-500" />
                    ) : (
                      <AlertTriangle className="w-6 h-6 text-red-500" />
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Clock className="w-3 h-3" />
                    <span>{formatTime(equipment.lastUpdate)}</span>
                    <span className="ml-2">
                      {equipment.inputType === 'iot' ? (
                        <span className="text-green-600">IoT</span>
                      ) : (
                        <span className="text-gray-400">수동</span>
                      )}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-gray-400">
                  <Thermometer className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-sm">기록 없음</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-lg font-semibold mb-4">빠른 작업</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href="/equipment/records"
            className="flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Plus className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-medium">온도 기록</p>
              <p className="text-sm text-gray-500">수동으로 온도 기록하기</p>
            </div>
          </Link>
          <Link
            href="/equipment/sensors"
            className="flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Wifi className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="font-medium">장비/센서 관리</p>
              <p className="text-sm text-gray-500">IoT 센서 등록 및 설정</p>
            </div>
          </Link>
          <Link
            href="/equipment/settings"
            className="flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Settings className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="font-medium">모니터링 장비 설정</p>
              <p className="text-sm text-gray-500">장비 추가/수정/삭제</p>
            </div>
          </Link>
          <Link
            href="/settings"
            className="flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <Settings className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="font-medium">알림 설정</p>
              <p className="text-sm text-gray-500">온도 이탈 알림 설정</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
