'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, BellOff, X, Loader2, Save, AlertTriangle, Clock, Users } from 'lucide-react';

interface SensorAlertSettings {
  alert_enabled: boolean;
  min_threshold: number | null;
  max_threshold: number | null;
  alert_interval_minutes: number;
  offline_alert_enabled: boolean;
  offline_threshold_minutes: number;
  notify_roles: string[];
  notify_users: string[];
  push_enabled: boolean;
  email_enabled: boolean;
  sms_enabled: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  quiet_hours_exception_critical: boolean;
}

interface SensorAlertSettingsModalProps {
  sensorId: string;
  sensorName: string;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

const ROLES = [
  { value: 'company_admin', label: '관리자' },
  { value: 'store_manager', label: '점장' },
  { value: 'haccp_manager', label: 'HACCP 담당자' },
  { value: 'staff', label: '직원' },
];

export default function SensorAlertSettingsModal({
  sensorId,
  sensorName,
  isOpen,
  onClose,
  onSaved,
}: SensorAlertSettingsModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SensorAlertSettings>({
    alert_enabled: true,
    min_threshold: null,
    max_threshold: null,
    alert_interval_minutes: 5,
    offline_alert_enabled: true,
    offline_threshold_minutes: 10,
    notify_roles: ['company_admin', 'store_manager', 'haccp_manager'],
    notify_users: [],
    push_enabled: true,
    email_enabled: false,
    sms_enabled: false,
    quiet_hours_enabled: false,
    quiet_hours_start: null,
    quiet_hours_end: null,
    quiet_hours_exception_critical: true,
  });

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/sensors/${sensorId}/alerts`);
      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings);
      }
    } catch (error) {
      console.error('Failed to fetch alert settings:', error);
    } finally {
      setLoading(false);
    }
  }, [sensorId]);

  useEffect(() => {
    if (isOpen && sensorId) {
      fetchSettings();
    }
  }, [isOpen, sensorId, fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/sensors/${sensorId}/alerts`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        onSaved?.();
        onClose();
      } else {
        const error = await response.json();
        alert(error.error || '저장 실패');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const toggleRole = (role: string) => {
    setSettings((prev) => ({
      ...prev,
      notify_roles: prev.notify_roles.includes(role)
        ? prev.notify_roles.filter((r) => r !== role)
        : [...prev.notify_roles, role],
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-blue-500 rounded-xl flex items-center justify-center">
              <Bell className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">알림 설정</h2>
              <p className="text-sm text-gray-500">{sensorName}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <>
              {/* Master Switch */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-3">
                  {settings.alert_enabled ? (
                    <Bell className="w-5 h-5 text-blue-600" />
                  ) : (
                    <BellOff className="w-5 h-5 text-gray-400" />
                  )}
                  <div>
                    <p className="font-medium">알림 활성화</p>
                    <p className="text-sm text-gray-500">이 센서의 모든 알림</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.alert_enabled}
                    onChange={(e) =>
                      setSettings({ ...settings, alert_enabled: e.target.checked })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {settings.alert_enabled && (
                <>
                  {/* Temperature Thresholds */}
                  <div className="space-y-4">
                    <h3 className="font-medium flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-orange-500" />
                      온도 임계값
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">
                          최저 온도 (°C)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={settings.min_threshold ?? ''}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              min_threshold: e.target.value ? parseFloat(e.target.value) : null,
                            })
                          }
                          placeholder="미설정"
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">
                          최고 온도 (°C)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={settings.max_threshold ?? ''}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              max_threshold: e.target.value ? parseFloat(e.target.value) : null,
                            })
                          }
                          placeholder="미설정"
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">
                      온도가 범위를 벗어나면 즉시 알림을 발송합니다.
                    </p>
                  </div>

                  {/* Alert Interval */}
                  <div className="space-y-3">
                    <h3 className="font-medium flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-500" />
                      알림 간격
                    </h3>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        중복 알림 방지 (분)
                      </label>
                      <select
                        value={settings.alert_interval_minutes}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            alert_interval_minutes: parseInt(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 border rounded-lg"
                      >
                        <option value={1}>1분</option>
                        <option value={5}>5분</option>
                        <option value={10}>10분</option>
                        <option value={15}>15분</option>
                        <option value={30}>30분</option>
                        <option value={60}>1시간</option>
                      </select>
                    </div>
                  </div>

                  {/* Offline Alert */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">오프라인 알림</p>
                        <p className="text-sm text-gray-500">센서 연결이 끊어지면 알림</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.offline_alert_enabled}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              offline_alert_enabled: e.target.checked,
                            })
                          }
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                    {settings.offline_alert_enabled && (
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">
                          오프라인 판정 시간 (분)
                        </label>
                        <select
                          value={settings.offline_threshold_minutes}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              offline_threshold_minutes: parseInt(e.target.value),
                            })
                          }
                          className="w-full px-3 py-2 border rounded-lg"
                        >
                          <option value={5}>5분</option>
                          <option value={10}>10분</option>
                          <option value={15}>15분</option>
                          <option value={30}>30분</option>
                          <option value={60}>1시간</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Notification Channels */}
                  <div className="space-y-3">
                    <h3 className="font-medium">알림 채널</h3>
                    <div className="space-y-2">
                      <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.push_enabled}
                          onChange={(e) =>
                            setSettings({ ...settings, push_enabled: e.target.checked })
                          }
                          className="w-4 h-4 text-blue-600"
                        />
                        <span>푸시 알림 (앱/웹)</span>
                      </label>
                      <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.email_enabled}
                          onChange={(e) =>
                            setSettings({ ...settings, email_enabled: e.target.checked })
                          }
                          className="w-4 h-4 text-blue-600"
                        />
                        <span>이메일</span>
                      </label>
                      <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.sms_enabled}
                          onChange={(e) =>
                            setSettings({ ...settings, sms_enabled: e.target.checked })
                          }
                          className="w-4 h-4 text-blue-600"
                        />
                        <span>SMS 문자</span>
                      </label>
                    </div>
                  </div>

                  {/* Notification Recipients */}
                  <div className="space-y-3">
                    <h3 className="font-medium flex items-center gap-2">
                      <Users className="w-4 h-4 text-green-500" />
                      알림 대상
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {ROLES.map((role) => (
                        <button
                          key={role.value}
                          type="button"
                          onClick={() => toggleRole(role.value)}
                          className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                            settings.notify_roles.includes(role.value)
                              ? 'bg-blue-100 text-blue-700 border border-blue-300'
                              : 'bg-gray-100 text-gray-600 border border-transparent'
                          }`}
                        >
                          {role.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Quiet Hours */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">방해 금지 시간</p>
                        <p className="text-sm text-gray-500">특정 시간대 알림 차단</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.quiet_hours_enabled}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              quiet_hours_enabled: e.target.checked,
                            })
                          }
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                    {settings.quiet_hours_enabled && (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm text-gray-600 mb-1">시작</label>
                            <input
                              type="time"
                              value={settings.quiet_hours_start || '22:00'}
                              onChange={(e) =>
                                setSettings({
                                  ...settings,
                                  quiet_hours_start: e.target.value,
                                })
                              }
                              className="w-full px-3 py-2 border rounded-lg"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-600 mb-1">종료</label>
                            <input
                              type="time"
                              value={settings.quiet_hours_end || '07:00'}
                              onChange={(e) =>
                                setSettings({
                                  ...settings,
                                  quiet_hours_end: e.target.value,
                                })
                              }
                              className="w-full px-3 py-2 border rounded-lg"
                            />
                          </div>
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={settings.quiet_hours_exception_critical}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                quiet_hours_exception_critical: e.target.checked,
                              })
                            }
                            className="w-4 h-4 text-blue-600"
                          />
                          <span className="text-gray-600">
                            긴급 알림은 방해 금지 시간에도 발송
                          </span>
                        </label>
                      </>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-gray-50 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-100 font-medium"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Save className="w-4 h-4" />
                저장
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
