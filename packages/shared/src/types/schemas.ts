import { z } from 'zod';
import {
  UserRole,
  UserStatus,
  ContractType,
  ContractStatus,
  SalaryType,
  AttendanceStatus,
  ApprovalType,
  ApprovalStatus,
  NotificationPriority,
  NotificationCategory,
  SubscriptionPlan,
} from './enums';

// ============================================
// 기본 스키마
// ============================================

export const UUIDSchema = z.string().uuid();

export const EmailSchema = z.string().email('올바른 이메일 형식이 아닙니다');

export const PhoneSchema = z.string().regex(
  /^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/,
  '올바른 전화번호 형식이 아닙니다'
);

export const BusinessNumberSchema = z.string().regex(
  /^[0-9]{3}-[0-9]{2}-[0-9]{5}$/,
  '올바른 사업자등록번호 형식이 아닙니다 (000-00-00000)'
);

export const SSNSchema = z.string().regex(
  /^[0-9]{6}-[0-9]{7}$/,
  '올바른 주민등록번호 형식이 아닙니다'
);

export const TimeSchema = z.string().regex(
  /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
  '올바른 시간 형식이 아닙니다 (HH:MM)'
);

// ============================================
// 회사/브랜드/매장
// ============================================

export const CreateCompanySchema = z.object({
  name: z.string().min(1, '회사명을 입력해주세요').max(255),
  businessNumber: BusinessNumberSchema.optional(),
  ceoName: z.string().max(100).optional(),
  address: z.string().optional(),
  phone: PhoneSchema.optional(),
});

export const UpdateCompanySchema = CreateCompanySchema.partial();

export const CreateBrandSchema = z.object({
  companyId: UUIDSchema,
  name: z.string().min(1, '브랜드명을 입력해주세요').max(255),
  logoUrl: z.string().url().optional(),
  description: z.string().optional(),
});

export const UpdateBrandSchema = CreateBrandSchema.partial().omit({ companyId: true });

export const CreateStoreSchema = z.object({
  companyId: UUIDSchema,
  brandId: UUIDSchema,
  name: z.string().min(1, '매장명을 입력해주세요').max(255),
  address: z.string().optional(),
  phone: PhoneSchema.optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  allowedRadius: z.number().min(10).max(1000).default(100),
  earlyCheckinMinutes: z.number().min(0).max(120).default(30),
  earlyCheckoutMinutes: z.number().min(0).max(120).default(30),
  defaultHourlyRate: z.number().min(0).optional(),
});

export const UpdateStoreSchema = CreateStoreSchema.partial().omit({ companyId: true, brandId: true });

// ============================================
// 사용자
// ============================================

export const CreateUserSchema = z.object({
  email: EmailSchema,
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다'),
  name: z.string().min(1, '이름을 입력해주세요').max(100),
  role: z.nativeEnum(UserRole),
  companyId: UUIDSchema.optional(),
  brandId: UUIDSchema.optional(),
  storeId: UUIDSchema.optional(),
  teamId: UUIDSchema.optional(),
  phone: PhoneSchema.optional(),
  address: z.string().optional(),
  birthDate: z.coerce.date().optional(),
  position: z.string().max(100).optional(),
});

export const UpdateUserSchema = CreateUserSchema.partial().omit({ email: true, password: true });

export const LoginSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, '비밀번호를 입력해주세요'),
});

// ============================================
// 계약서
// ============================================

export const WorkDayScheduleSchema = z.object({
  daysOfWeek: z.array(z.number().min(0).max(6)).min(1, '근무 요일을 선택해주세요'),
  startTime: TimeSchema,
  endTime: TimeSchema,
  breakMinutes: z.number().min(0).max(180),
  effectiveFrom: z.coerce.date().optional(),
});

export const SalaryAllowancesSchema = z.object({
  overtimeAllowance: z.boolean().default(true),
  nightAllowance: z.boolean().default(true),
  holidayAllowance: z.boolean().default(true),
  weeklyHolidayPay: z.boolean().default(true),
  mealAllowance: z.number().min(0).optional(),
  transportAllowance: z.number().min(0).optional(),
  positionAllowance: z.number().min(0).optional(),
  specialtyAllowance: z.number().min(0).optional(),
  familyAllowance: z.number().min(0).optional(),
  housingAllowance: z.number().min(0).optional(),
  childcareAllowance: z.number().min(0).optional(),
  performanceBonus: z.object({
    type: z.enum(['월별', '분기별', '연간']),
    basis: z.string(),
    rate: z.number().min(0).optional(),
  }).optional(),
});

export const SalaryConfigSchema = z.object({
  baseSalaryType: z.nativeEnum(SalaryType),
  baseSalaryAmount: z.number().min(0, '기본급을 입력해주세요'),
  allowances: SalaryAllowancesSchema,
  bonus: z.object({
    annualBonus: z.number().min(0),
    schedule: z.string(),
  }).optional(),
  paymentDate: z.number().min(1).max(31),
  paymentMethod: z.enum(['계좌이체', '현금', '혼합']),
});

export const DeductionConfigSchema = z.object({
  nationalPension: z.boolean().default(true),
  healthInsurance: z.boolean().default(true),
  employmentInsurance: z.boolean().default(true),
  industrialAccident: z.boolean().default(true),
  incomeTax: z.boolean().default(true),
  localIncomeTax: z.boolean().default(true),
  dormitoryFee: z.number().min(0).optional(),
  mealDeduction: z.number().min(0).optional(),
  uniformDeposit: z.number().min(0).optional(),
  otherDeductions: z.array(z.object({
    name: z.string(),
    amount: z.number().min(0),
    description: z.string(),
  })).optional(),
});

export const CreateContractSchema = z.object({
  staffId: UUIDSchema,
  companyId: UUIDSchema,
  brandId: UUIDSchema,
  storeId: UUIDSchema,

  contractType: z.nativeEnum(ContractType),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  probationMonths: z.number().min(0).max(12).optional(),

  workSchedules: z.array(WorkDayScheduleSchema).min(1, '근무 일정을 추가해주세요'),
  position: z.string().optional(),
  department: z.string().optional(),
  duties: z.array(z.string()).min(1, '업무 내용을 추가해주세요'),

  salaryConfig: SalaryConfigSchema,
  deductionConfig: DeductionConfigSchema,

  standardHoursPerWeek: z.number().min(1).max(52).default(40),
  standardHoursPerDay: z.number().min(1).max(12).default(8),
  breakMinutes: z.number().min(0).max(180).default(60),

  annualLeaveDays: z.number().min(0).default(15),
  paidLeaveDays: z.number().min(0).default(0),
  sickLeaveDays: z.number().min(0).default(0),
});

// ============================================
// 출퇴근
// ============================================

export const CheckInSchema = z.object({
  storeId: UUIDSchema,
  qrCode: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export const CheckOutSchema = z.object({
  attendanceId: UUIDSchema,
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

// ============================================
// 승인 요청
// ============================================

export const CreateLeaveRequestSchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  leaveType: z.enum(['연차', '반차(오전)', '반차(오후)', '병가', '경조사', '기타']),
  reason: z.string().min(1, '사유를 입력해주세요'),
});

export const CreateOvertimeRequestSchema = z.object({
  date: z.coerce.date(),
  startTime: TimeSchema,
  endTime: TimeSchema,
  reason: z.string().min(1, '사유를 입력해주세요'),
});

export const CreatePurchaseRequestSchema = z.object({
  category: z.enum(['소모품', '식자재', '설비', '기타']),
  itemName: z.string().min(1, '품목명을 입력해주세요'),
  quantity: z.number().min(1),
  unitPrice: z.number().min(0),
  vendor: z.string().optional(),
  purpose: z.string().min(1, '용도를 입력해주세요'),
  urgency: z.enum(['긴급', '일반', '정기']),
  deliveryDate: z.coerce.date().optional(),
});

export const ProcessApprovalSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  comment: z.string().optional(),
});

// ============================================
// 긴급 근무
// ============================================

export const CreateEmergencyShiftSchema = z.object({
  storeId: UUIDSchema,
  workDate: z.coerce.date(),
  startTime: TimeSchema,
  endTime: TimeSchema,
  positions: z.array(z.object({
    role: z.string(),
    count: z.number().min(1),
  })).min(1),
  reason: z.enum(['명절', '공휴일', '결근대체', '행사', '기타']),
  description: z.string().optional(),
  hourlyRate: z.number().min(0),
  bonus: z.number().min(0).optional(),
  benefits: z.array(z.string()).optional(),
  deadline: z.coerce.date(),
});

// ============================================
// 메시지
// ============================================

export const SendMessageSchema = z.object({
  recipientId: UUIDSchema,
  subject: z.string().max(255).optional(),
  body: z.string().min(1, '내용을 입력해주세요'),
  replyTo: UUIDSchema.optional(),
});

// ============================================
// 타입 추출
// ============================================

export type CreateCompanyInput = z.infer<typeof CreateCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof UpdateCompanySchema>;
export type CreateBrandInput = z.infer<typeof CreateBrandSchema>;
export type UpdateBrandInput = z.infer<typeof UpdateBrandSchema>;
export type CreateStoreInput = z.infer<typeof CreateStoreSchema>;
export type UpdateStoreInput = z.infer<typeof UpdateStoreSchema>;
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type CreateContractInput = z.infer<typeof CreateContractSchema>;
export type CheckInInput = z.infer<typeof CheckInSchema>;
export type CheckOutInput = z.infer<typeof CheckOutSchema>;
export type CreateLeaveRequestInput = z.infer<typeof CreateLeaveRequestSchema>;
export type CreateOvertimeRequestInput = z.infer<typeof CreateOvertimeRequestSchema>;
export type CreatePurchaseRequestInput = z.infer<typeof CreatePurchaseRequestSchema>;
export type ProcessApprovalInput = z.infer<typeof ProcessApprovalSchema>;
export type CreateEmergencyShiftInput = z.infer<typeof CreateEmergencyShiftSchema>;
export type SendMessageInput = z.infer<typeof SendMessageSchema>;
