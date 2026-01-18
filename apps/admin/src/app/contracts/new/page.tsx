'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import {
  Button,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Input,
  Label,
  Select,
  Textarea,
  DatePicker,
  Alert,
  ButtonLoading,
} from '@/components/ui';
import { ArrowLeft, ArrowRight, Check, Plus, X } from 'lucide-react';
import { ContractType, SalaryType } from '@abc/shared';

interface Staff {
  id: string;
  name: string;
  email: string;
  phone: string;
  position: string | null;
  department: string | null;
  contract_type: '정규직' | '계약직' | '아르바이트' | '인턴' | null;
  store_id: string | null;
  default_hourly_rate: number | null;
  stores: { id: string; name: string; brand_id: string; company_id: string; brands: { name: string } } | null;
}

interface Store {
  id: string;
  name: string;
  brand_id: string;
  company_id: string;
  brands: { name: string };
  // 급여 설정
  pay_day?: number;
  pay_period_type?: string;
  // 수당 옵션
  allowance_overtime?: boolean;
  allowance_night?: boolean;
  allowance_holiday?: boolean;
  // 기타
  default_hourly_rate?: number;
}

const STEPS = [
  { id: 1, title: '직원 선택', description: '계약할 직원을 선택합니다' },
  { id: 2, title: '근무지 선택', description: '근무할 매장을 선택합니다' },
  { id: 3, title: '계약 유형', description: '계약 유형 및 기간을 설정합니다' },
  { id: 4, title: '근무 시간', description: '근무 일정을 설정합니다' },
  { id: 5, title: '급여 설정', description: '급여 및 수당을 설정합니다' },
  { id: 6, title: '공제 설정', description: '4대보험 및 공제 항목을 설정합니다' },
  { id: 7, title: '특약사항', description: '추가 계약 조건을 입력합니다' },
  { id: 8, title: '확인', description: '최종 확인 후 저장합니다' },
];

const DAYS_OF_WEEK = [
  { value: 1, label: '월' },
  { value: 2, label: '화' },
  { value: 3, label: '수' },
  { value: 4, label: '목' },
  { value: 5, label: '금' },
  { value: 6, label: '토' },
  { value: 0, label: '일' },
];

export default function NewContractPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Data
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [storeList, setStoreList] = useState<Store[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    staffId: '',
    storeId: '',
    companyId: '',
    brandId: '',
    contractType: ContractType.FULL_TIME,
    startDate: new Date(),
    endDate: undefined as Date | undefined,
    probationMonths: 3,
    position: '',
    department: '',
    duties: [''],
    workSchedules: [
      {
        daysOfWeek: [1, 2, 3, 4, 5],
        startTime: '09:00',
        endTime: '18:00',
        breakMinutes: 60,
      },
    ],
    perDayMode: false,
    workSchedulePerDay: {} as Record<string, { startTime: string; endTime: string; breakMinutes: number }>,
    standardHoursPerWeek: 40,
    standardHoursPerDay: 8,
    breakMinutes: 60,
    salaryConfig: {
      baseSalaryType: SalaryType.MONTHLY,
      baseSalaryAmount: 0,
      allowances: {
        overtimeAllowance: true,
        nightAllowance: true,
        holidayAllowance: true,
        weeklyHolidayPay: true,
        mealAllowance: 0,
        transportAllowance: 0,
      },
      paymentDate: 25,
      paymentMethod: '계좌이체' as '계좌이체' | '현금' | '혼합',
    },
    deductionConfig: {
      deductionType: 'full' as 'full' | 'employment_only' | 'freelancer' | 'none',
      nationalPension: true,
      healthInsurance: true,
      employmentInsurance: true,
      industrialAccident: true,
      incomeTax: true,
      localIncomeTax: true,
      retirementAllowance: false,
    },
    annualLeaveDays: 15,
    paidLeaveDays: 0,
    sickLeaveDays: 0,
    specialTerms: '' as string, // 특약사항
  });

  useEffect(() => {
    fetchStaff();
    fetchStores();
  }, []);

  const fetchStaff = async () => {
    const response = await fetch('/api/users?role=staff&status=ACTIVE&limit=100');
    if (response.ok) {
      const data = await response.json();
      setStaffList(data.data || data);
    }
  };

  // 직원 선택 시 기존 정보로 프리필
  const handleStaffChange = (staffId: string) => {
    const staff = staffList.find((s) => s.id === staffId);
    if (staff) {
      const updates: Partial<typeof formData> = { staffId };

      // 매장 정보 프리필
      if (staff.store_id && staff.stores) {
        updates.storeId = staff.store_id;
        updates.brandId = staff.stores.brand_id;
        updates.companyId = staff.stores.company_id;
      }

      // 직책 프리필
      if (staff.position) {
        updates.position = staff.position;
      }

      // 부서 프리필
      if (staff.department) {
        updates.department = staff.department;
      }

      // 계약 유형 프리필
      if (staff.contract_type) {
        updates.contractType = staff.contract_type as ContractType;
      }

      // 시급 → 월급 변환 (주 40시간 기준)
      if (staff.default_hourly_rate) {
        updates.salaryConfig = {
          ...formData.salaryConfig,
          baseSalaryType: SalaryType.HOURLY,
          baseSalaryAmount: staff.default_hourly_rate,
        };
      }

      setFormData({ ...formData, ...updates });
    }
  };

  const fetchStores = async () => {
    const response = await fetch('/api/stores');
    if (response.ok) {
      const data = await response.json();
      setStoreList(data);
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, STEPS.length));
    }
  };

  const handlePrev = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const validateStep = (step: number): boolean => {
    setError('');
    switch (step) {
      case 1:
        if (!formData.staffId) {
          setError('직원을 선택해주세요.');
          return false;
        }
        break;
      case 2:
        if (!formData.storeId) {
          setError('매장을 선택해주세요.');
          return false;
        }
        break;
      case 3:
        if (!formData.startDate) {
          setError('시작일을 선택해주세요.');
          return false;
        }
        break;
      case 5:
        if (!formData.salaryConfig.baseSalaryAmount) {
          setError('기본급을 입력해주세요.');
          return false;
        }
        break;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const contract = await response.json();
        router.push(`/contracts/${contract.id}`);
      } else {
        const data = await response.json();
        setError(data.error || '계약서 생성에 실패했습니다.');
      }
    } catch (err) {
      setError('계약서 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleStoreChange = (storeId: string) => {
    const store = storeList.find((s) => s.id === storeId);
    if (store) {
      // 매장 설정에서 수당/급여일 프리필
      const updates: Partial<typeof formData> = {
        storeId,
        brandId: store.brand_id,
        companyId: store.company_id,
      };

      // 급여 설정 프리필
      if (store.pay_day || store.allowance_overtime !== undefined) {
        updates.salaryConfig = {
          ...formData.salaryConfig,
          paymentDate: store.pay_day || formData.salaryConfig.paymentDate,
          allowances: {
            ...formData.salaryConfig.allowances,
            overtimeAllowance: store.allowance_overtime ?? formData.salaryConfig.allowances.overtimeAllowance,
            nightAllowance: store.allowance_night ?? formData.salaryConfig.allowances.nightAllowance,
            holidayAllowance: store.allowance_holiday ?? formData.salaryConfig.allowances.holidayAllowance,
          },
        };
      }

      setFormData({ ...formData, ...updates });
    }
  };

  const addDuty = () => {
    setFormData({
      ...formData,
      duties: [...formData.duties, ''],
    });
  };

  const removeDuty = (index: number) => {
    setFormData({
      ...formData,
      duties: formData.duties.filter((_, i) => i !== index),
    });
  };

  const updateDuty = (index: number, value: string) => {
    const newDuties = [...formData.duties];
    newDuties[index] = value;
    setFormData({ ...formData, duties: newDuties });
  };

  const toggleWorkDay = (day: number) => {
    const schedule = formData.workSchedules[0];
    const isRemoving = schedule.daysOfWeek.includes(day);
    const newDays = isRemoving
      ? schedule.daysOfWeek.filter((d) => d !== day)
      : [...schedule.daysOfWeek, day].sort((a, b) => a - b);

    // Update per-day schedule accordingly
    const newWorkSchedulePerDay = { ...formData.workSchedulePerDay };
    if (isRemoving) {
      delete newWorkSchedulePerDay[String(day)];
    } else if (formData.perDayMode) {
      newWorkSchedulePerDay[String(day)] = {
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        breakMinutes: schedule.breakMinutes,
      };
    }

    setFormData({
      ...formData,
      workSchedules: [{ ...schedule, daysOfWeek: newDays }],
      workSchedulePerDay: newWorkSchedulePerDay,
    });
  };

  const togglePerDayMode = (enabled: boolean) => {
    if (enabled) {
      // Initialize per-day schedule for all selected days
      const newSchedule: Record<string, { startTime: string; endTime: string; breakMinutes: number }> = {};
      formData.workSchedules[0].daysOfWeek.forEach((day) => {
        newSchedule[String(day)] = {
          startTime: formData.workSchedules[0].startTime,
          endTime: formData.workSchedules[0].endTime,
          breakMinutes: formData.workSchedules[0].breakMinutes,
        };
      });
      setFormData({ ...formData, perDayMode: true, workSchedulePerDay: newSchedule });
    } else {
      setFormData({ ...formData, perDayMode: false, workSchedulePerDay: {} });
    }
  };

  const updateDaySchedule = (day: number, field: 'startTime' | 'endTime' | 'breakMinutes', value: string | number) => {
    setFormData({
      ...formData,
      workSchedulePerDay: {
        ...formData.workSchedulePerDay,
        [String(day)]: {
          ...formData.workSchedulePerDay[String(day)],
          [field]: value,
        },
      },
    });
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <Label required>직원 선택</Label>
              <Select
                value={formData.staffId}
                onChange={(e) => handleStaffChange(e.target.value)}
                options={[
                  { value: '', label: '직원을 선택하세요' },
                  ...staffList.map((s) => ({
                    value: s.id,
                    label: `${s.name} (${s.email})`,
                  })),
                ]}
                className="mt-2"
              />
            </div>
            {formData.staffId && (() => {
              const staff = staffList.find((s) => s.id === formData.staffId);
              return staff ? (
                <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                  <div>
                    <p className="text-sm text-gray-500">선택된 직원</p>
                    <p className="font-medium">{staff.name}</p>
                    <p className="text-sm text-gray-500">{staff.email}</p>
                  </div>
                  {(staff.store_id || staff.position || staff.default_hourly_rate || staff.contract_type) && (
                    <div className="pt-2 border-t">
                      <p className="text-xs text-blue-600 font-medium mb-1">자동 입력된 정보</p>
                      {staff.stores && (
                        <p className="text-sm">매장: {staff.stores.name}</p>
                      )}
                      {staff.position && (
                        <p className="text-sm">직책: {staff.position}</p>
                      )}
                      {staff.department && (
                        <p className="text-sm">부서: {staff.department}</p>
                      )}
                      {staff.contract_type && (
                        <p className="text-sm">계약유형: {staff.contract_type}</p>
                      )}
                      {staff.default_hourly_rate && (
                        <p className="text-sm">시급: {staff.default_hourly_rate.toLocaleString()}원</p>
                      )}
                    </div>
                  )}
                </div>
              ) : null;
            })()}
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <Label required>근무 매장</Label>
              <Select
                value={formData.storeId}
                onChange={(e) => handleStoreChange(e.target.value)}
                options={[
                  { value: '', label: '매장을 선택하세요' },
                  ...storeList.map((s) => ({
                    value: s.id,
                    label: `${s.name} (${s.brands?.name || ''})`,
                  })),
                ]}
                className="mt-2"
              />
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <Label required>계약 유형</Label>
              <Select
                value={formData.contractType}
                onChange={(e) => setFormData({ ...formData, contractType: e.target.value as ContractType })}
                options={Object.entries(ContractType).map(([key, value]) => ({
                  value,
                  label: value,
                }))}
                className="mt-2"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label required>계약 시작일</Label>
                <DatePicker
                  value={formData.startDate}
                  onChange={(date) => setFormData({ ...formData, startDate: date || new Date() })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>계약 종료일</Label>
                <DatePicker
                  value={formData.endDate}
                  onChange={(date) => setFormData({ ...formData, endDate: date })}
                  className="mt-2"
                />
              </div>
            </div>
            <div>
              <Label>수습 기간 (개월)</Label>
              <Input
                type="number"
                value={formData.probationMonths}
                onChange={(e) => setFormData({ ...formData, probationMonths: parseInt(e.target.value) || 0 })}
                min={0}
                max={12}
                className="mt-2"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>직책</Label>
                <Input
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  placeholder="예: 매니저, 파트타임"
                  className="mt-2"
                />
              </div>
              <div>
                <Label>부서</Label>
                <Input
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  placeholder="예: 홀, 주방"
                  className="mt-2"
                />
              </div>
            </div>
            <div>
              <Label>담당 업무</Label>
              <div className="space-y-2 mt-2">
                {formData.duties.map((duty, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={duty}
                      onChange={(e) => updateDuty(index, e.target.value)}
                      placeholder="업무 내용을 입력하세요"
                    />
                    {formData.duties.length > 1 && (
                      <Button variant="ghost" size="sm" onClick={() => removeDuty(index)}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addDuty}>
                  <Plus className="h-4 w-4 mr-2" />
                  업무 추가
                </Button>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div>
              <Label required>근무 요일</Label>
              <div className="flex gap-2 mt-2">
                {DAYS_OF_WEEK.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleWorkDay(day.value)}
                    className={`w-10 h-10 rounded-full text-sm font-medium transition-colors ${
                      formData.workSchedules[0].daysOfWeek.includes(day.value)
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="perDayMode"
                checked={formData.perDayMode}
                onChange={(e) => togglePerDayMode(e.target.checked)}
                className="mr-2"
              />
              <label htmlFor="perDayMode" className="text-sm cursor-pointer">
                요일별로 다른 근무시간 설정
              </label>
            </div>

            {!formData.perDayMode ? (
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>출근 시간</Label>
                  <Input
                    type="time"
                    value={formData.workSchedules[0].startTime}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        workSchedules: [
                          { ...formData.workSchedules[0], startTime: e.target.value },
                        ],
                      })
                    }
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label>퇴근 시간</Label>
                  <Input
                    type="time"
                    value={formData.workSchedules[0].endTime}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        workSchedules: [
                          { ...formData.workSchedules[0], endTime: e.target.value },
                        ],
                      })
                    }
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label>휴게 시간 (분)</Label>
                  <Input
                    type="number"
                    value={formData.workSchedules[0].breakMinutes}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        workSchedules: [
                          { ...formData.workSchedules[0], breakMinutes: parseInt(e.target.value) || 0 },
                        ],
                      })
                    }
                    className="mt-2"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {DAYS_OF_WEEK.filter((day) =>
                  formData.workSchedules[0].daysOfWeek.includes(day.value)
                ).map((day) => (
                  <div key={day.value} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <span className="w-8 h-8 flex items-center justify-center bg-primary text-white rounded-full text-sm font-medium">
                      {day.label}
                    </span>
                    <div className="flex-1 grid grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs">출근</Label>
                        <Input
                          type="time"
                          value={formData.workSchedulePerDay[String(day.value)]?.startTime || '09:00'}
                          onChange={(e) => updateDaySchedule(day.value, 'startTime', e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">퇴근</Label>
                        <Input
                          type="time"
                          value={formData.workSchedulePerDay[String(day.value)]?.endTime || '18:00'}
                          onChange={(e) => updateDaySchedule(day.value, 'endTime', e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">휴게(분)</Label>
                        <Input
                          type="number"
                          value={formData.workSchedulePerDay[String(day.value)]?.breakMinutes || 60}
                          onChange={(e) => updateDaySchedule(day.value, 'breakMinutes', parseInt(e.target.value) || 0)}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <Label>주당 근무시간</Label>
                <Input
                  type="number"
                  value={formData.standardHoursPerWeek}
                  onChange={(e) =>
                    setFormData({ ...formData, standardHoursPerWeek: parseInt(e.target.value) || 0 })
                  }
                  className="mt-2"
                />
              </div>
              <div>
                <Label>일일 근무시간</Label>
                <Input
                  type="number"
                  value={formData.standardHoursPerDay}
                  onChange={(e) =>
                    setFormData({ ...formData, standardHoursPerDay: parseInt(e.target.value) || 0 })
                  }
                  className="mt-2"
                />
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label required>급여 유형</Label>
                <Select
                  value={formData.salaryConfig.baseSalaryType}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      salaryConfig: {
                        ...formData.salaryConfig,
                        baseSalaryType: e.target.value as SalaryType,
                      },
                    })
                  }
                  options={Object.entries(SalaryType).map(([key, value]) => ({
                    value,
                    label: value,
                  }))}
                  className="mt-2"
                />
              </div>
              <div>
                <Label required>기본급 (원)</Label>
                <Input
                  type="number"
                  value={formData.salaryConfig.baseSalaryAmount}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      salaryConfig: {
                        ...formData.salaryConfig,
                        baseSalaryAmount: parseInt(e.target.value) || 0,
                      },
                    })
                  }
                  placeholder="0"
                  className="mt-2"
                />
              </div>
            </div>

            <div>
              <Label>수당 설정</Label>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.salaryConfig.allowances.overtimeAllowance}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        salaryConfig: {
                          ...formData.salaryConfig,
                          allowances: {
                            ...formData.salaryConfig.allowances,
                            overtimeAllowance: e.target.checked,
                          },
                        },
                      })
                    }
                    className="mr-2"
                  />
                  <span className="text-sm">연장근로수당</span>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.salaryConfig.allowances.nightAllowance}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        salaryConfig: {
                          ...formData.salaryConfig,
                          allowances: {
                            ...formData.salaryConfig.allowances,
                            nightAllowance: e.target.checked,
                          },
                        },
                      })
                    }
                    className="mr-2"
                  />
                  <span className="text-sm">야간근로수당</span>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.salaryConfig.allowances.holidayAllowance}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        salaryConfig: {
                          ...formData.salaryConfig,
                          allowances: {
                            ...formData.salaryConfig.allowances,
                            holidayAllowance: e.target.checked,
                          },
                        },
                      })
                    }
                    className="mr-2"
                  />
                  <span className="text-sm">휴일근로수당</span>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.salaryConfig.allowances.weeklyHolidayPay}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        salaryConfig: {
                          ...formData.salaryConfig,
                          allowances: {
                            ...formData.salaryConfig.allowances,
                            weeklyHolidayPay: e.target.checked,
                          },
                        },
                      })
                    }
                    className="mr-2"
                  />
                  <span className="text-sm">주휴수당</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>식대 (월, 원)</Label>
                <Input
                  type="number"
                  value={formData.salaryConfig.allowances.mealAllowance}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      salaryConfig: {
                        ...formData.salaryConfig,
                        allowances: {
                          ...formData.salaryConfig.allowances,
                          mealAllowance: parseInt(e.target.value) || 0,
                        },
                      },
                    })
                  }
                  className="mt-2"
                />
              </div>
              <div>
                <Label>교통비 (월, 원)</Label>
                <Input
                  type="number"
                  value={formData.salaryConfig.allowances.transportAllowance}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      salaryConfig: {
                        ...formData.salaryConfig,
                        allowances: {
                          ...formData.salaryConfig.allowances,
                          transportAllowance: parseInt(e.target.value) || 0,
                        },
                      },
                    })
                  }
                  className="mt-2"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>급여일</Label>
                <Select
                  value={formData.salaryConfig.paymentDate.toString()}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      salaryConfig: {
                        ...formData.salaryConfig,
                        paymentDate: parseInt(e.target.value),
                      },
                    })
                  }
                  options={Array.from({ length: 31 }, (_, i) => ({
                    value: (i + 1).toString(),
                    label: `${i + 1}일`,
                  }))}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>지급 방식</Label>
                <Select
                  value={formData.salaryConfig.paymentMethod}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      salaryConfig: {
                        ...formData.salaryConfig,
                        paymentMethod: e.target.value as '계좌이체' | '현금' | '혼합',
                      },
                    })
                  }
                  options={[
                    { value: '계좌이체', label: '계좌이체' },
                    { value: '현금', label: '현금' },
                    { value: '혼합', label: '혼합' },
                  ]}
                  className="mt-2"
                />
              </div>
            </div>
          </div>
        );

      case 6:
        const handleDeductionTypeChange = (type: 'full' | 'employment_only' | 'freelancer' | 'none') => {
          let config = { ...formData.deductionConfig, deductionType: type };

          switch (type) {
            case 'full':
              config = {
                ...config,
                nationalPension: true,
                healthInsurance: true,
                employmentInsurance: true,
                industrialAccident: true,
                incomeTax: true,
                localIncomeTax: true,
              };
              break;
            case 'employment_only':
              config = {
                ...config,
                nationalPension: false,
                healthInsurance: false,
                employmentInsurance: true,
                industrialAccident: true,
                incomeTax: false,
                localIncomeTax: false,
              };
              break;
            case 'freelancer':
              config = {
                ...config,
                nationalPension: false,
                healthInsurance: false,
                employmentInsurance: false,
                industrialAccident: false,
                incomeTax: true,
                localIncomeTax: true,
              };
              break;
            case 'none':
              config = {
                ...config,
                nationalPension: false,
                healthInsurance: false,
                employmentInsurance: false,
                industrialAccident: false,
                incomeTax: false,
                localIncomeTax: false,
              };
              break;
          }

          setFormData({ ...formData, deductionConfig: config });
        };

        return (
          <div className="space-y-6">
            <div>
              <Label required>공제 유형</Label>
              <Select
                value={formData.deductionConfig.deductionType}
                onChange={(e) => handleDeductionTypeChange(e.target.value as 'full' | 'employment_only' | 'freelancer' | 'none')}
                options={[
                  { value: 'full', label: '전체 적용 (국민연금+건강+장기요양+고용+산재)' },
                  { value: 'employment_only', label: '고용·산재보험만 (단시간 근로자)' },
                  { value: 'freelancer', label: '소득세만 적용 (프리랜서 3.3%)' },
                  { value: 'none', label: '완전 적용 안 함 (세금 없음)' },
                ]}
                className="mt-2"
              />
              <p className="text-xs text-gray-500 mt-1">
                근로 형태에 따라 적절한 공제 유형을 선택하세요.
              </p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-2">적용 항목</p>
              <div className="flex flex-wrap gap-2">
                {formData.deductionConfig.nationalPension && (
                  <Badge variant="default">국민연금 4.5%</Badge>
                )}
                {formData.deductionConfig.healthInsurance && (
                  <Badge variant="default">건강보험 3.545%</Badge>
                )}
                {formData.deductionConfig.employmentInsurance && (
                  <Badge variant="default">고용보험 0.9%</Badge>
                )}
                {formData.deductionConfig.industrialAccident && (
                  <Badge variant="default">산재보험</Badge>
                )}
                {formData.deductionConfig.incomeTax && (
                  <Badge variant="default">소득세</Badge>
                )}
                {formData.deductionConfig.localIncomeTax && (
                  <Badge variant="default">지방소득세</Badge>
                )}
                {formData.deductionConfig.deductionType === 'none' && (
                  <span className="text-sm text-gray-500">공제 항목 없음</span>
                )}
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="flex items-start">
                <input
                  type="checkbox"
                  id="retirementAllowance"
                  checked={formData.deductionConfig.retirementAllowance}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      deductionConfig: {
                        ...formData.deductionConfig,
                        retirementAllowance: e.target.checked,
                      },
                    })
                  }
                  className="mr-3 mt-1"
                />
                <label htmlFor="retirementAllowance" className="cursor-pointer">
                  <span className="text-sm font-medium">퇴직금 적용 대상</span>
                  <p className="text-xs text-gray-500">주 15시간 이상 근무, 1년 이상 근속 시 퇴직금 지급</p>
                </label>
              </div>
            </div>

            <Alert variant="info">
              <div className="flex items-center">
                <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                <span className="text-sm">
                  <strong>주휴수당</strong>은 주 15시간 이상 근무 시 자동 적용됩니다.
                </span>
              </div>
            </Alert>

            <div>
              <Label>휴가</Label>
              <div className="grid grid-cols-3 gap-4 mt-2">
                <div>
                  <Label className="text-xs">연차 (일)</Label>
                  <Input
                    type="number"
                    value={formData.annualLeaveDays}
                    onChange={(e) =>
                      setFormData({ ...formData, annualLeaveDays: parseInt(e.target.value) || 0 })
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">유급휴가 (일)</Label>
                  <Input
                    type="number"
                    value={formData.paidLeaveDays}
                    onChange={(e) =>
                      setFormData({ ...formData, paidLeaveDays: parseInt(e.target.value) || 0 })
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">병가 (일)</Label>
                  <Input
                    type="number"
                    value={formData.sickLeaveDays}
                    onChange={(e) =>
                      setFormData({ ...formData, sickLeaveDays: parseInt(e.target.value) || 0 })
                    }
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 7:
        return (
          <div className="space-y-6">
            <Alert variant="info">
              추가적인 계약 조건이 있다면 특약사항에 입력하세요. (선택사항)
            </Alert>

            <div>
              <Label>특약사항</Label>
              <Textarea
                value={formData.specialTerms}
                onChange={(e) => setFormData({ ...formData, specialTerms: e.target.value })}
                placeholder={`예시:
1. 수습 기간 중 급여는 기본급의 90%를 지급한다.
2. 근무 중 취득한 자격증 비용은 회사에서 50% 지원한다.
3. 야간 근무 시 교통비를 별도 지급한다.
4. 경쟁업체 취업 제한: 퇴사 후 1년간 동종업계 취업을 제한한다.
5. 비밀유지의무: 재직 중 알게 된 영업비밀을 퇴사 후에도 누설하지 않는다.`}
                rows={10}
                className="mt-2"
              />
              <p className="text-xs text-gray-500 mt-2">
                * 특약사항은 근로기준법에 위반되지 않는 범위 내에서 작성해주세요.
              </p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-2">자주 사용하는 특약사항</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({
                    ...formData,
                    specialTerms: formData.specialTerms + (formData.specialTerms ? '\n' : '') + '수습 기간 중 급여는 기본급의 90%를 지급한다.'
                  })}
                  className="text-xs px-3 py-1.5 bg-white border border-gray-200 rounded-full hover:bg-gray-50"
                >
                  + 수습기간 급여
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({
                    ...formData,
                    specialTerms: formData.specialTerms + (formData.specialTerms ? '\n' : '') + '근무 중 취득한 자격증 비용은 회사에서 지원한다.'
                  })}
                  className="text-xs px-3 py-1.5 bg-white border border-gray-200 rounded-full hover:bg-gray-50"
                >
                  + 자격증 비용 지원
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({
                    ...formData,
                    specialTerms: formData.specialTerms + (formData.specialTerms ? '\n' : '') + '야간 근무 시 교통비를 별도 지급한다.'
                  })}
                  className="text-xs px-3 py-1.5 bg-white border border-gray-200 rounded-full hover:bg-gray-50"
                >
                  + 야간 교통비
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({
                    ...formData,
                    specialTerms: formData.specialTerms + (formData.specialTerms ? '\n' : '') + '재직 중 알게 된 영업비밀을 퇴사 후에도 누설하지 않는다.'
                  })}
                  className="text-xs px-3 py-1.5 bg-white border border-gray-200 rounded-full hover:bg-gray-50"
                >
                  + 비밀유지의무
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({
                    ...formData,
                    specialTerms: formData.specialTerms + (formData.specialTerms ? '\n' : '') + '퇴사 후 1년간 동종업계 경쟁업체 취업을 제한한다.'
                  })}
                  className="text-xs px-3 py-1.5 bg-white border border-gray-200 rounded-full hover:bg-gray-50"
                >
                  + 경쟁업체 취업 제한
                </button>
              </div>
            </div>
          </div>
        );

      case 8:
        const selectedStaff = staffList.find((s) => s.id === formData.staffId);
        const selectedStore = storeList.find((s) => s.id === formData.storeId);

        return (
          <div className="space-y-6">
            <Alert variant="info">
              계약서 내용을 확인하고 저장하세요. 저장 후 직원에게 발송할 수 있습니다.
            </Alert>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-500">직원</p>
                  <p className="font-medium">{selectedStaff?.name}</p>
                  <p className="text-sm text-gray-500">{selectedStaff?.email}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">근무지</p>
                  <p className="font-medium">{selectedStore?.name}</p>
                  <p className="text-sm text-gray-500">{selectedStore?.brands?.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">계약 유형</p>
                  <p className="font-medium">{formData.contractType}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">계약 기간</p>
                  <p className="font-medium">
                    {formData.startDate.toLocaleDateString('ko-KR')}
                    {formData.endDate && ` ~ ${formData.endDate.toLocaleDateString('ko-KR')}`}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-500">급여</p>
                  <p className="font-medium">
                    {formData.salaryConfig.baseSalaryType} {formData.salaryConfig.baseSalaryAmount.toLocaleString()}원
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">근무 시간</p>
                  <p className="font-medium">
                    {formData.workSchedules[0].startTime} ~ {formData.workSchedules[0].endTime}
                  </p>
                  <p className="text-sm text-gray-500">
                    {DAYS_OF_WEEK.filter((d) =>
                      formData.workSchedules[0].daysOfWeek.includes(d.value)
                    )
                      .map((d) => d.label)
                      .join(', ')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">급여일</p>
                  <p className="font-medium">매월 {formData.salaryConfig.paymentDate}일</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">연차</p>
                  <p className="font-medium">{formData.annualLeaveDays}일</p>
                </div>
              </div>
            </div>

            {formData.specialTerms && (
              <div className="border-t pt-4">
                <p className="text-sm text-gray-500 mb-2">특약사항</p>
                <div className="p-3 bg-gray-50 rounded-lg whitespace-pre-wrap text-sm">
                  {formData.specialTerms}
                </div>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div>
      <Header title="계약서 작성" />

      <div className="p-6">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                    currentStep > step.id
                      ? 'bg-primary text-white'
                      : currentStep === step.id
                      ? 'bg-primary text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {currentStep > step.id ? <Check className="h-4 w-4" /> : step.id}
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`w-16 h-1 mx-2 ${
                      currentStep > step.id ? 'bg-primary' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 text-center">
            <p className="font-medium">{STEPS[currentStep - 1].title}</p>
            <p className="text-sm text-gray-500">{STEPS[currentStep - 1].description}</p>
          </div>
        </div>

        {/* Form Content */}
        <Card>
          <CardContent className="pt-6">
            {error && (
              <Alert variant="error" className="mb-6">
                {error}
              </Alert>
            )}
            {renderStepContent()}
          </CardContent>
        </Card>

        {/* Navigation Buttons */}
        <div className="mt-6 flex justify-between">
          <Button
            variant="outline"
            onClick={currentStep === 1 ? () => router.back() : handlePrev}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {currentStep === 1 ? '취소' : '이전'}
          </Button>

          {currentStep < STEPS.length ? (
            <Button onClick={handleNext}>
              다음
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? <ButtonLoading /> : '계약서 저장'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
