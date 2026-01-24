'use client';

import { useState, useEffect } from 'react';
import { Save, Shield, Globe, Server, Check, Info, ExternalLink } from 'lucide-react';

const defaultSettings = {
  platformName: 'Peanote',
  supportEmail: 'support@abcstaff.com',
  maxUsersPerCompany: 100,
  maxStoresPerCompany: 50,
  enableRegistration: true,
  requireEmailVerification: true,
  enableTwoFactor: false,
  maintenanceMode: false,
};

export default function SettingsPage() {
  const [settings, setSettings] = useState(defaultSettings);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/settings');
        if (response.ok) {
          const data = await response.json();
          if (data && Object.keys(data).length > 0) {
            setSettings({
              platformName: data.platform_name || defaultSettings.platformName,
              supportEmail: data.support_email || defaultSettings.supportEmail,
              maxUsersPerCompany: data.max_users_per_company ?? defaultSettings.maxUsersPerCompany,
              maxStoresPerCompany: data.max_stores_per_company ?? defaultSettings.maxStoresPerCompany,
              enableRegistration: data.enable_registration ?? defaultSettings.enableRegistration,
              requireEmailVerification: data.require_email_verification ?? defaultSettings.requireEmailVerification,
              enableTwoFactor: data.enable_two_factor ?? defaultSettings.enableTwoFactor,
              maintenanceMode: data.maintenance_mode ?? defaultSettings.maintenanceMode,
            });
          }
        }
      } catch (error) {
        console.error('Failed to fetch settings:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (response.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } else {
        alert('설정 저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('설정 저장에 실패했습니다.');
    }
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
          <div className="flex items-center justify-between opacity-50">
            <div>
              <p className="font-medium text-gray-900">2단계 인증</p>
              <p className="text-sm text-gray-500">모든 관리자에게 2단계 인증을 요구합니다 (준비중)</p>
            </div>
            <label className="relative inline-flex items-center cursor-not-allowed">
              <input
                type="checkbox"
                checked={settings.enableTwoFactor}
                disabled
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 rounded-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5"></div>
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
              <p className="text-sm text-gray-500">활성화 시 모든 사용자에게 점검 안내 페이지가 표시됩니다</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.maintenanceMode}
                onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
            </label>
          </div>
          {settings.maintenanceMode && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-800">유지보수 모드 활성화됨</p>
                  <p className="text-sm text-red-600 mt-1">
                    super_admin을 제외한 모든 사용자가 서비스에 접근할 수 없습니다.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Backup Info */}
          <div className="border-t pt-4 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">데이터 백업</p>
                <p className="text-sm text-gray-500">Supabase에서 자동으로 관리됩니다</p>
              </div>
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                Supabase 대시보드
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
            <div className="mt-3 bg-gray-50 rounded-lg p-4">
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• 자동 일일 백업 (Pro 플랜)</li>
                <li>• Point-in-Time Recovery 지원</li>
                <li>• 7일간 백업 보관</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
