'use client';

import { useState, useEffect } from 'react';
import { Save, Bell, Shield, Database, Mail, Globe, Server, Check } from 'lucide-react';

const defaultSettings = {
  platformName: 'ABC Staff System',
  supportEmail: 'support@abcstaff.com',
  maxUsersPerCompany: 100,
  maxStoresPerCompany: 50,
  enableRegistration: true,
  requireEmailVerification: true,
  enableTwoFactor: false,
  maintenanceMode: false,
  backupEnabled: true,
  backupFrequency: 'daily',
  emailNotifications: true,
  slackNotifications: false,
};

export default function SettingsPage() {
  const [settings, setSettings] = useState(defaultSettings);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('platform_settings');
    if (stored) {
      try {
        setSettings({ ...defaultSettings, ...JSON.parse(stored) });
      } catch {
        setSettings(defaultSettings);
      }
    }
    setLoading(false);
  }, []);

  const handleSave = () => {
    localStorage.setItem('platform_settings', JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">설정</h1>
          <p className="text-gray-600">플랫폼 전역 설정을 관리합니다</p>
        </div>
        <button
          onClick={handleSave}
          className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
            saved ? 'bg-green-600 text-white' : 'bg-primary text-white hover:bg-primary-700'
          }`}
        >
          {saved ? <Check className="w-5 h-5 mr-2" /> : <Save className="w-5 h-5 mr-2" />}
          {saved ? '저장됨' : '저장'}
        </button>
      </div>

      {/* General Settings */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center">
          <Globe className="w-5 h-5 text-gray-400 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">일반 설정</h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">플랫폼 이름</label>
              <input
                type="text"
                value={settings.platformName}
                onChange={(e) => setSettings({ ...settings, platformName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">지원 이메일</label>
              <input
                type="email"
                value={settings.supportEmail}
                onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">회사당 최대 사용자 수</label>
              <input
                type="number"
                value={settings.maxUsersPerCompany}
                onChange={(e) => setSettings({ ...settings, maxUsersPerCompany: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">회사당 최대 매장 수</label>
              <input
                type="number"
                value={settings.maxStoresPerCompany}
                onChange={(e) => setSettings({ ...settings, maxStoresPerCompany: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Security Settings */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center">
          <Shield className="w-5 h-5 text-gray-400 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">보안 설정</h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">신규 가입 허용</p>
              <p className="text-sm text-gray-500">새로운 회사가 가입할 수 있도록 허용합니다</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enableRegistration}
                onChange={(e) => setSettings({ ...settings, enableRegistration: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">이메일 인증 필수</p>
              <p className="text-sm text-gray-500">가입 시 이메일 인증을 필수로 합니다</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.requireEmailVerification}
                onChange={(e) => setSettings({ ...settings, requireEmailVerification: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">2단계 인증</p>
              <p className="text-sm text-gray-500">모든 관리자에게 2단계 인증을 요구합니다</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enableTwoFactor}
                onChange={(e) => setSettings({ ...settings, enableTwoFactor: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
        </div>
      </div>

      {/* System Settings */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center">
          <Server className="w-5 h-5 text-gray-400 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">시스템 설정</h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">유지보수 모드</p>
              <p className="text-sm text-gray-500">플랫폼을 유지보수 모드로 전환합니다</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.maintenanceMode}
                onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
            </label>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">자동 백업</p>
              <p className="text-sm text-gray-500">데이터베이스를 자동으로 백업합니다</p>
            </div>
            <div className="flex items-center space-x-4">
              <select
                value={settings.backupFrequency}
                onChange={(e) => setSettings({ ...settings, backupFrequency: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="hourly">매시간</option>
                <option value="daily">매일</option>
                <option value="weekly">매주</option>
              </select>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.backupEnabled}
                  onChange={(e) => setSettings({ ...settings, backupEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Notification Settings */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center">
          <Bell className="w-5 h-5 text-gray-400 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">알림 설정</h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">이메일 알림</p>
              <p className="text-sm text-gray-500">중요한 이벤트 발생 시 이메일로 알림을 받습니다</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.emailNotifications}
                onChange={(e) => setSettings({ ...settings, emailNotifications: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Slack 알림</p>
              <p className="text-sm text-gray-500">Slack 채널로 알림을 전송합니다</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.slackNotifications}
                onChange={(e) => setSettings({ ...settings, slackNotifications: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
