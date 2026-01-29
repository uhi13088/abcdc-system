'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Bell, Clock, Calendar, DollarSign, MessageSquare, AlertTriangle, Smartphone } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useNotificationStatus } from '@abc/shared';

interface NotificationSettings {
  push_enabled: boolean;
  attendance_enabled: boolean;
  schedule_enabled: boolean;
  salary_enabled: boolean;
  notice_enabled: boolean;
  message_enabled: boolean;
  emergency_enabled: boolean;
  quiet_hours_enabled: boolean;
  quiet_start: string;
  quiet_end: string;
}

const defaultSettings: NotificationSettings = {
  push_enabled: true,
  attendance_enabled: true,
  schedule_enabled: true,
  salary_enabled: true,
  notice_enabled: true,
  message_enabled: true,
  emergency_enabled: false,
  quiet_hours_enabled: false,
  quiet_start: '22:00',
  quiet_end: '08:00',
};

const SETTINGS_KEY = 'abcdc_notification_settings';

export default function SettingsPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);
  const { supported, permission, isRegistered, requestPermission } = useNotificationStatus();
  const [permissionLoading, setPermissionLoading] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    const checkAuthAndLoadSettings = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
          router.push('/auth/login');
          return;
        }

        // Load settings from localStorage
        const stored = localStorage.getItem(SETTINGS_KEY);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            setSettings({ ...defaultSettings, ...parsed });
          } catch (error) {
            console.error('Error parsing stored settings:', error);
          }
        }
      } catch (error) {
        console.error('Error checking auth:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAuthAndLoadSettings();
  }, [supabase, router]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save settings to localStorage
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      router.back();
    } catch (error) {
      console.error('Failed to save settings:', error);
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const settingItems = [
    {
      id: 'attendance',
      key: 'attendance_enabled' as keyof NotificationSettings,
      label: '출퇴근 알림',
      description: '출근/퇴근 시간 알림',
      icon: Clock,
    },
    {
      id: 'schedule',
      key: 'schedule_enabled' as keyof NotificationSettings,
      label: '스케줄 알림',
      description: '근무 일정 변경 및 알림',
      icon: Calendar,
    },
    {
      id: 'salary',
      key: 'salary_enabled' as keyof NotificationSettings,
      label: '급여 알림',
      description: '급여 지급 및 명세서 알림',
      icon: DollarSign,
    },
    {
      id: 'notice',
      key: 'notice_enabled' as keyof NotificationSettings,
      label: '공지사항 알림',
      description: '새 공지사항 알림',
      icon: Bell,
    },
    {
      id: 'message',
      key: 'message_enabled' as keyof NotificationSettings,
      label: '메시지 알림',
      description: '새 메시지 수신 알림',
      icon: MessageSquare,
    },
    {
      id: 'emergency',
      key: 'emergency_enabled' as keyof NotificationSettings,
      label: '긴급 근무 알림',
      description: '긴급 대타 모집 알림',
      icon: AlertTriangle,
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 safe-top">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button onClick={() => router.back()} className="p-2 -ml-2 mr-2">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <h1 className="text-xl font-bold text-gray-900">알림 설정</h1>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-primary text-white rounded-lg font-medium disabled:opacity-50"
          >
            {saving ? '저장중...' : '저장'}
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* System Notification Permission */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-blue-600" />
              </div>
              <div className="ml-3">
                <p className="font-medium text-gray-900">시스템 알림</p>
                <p className="text-sm text-gray-500">
                  {!supported ? '이 브라우저는 알림을 지원하지 않습니다' :
                   permission === 'granted' ? '알림 권한이 허용되었습니다' :
                   permission === 'denied' ? '알림이 차단되었습니다. 브라우저 설정에서 변경해주세요' :
                   '알림을 받으려면 권한을 허용해주세요'}
                </p>
              </div>
            </div>
            {supported && permission === 'default' && (
              <button
                onClick={async () => {
                  setPermissionLoading(true);
                  await requestPermission();
                  setPermissionLoading(false);
                }}
                disabled={permissionLoading}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg disabled:opacity-50"
              >
                {permissionLoading ? '...' : '허용'}
              </button>
            )}
            {supported && permission === 'granted' && (
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-green-600 text-lg">✓</span>
              </div>
            )}
            {supported && permission === 'denied' && (
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                <span className="text-red-600 text-lg">✕</span>
              </div>
            )}
          </div>
        </div>

        {/* Push Notification Toggle */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                <Bell className="w-5 h-5 text-primary" />
              </div>
              <div className="ml-3">
                <p className="font-medium text-gray-900">푸시 알림</p>
                <p className="text-sm text-gray-500">앱 알림 수신 설정</p>
              </div>
            </div>
            <button
              onClick={() => setSettings({ ...settings, push_enabled: !settings.push_enabled })}
              className={`w-12 h-7 rounded-full transition-colors ${
                settings.push_enabled ? 'bg-primary' : 'bg-gray-300'
              }`}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                settings.push_enabled ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
        </div>

        {/* Individual Settings */}
        {settings.push_enabled && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-medium text-gray-900">알림 유형</h3>
            </div>
            {settingItems.map((item, index) => (
              <div
                key={item.id}
                className={`flex items-center justify-between p-4 ${
                  index !== settingItems.length - 1 ? 'border-b border-gray-100' : ''
                }`}
              >
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                    <item.icon className="w-5 h-5 text-gray-600" />
                  </div>
                  <div className="ml-3">
                    <p className="font-medium text-gray-900">{item.label}</p>
                    <p className="text-xs text-gray-500">{item.description}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSettings({ ...settings, [item.key]: !settings[item.key] })}
                  className={`w-12 h-7 rounded-full transition-colors ${
                    settings[item.key] ? 'bg-primary' : 'bg-gray-300'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                    settings[item.key] ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Quiet Hours */}
        {settings.push_enabled && (
          <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">방해 금지 시간</p>
                <p className="text-sm text-gray-500">설정 시간에는 알림을 받지 않습니다</p>
              </div>
              <button
                onClick={() => setSettings({ ...settings, quiet_hours_enabled: !settings.quiet_hours_enabled })}
                className={`w-12 h-7 rounded-full transition-colors ${
                  settings.quiet_hours_enabled ? 'bg-primary' : 'bg-gray-300'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                  settings.quiet_hours_enabled ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            {settings.quiet_hours_enabled && (
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">시작 시간</label>
                  <input
                    type="time"
                    value={settings.quiet_start}
                    onChange={(e) => setSettings({ ...settings, quiet_start: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">종료 시간</label>
                  <input
                    type="time"
                    value={settings.quiet_end}
                    onChange={(e) => setSettings({ ...settings, quiet_end: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Info */}
        <p className="text-xs text-gray-400 text-center px-4">
          알림 설정은 기기의 시스템 설정에서도 관리할 수 있습니다.
        </p>
      </div>
    </div>
  );
}
