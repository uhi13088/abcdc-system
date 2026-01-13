'use client';

import { useState } from 'react';
import { Save, Building2, Bell, Shield, Users, Clock, Database } from 'lucide-react';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'company' | 'notification' | 'haccp' | 'users'>('company');
  const [saving, setSaving] = useState(false);

  const [companySettings, setCompanySettings] = useState({
    company_name: 'ABC 식품',
    business_number: '123-45-67890',
    representative: '홍길동',
    address: '서울시 강남구 테헤란로 123',
    phone: '02-1234-5678',
    haccp_certification_number: 'HACCP-2024-001234',
    certification_date: '2024-01-15',
    certification_expiry: '2027-01-14',
  });

  const [notificationSettings, setNotificationSettings] = useState({
    ccp_alert_enabled: true,
    ccp_deviation_notification: true,
    daily_report_enabled: true,
    daily_report_time: '18:00',
    inspection_reminder: true,
    inspection_reminder_hours: 2,
    training_reminder: true,
    email_notifications: true,
    notification_email: 'haccp@abc-food.com',
  });

  const [haccpSettings, setHaccpSettings] = useState({
    auto_logout_minutes: 30,
    require_photo_evidence: true,
    allow_late_entry: false,
    late_entry_hours: 24,
    require_corrective_action: true,
    ccp_monitoring_interval: 60,
    temperature_unit: 'celsius',
    record_retention_years: 3,
  });

  const handleSave = async () => {
    setSaving(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setSaving(false);
    alert('설정이 저장되었습니다.');
  };

  const tabs = [
    { id: 'company', name: '회사 정보', icon: Building2 },
    { id: 'notification', name: '알림 설정', icon: Bell },
    { id: 'haccp', name: 'HACCP 설정', icon: Shield },
    { id: 'users', name: '사용자 관리', icon: Users },
  ] as const;

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">설정</h1>
          <p className="mt-1 text-sm text-gray-500">HACCP 시스템 설정을 관리합니다</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>

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
                  onChange={(e) => setHaccpSettings({ ...haccpSettings, auto_logout_minutes: parseInt(e.target.value) })}
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
    </div>
  );
}
