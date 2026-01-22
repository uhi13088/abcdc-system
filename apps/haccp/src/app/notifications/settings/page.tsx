'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Edit2, Trash2, Bell, Clock, AlertTriangle, X } from 'lucide-react';
import Link from 'next/link';
import { Label } from '@/components/ui/label';

interface HACCPReminder {
  id: string;
  reminder_type: string;
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  time_of_day?: string;
  day_of_week?: number;
  day_of_month?: number;
  target_role?: string;
  target_user_ids?: string[];
  escalation_enabled: boolean;
  escalation_delay_minutes: number;
  escalation_role?: string;
  is_active: boolean;
  created_at: string;
}

const REMINDER_TYPES = [
  { value: 'DAILY_HYGIENE', label: '일일 위생점검' },
  { value: 'CCP_MONITORING', label: 'CCP 모니터링' },
  { value: 'PEST_CONTROL', label: '방충/방서 점검' },
  { value: 'EQUIPMENT_CALIBRATION', label: '장비 검교정' },
  { value: 'CCP_VERIFICATION', label: 'CCP 월간 검증' },
  { value: 'INVENTORY_CHECK', label: '재고 점검' },
  { value: 'TRAINING', label: '교육 훈련' },
  { value: 'AUDIT', label: '내부 감사' },
];

const FREQUENCIES = [
  { value: 'DAILY', label: '매일' },
  { value: 'WEEKLY', label: '매주' },
  { value: 'MONTHLY', label: '매월' },
];

const DAYS_OF_WEEK = [
  { value: 0, label: '일요일' },
  { value: 1, label: '월요일' },
  { value: 2, label: '화요일' },
  { value: 3, label: '수요일' },
  { value: 4, label: '목요일' },
  { value: 5, label: '금요일' },
  { value: 6, label: '토요일' },
];

const TARGET_ROLES = [
  { value: 'HACCP_STAFF', label: 'HACCP 담당자' },
  { value: 'HACCP_MANAGER', label: 'HACCP 관리자' },
  { value: 'STORE_MANAGER', label: '점장/팀장' },
  { value: 'COMPANY_ADMIN', label: '회사 관리자' },
];

export default function NotificationSettingsPage() {
  const [reminders, setReminders] = useState<HACCPReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedReminder, setSelectedReminder] = useState<HACCPReminder | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    reminder_type: 'DAILY_HYGIENE',
    frequency: 'DAILY' as HACCPReminder['frequency'],
    time_of_day: '08:00',
    day_of_week: 1,
    day_of_month: 1,
    target_role: 'HACCP_STAFF',
    escalation_enabled: true,
    escalation_delay_minutes: 120,
    escalation_role: 'HACCP_MANAGER',
    is_active: true,
  });

  useEffect(() => {
    fetchReminders();
  }, []);

  const fetchReminders = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/haccp/reminders');
      if (response.ok) {
        const data = await response.json();
        setReminders(data);
      }
    } catch (error) {
      console.error('Failed to fetch reminders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editMode ? 'PUT' : 'POST';
      const body = editMode
        ? { id: selectedReminder?.id, ...formData }
        : formData;

      const response = await fetch('/api/haccp/reminders', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...body,
          time_of_day: body.time_of_day || null,
          day_of_week: body.frequency === 'WEEKLY' ? body.day_of_week : null,
          day_of_month: body.frequency === 'MONTHLY' ? body.day_of_month : null,
        }),
      });

      if (response.ok) {
        setShowModal(false);
        fetchReminders();
        resetForm();
      }
    } catch (error) {
      console.error('Failed to save reminder:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/haccp/reminders?id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchReminders();
        setDeleteConfirm(null);
      }
    } catch (error) {
      console.error('Failed to delete reminder:', error);
    }
  };

  const handleToggleActive = async (reminder: HACCPReminder) => {
    try {
      const response = await fetch('/api/haccp/reminders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: reminder.id,
          is_active: !reminder.is_active,
        }),
      });

      if (response.ok) {
        fetchReminders();
      }
    } catch (error) {
      console.error('Failed to toggle reminder:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      reminder_type: 'DAILY_HYGIENE',
      frequency: 'DAILY',
      time_of_day: '08:00',
      day_of_week: 1,
      day_of_month: 1,
      target_role: 'HACCP_STAFF',
      escalation_enabled: true,
      escalation_delay_minutes: 120,
      escalation_role: 'HACCP_MANAGER',
      is_active: true,
    });
    setEditMode(false);
    setSelectedReminder(null);
  };

  const handleEdit = (reminder: HACCPReminder) => {
    setSelectedReminder(reminder);
    setFormData({
      reminder_type: reminder.reminder_type,
      frequency: reminder.frequency,
      time_of_day: reminder.time_of_day || '08:00',
      day_of_week: reminder.day_of_week ?? 1,
      day_of_month: reminder.day_of_month ?? 1,
      target_role: reminder.target_role || 'HACCP_STAFF',
      escalation_enabled: reminder.escalation_enabled,
      escalation_delay_minutes: reminder.escalation_delay_minutes,
      escalation_role: reminder.escalation_role || 'HACCP_MANAGER',
      is_active: reminder.is_active,
    });
    setEditMode(true);
    setShowModal(true);
  };

  const getReminderTypeLabel = (type: string) => {
    return REMINDER_TYPES.find(t => t.value === type)?.label || type;
  };

  const getFrequencyLabel = (freq: string) => {
    return FREQUENCIES.find(f => f.value === freq)?.label || freq;
  };

  const getDayOfWeekLabel = (day: number | undefined) => {
    if (day === undefined) return '';
    return DAYS_OF_WEEK.find(d => d.value === day)?.label || '';
  };

  const getRoleLabel = (role: string | undefined) => {
    if (!role) return '-';
    return TARGET_ROLES.find(r => r.value === role)?.label || role;
  };

  const formatSchedule = (reminder: HACCPReminder) => {
    const time = reminder.time_of_day || '08:00';
    switch (reminder.frequency) {
      case 'DAILY':
        return `매일 ${time}`;
      case 'WEEKLY':
        return `매주 ${getDayOfWeekLabel(reminder.day_of_week)} ${time}`;
      case 'MONTHLY':
        return `매월 ${reminder.day_of_month}일 ${time}`;
      default:
        return '-';
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link href="/notifications" className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="w-4 h-4" />
          알림 목록
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">알림 설정</h1>
            <p className="mt-1 text-sm text-gray-500">HACCP 리마인더 및 알림을 설정합니다</p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            리마인더 추가
          </button>
        </div>
      </div>

      {/* Info Box */}
      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <Bell className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-800">리마인더 시스템 안내</h3>
            <p className="text-sm text-blue-700 mt-1">
              설정한 시간에 담당자에게 자동으로 알림이 발송됩니다.
              미완료 시 에스컬레이션 기능을 통해 상위 관리자에게 알림이 전달됩니다.
            </p>
          </div>
        </div>
      </div>

      {/* Reminders List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : reminders.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">등록된 리마인더가 없습니다</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 text-blue-600 hover:text-blue-700"
          >
            첫 리마인더 추가하기
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">리마인더 유형</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">일정</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">대상</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">에스컬레이션</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {reminders.map((reminder) => (
                <tr key={reminder.id} className={`hover:bg-gray-50 ${!reminder.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleToggleActive(reminder)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        reminder.is_active ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          reminder.is_active ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium">{getReminderTypeLabel(reminder.reminder_type)}</p>
                    <p className="text-xs text-gray-500">{getFrequencyLabel(reminder.frequency)}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm">{formatSchedule(reminder)}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm">{getRoleLabel(reminder.target_role)}</p>
                  </td>
                  <td className="px-6 py-4">
                    {reminder.escalation_enabled ? (
                      <div className="text-sm">
                        <p className="text-orange-600 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {reminder.escalation_delay_minutes}분 후
                        </p>
                        <p className="text-xs text-gray-500">{getRoleLabel(reminder.escalation_role)}</p>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">비활성</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(reminder)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(reminder.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-bold mb-2">리마인더 삭제</h3>
            <p className="text-gray-600 mb-4">
              이 리마인더를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">{editMode ? '리마인더 수정' : '리마인더 추가'}</h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label required>리마인더 유형</Label>
                <select
                  value={formData.reminder_type}
                  onChange={(e) => setFormData({ ...formData, reminder_type: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  {REMINDER_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label required>반복 주기</Label>
                  <select
                    value={formData.frequency}
                    onChange={(e) => setFormData({ ...formData, frequency: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    {FREQUENCIES.map((freq) => (
                      <option key={freq.value} value={freq.value}>{freq.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>알림 시간</Label>
                  <input
                    type="time"
                    value={formData.time_of_day}
                    onChange={(e) => setFormData({ ...formData, time_of_day: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              {formData.frequency === 'WEEKLY' && (
                <div>
                  <Label>요일</Label>
                  <select
                    value={formData.day_of_week}
                    onChange={(e) => setFormData({ ...formData, day_of_week: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    {DAYS_OF_WEEK.map((day) => (
                      <option key={day.value} value={day.value}>{day.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {formData.frequency === 'MONTHLY' && (
                <div>
                  <Label>일</Label>
                  <select
                    value={formData.day_of_month}
                    onChange={(e) => setFormData({ ...formData, day_of_month: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                      <option key={day} value={day}>{day}일</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <Label required>알림 대상</Label>
                <select
                  value={formData.target_role}
                  onChange={(e) => setFormData({ ...formData, target_role: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  {TARGET_ROLES.map((role) => (
                    <option key={role.value} value={role.value}>{role.label}</option>
                  ))}
                </select>
              </div>

              <div className="border-t pt-4 mt-4">
                <label className="flex items-center gap-2 mb-4">
                  <input
                    type="checkbox"
                    checked={formData.escalation_enabled}
                    onChange={(e) => setFormData({ ...formData, escalation_enabled: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm font-medium">미완료 시 에스컬레이션</span>
                </label>

                {formData.escalation_enabled && (
                  <div className="grid grid-cols-2 gap-4 pl-6">
                    <div>
                      <Label>지연 시간 (분)</Label>
                      <input
                        type="number"
                        min="30"
                        step="30"
                        value={formData.escalation_delay_minutes}
                        onChange={(e) => setFormData({ ...formData, escalation_delay_minutes: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <Label>에스컬레이션 대상</Label>
                      <select
                        value={formData.escalation_role}
                        onChange={(e) => setFormData({ ...formData, escalation_role: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg"
                      >
                        {TARGET_ROLES.map((role) => (
                          <option key={role.value} value={role.value}>{role.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm">리마인더 활성화</span>
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editMode ? '수정' : '저장'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
