'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import {
  Button,
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
}

interface Store {
  id: string;
  name: string;
  brand_id: string;
  company_id: string;
  brands: { name: string };
}

const STEPS = [
  { id: 1, title: '직원 선택', description: '계약할 직원을 선택합니다' },
  { id: 2, title: '근무지 선택', description: '근무할 매장을 선택합니다' },
  { id: 3, title: '계약 유형', description: '계약 유형 및 기간을 설정합니다' },
  { id: 4, title: '근무 시간', description: '근무 일정을 설정합니다' },
  { id: 5, title: '급여 설정', description: '급여 및 수당을 설정합니다' },
  { id: 6, title: '공제 설정', description: '4대보험 및 공제 항목을 설정합니다' },
  { id: 7, title: '확인', description: '최종 확인 후 저장합니다' },
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
      paymentMethod: '계좌이체' as const,
    },
    deductionConfig: {
      nationalPension: true,
      healthInsurance: true,
      employmentInsurance: true,
      industrialAccident: true,
      incomeTax: true,
      localIncomeTax: true,
    },
    annualLeaveDays: 15,
    paidLeaveDays: 0,
    sickLeaveDays: 0,
  });

  useEffect(() => {
    fetchStaff();
    fetchStores();
  }, []);

  const fetchStaff = async () => {
    const response = await fetch('/api/users?role=staff&status=ACTIVE');
    if (response.ok) {
      const data = await response.json();
      setStaffList(data.data || data);
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
      setFormData({
        ...formData,
        storeId,
        brandId: store.brand_id,
        companyId: store.company_id,
      });
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
    const days = schedule.daysOfWeek.includes(day)
      ? schedule.daysOfWeek.filter((d) => d !== day)
      : [...schedule.daysOfWeek, day];

    setFormData({
      ...formData,
      workSchedules: [{ ...schedule, daysOfWeek: days }],
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
                onChange={(e) => setFormData({ ...formData, staffId: e.target.value })}
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
            {formData.staffId && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">선택된 직원</p>
                <p className="font-medium">
                  {staffList.find((s) => s.id === formData.staffId)?.name}
                </p>
                <p className="text-sm text-gray-500">
                  {staffList.find((s) => s.id === formData.staffId)?.email}
                </p>
              </div>
            )}
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
            <div className="grid grid-cols-2 gap-4">
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
            </div>
            <div className="grid grid-cols-3 gap-4">
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
        return (
          <div className="space-y-6">
            <div>
              <Label>4대보험</Label>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.deductionConfig.nationalPension}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        deductionConfig: {
                          ...formData.deductionConfig,
                          nationalPension: e.target.checked,
                        },
                      })
                    }
                    className="mr-2"
                  />
                  <span className="text-sm">국민연금 (4.5%)</span>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.deductionConfig.healthInsurance}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        deductionConfig: {
                          ...formData.deductionConfig,
                          healthInsurance: e.target.checked,
                        },
                      })
                    }
                    className="mr-2"
                  />
                  <span className="text-sm">건강보험 (3.545%)</span>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.deductionConfig.employmentInsurance}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        deductionConfig: {
                          ...formData.deductionConfig,
                          employmentInsurance: e.target.checked,
                        },
                      })
                    }
                    className="mr-2"
                  />
                  <span className="text-sm">고용보험 (0.9%)</span>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.deductionConfig.industrialAccident}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        deductionConfig: {
                          ...formData.deductionConfig,
                          industrialAccident: e.target.checked,
                        },
                      })
                    }
                    className="mr-2"
                  />
                  <span className="text-sm">산재보험</span>
                </div>
              </div>
            </div>

            <div>
              <Label>세금</Label>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.deductionConfig.incomeTax}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        deductionConfig: {
                          ...formData.deductionConfig,
                          incomeTax: e.target.checked,
                        },
                      })
                    }
                    className="mr-2"
                  />
                  <span className="text-sm">소득세</span>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.deductionConfig.localIncomeTax}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        deductionConfig: {
                          ...formData.deductionConfig,
                          localIncomeTax: e.target.checked,
                        },
                      })
                    }
                    className="mr-2"
                  />
                  <span className="text-sm">지방소득세</span>
                </div>
              </div>
            </div>

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
