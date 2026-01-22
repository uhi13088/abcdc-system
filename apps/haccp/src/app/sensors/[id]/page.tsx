'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { ArrowLeft, Wifi, WifiOff, RefreshCw, AlertTriangle, CheckCircle, Settings, Activity } from 'lucide-react';
import Link from 'next/link';

interface CCPDefinition {
  id: string;
  ccp_number: string;
  process: string;
  hazard?: string;
  critical_limit?: {
    parameter?: string;
    min?: number;
    max?: number;
    unit?: string;
  };
}

interface SensorReading {
  id: string;
  reading_value: number;
  reading_unit?: string;
  is_within_limit: boolean | null;
  recorded_at: string;
}

interface IoTSensor {
  id: string;
  sensor_name: string;
  sensor_type: string;
  protocol: string;
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
  readings?: SensorReading[];
}

interface ReadingsResponse {
  readings: SensorReading[];
  stats: {
    count: number;
    min: number;
    max: number;
    avg: number;
    withinLimit: number;
    outOfLimit: number;
  } | null;
  period: string;
}

export default function SensorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [sensor, setSensor] = useState<IoTSensor | null>(null);
  const [readingsData, setReadingsData] = useState<ReadingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState('24h');
  const [error, setError] = useState<string | null>(null);

  const fetchSensor = useCallback(async () => {
    try {
      const response = await fetch(`/api/haccp/sensors/${id}`);
      if (response.ok) {
        const data = await response.json();
        setSensor(data);
      } else {
        setError('센서를 찾을 수 없습니다');
      }
    } catch (err) {
      console.error('Failed to fetch sensor:', err);
      setError('데이터를 불러오는데 실패했습니다');
    }
  }, [id]);

  const fetchReadings = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const response = await fetch(`/api/haccp/sensors/${id}/readings?period=${period}`);
      if (response.ok) {
        const data = await response.json();
        setReadingsData(data);
      }
    } catch (err) {
      console.error('Failed to fetch readings:', err);
    } finally {
      setRefreshing(false);
    }
  }, [id, period]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchSensor();
      await fetchReadings();
      setLoading(false);
    };
    loadData();

    // 30초마다 자동 새로고침
    const interval = setInterval(() => {
      fetchSensor();
      fetchReadings();
    }, 30 * 1000);

    return () => clearInterval(interval);
  }, [fetchSensor, fetchReadings]);

  useEffect(() => {
    if (!loading) {
      fetchReadings();
    }
  }, [period, fetchReadings, loading]);

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

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('ko-KR', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
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

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error || !sensor) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-red-500" />
          <p className="text-red-700">{error || '센서를 찾을 수 없습니다'}</p>
          <Link href="/sensors" className="mt-4 inline-block text-blue-600 hover:text-blue-700">
            센서 목록으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  const unit = getUnit(sensor.sensor_type);
  const criticalLimit = sensor.ccp_definition?.critical_limit;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <Link href="/sensors" className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="w-4 h-4" />
          센서 목록
        </Link>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {sensor.status === 'ONLINE' ? (
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <Wifi className="w-6 h-6 text-green-600" />
              </div>
            ) : (
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <WifiOff className="w-6 h-6 text-red-600" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{sensor.sensor_name}</h1>
              <p className="text-sm text-gray-500">
                {sensor.device_id || '-'} · {sensor.location || '위치 미지정'}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              fetchSensor();
              fetchReadings(true);
            }}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            새로고침
          </button>
        </div>
      </div>

      {/* Current Value & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="md:col-span-2 bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-500">현재 측정값</p>
            <span className={`px-2 py-1 text-xs rounded-full ${
              sensor.status === 'ONLINE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {sensor.status === 'ONLINE' ? '온라인' : '오프라인'}
            </span>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-5xl font-bold">
              {sensor.last_reading_value?.toFixed(1) ?? '-'}
            </span>
            <span className="text-2xl text-gray-500 mb-1">{unit}</span>
          </div>
          {criticalLimit && (
            <p className="text-sm text-gray-500 mt-2">
              한계기준: {criticalLimit.min ?? '-'} ~ {criticalLimit.max ?? '-'} {criticalLimit.unit || unit}
            </p>
          )}
          {sensor.last_reading_at && (
            <p className="text-xs text-gray-400 mt-1">
              최종 수신: {formatTime(sensor.last_reading_at)}
            </p>
          )}
        </div>

        {readingsData?.stats && (
          <>
            <div className="bg-white rounded-xl p-4 shadow-sm border">
              <p className="text-sm text-gray-500 mb-1">평균값 ({period})</p>
              <p className="text-2xl font-bold">{readingsData.stats.avg.toFixed(1)}{unit}</p>
              <p className="text-xs text-gray-400 mt-1">
                최소 {readingsData.stats.min.toFixed(1)} / 최대 {readingsData.stats.max.toFixed(1)}
              </p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border">
              <p className="text-sm text-gray-500 mb-1">측정 횟수</p>
              <p className="text-2xl font-bold">{readingsData.stats.count}회</p>
              <div className="flex gap-2 mt-1">
                <span className="text-xs text-green-600">
                  <CheckCircle className="w-3 h-3 inline" /> {readingsData.stats.withinLimit}
                </span>
                <span className="text-xs text-red-600">
                  <AlertTriangle className="w-3 h-3 inline" /> {readingsData.stats.outOfLimit}
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Sensor Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Settings className="w-4 h-4" />
            센서 정보
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-1 border-b">
              <span className="text-gray-500">센서 유형</span>
              <span>{sensorTypeText[sensor.sensor_type]}</span>
            </div>
            <div className="flex justify-between py-1 border-b">
              <span className="text-gray-500">프로토콜</span>
              <span>{sensor.protocol}</span>
            </div>
            <div className="flex justify-between py-1 border-b">
              <span className="text-gray-500">측정 주기</span>
              <span>{sensor.reading_interval_seconds}초</span>
            </div>
            <div className="flex justify-between py-1 border-b">
              <span className="text-gray-500">보정 오프셋</span>
              <span>{sensor.calibration_offset}</span>
            </div>
            <div className="flex justify-between py-1 border-b">
              <span className="text-gray-500">알림 활성화</span>
              <span>{sensor.alert_enabled ? '예' : '아니오'}</span>
            </div>
            {sensor.calibration_due_at && (
              <div className="flex justify-between py-1">
                <span className="text-gray-500">다음 교정일</span>
                <span>{new Date(sensor.calibration_due_at).toLocaleDateString('ko-KR')}</span>
              </div>
            )}
          </div>
        </div>

        {sensor.ccp_definition && (
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4" />
              연결된 CCP
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-1 border-b">
                <span className="text-gray-500">CCP 번호</span>
                <span className="font-medium text-blue-600">{sensor.ccp_definition.ccp_number}</span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span className="text-gray-500">공정</span>
                <span>{sensor.ccp_definition.process}</span>
              </div>
              {sensor.ccp_definition.hazard && (
                <div className="flex justify-between py-1 border-b">
                  <span className="text-gray-500">위해요소</span>
                  <span>{sensor.ccp_definition.hazard}</span>
                </div>
              )}
              {criticalLimit && (
                <div className="flex justify-between py-1">
                  <span className="text-gray-500">한계기준</span>
                  <span>
                    {criticalLimit.min ?? '-'} ~ {criticalLimit.max ?? '-'} {criticalLimit.unit || unit}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Readings History */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold">측정 기록</h3>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-3 py-1 border rounded-lg text-sm"
          >
            <option value="1h">최근 1시간</option>
            <option value="6h">최근 6시간</option>
            <option value="24h">최근 24시간</option>
            <option value="7d">최근 7일</option>
            <option value="30d">최근 30일</option>
          </select>
        </div>

        {/* Simple Bar Chart Visualization */}
        {readingsData?.readings && readingsData.readings.length > 0 && criticalLimit && (
          <div className="p-4 border-b">
            <div className="h-32 flex items-end gap-0.5">
              {readingsData.readings.slice(0, 100).reverse().map((reading, idx) => {
                const min = criticalLimit.min ?? 0;
                const max = criticalLimit.max ?? 100;
                const range = max - min;
                const normalizedValue = ((reading.reading_value - min) / range) * 100;
                const height = Math.max(5, Math.min(100, normalizedValue));
                const isOutOfLimit = reading.is_within_limit === false;

                return (
                  <div
                    key={reading.id || idx}
                    className={`flex-1 min-w-0.5 max-w-2 rounded-t transition-all ${
                      isOutOfLimit ? 'bg-red-400' : 'bg-blue-400'
                    }`}
                    style={{ height: `${height}%` }}
                    title={`${reading.reading_value.toFixed(1)}${unit} - ${formatTime(reading.recorded_at)}`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>{criticalLimit.min ?? 0}{unit}</span>
              <span>{criticalLimit.max ?? 100}{unit}</span>
            </div>
          </div>
        )}

        {/* Readings Table */}
        <div className="max-h-96 overflow-y-auto">
          {!readingsData?.readings || readingsData.readings.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              해당 기간에 측정 기록이 없습니다
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">시간</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">측정값</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {readingsData.readings.map((reading) => (
                  <tr key={reading.id} className={reading.is_within_limit === false ? 'bg-red-50' : 'hover:bg-gray-50'}>
                    <td className="px-4 py-3 text-sm">{formatTime(reading.recorded_at)}</td>
                    <td className="px-4 py-3 text-sm text-right font-mono">
                      {reading.reading_value.toFixed(2)} {reading.reading_unit || unit}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {reading.is_within_limit === true ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
                          <CheckCircle className="w-3 h-3" />
                          정상
                        </span>
                      ) : reading.is_within_limit === false ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">
                          <AlertTriangle className="w-3 h-3" />
                          이탈
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
