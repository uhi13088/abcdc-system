'use client';

import { useState } from 'react';
import { ArrowLeft, Bell, Clock, Calendar, DollarSign, MessageSquare, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface NotificationSetting {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  enabled: boolean;
}

export default function SettingsPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [settings, setSettings] = useState<NotificationSetting[]>([
    {
      id: 'attendance',
      label: '출퇴근 알림',
      description: '출근/퇴근 시간 알림',
      icon: Clock,
      enabled: true,
    },
    {
      id: 'schedule',
      label: '스케줄 알림',
      description: '근무 일정 변경 및 알림',
      icon: Calendar,
      enabled: true,
    },
    {
      id: 'salary',
      label: '급여 알림',
      description: '급여 지급 및 명세서 알림',
      icon: DollarSign,
      enabled: true,
    },
    {
      id: 'notice',
      label: '공지사항 알림',
      description: '새 공지사항 알림',
      icon: Bell,
      enabled: true,
    },
    {
      id: 'message',
      label: '메시지 알림',
      description: '새 메시지 수신 알림',
      icon: MessageSquare,
      enabled: true,
    },
    {
      id: 'emergency',
      label: '긴급 근무 알림',
      description: '긴급 대타 모집 알림',
      icon: AlertTriangle,
      enabled: false,
    },
  ]);

  const [pushEnabled, setPushEnabled] = useState(true);
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietStart, setQuietStart] = useState('22:00');
  const [quietEnd, setQuietEnd] = useState('08:00');

  const toggleSetting = (id: string) => {
    setSettings(settings.map(s =>
      s.id === id ? { ...s, enabled: !s.enabled } : s
    ));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // TODO: Replace with real API call
      // await fetch('/api/my/settings', {
      //   method: 'PUT',
      //   body: JSON.stringify({ settings, pushEnabled, quietHoursEnabled, quietStart, quietEnd }),
      // });

      await new Promise(resolve => setTimeout(resolve, 500));
      router.back();
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  };

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
              onClick={() => setPushEnabled(!pushEnabled)}
              className={`w-12 h-7 rounded-full transition-colors ${
                pushEnabled ? 'bg-primary' : 'bg-gray-300'
              }`}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                pushEnabled ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
        </div>

        {/* Individual Settings */}
        {pushEnabled && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-medium text-gray-900">알림 유형</h3>
            </div>
            {settings.map((setting, index) => (
              <div
                key={setting.id}
                className={`flex items-center justify-between p-4 ${
                  index !== settings.length - 1 ? 'border-b border-gray-100' : ''
                }`}
              >
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                    <setting.icon className="w-5 h-5 text-gray-600" />
                  </div>
                  <div className="ml-3">
                    <p className="font-medium text-gray-900">{setting.label}</p>
                    <p className="text-xs text-gray-500">{setting.description}</p>
                  </div>
                </div>
                <button
                  onClick={() => toggleSetting(setting.id)}
                  className={`w-12 h-7 rounded-full transition-colors ${
                    setting.enabled ? 'bg-primary' : 'bg-gray-300'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                    setting.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Quiet Hours */}
        {pushEnabled && (
          <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">방해 금지 시간</p>
                <p className="text-sm text-gray-500">설정 시간에는 알림을 받지 않습니다</p>
              </div>
              <button
                onClick={() => setQuietHoursEnabled(!quietHoursEnabled)}
                className={`w-12 h-7 rounded-full transition-colors ${
                  quietHoursEnabled ? 'bg-primary' : 'bg-gray-300'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                  quietHoursEnabled ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            {quietHoursEnabled && (
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">시작 시간</label>
                  <input
                    type="time"
                    value={quietStart}
                    onChange={(e) => setQuietStart(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">종료 시간</label>
                  <input
                    type="time"
                    value={quietEnd}
                    onChange={(e) => setQuietEnd(e.target.value)}
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
