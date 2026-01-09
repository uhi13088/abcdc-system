import {
  UserRole,
  UserStatus,
  ContractType,
  ContractStatus,
  SalaryType,
  AttendanceStatus,
  CheckInMethod,
  SalaryStatus,
  ScheduleStatus,
  ApprovalType,
  ApprovalStatus,
  EmergencyShiftReason,
  EmergencyShiftStatus,
  NotificationPriority,
  NotificationCategory,
  MessageStatus,
  SubscriptionPlan,
  SubscriptionStatus,
  BillingCycle,
} from './enums';

// ============================================
// 기본 타입
// ============================================

export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// 회사/브랜드/매장 계층 구조
// ============================================

export interface Company extends BaseEntity {
  name: string;
  businessNumber?: string;
  ceoName?: string;
  address?: string;
  phone?: string;
  subscriptionPlanId?: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface Brand extends BaseEntity {
  companyId: string;
  name: string;
  logoUrl?: string;
  description?: string;
}

export interface Store extends BaseEntity {
  companyId: string;
  brandId: string;
  name: string;
  address?: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
  allowedRadius: number; // 미터
  earlyCheckinMinutes: number;
  earlyCheckoutMinutes: number;
  defaultHourlyRate?: number;
  qrCode?: string;
}

export interface Team extends BaseEntity {
  companyId: string;
  brandId: string;
  storeId: string;
  name: string;
  leaderId?: string;
  description?: string;
}

// ============================================
// 사용자
// ============================================

export interface User extends BaseEntity {
  email: string;
  name: string;
  role: UserRole;
  companyId?: string;
  brandId?: string;
  storeId?: string;
  teamId?: string;
  phone?: string;
  address?: string;
  birthDate?: Date;
  ssnEncrypted?: string; // 주민등록번호 (암호화)
  position?: string;
  bankName?: string;
  bankAccount?: string;
  accountHolder?: string;
  status: UserStatus;
  lastLoginAt?: Date;
}

// ============================================
// 계약서
// ============================================

export interface WorkDaySchedule {
  daysOfWeek: number[]; // 0-6 (일-토)
  startTime: string;    // "09:00"
  endTime: string;      // "18:00"
  breakMinutes: number;
  effectiveFrom?: Date;
}

export interface SalaryAllowances {
  // 법정 수당
  overtimeAllowance: boolean;    // 연장근로수당
  nightAllowance: boolean;       // 야간근로수당
  holidayAllowance: boolean;     // 휴일근로수당
  weeklyHolidayPay: boolean;     // 주휴수당

  // 추가 수당
  mealAllowance?: number;
  transportAllowance?: number;
  positionAllowance?: number;
  specialtyAllowance?: number;
  familyAllowance?: number;
  housingAllowance?: number;
  childcareAllowance?: number;
  performanceBonus?: {
    type: '월별' | '분기별' | '연간';
    basis: string;
    rate?: number;
  };
}

export interface SalaryConfig {
  baseSalaryType: SalaryType;
  baseSalaryAmount: number;
  allowances: SalaryAllowances;
  bonus?: {
    annualBonus: number;
    schedule: string;
  };
  paymentDate: number; // 1-31
  paymentMethod: '계좌이체' | '현금' | '혼합';
}

export interface DeductionConfig {
  // 4대 보험
  nationalPension: boolean;
  healthInsurance: boolean;
  employmentInsurance: boolean;
  industrialAccident: boolean;

  // 세금
  incomeTax: boolean;
  localIncomeTax: boolean;

  // 기타 공제
  dormitoryFee?: number;
  mealDeduction?: number;
  uniformDeposit?: number;
  otherDeductions?: Array<{
    name: string;
    amount: number;
    description: string;
  }>;
}

export interface ContractTerms {
  confidentiality: boolean;
  nonCompete?: {
    enabled: boolean;
    period: number;
    scope: string;
  };
  intellectualProperty: boolean;
  terminationNotice: number;
}

export interface TerminationConfig {
  employeeNotice: number;
  employerNotice: number;
  severancePay: boolean;
  penaltyClause?: string;
}

export interface Contract extends BaseEntity {
  contractNumber: string;
  staffId: string;
  companyId: string;
  brandId: string;
  storeId: string;

  // 기본 정보
  contractType: ContractType;
  startDate: Date;
  endDate?: Date;
  probationMonths?: number;

  // 근무 조건
  workSchedules: WorkDaySchedule[];
  position?: string;
  department?: string;
  duties: string[];

  // 급여/공제
  salaryConfig: SalaryConfig;
  deductionConfig: DeductionConfig;

  // 근무시간
  standardHoursPerWeek: number;
  standardHoursPerDay: number;
  breakMinutes: number;

  // 휴가
  annualLeaveDays: number;
  paidLeaveDays: number;
  sickLeaveDays: number;

  // 복리후생
  benefits?: {
    healthCheckup: boolean;
    retirementPlan: boolean;
    educationSupport?: string;
    others?: string[];
  };

  // 계약 조건
  terms: ContractTerms;
  terminationConfig: TerminationConfig;

  // 서명
  employeeSignedAt?: Date;
  employeeSignature?: string;
  employerSignedAt?: Date;
  employerSignature?: string;

  // 첨부
  attachments?: {
    resume?: string;
    certificates?: string[];
    healthCertificate?: string;
    idCopy?: string;
    others?: Array<{ name: string; fileUrl: string }>;
  };

  status: ContractStatus;
  createdBy: string;
}

// ============================================
// 출퇴근
// ============================================

export interface Attendance extends BaseEntity {
  staffId: string;
  companyId: string;
  brandId: string;
  storeId: string;
  workDate: Date;

  // 시간
  scheduledCheckIn?: Date;
  scheduledCheckOut?: Date;
  actualCheckIn?: Date;
  actualCheckOut?: Date;

  status: AttendanceStatus;

  // 위치
  checkInLat?: number;
  checkInLng?: number;
  checkOutLat?: number;
  checkOutLng?: number;
  checkInMethod?: CheckInMethod;

  // 시간 계산
  workHours?: number;
  breakHours?: number;
  overtimeHours?: number;
  nightHours?: number;
  holidayHours?: number;

  // 금액
  basePay?: number;
  overtimePay?: number;
  nightPay?: number;
  holidayPay?: number;
  dailyTotal?: number;

  // 이상 감지
  anomalies?: Record<string, unknown>;

  // 확장 필드
  extensions?: Record<string, unknown>;
}

// ============================================
// 급여
// ============================================

export interface Salary extends BaseEntity {
  staffId: string;
  companyId: string;
  year: number;
  month: number;

  // 기본급
  baseSalary: number;

  // 수당
  overtimePay: number;
  nightPay: number;
  holidayPay: number;
  weeklyHolidayPay: number;

  // 추가 수당
  mealAllowance: number;
  transportAllowance: number;
  positionAllowance: number;
  otherAllowances?: Record<string, number>;

  totalGrossPay: number;

  // 공제
  nationalPension: number;
  healthInsurance: number;
  longTermCare: number;
  employmentInsurance: number;
  incomeTax: number;
  localIncomeTax: number;
  otherDeductions?: Record<string, number>;

  totalDeductions: number;
  netPay: number;

  // 근무 정보
  workDays: number;
  totalHours: number;

  status: SalaryStatus;
  confirmedAt?: Date;
  confirmedBy?: string;
  paidAt?: Date;
}

// ============================================
// 스케줄
// ============================================

export interface Schedule extends BaseEntity {
  staffId: string;
  teamId?: string;
  companyId: string;
  brandId: string;
  storeId: string;

  workDate: Date;
  startTime: Date;
  endTime: Date;
  breakMinutes: number;

  status: ScheduleStatus;
  generatedBy?: 'AI' | 'MANUAL' | 'CONTRACT';
  aiConfidence?: number;

  tradeRequest?: {
    requestedBy: string;
    requestedWith: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
  };

  extensions?: Record<string, unknown>;
}

// ============================================
// 승인 요청
// ============================================

export interface ApprovalLineItem {
  order: number;
  approverId: string;
  approverName: string;
  approverRole: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  comment?: string;
  decidedAt?: Date;
}

export interface ApprovalRequest extends BaseEntity {
  type: ApprovalType;
  requesterId: string;
  requesterName: string;
  requesterRole: string;

  companyId: string;
  brandId?: string;
  storeId?: string;

  approvalLine: ApprovalLineItem[];
  currentStep: number;
  finalStatus: ApprovalStatus;

  details: Record<string, unknown>;
  attachments?: Array<{
    name: string;
    url: string;
    type: string;
  }>;

  finalizedAt?: Date;
}

// ============================================
// 긴급 근무 모집
// ============================================

export interface EmergencyShift extends BaseEntity {
  storeId: string;
  companyId: string;
  brandId: string;

  workDate: Date;
  startTime: string;
  endTime: string;

  positions: Array<{
    role: string;
    count: number;
  }>;

  reason: EmergencyShiftReason;
  description?: string;

  hourlyRate: number;
  bonus?: number;
  benefits?: string[];

  status: EmergencyShiftStatus;
  deadline: Date;

  applicants: Array<{
    staffId: string;
    staffName: string;
    appliedAt: Date;
    status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  }>;

  createdBy: string;
}

// ============================================
// 알림
// ============================================

export interface Notification extends BaseEntity {
  userId: string;
  category: NotificationCategory;
  priority: NotificationPriority;

  title: string;
  body: string;
  imageUrl?: string;

  actions?: Array<{
    id: string;
    title: string;
    icon?: string;
  }>;

  deepLink?: string;
  data?: Record<string, unknown>;

  sound?: string;
  vibration?: boolean;
  badge?: number;

  sent: boolean;
  sentAt?: Date;
  read: boolean;
  readAt?: Date;

  expiresAt?: Date;
}

// ============================================
// 메시지
// ============================================

export interface Message extends BaseEntity {
  senderId: string;
  senderName: string;
  senderRole: string;

  recipientId: string;
  recipientName: string;
  recipientRole: string;

  subject?: string;
  body: string;

  attachments?: Array<{
    name: string;
    url: string;
    size: number;
    type: string;
  }>;

  status: MessageStatus;
  readAt?: Date;

  replyTo?: string;
  hasReplies: boolean;
  replyCount: number;
}

// ============================================
// 구독/결제
// ============================================

export interface SubscriptionPlanEntity extends BaseEntity {
  name: SubscriptionPlan;
  displayName: string;
  priceMonthly: number;
  priceYearly: number;
  limits: {
    maxEmployees: number;
    maxStores: number;
  };
  features: Record<string, boolean>;
  active: boolean;
}

export interface CompanySubscription extends BaseEntity {
  companyId: string;
  planId: string;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  paymentMethod?: Record<string, unknown>;
}

// ============================================
// 세무대리인
// ============================================

export interface TaxAccountant {
  name: string;
  businessNumber: string;
  phone: string;
  email: string;
  faxNumber?: string;
}

export interface TaxTransmissionSettings {
  method: 'EMAIL' | 'FAX' | 'API' | 'MANUAL';
  frequency: 'MONTHLY' | 'SEMI_MONTHLY' | 'CUSTOM';
  autoSend: boolean;
  sendDay: number;
  includeAttachments: boolean;
  format: 'EXCEL' | 'PDF' | 'JSON' | 'HOMTAX_FORMAT';
}

// ============================================
// 근로기준법
// ============================================

export interface LaborLawVersion extends BaseEntity {
  version: string;
  effectiveDate: Date;
  source?: string;

  minimumWageHourly: number;

  standardDailyHours: number;
  standardWeeklyHours: number;
  maxWeeklyHours: number;

  overtimeRate: number;
  nightRate: number;
  holidayRate: number;

  nationalPensionRate: number;
  healthInsuranceRate: number;
  longTermCareRate: number;
  employmentInsuranceRate: number;

  status: 'DRAFT' | 'VERIFIED' | 'ACTIVE' | 'ARCHIVED';
  verifiedBy?: string;
  verifiedAt?: Date;

  changelog?: string;
  previousVersionId?: string;
  activatedAt?: Date;
}
