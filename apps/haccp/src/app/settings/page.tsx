'use client';

import { useState, useEffect, useCallback } from 'react';
import { Save, Building2, Bell, Shield, Users, Clock, Database, RefreshCw, AlertCircle, MapPin, Sun, Plus, Trash2, Edit2 } from 'lucide-react';

interface CompanySettings {
  company_name: string;
  business_number: string;
  representative: string;
  address: string;
  phone: string;
  haccp_certification_number: string;
  certification_date: string;
  certification_expiry: string;
}

interface NotificationSettings {
  ccp_alert_enabled: boolean;
  ccp_deviation_notification: boolean;
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

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'company' | 'notification' | 'haccp' | 'zones' | 'seasons' | 'users'>('company');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Zone settings
  const [zones, setZones] = useState<Zone[]>([]);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [showZoneModal, setShowZoneModal] = useState(false);

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
    phone: '',
    haccp_certification_number: '',
    certification_date: '',
    certification_expiry: '',
  });

  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    ccp_alert_enabled: true,
    ccp_deviation_notification: true,
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
      setError(err instanceof Error ? err.message : '설정을 불러오는데 실패했습니다.');
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
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err) {
      setError('구역 저장에 실패했습니다.');
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
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err) {
      setError('구역 삭제에 실패했습니다.');
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
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err) {
      setError('시즌 설정 저장에 실패했습니다.');
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
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '설정 저장에 실패했습니다.');
      }

      setSuccessMessage('설정이 저장되었습니다.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '설정 저장에 실패했습니다.');
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
                onChange={(e) => setCompanySettings({ ...companySettings, business_number: e.target.value })}
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
                onChange={(e) => setCompanySettings({ ...companySettings, phone: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">주소</label>
              <input
                type="text"
                value={companySettings.address}
                onChange={(e) => setCompanySettings({ ...companySettings, address: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
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
    </div>
  );
}
