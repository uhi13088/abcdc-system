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

export const UUIDSchema = z.string().uuid('올바른 ID 형식이 아닙니다');

// Helper for required selection fields
const requiredUUID = (fieldName: string) =>
  z.string({ required_error: `${fieldName}을(를) 선택해주세요` })
   .min(1, `${fieldName}을(를) 선택해주세요`)
   .uuid(`올바른 ${fieldName} 형식이 아닙니다`);

const requiredString = (fieldName: string, minLength = 1) =>
  z.string({ required_error: `${fieldName}을(를) 입력해주세요` })
   .min(minLength, `${fieldName}을(를) 입력해주세요`);

export const EmailSchema = z.string({ required_error: '이메일을 입력해주세요' })
  .min(1, '이메일을 입력해주세요')
  .email('올바른 이메일 형식이 아닙니다 (예: example@email.com)');

export const PhoneSchema = z.string().regex(
  /^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/,
  '올바른 전화번호 형식이 아닙니다 (예: 010-1234-5678)'
);

export const BusinessNumberSchema = z.string().regex(
  /^[0-9]{3}-[0-9]{2}-[0-9]{5}$/,
  '올바른 사업자등록번호 형식이 아닙니다 (예: 123-45-67890)'
);

export const SSNSchema = z.string().regex(
  /^[0-9]{6}-[0-9]{7}$/,
  '올바른 주민등록번호 형식이 아닙니다 (예: 990101-1234567)'
);

export const TimeSchema = z.string().regex(
  /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
  '올바른 시간 형식이 아닙니다 (예: 09:00)'
);

// ============================================
// 회사/브랜드/매장
// ============================================

export const CreateCompanySchema = z.object({
  name: requiredString('회사명').max(255, '회사명은 255자 이하로 입력해주세요'),
  businessNumber: BusinessNumberSchema.optional(),
  ceoName: z.string().max(100, '대표자명은 100자 이하로 입력해주세요').optional(),
  address: z.string().optional(),
  phone: PhoneSchema.optional(),
});

export const UpdateCompanySchema = CreateCompanySchema.partial();

export const CreateBrandSchema = z.object({
  companyId: requiredUUID('회사'),
  name: requiredString('브랜드명').max(255, '브랜드명은 255자 이하로 입력해주세요'),
  logoUrl: z.string().url('올바른 URL 형식이 아닙니다').nullish(),
  description: z.string().nullish(),
});

export const UpdateBrandSchema = CreateBrandSchema.partial().omit({ companyId: true });

export const CreateStoreSchema = z.object({
  companyId: requiredUUID('회사'),
  brandId: requiredUUID('브랜드'),
  name: requiredString('매장명').max(255, '매장명은 255자 이하로 입력해주세요'),
  address: z.string().optional(),
  phone: PhoneSchema.optional(),
  latitude: z.number().min(-90, '위도는 -90 이상이어야 합니다').max(90, '위도는 90 이하여야 합니다').optional(),
  longitude: z.number().min(-180, '경도는 -180 이상이어야 합니다').max(180, '경도는 180 이하여야 합니다').optional(),
  allowedRadius: z.number().min(10, '출근 허용 반경은 최소 10m 이상이어야 합니다').max(1000, '출근 허용 반경은 최대 1000m까지 설정 가능합니다').default(100),
  earlyCheckinMinutes: z.number().min(0).max(120, '조기 출근 허용 시간은 최대 120분까지 설정 가능합니다').default(30),
  earlyCheckoutMinutes: z.number().min(0).max(120, '조기 퇴근 허용 시간은 최대 120분까지 설정 가능합니다').default(30),
  defaultHourlyRate: z.number().min(0, '기본 시급은 0 이상이어야 합니다').optional(),
});

export const UpdateStoreSchema = CreateStoreSchema.partial().omit({ companyId: true, brandId: true });

// ============================================
// 사용자
// ============================================

export const CreateUserSchema = z.object({
  email: EmailSchema,
  password: z.string({ required_error: '비밀번호를 입력해주세요' })
    .min(8, '비밀번호는 8자 이상이어야 합니다')
    .max(100, '비밀번호는 100자 이하여야 합니다'),
  name: requiredString('이름').max(100, '이름은 100자 이하로 입력해주세요'),
  role: z.nativeEnum(UserRole, { errorMap: () => ({ message: '역할을 선택해주세요' }) }),
  companyId: UUIDSchema.optional(),
  brandId: UUIDSchema.optional(),
  storeId: UUIDSchema.optional(),
  teamId: UUIDSchema.optional(),
  phone: PhoneSchema.optional(),
  address: z.string().optional(),
  birthDate: z.coerce.date({ errorMap: () => ({ message: '올바른 날짜 형식이 아닙니다' }) }).optional(),
  position: z.string().max(100, '직책은 100자 이하로 입력해주세요').optional(),
});

export const UpdateUserSchema = CreateUserSchema.partial().omit({ email: true, password: true });

export const LoginSchema = z.object({
  email: EmailSchema,
  password: requiredString('비밀번호'),
});

// ============================================
// 계약서
// ============================================

export const WorkDayScheduleSchema = z.object({
  daysOfWeek: z.array(z.number().min(0).max(6)).min(1, '근무 요일을 최소 1일 이상 선택해주세요'),
  startTime: TimeSchema,
  endTime: TimeSchema,
  breakMinutes: z.number().min(0, '휴게시간은 0분 이상이어야 합니다').max(180, '휴게시간은 최대 180분까지 설정 가능합니다'),
  effectiveFrom: z.coerce.date({ errorMap: () => ({ message: '올바른 날짜 형식이 아닙니다' }) }).optional(),
});

export const SalaryAllowancesSchema = z.object({
  overtimeAllowance: z.boolean().default(true),
  nightAllowance: z.boolean().default(true),
  holidayAllowance: z.boolean().default(true),
  weeklyHolidayPay: z.boolean().default(true),
  mealAllowance: z.number().min(0, '식대는 0 이상이어야 합니다').optional(),
  transportAllowance: z.number().min(0, '교통비는 0 이상이어야 합니다').optional(),
  positionAllowance: z.number().min(0, '직책수당은 0 이상이어야 합니다').optional(),
  specialtyAllowance: z.number().min(0, '자격수당은 0 이상이어야 합니다').optional(),
  familyAllowance: z.number().min(0, '가족수당은 0 이상이어야 합니다').optional(),
  housingAllowance: z.number().min(0, '주거수당은 0 이상이어야 합니다').optional(),
  childcareAllowance: z.number().min(0, '육아수당은 0 이상이어야 합니다').optional(),
  performanceBonus: z.object({
    type: z.enum(['월별', '분기별', '연간'], { errorMap: () => ({ message: '성과급 유형을 선택해주세요' }) }),
    basis: z.string(),
    rate: z.number().min(0).optional(),
  }).optional(),
});

export const SalaryConfigSchema = z.object({
  baseSalaryType: z.nativeEnum(SalaryType, { errorMap: () => ({ message: '급여 유형을 선택해주세요' }) }),
  baseSalaryAmount: z.number({ required_error: '기본급을 입력해주세요' }).min(0, '기본급은 0 이상이어야 합니다'),
  allowances: SalaryAllowancesSchema,
  bonus: z.object({
    annualBonus: z.number().min(0, '연간 상여금은 0 이상이어야 합니다'),
    schedule: z.string(),
  }).optional(),
  paymentDate: z.number().min(1, '급여일은 1일 이상이어야 합니다').max(31, '급여일은 31일 이하여야 합니다'),
  paymentMethod: z.enum(['계좌이체', '현금', '혼합'], { errorMap: () => ({ message: '지급 방법을 선택해주세요' }) }),
});

export const DeductionConfigSchema = z.object({
  nationalPension: z.boolean().default(true),
  healthInsurance: z.boolean().default(true),
  employmentInsurance: z.boolean().default(true),
  industrialAccident: z.boolean().default(true),
  incomeTax: z.boolean().default(true),
  localIncomeTax: z.boolean().default(true),
  dormitoryFee: z.number().min(0, '기숙사비는 0 이상이어야 합니다').optional(),
  mealDeduction: z.number().min(0, '식대 공제는 0 이상이어야 합니다').optional(),
  uniformDeposit: z.number().min(0, '유니폼 보증금은 0 이상이어야 합니다').optional(),
  otherDeductions: z.array(z.object({
    name: z.string().min(1, '공제 항목명을 입력해주세요'),
    amount: z.number().min(0, '공제 금액은 0 이상이어야 합니다'),
    description: z.string(),
  })).optional(),
});

export const CreateContractSchema = z.object({
  staffId: requiredUUID('직원'),
  companyId: requiredUUID('회사'),
  brandId: requiredUUID('브랜드'),
  storeId: requiredUUID('매장'),

  contractType: z.nativeEnum(ContractType, { errorMap: () => ({ message: '계약 유형을 선택해주세요' }) }),
  startDate: z.coerce.date({ errorMap: () => ({ message: '계약 시작일을 선택해주세요' }) }),
  endDate: z.coerce.date({ errorMap: () => ({ message: '올바른 계약 종료일 형식이 아닙니다' }) }).optional(),
  probationMonths: z.number().min(0, '수습 기간은 0개월 이상이어야 합니다').max(12, '수습 기간은 최대 12개월까지 설정 가능합니다').optional(),

  workSchedules: z.array(WorkDayScheduleSchema).min(1, '근무 일정을 최소 1개 이상 추가해주세요'),
  position: z.string().optional(),
  department: z.string().optional(),
  duties: z.array(z.string()).min(1, '업무 내용을 최소 1개 이상 추가해주세요'),

  salaryConfig: SalaryConfigSchema,
  deductionConfig: DeductionConfigSchema,

  standardHoursPerWeek: z.number().min(1, '주당 소정근로시간은 1시간 이상이어야 합니다').max(52, '주당 소정근로시간은 52시간 이하여야 합니다').default(40),
  standardHoursPerDay: z.number().min(1, '1일 소정근로시간은 1시간 이상이어야 합니다').max(12, '1일 소정근로시간은 12시간 이하여야 합니다').default(8),
  breakMinutes: z.number().min(0, '휴게시간은 0분 이상이어야 합니다').max(180, '휴게시간은 180분 이하여야 합니다').default(60),

  annualLeaveDays: z.number().min(0, '연차는 0일 이상이어야 합니다').default(15),
  paidLeaveDays: z.number().min(0, '유급휴가는 0일 이상이어야 합니다').default(0),
  sickLeaveDays: z.number().min(0, '병가는 0일 이상이어야 합니다').default(0),
});

// ============================================
// 출퇴근
// ============================================

export const CheckInSchema = z.object({
  storeId: requiredUUID('매장'),
  qrCode: z.string().optional(),
  latitude: z.number().min(-90, '올바른 위치 정보가 아닙니다').max(90, '올바른 위치 정보가 아닙니다').optional(),
  longitude: z.number().min(-180, '올바른 위치 정보가 아닙니다').max(180, '올바른 위치 정보가 아닙니다').optional(),
});

export const CheckOutSchema = z.object({
  attendanceId: requiredUUID('출근 기록'),
  latitude: z.number().min(-90, '올바른 위치 정보가 아닙니다').max(90, '올바른 위치 정보가 아닙니다').optional(),
  longitude: z.number().min(-180, '올바른 위치 정보가 아닙니다').max(180, '올바른 위치 정보가 아닙니다').optional(),
});

// ============================================
// 승인 요청
// ============================================

export const CreateLeaveRequestSchema = z.object({
  startDate: z.coerce.date({ errorMap: () => ({ message: '휴가 시작일을 선택해주세요' }) }),
  endDate: z.coerce.date({ errorMap: () => ({ message: '휴가 종료일을 선택해주세요' }) }),
  leaveType: z.enum(['연차', '반차(오전)', '반차(오후)', '병가', '경조사', '기타'], { errorMap: () => ({ message: '휴가 유형을 선택해주세요' }) }),
  reason: requiredString('휴가 사유'),
});

export const CreateOvertimeRequestSchema = z.object({
  date: z.coerce.date({ errorMap: () => ({ message: '연장근무 날짜를 선택해주세요' }) }),
  startTime: TimeSchema,
  endTime: TimeSchema,
  reason: requiredString('연장근무 사유'),
});

export const CreatePurchaseRequestSchema = z.object({
  category: z.enum(['소모품', '식자재', '설비', '기타'], { errorMap: () => ({ message: '카테고리를 선택해주세요' }) }),
  itemName: requiredString('품목명'),
  quantity: z.number({ required_error: '수량을 입력해주세요' }).min(1, '수량은 1개 이상이어야 합니다'),
  unitPrice: z.number({ required_error: '단가를 입력해주세요' }).min(0, '단가는 0원 이상이어야 합니다'),
  vendor: z.string().optional(),
  purpose: requiredString('구매 용도'),
  urgency: z.enum(['긴급', '일반', '정기'], { errorMap: () => ({ message: '긴급도를 선택해주세요' }) }),
  deliveryDate: z.coerce.date({ errorMap: () => ({ message: '올바른 날짜 형식이 아닙니다' }) }).optional(),
});

export const ProcessApprovalSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED'], { errorMap: () => ({ message: '승인 여부를 선택해주세요' }) }),
  comment: z.string().optional(),
});

// ============================================
// 긴급 근무
// ============================================

export const CreateEmergencyShiftSchema = z.object({
  storeId: requiredUUID('매장'),
  workDate: z.coerce.date({ errorMap: () => ({ message: '근무 날짜를 선택해주세요' }) }),
  startTime: TimeSchema,
  endTime: TimeSchema,
  positions: z.array(z.object({
    role: z.string().min(1, '포지션을 입력해주세요'),
    count: z.number().min(1, '인원수는 1명 이상이어야 합니다'),
  })).min(1, '모집 포지션을 최소 1개 이상 추가해주세요'),
  reason: z.enum(['명절', '공휴일', '결근대체', '행사', '기타'], { errorMap: () => ({ message: '긴급 근무 사유를 선택해주세요' }) }),
  description: z.string().optional(),
  hourlyRate: z.number({ required_error: '시급을 입력해주세요' }).min(0, '시급은 0원 이상이어야 합니다'),
  bonus: z.number().min(0, '추가 수당은 0원 이상이어야 합니다').optional(),
  benefits: z.array(z.string()).optional(),
  deadline: z.coerce.date({ errorMap: () => ({ message: '모집 마감일을 선택해주세요' }) }),
});

// ============================================
// 메시지
// ============================================

export const SendMessageSchema = z.object({
  recipientId: requiredUUID('수신자'),
  subject: z.string().max(255, '제목은 255자 이하로 입력해주세요').optional(),
  body: requiredString('메시지 내용'),
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
