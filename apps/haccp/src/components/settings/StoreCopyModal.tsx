'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Copy, Store, Settings, Thermometer, Bell, AlertTriangle, CheckCircle2, MapPin, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface StoreInfo {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  business_number: string | null;
  haccp_certification_number: string | null;
}

interface CopyOptions {
  haccpSettings: boolean;
  equipmentSettings: boolean;
  notificationSettings: boolean;
  ccpDefinitions: boolean;
  zones: boolean;
}

interface CopyResult {
  success: boolean;
  message: string;
  copied: {
    haccpSettings: number;
    equipmentSettings: number;
    notificationSettings: number;
    ccpDefinitions: number;
    zones: number;
  };
  errors: string[];
  sourceStoreName: string;
  targetStoreName: string;
}

interface StoreCopyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  currentStoreId?: string;
}

export default function StoreCopyModal({ isOpen, onClose, onSuccess, currentStoreId: _currentStoreId }: StoreCopyModalProps) {
  const [stores, setStores] = useState<StoreInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [copying, setCopying] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [copyOptions, setCopyOptions] = useState<CopyOptions>({
    haccpSettings: true,
    equipmentSettings: true,
    notificationSettings: true,
    ccpDefinitions: false,
    zones: true,
  });
  const [result, setResult] = useState<CopyResult | null>(null);

  const fetchStores = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/haccp/stores?exclude_current=true');
      if (!response.ok) throw new Error('Failed to fetch stores');

      const data = await response.json();
      setStores(data.stores || []);
    } catch (error) {
      console.error('Error fetching stores:', error);
      toast.error('매장 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchStores();
      setSelectedStoreId('');
      setResult(null);
    }
  }, [isOpen, fetchStores]);

  const handleCopy = async () => {
    if (!selectedStoreId) {
      toast.error('원본 매장을 선택해주세요.');
      return;
    }

    // 최소 하나의 옵션은 선택되어야 함
    if (!Object.values(copyOptions).some(v => v)) {
      toast.error('복사할 항목을 선택해주세요.');
      return;
    }

    try {
      setCopying(true);
      setResult(null);

      const response = await fetch('/api/haccp/stores/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceStoreId: selectedStoreId,
          copyOptions,
        }),
      });

      const data: CopyResult = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '복사에 실패했습니다.');
      }

      setResult(data);

      if (data.success) {
        toast.success(data.message);
        onSuccess?.();
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      console.error('Error copying store settings:', error);
      toast.error(error instanceof Error ? error.message : '복사 중 오류가 발생했습니다.');
    } finally {
      setCopying(false);
    }
  };

  const toggleOption = (key: keyof CopyOptions) => {
    setCopyOptions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const selectedStore = stores.find(s => s.id === selectedStoreId);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-lg">
                <Copy className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">다른 매장에서 설정 복사</h2>
                <p className="text-blue-100 text-sm">기존 매장의 설정을 현재 매장으로 복사합니다</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Store Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <Store className="w-4 h-4 inline mr-1" />
              원본 매장 선택
            </label>
            {loading ? (
              <div className="flex items-center justify-center py-4 bg-gray-50 rounded-lg">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                <span className="ml-2 text-gray-500">매장 목록 로딩 중...</span>
              </div>
            ) : stores.length === 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                <AlertTriangle className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
                <p className="text-yellow-700 font-medium">복사할 수 있는 다른 매장이 없습니다.</p>
                <p className="text-yellow-600 text-sm mt-1">다른 매장을 먼저 등록해주세요.</p>
              </div>
            ) : (
              <select
                value={selectedStoreId}
                onChange={(e) => setSelectedStoreId(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
              >
                <option value="">매장을 선택하세요</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name} {store.address ? `(${store.address})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Selected Store Info */}
          {selectedStore && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <Store className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-blue-900">{selectedStore.name}</h4>
                  {selectedStore.address && (
                    <p className="text-blue-700 text-sm flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3" />
                      {selectedStore.address}
                    </p>
                  )}
                  {selectedStore.haccp_certification_number && (
                    <p className="text-blue-600 text-xs mt-1">
                      HACCP: {selectedStore.haccp_certification_number}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Copy Options */}
          {stores.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                복사할 항목 선택
              </label>
              <div className="space-y-2">
                <CopyOptionItem
                  checked={copyOptions.haccpSettings}
                  onChange={() => toggleOption('haccpSettings')}
                  icon={<Settings className="w-5 h-5" />}
                  title="HACCP 운영 설정"
                  description="자동 로그아웃, 사진 증빙, 지연 입력 허용 등"
                  color="blue"
                />
                <CopyOptionItem
                  checked={copyOptions.equipmentSettings}
                  onChange={() => toggleOption('equipmentSettings')}
                  icon={<Thermometer className="w-5 h-5" />}
                  title="장비 온도 설정"
                  description="냉장고, 냉동고 목록 및 목표 온도"
                  color="cyan"
                />
                <CopyOptionItem
                  checked={copyOptions.zones}
                  onChange={() => toggleOption('zones')}
                  icon={<MapPin className="w-5 h-5" />}
                  title="구역 설정"
                  description="청결구역, 일반구역 등 구역 정보"
                  color="green"
                />
                <CopyOptionItem
                  checked={copyOptions.notificationSettings}
                  onChange={() => toggleOption('notificationSettings')}
                  icon={<Bell className="w-5 h-5" />}
                  title="알림 설정"
                  description="CCP 알림, 일일 보고서 등 알림 규칙"
                  color="amber"
                />
                <CopyOptionItem
                  checked={copyOptions.ccpDefinitions}
                  onChange={() => toggleOption('ccpDefinitions')}
                  icon={<AlertTriangle className="w-5 h-5" />}
                  title="CCP 정의"
                  description="중요관리점 정의 및 한계기준 (주의: 기존 정의와 중복되지 않는 항목만)"
                  color="red"
                />
              </div>
            </div>
          )}

          {/* Warning */}
          {stores.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-amber-800">주의사항</p>
                  <ul className="text-amber-700 mt-1 space-y-1">
                    <li>• HACCP 설정과 알림 설정은 기존 값을 덮어씁니다.</li>
                    <li>• 장비 설정은 기존 장비를 삭제 후 새로 복사합니다.</li>
                    <li>• CCP 정의는 중복되지 않는 항목만 추가됩니다.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className={`rounded-xl p-4 ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="flex gap-3">
                {result.success ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                )}
                <div className="text-sm flex-1">
                  <p className={`font-medium ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                    {result.message}
                  </p>
                  <div className={`mt-2 space-y-1 ${result.success ? 'text-green-700' : 'text-red-700'}`}>
                    {result.copied.haccpSettings > 0 && (
                      <p>• HACCP 설정: {result.copied.haccpSettings}개 복사됨</p>
                    )}
                    {result.copied.equipmentSettings > 0 && (
                      <p>• 장비 설정: {result.copied.equipmentSettings}개 복사됨</p>
                    )}
                    {result.copied.zones > 0 && (
                      <p>• 구역 설정: {result.copied.zones}개 복사됨</p>
                    )}
                    {result.copied.notificationSettings > 0 && (
                      <p>• 알림 설정: {result.copied.notificationSettings}개 복사됨</p>
                    )}
                    {result.copied.ccpDefinitions > 0 && (
                      <p>• CCP 정의: {result.copied.ccpDefinitions}개 복사됨</p>
                    )}
                  </div>
                  {result.errors.length > 0 && (
                    <div className="mt-2 text-red-600">
                      {result.errors.map((err, i) => (
                        <p key={i}>• {err}</p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 bg-gray-50 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 transition-colors font-medium"
          >
            {result ? '닫기' : '취소'}
          </button>
          {!result && (
            <button
              onClick={handleCopy}
              disabled={copying || !selectedStoreId || stores.length === 0}
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
            >
              {copying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  복사 중...
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  설정 복사
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Copy Option Item Component
interface CopyOptionItemProps {
  checked: boolean;
  onChange: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  color: 'blue' | 'cyan' | 'green' | 'amber' | 'red';
}

function CopyOptionItem({ checked, onChange, icon, title, description, color }: CopyOptionItemProps) {
  const colorClasses = {
    blue: {
      bg: checked ? 'bg-blue-50' : 'bg-white',
      border: checked ? 'border-blue-300' : 'border-gray-200',
      icon: checked ? 'text-blue-600' : 'text-gray-400',
      ring: 'focus-within:ring-blue-200',
    },
    cyan: {
      bg: checked ? 'bg-cyan-50' : 'bg-white',
      border: checked ? 'border-cyan-300' : 'border-gray-200',
      icon: checked ? 'text-cyan-600' : 'text-gray-400',
      ring: 'focus-within:ring-cyan-200',
    },
    green: {
      bg: checked ? 'bg-green-50' : 'bg-white',
      border: checked ? 'border-green-300' : 'border-gray-200',
      icon: checked ? 'text-green-600' : 'text-gray-400',
      ring: 'focus-within:ring-green-200',
    },
    amber: {
      bg: checked ? 'bg-amber-50' : 'bg-white',
      border: checked ? 'border-amber-300' : 'border-gray-200',
      icon: checked ? 'text-amber-600' : 'text-gray-400',
      ring: 'focus-within:ring-amber-200',
    },
    red: {
      bg: checked ? 'bg-red-50' : 'bg-white',
      border: checked ? 'border-red-300' : 'border-gray-200',
      icon: checked ? 'text-red-600' : 'text-gray-400',
      ring: 'focus-within:ring-red-200',
    },
  };

  const classes = colorClasses[color];

  return (
    <label
      className={`flex items-start gap-3 p-3 border-2 rounded-xl cursor-pointer transition-all ${classes.bg} ${classes.border} ${classes.ring} hover:shadow-sm`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="mt-1 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />
      <div className={`${classes.icon} transition-colors`}>
        {icon}
      </div>
      <div className="flex-1">
        <p className="font-medium text-gray-900">{title}</p>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
    </label>
  );
}
