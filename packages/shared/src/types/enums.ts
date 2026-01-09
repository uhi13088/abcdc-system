// 사용자 역할
export enum UserRole {
  PLATFORM_ADMIN = 'platform_admin',  // 플랫폼 관리자
  COMPANY_ADMIN = 'company_admin',    // 회사 관리자
  MANAGER = 'manager',                // 본사 관리자
  STORE_MANAGER = 'store_manager',    // 매장 관리자
  TEAM_LEADER = 'team_leader',        // 팀장
  STAFF = 'staff',                    // 일반 직원
}

// 사용자 상태
export enum UserStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

// 계약 유형
export enum ContractType {
  FULL_TIME = '정규직',
  CONTRACT = '계약직',
  PART_TIME = '아르바이트',
  INTERN = '인턴',
}

// 계약서 상태
export enum ContractStatus {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  SIGNED = 'SIGNED',
  REJECTED = 'REJECTED',
}

// 급여 유형
export enum SalaryType {
  HOURLY = '시급',
  DAILY = '일급',
  MONTHLY = '월급',
  YEARLY = '연봉',
}

// 출퇴근 상태
export enum AttendanceStatus {
  NORMAL = 'NORMAL',
  LATE = 'LATE',
  EARLY_LEAVE = 'EARLY_LEAVE',
  ABSENT = 'ABSENT',
  VACATION = 'VACATION',
}

// 체크인 방법
export enum CheckInMethod {
  QR = 'QR',
  GEOFENCE = 'GEOFENCE',
  BEACON = 'BEACON',
  MANUAL = 'MANUAL',
}

// 급여 상태
export enum SalaryStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PAID = 'PAID',
}

// 스케줄 상태
export enum ScheduleStatus {
  SCHEDULED = 'SCHEDULED',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

// 승인 유형
export enum ApprovalType {
  LEAVE = 'LEAVE',                   // 휴가
  OVERTIME = 'OVERTIME',             // 초과근무
  SCHEDULE_CHANGE = 'SCHEDULE_CHANGE', // 근무조정
  PURCHASE = 'PURCHASE',             // 구매
  DISPOSAL = 'DISPOSAL',             // 폐기
  RESIGNATION = 'RESIGNATION',       // 사직서
  ABSENCE_EXCUSE = 'ABSENCE_EXCUSE', // 결근 사유서
  EXPENSE = 'EXPENSE',               // 경비 지출
  DOCUMENT = 'DOCUMENT',             // 문서 결재
  OTHER = 'OTHER',                   // 기타
}

// 승인 상태
export enum ApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

// 긴급근무 사유
export enum EmergencyShiftReason {
  HOLIDAY = '명절',
  PUBLIC_HOLIDAY = '공휴일',
  ABSENCE_REPLACEMENT = '결근대체',
  EVENT = '행사',
  OTHER = '기타',
}

// 긴급근무 상태
export enum EmergencyShiftStatus {
  OPEN = 'OPEN',
  FILLED = 'FILLED',
  CANCELLED = 'CANCELLED',
}

// 알림 우선순위
export enum NotificationPriority {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  NORMAL = 'NORMAL',
  LOW = 'LOW',
}

// 알림 카테고리
export enum NotificationCategory {
  ATTENDANCE = 'ATTENDANCE',
  SALARY = 'SALARY',
  SCHEDULE = 'SCHEDULE',
  APPROVAL = 'APPROVAL',
  EMERGENCY_SHIFT = 'EMERGENCY_SHIFT',
  CONTRACT = 'CONTRACT',
  NOTICE = 'NOTICE',
  MESSAGE = 'MESSAGE',
  SYSTEM = 'SYSTEM',
}

// 메시지 상태
export enum MessageStatus {
  SENT = 'SENT',
  READ = 'READ',
  REPLIED = 'REPLIED',
}

// 구독 플랜
export enum SubscriptionPlan {
  FREE = 'FREE',
  STARTER = 'STARTER',
  PRO = 'PRO',
}

// 구독 상태
export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

// 결제 주기
export enum BillingCycle {
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
}

// 구매 카테고리
export enum PurchaseCategory {
  CONSUMABLES = '소모품',
  INGREDIENTS = '식자재',
  EQUIPMENT = '설비',
  OTHER = '기타',
}

// 구매 긴급도
export enum PurchaseUrgency {
  URGENT = '긴급',
  NORMAL = '일반',
  REGULAR = '정기',
}

// 폐기 사유
export enum DisposalReason {
  EXPIRED = '유통기한만료',
  DAMAGED = '파손',
  DEFECTIVE = '불량',
  INVENTORY_ADJUSTMENT = '재고조정',
  OTHER = '기타',
}

// 폐기 방법
export enum DisposalMethod {
  DISPOSE = '폐기',
  DONATE = '기부',
  RECYCLE = '재활용',
}

// 퇴사 유형
export enum ResignationType {
  VOLUNTARY = '자진퇴사',
  RECOMMENDED = '권고사직',
  CONTRACT_EXPIRY = '계약만료',
  DISMISSAL = '해고',
}

// 결근 유형
export enum AbsenceType {
  SICK = '병가',
  PERSONAL = '개인사정',
  FAMILY_CARE = '가족돌봄',
  OTHER = '기타',
}

// 세무 전송 방법
export enum TaxTransmissionMethod {
  EMAIL = 'EMAIL',
  FAX = 'FAX',
  API = 'API',
  MANUAL = 'MANUAL',
}

// 법령 상태
export enum LaborLawStatus {
  DRAFT = 'DRAFT',
  VERIFIED = 'VERIFIED',
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}
