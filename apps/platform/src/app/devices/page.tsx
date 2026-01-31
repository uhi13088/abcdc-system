'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense } from 'react';
import {
  Plus,
  Search,
  Cpu,
  Wifi,
  WifiOff,
  Package,
  Building2,
  Copy,
  Check,
  RefreshCw,
  Filter,
  Download,
  X
} from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface Device {
  id: string;
  device_serial: string;
  device_type: string;
  status: string;
  registration_code: string;
  firmware_version: string;
  last_seen_at: string | null;
  wifi_ssid: string | null;
  wifi_signal_strength: number | null;
  registered_at: string | null;
  created_at: string;
  company?: {
    id: string;
    name: string;
  } | null;
  sensor?: {
    id: string;
    name: string;
    sensor_code: string;
  } | null;
}

interface Batch {
  id: string;
  batch_name: string;
  batch_code: string;
  device_type: string;
  quantity: number;
  serial_prefix: string;
  registered_count: number;
  unregistered_count: number;
  created_at: string;
}

interface BatchFormData {
  batch_name: string;
  device_type: string;
  quantity: number;
  serial_prefix: string;
  description: string;
}

const DEVICE_TYPES = [
  { value: 'TEMPERATURE', label: '온도 센서' },
  { value: 'HUMIDITY', label: '습도 센서' },
  { value: 'TEMPERATURE_HUMIDITY', label: '온습도 센서' },
  { value: 'PH', label: 'pH 센서' },
  { value: 'PRESSURE', label: '압력 센서' },
  { value: 'CO2', label: 'CO2 센서' },
  { value: 'DOOR', label: '도어 센서' },
  { value: 'WATER_LEAK', label: '누수 센서' },
  { value: 'OTHER', label: '기타' },
];

const initialBatchForm: BatchFormData = {
  batch_name: '',
  device_type: 'TEMPERATURE',
  quantity: 10,
  serial_prefix: 'ESP32-TEMP-',
  description: '',
};

export default function DevicesPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <DevicesContent />
    </Suspense>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
}

function DevicesContent() {
  const [activeTab, setActiveTab] = useState<'devices' | 'batches'>('devices');
  const [devices, setDevices] = useState<Device[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchForm, setBatchForm] = useState<BatchFormData>(initialBatchForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [createdDevices, setCreatedDevices] = useState<Device[]>([]);
  const [showResultModal, setShowResultModal] = useState(false);

  useEffect(() => {
    if (activeTab === 'devices') {
      fetchDevices();
    } else {
      fetchBatches();
    }
  }, [activeTab, statusFilter, typeFilter]);

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (typeFilter) params.append('device_type', typeFilter);

      const response = await fetch(`/api/devices?${params.toString()}`);
      if (response.ok) {
        const result = await response.json();
        setDevices(result.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch devices:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBatches = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/devices/batch');
      if (response.ok) {
        const result = await response.json();
        setBatches(result.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch batches:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const response = await fetch('/api/devices/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batchForm),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setShowBatchModal(false);
        setBatchForm(initialBatchForm);
        setCreatedDevices(result.data.devices || []);
        setShowResultModal(true);
        fetchBatches();
        fetchDevices();
      } else {
        setError(result.error || '배치 생성에 실패했습니다.');
      }
    } catch {
      setError('배치 생성에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const exportDeviceCodes = () => {
    const csvContent = [
      ['시리얼번호', '등록코드', '기기타입', '상태'].join(','),
      ...createdDevices.map(d =>
        [d.device_serial, d.registration_code, d.device_type, d.status].join(',')
      )
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `devices_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      UNREGISTERED: 'bg-gray-100 text-gray-800',
      REGISTERED: 'bg-blue-100 text-blue-800',
      ACTIVE: 'bg-green-100 text-green-800',
      OFFLINE: 'bg-yellow-100 text-yellow-800',
      MAINTENANCE: 'bg-orange-100 text-orange-800',
      DEACTIVATED: 'bg-red-100 text-red-800',
    };
    const labels: Record<string, string> = {
      UNREGISTERED: '미등록',
      REGISTERED: '등록완료',
      ACTIVE: '활성',
      OFFLINE: '오프라인',
      MAINTENANCE: '유지보수',
      DEACTIVATED: '비활성',
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status] || styles.UNREGISTERED}`}>
        {labels[status] || status}
      </span>
    );
  };

  const getDeviceTypeLabel = (type: string) => {
    return DEVICE_TYPES.find(t => t.value === type)?.label || type;
  };

  const filteredDevices = devices.filter(device =>
    device.device_serial.toLowerCase().includes(searchTerm.toLowerCase()) ||
    device.registration_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    device.company?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: devices.length,
    unregistered: devices.filter(d => d.status === 'UNREGISTERED').length,
    registered: devices.filter(d => d.status === 'REGISTERED').length,
    active: devices.filter(d => d.status === 'ACTIVE').length,
    offline: devices.filter(d => d.status === 'OFFLINE').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">IoT 기기 관리</h1>
          <p className="text-gray-600">ESP32 기기 생성 및 관리</p>
        </div>
        <button
          onClick={() => setShowBatchModal(true)}
          className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-700"
        >
          <Plus className="w-5 h-5 mr-2" />
          기기 배치 생성
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">전체</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <Cpu className="w-8 h-8 text-gray-400" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">미등록</p>
              <p className="text-2xl font-bold text-gray-600">{stats.unregistered}</p>
            </div>
            <Package className="w-8 h-8 text-gray-400" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">등록완료</p>
              <p className="text-2xl font-bold text-blue-600">{stats.registered}</p>
            </div>
            <Building2 className="w-8 h-8 text-blue-400" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">활성</p>
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

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex -mb-px">
          <button
            onClick={() => setActiveTab('devices')}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              activeTab === 'devices'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            기기 목록
          </button>
          <button
            onClick={() => setActiveTab('batches')}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              activeTab === 'batches'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            배치 관리
          </button>
        </nav>
      </div>

      {activeTab === 'devices' ? (
        <>
          {/* Filters */}
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="시리얼번호, 등록코드, 회사명으로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">모든 상태</option>
              <option value="UNREGISTERED">미등록</option>
              <option value="REGISTERED">등록완료</option>
              <option value="ACTIVE">활성</option>
              <option value="OFFLINE">오프라인</option>
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">모든 타입</option>
              {DEVICE_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
            <button
              onClick={fetchDevices}
              className="p-2 text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>

          {/* Devices Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {loading ? (
              <div className="p-8 text-center">
                <LoadingSpinner />
              </div>
            ) : filteredDevices.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                {searchTerm || statusFilter || typeFilter ? '검색 결과가 없습니다.' : '등록된 기기가 없습니다.'}
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">기기</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">등록코드</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">타입</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">회사</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">마지막 연결</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredDevices.map((device) => (
                    <tr key={device.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                            <Cpu className="w-5 h-5 text-primary" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{device.device_serial}</div>
                            <div className="text-sm text-gray-500">v{device.firmware_version}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <code className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">
                            {device.registration_code}
                          </code>
                          <button
                            onClick={() => copyToClipboard(device.registration_code)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            {copiedCode === device.registration_code ? (
                              <Check className="w-4 h-4 text-green-500" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {getDeviceTypeLabel(device.device_type)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(device.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {device.company?.name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {device.last_seen_at ? formatDate(device.last_seen_at) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Batches Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {loading ? (
              <div className="p-8 text-center">
                <LoadingSpinner />
              </div>
            ) : batches.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                생성된 배치가 없습니다.
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">배치명</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">배치코드</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">기기타입</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">생성수량</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">등록현황</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">생성일</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {batches.map((batch) => (
                    <tr key={batch.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{batch.batch_name}</div>
                        <div className="text-sm text-gray-500">{batch.serial_prefix}*</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <code className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">
                          {batch.batch_code}
                        </code>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {getDeviceTypeLabel(batch.device_type)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {batch.quantity}개
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <div className="flex-1 h-2 bg-gray-200 rounded-full w-24">
                            <div
                              className="h-2 bg-green-500 rounded-full"
                              style={{ width: `${(batch.registered_count / batch.quantity) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-500">
                            {batch.registered_count}/{batch.quantity}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(batch.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* Create Batch Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowBatchModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">기기 배치 생성</h2>
              <button
                onClick={() => setShowBatchModal(false)}
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

            <form onSubmit={handleCreateBatch} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  배치명 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={batchForm.batch_name}
                  onChange={(e) => setBatchForm({ ...batchForm, batch_name: e.target.value })}
                  placeholder="예: 2024년 1월 온도센서"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  기기 타입 <span className="text-red-500">*</span>
                </label>
                <select
                  value={batchForm.device_type}
                  onChange={(e) => {
                    const type = e.target.value;
                    const prefixMap: Record<string, string> = {
                      TEMPERATURE: 'ESP32-TEMP-',
                      HUMIDITY: 'ESP32-HUM-',
                      TEMPERATURE_HUMIDITY: 'ESP32-TH-',
                      PH: 'ESP32-PH-',
                      PRESSURE: 'ESP32-PRES-',
                      CO2: 'ESP32-CO2-',
                      DOOR: 'ESP32-DOOR-',
                      WATER_LEAK: 'ESP32-WL-',
                      OTHER: 'ESP32-OTH-',
                    };
                    setBatchForm({
                      ...batchForm,
                      device_type: type,
                      serial_prefix: prefixMap[type] || 'ESP32-'
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  {DEVICE_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  생성 수량 <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={1000}
                  value={batchForm.quantity}
                  onChange={(e) => setBatchForm({ ...batchForm, quantity: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <p className="mt-1 text-xs text-gray-500">최대 1,000개까지 생성 가능</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  시리얼 접두사 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={batchForm.serial_prefix}
                  onChange={(e) => setBatchForm({ ...batchForm, serial_prefix: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <p className="mt-1 text-xs text-gray-500">
                  예시: {batchForm.serial_prefix}000001
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                <textarea
                  value={batchForm.description}
                  onChange={(e) => setBatchForm({ ...batchForm, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowBatchModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {submitting ? '생성 중...' : `${batchForm.quantity}개 기기 생성`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Result Modal */}
      {showResultModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowResultModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6 max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">기기 생성 완료</h2>
              <button
                onClick={() => setShowResultModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-md">
              {createdDevices.length}개의 기기가 성공적으로 생성되었습니다.
            </div>

            <div className="flex-1 overflow-auto mb-4">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">시리얼번호</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">등록코드</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">복사</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {createdDevices.map((device) => (
                    <tr key={device.id}>
                      <td className="px-4 py-2 text-sm font-mono">{device.device_serial}</td>
                      <td className="px-4 py-2">
                        <code className="px-2 py-1 bg-yellow-100 rounded text-sm font-mono font-bold">
                          {device.registration_code}
                        </code>
                      </td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => copyToClipboard(device.registration_code)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          {copiedCode === device.registration_code ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                onClick={exportDeviceCodes}
                className="flex items-center px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                <Download className="w-4 h-4 mr-2" />
                CSV 다운로드
              </button>
              <button
                onClick={() => setShowResultModal(false)}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-700"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
