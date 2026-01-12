'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/header';
import {
  Button,
  Input,
  Select,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Label,
  Alert,
} from '@/components/ui';
import { Plus, Edit, Trash2, FileText, Clock, DollarSign } from 'lucide-react';

interface DaySchedule {
  startTime: string;
  endTime: string;
  breakMinutes: number;
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  role: string;
  position: string | null;
  salary_type: string;
  salary_amount: number;
  work_days: number[];
  work_start_time: string;
  work_end_time: string;
  break_minutes: number;
  work_schedule: Record<string, DaySchedule> | null;
  required_documents: string[];
  custom_fields: { name: string; type: string; required: boolean }[];
  is_active: boolean;
  created_at: string;
}

const roleLabels: Record<string, string> = {
  staff: '직원',
  team_leader: '팀장',
  store_manager: '매장 관리자',
  manager: '본사 관리자',
  company_admin: '회사 관리자',
};

const salaryTypeLabels: Record<string, string> = {
  hourly: '시급',
  daily: '일급',
  monthly: '월급',
};

const dayLabels = ['일', '월', '화', '수', '목', '금', '토'];

const documentOptions = [
  { value: 'health_certificate', label: '보건증 사본' },
  { value: 'bank_copy', label: '통장 사본' },
  { value: 'career_certificate', label: '경력 증명서' },
  { value: 'education_certificate', label: '학력 증명서' },
  { value: 'id_copy', label: '신분증 사본' },
];

export default function InvitationTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    role: 'staff',
    position: '',
    salaryType: 'hourly' as 'hourly' | 'daily' | 'monthly',
    salaryAmount: 0,
    workDays: [1, 2, 3, 4, 5],
    workStartTime: '09:00',
    workEndTime: '18:00',
    breakMinutes: 60,
    perDayMode: false,
    workSchedule: {} as Record<string, DaySchedule>,
    requiredDocuments: [] as string[],
  });

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/invitation-templates');
      const result = await response.json();
      if (response.ok) {
        setTemplates(result.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      role: 'staff',
      position: '',
      salaryType: 'hourly',
      salaryAmount: 0,
      workDays: [1, 2, 3, 4, 5],
      workStartTime: '09:00',
      workEndTime: '18:00',
      breakMinutes: 60,
      perDayMode: false,
      workSchedule: {},
      requiredDocuments: [],
    });
    setEditingTemplate(null);
    setError('');
  };

  const openCreateDialog = () => {
    resetForm();
    setShowDialog(true);
  };

  const openEditDialog = (template: Template) => {
    setEditingTemplate(template);
    const hasPerDaySchedule = !!(template.work_schedule && Object.keys(template.work_schedule).length > 0);
    setFormData({
      name: template.name,
      description: template.description || '',
      role: template.role,
      position: template.position || '',
      salaryType: template.salary_type as 'hourly' | 'daily' | 'monthly',
      salaryAmount: template.salary_amount,
      workDays: template.work_days,
      workStartTime: template.work_start_time,
      workEndTime: template.work_end_time,
      breakMinutes: template.break_minutes,
      perDayMode: hasPerDaySchedule,
      workSchedule: template.work_schedule || {},
      requiredDocuments: template.required_documents,
    });
    setShowDialog(true);
  };

  const handleSubmit = async () => {
    setError('');
    setSubmitting(true);

    try {
      const url = editingTemplate
        ? `/api/invitation-templates/${editingTemplate.id}`
        : '/api/invitation-templates';
      const method = editingTemplate ? 'PATCH' : 'POST';

      // Prepare data to send
      const dataToSend = {
        name: formData.name,
        description: formData.description,
        role: formData.role,
        position: formData.position,
        salaryType: formData.salaryType,
        salaryAmount: formData.salaryAmount,
        workDays: formData.workDays,
        workStartTime: formData.workStartTime,
        workEndTime: formData.workEndTime,
        breakMinutes: formData.breakMinutes,
        workSchedule: formData.perDayMode ? formData.workSchedule : null,
        requiredDocuments: formData.requiredDocuments,
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend),
      });

      if (response.ok) {
        setShowDialog(false);
        resetForm();
        fetchTemplates();
      } else {
        const result = await response.json();
        setError(result.error || '저장에 실패했습니다.');
      }
    } catch (err) {
      setError('저장에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
      const response = await fetch(`/api/invitation-templates/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchTemplates();
      } else {
        const result = await response.json();
        alert(result.error || '삭제에 실패했습니다.');
      }
    } catch (err) {
      alert('삭제에 실패했습니다.');
    }
  };

  const toggleWorkDay = (day: number) => {
    setFormData((prev) => {
      const isRemoving = prev.workDays.includes(day);
      const newWorkDays = isRemoving
        ? prev.workDays.filter((d) => d !== day)
        : [...prev.workDays, day].sort();

      // Update workSchedule accordingly
      const newWorkSchedule = { ...prev.workSchedule };
      if (isRemoving) {
        delete newWorkSchedule[String(day)];
      } else if (prev.perDayMode) {
        // Initialize with default times when adding a day in per-day mode
        newWorkSchedule[String(day)] = {
          startTime: prev.workStartTime,
          endTime: prev.workEndTime,
          breakMinutes: prev.breakMinutes,
        };
      }

      return {
        ...prev,
        workDays: newWorkDays,
        workSchedule: newWorkSchedule,
      };
    });
  };

  const updateDaySchedule = (day: number, field: keyof DaySchedule, value: string | number) => {
    setFormData((prev) => ({
      ...prev,
      workSchedule: {
        ...prev.workSchedule,
        [String(day)]: {
          ...prev.workSchedule[String(day)],
          [field]: value,
        },
      },
    }));
  };

  const togglePerDayMode = (enabled: boolean) => {
    setFormData((prev) => {
      if (enabled) {
        // Initialize workSchedule for all selected days
        const newSchedule: Record<string, DaySchedule> = {};
        prev.workDays.forEach((day) => {
          newSchedule[String(day)] = {
            startTime: prev.workStartTime,
            endTime: prev.workEndTime,
            breakMinutes: prev.breakMinutes,
          };
        });
        return { ...prev, perDayMode: true, workSchedule: newSchedule };
      } else {
        return { ...prev, perDayMode: false, workSchedule: {} };
      }
    });
  };

  const toggleDocument = (doc: string) => {
    setFormData((prev) => ({
      ...prev,
      requiredDocuments: prev.requiredDocuments.includes(doc)
        ? prev.requiredDocuments.filter((d) => d !== doc)
        : [...prev.requiredDocuments, doc],
    }));
  };

  const formatWorkDays = (days: number[]) => {
    return days.map((d) => dayLabels[d]).join(', ');
  };

  const formatScheduleDisplay = (template: Template) => {
    if (template.work_schedule && Object.keys(template.work_schedule).length > 0) {
      // Per-day schedule - show summary
      const uniqueTimes = new Set<string>();
      Object.values(template.work_schedule).forEach((schedule) => {
        uniqueTimes.add(`${schedule.startTime}~${schedule.endTime}`);
      });
      if (uniqueTimes.size === 1) {
        // All days have same time
        return `${formatWorkDays(template.work_days)} ${Array.from(uniqueTimes)[0]}`;
      } else {
        // Different times - show "요일별 다름"
        return `${formatWorkDays(template.work_days)} (요일별 다름)`;
      }
    }
    return `${formatWorkDays(template.work_days)} ${template.work_start_time}~${template.work_end_time}`;
  };

  const formatSalary = (type: string, amount: number) => {
    const formatted = amount.toLocaleString();
    switch (type) {
      case 'hourly':
        return `시급 ${formatted}원`;
      case 'daily':
        return `일급 ${formatted}원`;
      case 'monthly':
        return `월급 ${formatted}원`;
      default:
        return `${formatted}원`;
    }
  };

  return (
    <div>
      <Header title="초대 템플릿 관리" />

      <div className="p-6">
        <div className="mb-6 flex justify-between items-center">
          <p className="text-gray-600">
            자주 사용하는 초대 조건을 템플릿으로 저장하면 초대 시 간편하게 사용할 수 있습니다.
          </p>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            템플릿 추가
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : templates.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">등록된 템플릿이 없습니다.</p>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              첫 템플릿 만들기
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {templates.map((template) => (
              <div
                key={template.id}
                className="bg-white rounded-lg border border-gray-200 p-5 hover:border-blue-300 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">{template.name}</h3>
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-sm rounded">
                        {roleLabels[template.role] || template.role}
                      </span>
                    </div>
                    {template.description && (
                      <p className="text-gray-500 text-sm mb-3">{template.description}</p>
                    )}
                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-4 w-4" />
                        {formatSalary(template.salary_type, template.salary_amount)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {formatScheduleDisplay(template)}
                      </span>
                    </div>
                    {template.required_documents.length > 0 && (
                      <div className="mt-2 flex gap-2">
                        {template.required_documents.map((doc) => (
                          <span key={doc} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded">
                            {documentOptions.find((d) => d.value === doc)?.label || doc}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => openEditDialog(template)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(template.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 템플릿 생성/수정 다이얼로그 */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? '템플릿 수정' : '템플릿 추가'}</DialogTitle>
          </DialogHeader>

          {error && <Alert variant="error" className="mb-4">{error}</Alert>}

          <div className="space-y-6">
            {/* 기본 정보 */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">기본 정보</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label required>템플릿명</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="예: 홀서빙 알바"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>역할</Label>
                  <Select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    options={Object.entries(roleLabels).map(([value, label]) => ({ value, label }))}
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>설명</Label>
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="예: 주중 오전 근무자"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>직책</Label>
                  <Input
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    placeholder="예: 홀서빙, 주방보조"
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            {/* 급여 정보 */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">급여 정보</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label required>급여 유형</Label>
                  <Select
                    value={formData.salaryType}
                    onChange={(e) => setFormData({ ...formData, salaryType: e.target.value as 'hourly' | 'daily' | 'monthly' })}
                    options={Object.entries(salaryTypeLabels).map(([value, label]) => ({ value, label }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label required>금액 (원)</Label>
                  <Input
                    type="number"
                    value={formData.salaryAmount}
                    onChange={(e) => setFormData({ ...formData, salaryAmount: parseInt(e.target.value) || 0 })}
                    placeholder="10030"
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            {/* 근무 스케줄 */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">기본 근무 스케줄</h4>
              <div>
                <Label>근무 요일</Label>
                <div className="flex gap-2 mt-2">
                  {dayLabels.map((label, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => toggleWorkDay(idx)}
                      className={`w-10 h-10 rounded-full text-sm font-medium transition-colors ${
                        formData.workDays.includes(idx)
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 시간 설정 모드 토글 */}
              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => togglePerDayMode(false)}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    !formData.perDayMode
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  모든 요일 같은 시간
                </button>
                <button
                  type="button"
                  onClick={() => togglePerDayMode(true)}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    formData.perDayMode
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  요일별 다른 시간
                </button>
              </div>

              {!formData.perDayMode ? (
                /* 같은 시간 모드 */
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>시작 시간</Label>
                    <Input
                      type="time"
                      value={formData.workStartTime}
                      onChange={(e) => setFormData({ ...formData, workStartTime: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>종료 시간</Label>
                    <Input
                      type="time"
                      value={formData.workEndTime}
                      onChange={(e) => setFormData({ ...formData, workEndTime: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>휴게 시간 (분)</Label>
                    <Input
                      type="number"
                      value={formData.breakMinutes}
                      onChange={(e) => setFormData({ ...formData, breakMinutes: parseInt(e.target.value) || 0 })}
                      className="mt-1"
                    />
                  </div>
                </div>
              ) : (
                /* 요일별 다른 시간 모드 */
                <div className="space-y-3 bg-gray-50 rounded-lg p-4">
                  {formData.workDays.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-2">
                      먼저 근무 요일을 선택해주세요.
                    </p>
                  ) : (
                    formData.workDays.map((day) => (
                      <div key={day} className="grid grid-cols-4 gap-3 items-center">
                        <div className="font-medium text-sm text-gray-700">
                          {dayLabels[day]}요일
                        </div>
                        <div>
                          <Input
                            type="time"
                            value={formData.workSchedule[String(day)]?.startTime || formData.workStartTime}
                            onChange={(e) => updateDaySchedule(day, 'startTime', e.target.value)}
                            className="text-sm"
                          />
                        </div>
                        <div>
                          <Input
                            type="time"
                            value={formData.workSchedule[String(day)]?.endTime || formData.workEndTime}
                            onChange={(e) => updateDaySchedule(day, 'endTime', e.target.value)}
                            className="text-sm"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            value={formData.workSchedule[String(day)]?.breakMinutes ?? formData.breakMinutes}
                            onChange={(e) => updateDaySchedule(day, 'breakMinutes', parseInt(e.target.value) || 0)}
                            className="text-sm w-16"
                          />
                          <span className="text-xs text-gray-500">분</span>
                        </div>
                      </div>
                    ))
                  )}
                  {formData.workDays.length > 0 && (
                    <p className="text-xs text-gray-500 mt-2">
                      * 각 요일의 시작/종료 시간과 휴게 시간을 개별 설정할 수 있습니다.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* 요청 서류 */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">요청 서류</h4>
              <div className="flex flex-wrap gap-2">
                {documentOptions.map((doc) => (
                  <button
                    key={doc.value}
                    type="button"
                    onClick={() => toggleDocument(doc.value)}
                    className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                      formData.requiredDocuments.includes(doc.value)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {doc.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              취소
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? '저장 중...' : editingTemplate ? '수정' : '저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
