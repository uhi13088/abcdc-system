'use client';

import { useState, useEffect } from 'react';
import {
  Plus,
  Calendar,
  Thermometer,
  Clock,
  AlertTriangle,
  CheckCircle,
  Wifi,
  WifiOff,
  RefreshCw,
  ArrowLeft,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';

interface TemperatureRecord {
  id: string;
  record_date: string;
  record_time: string;
  equipment_location: string;
  equipment_id?: string;
  temperature: number;
  target_temperature?: number;
  input_type: 'manual' | 'iot';
  is_within_limit?: boolean;
  deviation_action?: string;
}

const EQUIPMENT_LOCATIONS = [
  { key: '냉동창고', label: '냉동창고', target: -18, type: 'freezer' },
  { key: '배합실_냉장고', label: '배합실 냉장고', target: 5, type: 'fridge' },
  { key: '내포장실_냉장고', label: '내포장실 냉장고', target: 5, type: 'fridge' },
  { key: '내포장실_냉동고', label: '내포장실 냉동고', target: -18, type: 'freezer' },
];

export default function EquipmentRecordsPage() {
  const [records, setRecords] = useState<TemperatureRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [formData, setFormData] = useState({
    equipment_location: '냉동창고',
    temperature: '',
    deviation_action: '',
  });

  useEffect(() => {
    fetchRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/haccp/equipment-temperature?date=${selectedDate}`);
      if (response.ok) {
        const data = await response.json();
        setRecords(data);
      }
    } catch (error) {
      console.error('Failed to fetch temperature records:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch('/api/haccp/equipment-temperature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          record_date: selectedDate,
          equipment_location: formData.equipment_location,
          temperature: parseFloat(formData.temperature),
          deviation_action: formData.deviation_action || undefined,
          input_type: 'manual',
        }),
      });

      if (response.ok) {
        setShowModal(false);
        setFormData({
          equipment_location: '냉동창고',
          temperature: '',
          deviation_action: '',
        });
        fetchRecords();
      }
    } catch (error) {
      console.error('Failed to create temperature record:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 기록을 삭제하시겠습니까?')) return;
    try {
      const response = await fetch(`/api/haccp/equipment-temperature/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        fetchRecords();
      }
    } catch (error) {
      console.error('Failed to delete record:', error);
    }
  };

  const getLocationConfig = (location: string) => {
    return EQUIPMENT_LOCATIONS.find((l) => l.key === location);
  };

  const handleAutoFill = () => {
    const locationConfig = EQUIPMENT_LOCATIONS.find((l) => l.key === formData.equipment_location);
    let sampleTemp: number;

    if (locationConfig) {
      if (locationConfig.type === 'freezer') {
        sampleTemp = locationConfig.target + (Math.random() * 3 - 1.5);
      } else {
        sampleTemp = locationConfig.target + (Math.random() * 4 - 2);
      }
      sampleTemp = Math.round(sampleTemp * 10) / 10;
    } else {
      sampleTemp = 4.5;
    }

    setFormData({
      equipment_location: formData.equipment_location,
      temperature: sampleTemp.toString(),
      deviation_action: '',
    });
  };

  const isWithinLimit = (record: TemperatureRecord) => {
    const config = getLocationConfig(record.equipment_location);
    if (!config) return true;

    if (config.type === 'freezer') {
      return record.temperature <= config.target + 3;
    }
    return record.temperature >= 0 && record.temperature <= config.target + 5;
  };

  const groupedRecords = EQUIPMENT_LOCATIONS.map((location) => {
    const locationRecords = records.filter((r) => r.equipment_location === location.key);
    const latestRecord = locationRecords.length > 0 ? locationRecords[0] : null;
    const hasIoT = locationRecords.some((r) => r.input_type === 'iot');

    return {
      ...location,
      records: locationRecords,
      latestRecord,
      hasIoT,
    };
  });

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/equipment"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">온도 기록</h1>
            <p className="mt-1 text-sm text-gray-500">
              냉장/냉동 장비 온도 수동 기록
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          수동 기록
        </button>
      </div>

      {/* Date Selector */}
      <div className="mb-6 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-gray-400" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border rounded-lg"
          />
        </div>
        <button
          onClick={fetchRecords}
          className="inline-flex items-center gap-1 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          <RefreshCw className="w-4 h-4" />
          새로고침
        </button>
      </div>

      {/* Equipment Cards */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {groupedRecords.map((location) => {
            const isOk = location.latestRecord
              ? isWithinLimit(location.latestRecord)
              : true;

            return (
              <div
                key={location.key}
                className={`bg-white rounded-xl shadow-sm border overflow-hidden ${
                  location.latestRecord
                    ? isOk
                      ? 'border-green-200'
                      : 'border-red-200'
                    : 'border-gray-200'
                }`}
              >
                {/* Header */}
                <div
                  className={`px-4 py-3 ${
                    location.type === 'freezer' ? 'bg-blue-50' : 'bg-cyan-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Thermometer
                        className={`w-5 h-5 ${
                          location.type === 'freezer' ? 'text-blue-600' : 'text-cyan-600'
                        }`}
                      />
                      <span className="font-medium text-gray-900">{location.label}</span>
                    </div>
                    <span title={location.hasIoT ? 'IoT 연동' : '수동 입력'}>
                      {location.hasIoT ? (
                        <Wifi className="w-4 h-4 text-green-500" />
                      ) : (
                        <WifiOff className="w-4 h-4 text-gray-300" />
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">기준: {location.target}°C</p>
                </div>

                {/* Current Temperature */}
                <div className="p-4">
                  {location.latestRecord ? (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className={`text-3xl font-bold ${
                            isOk ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {location.latestRecord.temperature}°C
                        </span>
                        {isOk ? (
                          <CheckCircle className="w-6 h-6 text-green-500" />
                        ) : (
                          <AlertTriangle className="w-6 h-6 text-red-500" />
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        <span>
                          {location.latestRecord.record_time?.substring(0, 5) || '-'}
                        </span>
                        <span className="ml-2">
                          {location.latestRecord.input_type === 'iot' ? (
                            <span className="text-green-600">IoT</span>
                          ) : (
                            <span className="text-gray-400">수동</span>
                          )}
                        </span>
                      </div>
                      {!isOk && location.latestRecord.deviation_action && (
                        <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-700">
                          조치: {location.latestRecord.deviation_action}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-400">
                      <Thermometer className="w-8 h-8 mx-auto mb-2" />
                      <p className="text-sm">기록 없음</p>
                    </div>
                  )}
                </div>

                {/* History */}
                {location.records.length > 0 && (
                  <div className="px-4 py-2 bg-gray-50 border-t">
                    <p className="text-xs font-medium text-gray-500 mb-2">
                      오늘 기록 ({location.records.length}건)
                    </p>
                    <div className="space-y-1">
                      {location.records.slice(0, 5).map((record) => (
                        <div
                          key={record.id}
                          className="flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded ${
                                isWithinLimit(record)
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {record.temperature}°C
                            </span>
                            <span className="text-gray-400">
                              {record.record_time?.substring(0, 5)}
                            </span>
                          </div>
                          {record.input_type === 'manual' && (
                            <button
                              onClick={() => handleDelete(record.id)}
                              className="p-1 text-gray-400 hover:text-red-500"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">온도 기록</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                닫기
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <button
                type="button"
                onClick={handleAutoFill}
                className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all shadow-md"
              >
                자동 입력 (샘플 데이터)
              </button>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  장비 위치
                </label>
                <select
                  value={formData.equipment_location}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      equipment_location: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  {EQUIPMENT_LOCATIONS.map((loc) => (
                    <option key={loc.key} value={loc.key}>
                      {loc.label} (기준: {loc.target}°C)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  온도 (°C)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.temperature}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      temperature: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="예: -18.5"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이탈 시 조치사항 (선택)
                </label>
                <textarea
                  value={formData.deviation_action}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      deviation_action: e.target.value,
                    }))
                  }
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="온도 이탈 시 취한 조치를 기록하세요"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
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
