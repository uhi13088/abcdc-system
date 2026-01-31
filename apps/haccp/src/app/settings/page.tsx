'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Save, Building2, Bell, Shield, Users, Clock, Database, RefreshCw, AlertCircle, MapPin, Sun, Plus, Trash2, Edit2, CheckCircle, Lock, Info, Search, Copy } from 'lucide-react';
import StoreCopyModal from '@/components/settings/StoreCopyModal';
import toast from 'react-hot-toast';

declare global {
  interface Window {
    daum: {
      Postcode: new (config: {
        oncomplete: (data: DaumPostcodeData) => void;
      }) => { open: () => void };
    };
  }
}

interface DaumPostcodeData {
  zonecode: string;
  roadAddress: string;
  jibunAddress: string;
  userSelectedType: string;
  bname: string;
  buildingName: string;
  apartment: string;
}

// 사업자등록번호 포맷팅 (000-00-00000)
const formatBusinessNumber = (value: string): string => {
  const numbers = value.replace(/[^0-9]/g, '').slice(0, 10);
  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 5) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
  return `${numbers.slice(0, 3)}-${numbers.slice(3, 5)}-${numbers.slice(5)}`;
};

// 전화번호 포맷팅
const formatPhoneNumber = (value: string): string => {
  const numbers = value.replace(/[^0-9]/g, '').slice(0, 11);
  if (numbers.length <= 3) return numbers;
  if (numbers.startsWith('02')) {
    if (numbers.length <= 5) return `${numbers.slice(0, 2)}-${numbers.slice(2)}`;
    if (numbers.length <= 9) return `${numbers.slice(0, 2)}-${numbers.slice(2, 5)}-${numbers.slice(5)}`;
    return `${numbers.slice(0, 2)}-${numbers.slice(2, 6)}-${numbers.slice(6)}`;
  }
  if (numbers.length <= 6) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
  if (numbers.length <= 10) return `${numbers.slice(0, 3)}-${numbers.slice(3, 6)}-${numbers.slice(6)}`;
  return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
};

interface CompanySettings {
  company_name: string;
  business_number: string;
  representative: string;
  address: string;
  address_detail: string;
  phone: string;
  haccp_certification_number: string;
  certification_date: string;
  certification_expiry: string;
}

interface NotificationSettings {
  ccp_alert_enabled: boolean;
  ccp_deviation_notification: boolean;
  equipment_temp_alert_enabled: boolean;
  daily_report_enabled: boolean;
  daily_report_time: string;
  inspection_reminder: boolean;
  inspection_reminder_hours: number;
  training_reminder: boolean;
  email_notifications: boolean;
  notification_email: string;
}

interface HaccpSettings {
  auto_logout_minutes: number;
  require_photo_evidence: boolean;
  allow_late_entry: boolean;
  late_entry_hours: number;
  require_corrective_action: boolean;
  ccp_monitoring_interval: number;
  temperature_unit: string;
  record_retention_years: number;
}

// 역할 계층 정의
type UserRole = 'company_admin' | 'manager' | 'store_manager' | 'team_leader' | 'staff';

const ROLE_LABELS: Record<UserRole, string> = {
  company_admin: '회사 관리자',
  manager: '매니저',
  store_manager: '매장 관리자',
  team_leader: '팀장',
  staff: '직원',
};

const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  company_admin: '회사 전체 관리 권한',
  manager: '회사 내 운영 관리 권한',
  store_manager: '매장 운영 관리 권한',
  team_leader: '팀 관리 및 승인 권한',
  staff: '기본 기록 작성 권한',
};

// 기록 유형
type RecordType = 'hygiene' | 'ccp' | 'storage' | 'pest_control' | 'calibration' | 'training' | 'corrective_action';

const RECORD_TYPE_LABELS: Record<RecordType, string> = {
  hygiene: '위생점검',
  ccp: 'CCP 모니터링',
  storage: '저장소 점검',
  pest_control: '방충방서 점검',
  calibration: '검교정 기록',
  training: '교육훈련 기록',
  corrective_action: '개선조치',
};

interface VerificationSettings {
  verification_min_role: UserRole;
  allow_self_verification: boolean;
  verification_roles_by_type: Record<string, UserRole>;
}

interface Zone {
  id?: string;
  zone_code: string;
  zone_name: string;
  zone_grade: '청결구역' | '일반구역';
  sort_order: number;
  is_active: boolean;
}

interface SeasonConfig {
  동절기: { start_month: number; end_month: number };
  하절기: { start_month: number; end_month: number };
}

// Wrapper component that handles useSearchParams with Suspense
function SettingsPageContent({ initialTab }: { initialTab: string | null }) {
  const [activeTab, setActiveTab] = useState<'company' | 'notification' | 'haccp' | 'verification' | 'zones' | 'seasons' | 'users'>(
    (initialTab as 'company' | 'notification' | 'haccp' | 'verification' | 'zones' | 'seasons' | 'users') || 'company'
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Zone settings
  const [zones, setZones] = useState<Zone[]>([]);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [showZoneModal, setShowZoneModal] = useState(false);

  // Store copy modal
  const [showCopyModal, setShowCopyModal] = useState(false);

  // Season settings
  const [seasonConfig, setSeasonConfig] = useState<SeasonConfig>({
    동절기: { start_month: 11, end_month: 3 },
    하절기: { start_month: 4, end_month: 10 },
  });
  const [currentSeason, setCurrentSeason] = useState<string>('');

  const [companySettings, setCompanySettings] = useState<CompanySettings>({
    company_name: '',
    business_number: '',
    representative: '',
    address: '',
    address_detail: '',
    phone: '',
    haccp_certification_number: '',
    certification_date: '',
    certification_expiry: '',
  });

  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    ccp_alert_enabled: true,
    ccp_deviation_notification: true,
    equipment_temp_alert_enabled: true,
    daily_report_enabled: true,
    daily_report_time: '18:00',
    inspection_reminder: true,
    inspection_reminder_hours: 2,
    training_reminder: true,
    email_notifications: true,
    notification_email: '',
  });

  const [haccpSettings, setHaccpSettings] = useState<HaccpSettings>({
    auto_logout_minutes: 30,
    require_photo_evidence: true,
    allow_late_entry: false,
    late_entry_hours: 24,
    require_corrective_action: true,
    ccp_monitoring_interval: 60,
    temperature_unit: 'celsius',
    record_retention_years: 3,
  });

  const [verificationSettings, setVerificationSettings] = useState<VerificationSettings>({
    verification_min_role: 'manager',
    allow_self_verification: false,
    verification_roles_by_type: {},
  });

  // 유형별 세부 설정 활성화 여부
  const [useDetailedRoles, setUseDetailedRoles] = useState(false);

  // 다음 우편번호 스크립트 로드
  useEffect(() => {
    const script = document.createElement('script');
    script.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
    script.async = true;
    document.head.appendChild(script);
    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  // 주소 검색 핸들러
  const handleAddressSearch = useCallback(() => {
    if (typeof window !== 'undefined' && window.daum?.Postcode) {
      new window.daum.Postcode({
        oncomplete: (data: DaumPostcodeData) => {
          const roadAddr = data.roadAddress;
          let extraAddr = '';
          if (data.userSelectedType === 'R') {
            if (data.bname !== '' && /[동|로|가]$/g.test(data.bname)) {
              extraAddr += data.bname;
            }
            if (data.buildingName !== '' && data.apartment === 'Y') {
              extraAddr += extraAddr !== '' ? ', ' + data.buildingName : data.buildingName;
            }
          }
          const fullAddress = extraAddr !== '' ? `${roadAddr} (${extraAddr})` : roadAddr;
          setCompanySettings(prev => ({ ...prev, address: fullAddress }));
        },
      }).open();
    }
  }, []);

  // 사업자등록번호 변경 핸들러
  const handleBusinessNumberChange = (value: string) => {
    setCompanySettings({ ...companySettings, business_number: formatBusinessNumber(value) });
  };

  // 전화번호 변경 핸들러
  const handlePhoneChange = (value: string) => {
    setCompanySettings({ ...companySettings, phone: formatPhoneNumber(value) });
  };

  const fetchSettings = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch('/api/haccp/settings');
      if (!response.ok) {
        throw new Error('설정을 불러오는데 실패했습니다.');
      }
      const data = await response.json();

      if (data.companySettings) {
        setCompanySettings({
          company_name: data.companySettings.company_name || '',
          business_number: data.companySettings.business_number || '',
          representative: data.companySettings.representative || '',
          address: data.companySettings.address || '',
          address_detail: data.companySettings.address_detail || '',
          phone: data.companySettings.phone || '',
          haccp_certification_number: data.companySettings.haccp_certification_number || '',
          certification_date: data.companySettings.certification_date || '',
          certification_expiry: data.companySettings.certification_expiry || '',
        });
      }

      if (data.notificationSettings) {
        setNotificationSettings({
          ccp_alert_enabled: data.notificationSettings.ccp_alert_enabled ?? true,
          ccp_deviation_notification: data.notificationSettings.ccp_deviation_notification ?? true,
          equipment_temp_alert_enabled: data.notificationSettings.equipment_temp_alert_enabled ?? true,
          daily_report_enabled: data.notificationSettings.daily_report_enabled ?? true,
          daily_report_time: data.notificationSettings.daily_report_time || '18:00',
          inspection_reminder: data.notificationSettings.inspection_reminder ?? true,
          inspection_reminder_hours: data.notificationSettings.inspection_reminder_hours ?? 2,
          training_reminder: data.notificationSettings.training_reminder ?? true,
          email_notifications: data.notificationSettings.email_notifications ?? true,
          notification_email: data.notificationSettings.notification_email || '',
        });
      }

      if (data.haccpSettings) {
        setHaccpSettings({
          auto_logout_minutes: data.haccpSettings.auto_logout_minutes ?? 30,
          require_photo_evidence: data.haccpSettings.require_photo_evidence ?? true,
          allow_late_entry: data.haccpSettings.allow_late_entry ?? false,
          late_entry_hours: data.haccpSettings.late_entry_hours ?? 24,
          require_corrective_action: data.haccpSettings.require_corrective_action ?? true,
          ccp_monitoring_interval: data.haccpSettings.ccp_monitoring_interval ?? 60,
          temperature_unit: data.haccpSettings.temperature_unit || 'celsius',
          record_retention_years: data.haccpSettings.record_retention_years ?? 3,
        });
      }

      if (data.verificationSettings) {
        setVerificationSettings({
          verification_min_role: data.verificationSettings.verification_min_role || 'manager',
          allow_self_verification: data.verificationSettings.allow_self_verification ?? false,
          verification_roles_by_type: data.verificationSettings.verification_roles_by_type || {},
        });
        // 유형별 설정이 있으면 세부 설정 활성화
        if (Object.keys(data.verificationSettings.verification_roles_by_type || {}).length > 0) {
          setUseDetailedRoles(true);
        }
      }
    // Fetch zones
      const zonesRes = await fetch('/api/haccp/settings/zones');
      if (zonesRes.ok) {
        const zonesData = await zonesRes.json();
        setZones(zonesData);
      }

      // Fetch seasons
      const seasonsRes = await fetch('/api/haccp/settings/seasons');
      if (seasonsRes.ok) {
        const seasonsData = await seasonsRes.json();
        setSeasonConfig(seasonsData.config);
        setCurrentSeason(seasonsData.currentSeason);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '설정을 불러오는데 실패했습니다.';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Zone handlers
  const handleSaveZone = async () => {
    if (!editingZone) return;

    try {
      setSaving(true);
      const isNew = !editingZone.id;
      const response = await fetch('/api/haccp/settings/zones', {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isNew ? editingZone : { zones: [editingZone] }),
      });

      if (response.ok) {
        setShowZoneModal(false);
        setEditingZone(null);
        fetchSettings();
        setSuccessMessage('구역이 저장되었습니다.');
        toast.success('구역이 저장되었습니다.');
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (_err) {
      setError('구역 저장에 실패했습니다.');
      toast.error('구역 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteZone = async (id: string) => {
    if (!confirm('이 구역을 삭제하시겠습니까?')) return;

    try {
      const response = await fetch(`/api/haccp/settings/zones?id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchSettings();
        setSuccessMessage('구역이 삭제되었습니다.');
        toast.success('구역이 삭제되었습니다.');
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (_err) {
      setError('구역 삭제에 실패했습니다.');
      toast.error('구역 삭제에 실패했습니다.');
    }
  };

  // Season handlers
  const handleSaveSeasons = async () => {
    try {
      setSaving(true);
      const response = await fetch('/api/haccp/settings/seasons', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: seasonConfig }),
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentSeason(data.currentSeason);
        setSuccessMessage('시즌 설정이 저장되었습니다.');
        toast.success('시즌 설정이 저장되었습니다.');
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (_err) {
      setError('시즌 설정 저장에 실패했습니다.');
      toast.error('시즌 설정 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch('/api/haccp/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companySettings,
          notificationSettings,
          haccpSettings,
          verificationSettings: {
            ...verificationSettings,
            // 세부 설정을 사용하지 않으면 유형별 설정 초기화
            verification_roles_by_type: useDetailedRoles ? verificationSettings.verification_roles_by_type : {},
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '설정 저장에 실패했습니다.');
      }

      setSuccessMessage('설정이 저장되었습니다.');
      toast.success('설정이 저장되었습니다.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '설정 저장에 실패했습니다.';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'company', name: '회사 정보', icon: Building2 },
    { id: 'zones', name: '구역 관리', icon: MapPin },
    { id: 'seasons', name: '시즌 설정', icon: Sun },
    { id: 'notification', name: '알림 설정', icon: Bell },
    { id: 'haccp', name: 'HACCP 설정', icon: Shield },
    { id: 'verification', name: '검증 권한', icon: CheckCircle },
    { id: 'users', name: '사용자 관리', icon: Users },
  ] as const;

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">설정</h1>
          <p className="mt-1 text-sm text-gray-500">HACCP 시스템 설정을 관리합니다</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCopyModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border-2 border-purple-200 text-purple-700 rounded-lg hover:bg-purple-50 hover:border-purple-300 transition-colors"
          >
            <Copy className="w-4 h-4" />
            다른 매장에서 복사
          </button>
          <button
            onClick={fetchSettings}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}
      {successMessage && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          {successMessage}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.name}
          </button>
        ))}
      </div>

      {/* Company Info Tab */}
      {activeTab === 'company' && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-gray-400" />
            회사 기본 정보
          </h2>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">회사명</label>
              <input
                type="text"
                value={companySettings.company_name}
                onChange={(e) => setCompanySettings({ ...companySettings, company_name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">사업자등록번호</label>
              <input
                type="text"
                value={companySettings.business_number}
                onChange={(e) => handleBusinessNumberChange(e.target.value)}
                placeholder="000-00-00000"
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">대표자</label>
              <input
                type="text"
                value={companySettings.representative}
                onChange={(e) => setCompanySettings({ ...companySettings, representative: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">전화번호</label>
              <input
                type="text"
                value={companySettings.phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="000-0000-0000"
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">주소</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={companySettings.address}
                  readOnly
                  placeholder="주소 검색 버튼을 클릭하세요"
                  className="flex-1 px-3 py-2 border rounded-lg bg-gray-50"
                />
                <button
                  type="button"
                  onClick={handleAddressSearch}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
                >
                  <Search className="w-4 h-4" />
                  주소 검색
                </button>
              </div>
              <input
                type="text"
                value={companySettings.address_detail}
                onChange={(e) => setCompanySettings({ ...companySettings, address_detail: e.target.value })}
                placeholder="상세주소 (건물명, 동/호수 등)"
                className="w-full px-3 py-2 border rounded-lg mt-2"
              />
            </div>
          </div>

          <h3 className="text-md font-semibold mt-8 mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-green-500" />
            HACCP 인증 정보
          </h3>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">인증번호</label>
              <input
                type="text"
                value={companySettings.haccp_certification_number}
                onChange={(e) => setCompanySettings({ ...companySettings, haccp_certification_number: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">인증일</label>
              <input
                type="date"
                value={companySettings.certification_date}
                onChange={(e) => setCompanySettings({ ...companySettings, certification_date: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">만료일</label>
              <input
                type="date"
                value={companySettings.certification_expiry}
                onChange={(e) => setCompanySettings({ ...companySettings, certification_expiry: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          </div>
        </div>
      )}

      {/* Notification Tab */}
      {activeTab === 'notification' && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Bell className="w-5 h-5 text-gray-400" />
            알림 설정
          </h2>
          <div className="space-y-6">
            <div className="flex items-center justify-between py-3 border-b">
              <div>
                <p className="font-medium">CCP 이탈 알림</p>
                <p className="text-sm text-gray-500">CCP 측정값이 한계기준을 벗어나면 알림</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notificationSettings.ccp_alert_enabled}
                  onChange={(e) => setNotificationSettings({ ...notificationSettings, ccp_alert_enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between py-3 border-b">
              <div>
                <p className="font-medium">장비 온도이탈 알림</p>
                <p className="text-sm text-gray-500">모니터링 장비(냉장/냉동고)의 온도가 설정 범위를 벗어나면 알림</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notificationSettings.equipment_temp_alert_enabled}
                  onChange={(e) => setNotificationSettings({ ...notificationSettings, equipment_temp_alert_enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between py-3 border-b">
              <div>
                <p className="font-medium">일일 보고서 알림</p>
                <p className="text-sm text-gray-500">매일 지정 시간에 일일 보고서 알림</p>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="time"
                  value={notificationSettings.daily_report_time}
                  onChange={(e) => setNotificationSettings({ ...notificationSettings, daily_report_time: e.target.value })}
                  className="px-3 py-1.5 border rounded-lg text-sm"
                  disabled={!notificationSettings.daily_report_enabled}
                />
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notificationSettings.daily_report_enabled}
                    onChange={(e) => setNotificationSettings({ ...notificationSettings, daily_report_enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between py-3 border-b">
              <div>
                <p className="font-medium">점검 리마인더</p>
                <p className="text-sm text-gray-500">예정된 점검 시간 전 알림</p>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={notificationSettings.inspection_reminder_hours}
                  onChange={(e) => setNotificationSettings({ ...notificationSettings, inspection_reminder_hours: parseInt(e.target.value) })}
                  className="px-3 py-1.5 border rounded-lg text-sm"
                  disabled={!notificationSettings.inspection_reminder}
                >
                  <option value={1}>1시간 전</option>
                  <option value={2}>2시간 전</option>
                  <option value={4}>4시간 전</option>
                  <option value={24}>1일 전</option>
                </select>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notificationSettings.inspection_reminder}
                    onChange={(e) => setNotificationSettings({ ...notificationSettings, inspection_reminder: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between py-3 border-b">
              <div>
                <p className="font-medium">이메일 알림</p>
                <p className="text-sm text-gray-500">중요 알림을 이메일로 전송</p>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="email"
                  value={notificationSettings.notification_email}
                  onChange={(e) => setNotificationSettings({ ...notificationSettings, notification_email: e.target.value })}
                  className="px-3 py-1.5 border rounded-lg text-sm w-48"
                  placeholder="이메일 주소"
                  disabled={!notificationSettings.email_notifications}
                />
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notificationSettings.email_notifications}
                    onChange={(e) => setNotificationSettings({ ...notificationSettings, email_notifications: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HACCP Settings Tab */}
      {activeTab === 'haccp' && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-gray-400" />
            HACCP 운영 설정
          </h2>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Clock className="w-4 h-4 inline mr-1" />
                  자동 로그아웃 (분)
                </label>
                <input
                  type="number"
                  value={haccpSettings.auto_logout_minutes}
                  onChange={(e) => setHaccpSettings({ ...haccpSettings, auto_logout_minutes: parseInt(e.target.value) || 30 })}
                  className="w-full px-3 py-2 border rounded-lg"
                  min={5}
                  max={120}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CCP 모니터링 간격 (분)
                </label>
                <select
                  value={haccpSettings.ccp_monitoring_interval}
                  onChange={(e) => setHaccpSettings({ ...haccpSettings, ccp_monitoring_interval: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value={15}>15분</option>
                  <option value={30}>30분</option>
                  <option value={60}>1시간</option>
                  <option value={120}>2시간</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">온도 단위</label>
                <select
                  value={haccpSettings.temperature_unit}
                  onChange={(e) => setHaccpSettings({ ...haccpSettings, temperature_unit: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="celsius">섭씨 (°C)</option>
                  <option value="fahrenheit">화씨 (°F)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Database className="w-4 h-4 inline mr-1" />
                  기록 보관 기간 (년)
                </label>
                <select
                  value={haccpSettings.record_retention_years}
                  onChange={(e) => setHaccpSettings({ ...haccpSettings, record_retention_years: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value={1}>1년</option>
                  <option value={2}>2년</option>
                  <option value={3}>3년</option>
                  <option value={5}>5년</option>
                  <option value={10}>10년</option>
                </select>
              </div>
            </div>

            <div className="border-t pt-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">사진 증거 필수</p>
                  <p className="text-sm text-gray-500">이탈 발생 시 사진 첨부를 필수로 요구</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={haccpSettings.require_photo_evidence}
                    onChange={(e) => setHaccpSettings({ ...haccpSettings, require_photo_evidence: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">지연 기록 허용</p>
                  <p className="text-sm text-gray-500">지정 시간 이후 기록 입력 허용</p>
                </div>
                <div className="flex items-center gap-3">
                  {haccpSettings.allow_late_entry && (
                    <select
                      value={haccpSettings.late_entry_hours}
                      onChange={(e) => setHaccpSettings({ ...haccpSettings, late_entry_hours: parseInt(e.target.value) })}
                      className="px-3 py-1.5 border rounded-lg text-sm"
                    >
                      <option value={2}>2시간</option>
                      <option value={4}>4시간</option>
                      <option value={24}>24시간</option>
                      <option value={48}>48시간</option>
                    </select>
                  )}
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={haccpSettings.allow_late_entry}
                      onChange={(e) => setHaccpSettings({ ...haccpSettings, allow_late_entry: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">개선조치 필수</p>
                  <p className="text-sm text-gray-500">이탈 발생 시 개선조치 기록 필수</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={haccpSettings.require_corrective_action}
                    onChange={(e) => setHaccpSettings({ ...haccpSettings, require_corrective_action: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Zones Tab */}
      {activeTab === 'zones' && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <MapPin className="w-5 h-5 text-gray-400" />
              구역 관리
            </h2>
            <button
              onClick={() => {
                setEditingZone({
                  zone_code: '',
                  zone_name: '',
                  zone_grade: '일반구역',
                  sort_order: zones.length,
                  is_active: true,
                });
                setShowZoneModal(true);
              }}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              구역 추가
            </button>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            HACCP 시스템에서 사용할 구역을 관리합니다. 구역 등급(청결/일반)은 방충방서 관리 기준에 적용됩니다.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">순서</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">구역 코드</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">구역명</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">등급</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">상태</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {zones.map((zone, idx) => (
                  <tr key={zone.id || idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3">{idx + 1}</td>
                    <td className="px-4 py-3 font-mono text-xs">{zone.zone_code}</td>
                    <td className="px-4 py-3 font-medium">{zone.zone_name}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        zone.zone_grade === '청결구역'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {zone.zone_grade}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        zone.is_active
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {zone.is_active ? '활성' : '비활성'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => {
                          setEditingZone(zone);
                          setShowZoneModal(true);
                        }}
                        className="p-1 text-gray-400 hover:text-blue-600"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => zone.id && handleDeleteZone(zone.id)}
                        className="p-1 text-gray-400 hover:text-red-600 ml-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {zones.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              등록된 구역이 없습니다. 구역을 추가해주세요.
            </div>
          )}
        </div>
      )}

      {/* Seasons Tab */}
      {activeTab === 'seasons' && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Sun className="w-5 h-5 text-gray-400" />
              시즌 설정
            </h2>
            <button
              onClick={handleSaveSeasons}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
          <p className="text-sm text-gray-500 mb-6">
            방충방서 관리 기준은 시즌(동절기/하절기)에 따라 다르게 적용됩니다.
          </p>

          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800">
              <strong>현재 시즌:</strong>{' '}
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                currentSeason === '동절기' ? 'bg-blue-200' : 'bg-orange-200'
              }`}>
                {currentSeason || '계산 중...'}
              </span>
              <span className="ml-2 text-blue-600">
                (현재 {new Date().getMonth() + 1}월)
              </span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* 동절기 */}
            <div className="border rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                동절기 (겨울)
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">시작 월</label>
                  <select
                    value={seasonConfig.동절기.start_month}
                    onChange={(e) => setSeasonConfig({
                      ...seasonConfig,
                      동절기: { ...seasonConfig.동절기, start_month: parseInt(e.target.value) }
                    })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    {monthNames.map((name, idx) => (
                      <option key={idx} value={idx + 1}>{name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">종료 월</label>
                  <select
                    value={seasonConfig.동절기.end_month}
                    onChange={(e) => setSeasonConfig({
                      ...seasonConfig,
                      동절기: { ...seasonConfig.동절기, end_month: parseInt(e.target.value) }
                    })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    {monthNames.map((name, idx) => (
                      <option key={idx} value={idx + 1}>{name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {seasonConfig.동절기.start_month}월 ~ {seasonConfig.동절기.end_month}월
              </p>
            </div>

            {/* 하절기 */}
            <div className="border rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                <span className="w-3 h-3 bg-orange-500 rounded-full"></span>
                하절기 (여름)
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">시작 월</label>
                  <select
                    value={seasonConfig.하절기.start_month}
                    onChange={(e) => setSeasonConfig({
                      ...seasonConfig,
                      하절기: { ...seasonConfig.하절기, start_month: parseInt(e.target.value) }
                    })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    {monthNames.map((name, idx) => (
                      <option key={idx} value={idx + 1}>{name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">종료 월</label>
                  <select
                    value={seasonConfig.하절기.end_month}
                    onChange={(e) => setSeasonConfig({
                      ...seasonConfig,
                      하절기: { ...seasonConfig.하절기, end_month: parseInt(e.target.value) }
                    })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    {monthNames.map((name, idx) => (
                      <option key={idx} value={idx + 1}>{name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {seasonConfig.하절기.start_month}월 ~ {seasonConfig.하절기.end_month}월
              </p>
            </div>
          </div>

          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700 mb-2">시즌별 방충방서 관리 차이</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• 하절기는 해충 활동이 활발하여 관리 기준이 높아집니다</li>
              <li>• 동절기는 해충 활동이 감소하여 관리 기준이 낮아집니다</li>
              <li>• 방충방서 점검 시 현재 시즌 기준이 자동 적용됩니다</li>
            </ul>
          </div>
        </div>
      )}

      {/* Verification Permission Tab */}
      {activeTab === 'verification' && (
        <div className="space-y-6">
          {/* 역할 계층 설명 */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-500" />
              역할 계층 구조
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              HACCP 시스템에서 사용되는 역할 계층입니다. 상위 역할은 하위 역할의 모든 권한을 포함합니다.
            </p>
            <div className="space-y-2">
              {(['company_admin', 'manager', 'store_manager', 'team_leader', 'staff'] as UserRole[]).map((role, idx) => (
                <div
                  key={role}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    idx === 0 ? 'bg-blue-50 border-blue-200' :
                    idx === 1 ? 'bg-green-50 border-green-200' :
                    idx === 2 ? 'bg-yellow-50 border-yellow-200' :
                    idx === 3 ? 'bg-orange-50 border-orange-200' :
                    'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                    idx === 0 ? 'bg-blue-500' :
                    idx === 1 ? 'bg-green-500' :
                    idx === 2 ? 'bg-yellow-500' :
                    idx === 3 ? 'bg-orange-500' :
                    'bg-gray-500'
                  }`}>
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{ROLE_LABELS[role]}</p>
                    <p className="text-sm text-gray-500">{ROLE_DESCRIPTIONS[role]}</p>
                  </div>
                  {idx < 4 && (
                    <div className="text-gray-300">↓</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 검증 권한 설정 */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Lock className="w-5 h-5 text-gray-400" />
              검증(승인) 권한 설정
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              HACCP 기록물의 검증(승인)을 수행할 수 있는 최소 역할을 설정합니다.
            </p>

            <div className="space-y-6">
              {/* 기본 검증 최소 역할 */}
              <div className="border rounded-lg p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  검증 가능 최소 역할 (기본)
                </label>
                <select
                  value={verificationSettings.verification_min_role}
                  onChange={(e) => setVerificationSettings({
                    ...verificationSettings,
                    verification_min_role: e.target.value as UserRole,
                  })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  {(['company_admin', 'manager', 'store_manager', 'team_leader'] as UserRole[]).map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]} 이상
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-2">
                  선택한 역할 이상의 사용자만 기록물 검증이 가능합니다.
                </p>
              </div>

              {/* 본인 검증 허용 */}
              <div className="flex items-center justify-between py-3 border-b">
                <div>
                  <p className="font-medium">본인 검증 허용</p>
                  <p className="text-sm text-gray-500">
                    자신이 작성한 기록을 본인이 검증할 수 있도록 허용합니다.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={verificationSettings.allow_self_verification}
                    onChange={(e) => setVerificationSettings({
                      ...verificationSettings,
                      allow_self_verification: e.target.checked,
                    })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              {!verificationSettings.allow_self_verification && (
                <div className="bg-yellow-50 rounded-lg p-3 text-sm text-yellow-800">
                  <AlertCircle className="w-4 h-4 inline mr-1" />
                  본인 검증이 비활성화되어 있습니다. 기록 작성자와 검증자는 다른 사람이어야 합니다.
                </div>
              )}

              {/* 유형별 세부 설정 */}
              <div className="border-t pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="font-medium">기록 유형별 세부 설정</p>
                    <p className="text-sm text-gray-500">
                      기록 유형마다 다른 검증 권한을 설정합니다.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useDetailedRoles}
                      onChange={(e) => setUseDetailedRoles(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {useDetailedRoles && (
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    {(Object.keys(RECORD_TYPE_LABELS) as RecordType[]).map((recordType) => (
                      <div key={recordType} className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">
                          {RECORD_TYPE_LABELS[recordType]}
                        </span>
                        <select
                          value={verificationSettings.verification_roles_by_type[recordType] || verificationSettings.verification_min_role}
                          onChange={(e) => setVerificationSettings({
                            ...verificationSettings,
                            verification_roles_by_type: {
                              ...verificationSettings.verification_roles_by_type,
                              [recordType]: e.target.value as UserRole,
                            },
                          })}
                          className="px-3 py-1.5 border rounded-lg text-sm"
                        >
                          {(['company_admin', 'manager', 'store_manager', 'team_leader'] as UserRole[]).map((role) => (
                            <option key={role} value={role}>
                              {ROLE_LABELS[role]} 이상
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 현재 설정 요약 */}
          <div className="bg-blue-50 rounded-xl border border-blue-200 p-6">
            <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              현재 설정 요약
            </h3>
            <ul className="text-sm text-blue-800 space-y-2">
              <li>
                • 기본 검증 권한: <strong>{ROLE_LABELS[verificationSettings.verification_min_role]}</strong> 이상
              </li>
              <li>
                • 본인 검증: <strong>{verificationSettings.allow_self_verification ? '허용' : '불허'}</strong>
              </li>
              {useDetailedRoles && Object.keys(verificationSettings.verification_roles_by_type).length > 0 && (
                <li>
                  • 유형별 세부 설정 활성화됨
                </li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-gray-400" />
            사용자 관리
          </h2>
          <p className="text-gray-500 text-center py-8">
            사용자 관리 기능은 준비 중입니다.
            <br />
            관리자에게 문의해 주세요.
          </p>
        </div>
      )}

      {/* Zone Modal */}
      {showZoneModal && editingZone && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-xl font-bold mb-4">
              {editingZone.id ? '구역 수정' : '구역 추가'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">구역 코드</label>
                <input
                  type="text"
                  value={editingZone.zone_code}
                  onChange={(e) => setEditingZone({ ...editingZone, zone_code: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="예: mixing_room"
                  disabled={!!editingZone.id}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">구역명</label>
                <input
                  type="text"
                  value={editingZone.zone_name}
                  onChange={(e) => setEditingZone({ ...editingZone, zone_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="예: 배합실"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">구역 등급</label>
                <select
                  value={editingZone.zone_grade}
                  onChange={(e) => setEditingZone({ ...editingZone, zone_grade: e.target.value as '청결구역' | '일반구역' })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="청결구역">청결구역</option>
                  <option value="일반구역">일반구역</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="zone_active"
                  checked={editingZone.is_active}
                  onChange={(e) => setEditingZone({ ...editingZone, is_active: e.target.checked })}
                  className="w-4 h-4 rounded"
                />
                <label htmlFor="zone_active" className="text-sm text-gray-700">활성화</label>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowZoneModal(false);
                  setEditingZone(null);
                }}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleSaveZone}
                disabled={saving || !editingZone.zone_code || !editingZone.zone_name}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Store Copy Modal */}
      <StoreCopyModal
        isOpen={showCopyModal}
        onClose={() => setShowCopyModal(false)}
        onSuccess={() => {
          // 복사 성공 후 설정 새로고침
          fetchSettings();
        }}
      />
    </div>
  );
}

// useSearchParams를 Suspense로 감싸기 위한 내부 컴포넌트
function SettingsWithSearchParams() {
  const searchParams = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  return <SettingsPageContent initialTab={tabFromUrl} />;
}

// 메인 export - Suspense로 감싸서 useSearchParams 사용
export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    }>
      <SettingsWithSearchParams />
    </Suspense>
  );
}
