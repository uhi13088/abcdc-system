# ABC Staff System - Claude Code 개발 가이드

> **목적**: Claude Code가 오류 없이 개발할 수 있도록 필수 정보 제공  
> **포함 내용**: 폴더 구조, 필드명, API 엔드포인트, 환경 변수, 주요 로직

---

## 📁 프로젝트 구조

```
abc-staff-system/
├── apps/
│   ├── landing/              # 랜딩페이지 (Next.js Static)
│   │   ├── app/
│   │   │   ├── page.tsx      # 메인 페이지
│   │   │   ├── pricing/      # 요금제
│   │   │   └── contact/      # 문의하기
│   │   └── components/
│   │
│   ├── platform/             # 플랫폼 대시보드 (super_admin)
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   └── login/
│   │   │   ├── (dashboard)/
│   │   │   │   ├── companies/      # 회사 관리
│   │   │   │   ├── subscriptions/  # 구독 관리
│   │   │   │   ├── labor-law/      # 근로기준법 관리
│   │   │   │   └── analytics/      # 통계
│   │   │   └── api/
│   │   │       ├── companies/
│   │   │       └── labor-law/
│   │   └── middleware.ts     # RLS 설정
│   │
│   ├── admin/                # 관리자 대시보드
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   ├── (dashboard)/
│   │   │   │   ├── staff/          # 직원 관리
│   │   │   │   ├── attendance/     # 출퇴근
│   │   │   │   ├── salary/         # 급여
│   │   │   │   ├── schedule/       # 스케줄
│   │   │   │   ├── approval/       # 승인
│   │   │   │   ├── contract/       # 계약서
│   │   │   │   ├── emergency/      # 긴급근무
│   │   │   │   ├── store/          # 매장관리
│   │   │   │   └── notice/         # 공지사항
│   │   │   └── api/
│   │   │       ├── staff/
│   │   │       ├── attendance/
│   │   │       ├── salary/
│   │   │       ├── approval/
│   │   │       └── tax/            # 세무 전송
│   │   └── middleware.ts     # company별 RLS
│   │
│   └── mobile/               # React Native (직원용)
│       ├── src/
│       │   ├── screens/
│       │   │   ├── HomeScreen.tsx
│       │   │   ├── AttendanceScreen.tsx
│       │   │   ├── SalaryScreen.tsx
│       │   │   ├── ScheduleScreen.tsx
│       │   │   └── MoreScreen.tsx
│       │   ├── components/
│       │   ├── services/
│       │   │   ├── api.ts
│       │   │   ├── auth.ts
│       │   │   └── push.ts
│       │   └── navigation/
│       └── app.json
│
├── packages/
│   ├── database/             # Supabase 스키마
│   │   ├── schema.sql
│   │   ├── migrations/
│   │   └── seed.sql
│   │
│   ├── shared/               # 공통 타입 및 유틸
│   │   ├── types/
│   │   │   ├── user.ts
│   │   │   ├── contract.ts
│   │   │   ├── attendance.ts
│   │   │   ├── salary.ts
│   │   │   └── approval.ts
│   │   └── utils/
│   │       ├── date.ts
│   │       ├── currency.ts
│   │       └── validation.ts
│   │
│   └── ui/                   # 공통 UI 컴포넌트
│       ├── button.tsx
│       ├── input.tsx
│       ├── card.tsx
│       └── modal.tsx
│
└── docs/
    ├── API.md                # API 명세
    ├── DATABASE.md           # 데이터베이스 스키마
    └── DEPLOYMENT.md         # 배포 가이드
```

---

## 🗄️ 데이터베이스 스키마 (필드명)

### users (직원/관리자)

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(50) NOT NULL,              -- platform_admin, company_admin, manager, store_manager, team_leader, staff
  
  company_id UUID REFERENCES companies(id),
  brand_id UUID REFERENCES brands(id),
  store_id UUID REFERENCES stores(id),
  team_id UUID,
  
  phone VARCHAR(20),
  address TEXT,
  birth_date DATE,
  ssn_encrypted TEXT,                     -- 주민번호 (암호화)
  position VARCHAR(100),                  -- 직책
  
  bank_name VARCHAR(100),
  bank_account VARCHAR(50),
  account_holder VARCHAR(100),
  
  status VARCHAR(20) DEFAULT 'ACTIVE',    -- PENDING, ACTIVE, INACTIVE, SUSPENDED
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### companies (회사)

```sql
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  business_number VARCHAR(20) UNIQUE,
  ceo_name VARCHAR(100),
  address TEXT,
  phone VARCHAR(20),
  
  subscription_plan VARCHAR(50),          -- FREE, BASIC, PRO, ENTERPRISE
  subscription_status VARCHAR(20),        -- TRIAL, ACTIVE, SUSPENDED, CANCELLED
  trial_ends_at TIMESTAMP,
  
  tax_accountant_name VARCHAR(100),       -- 세무대리인 이름
  tax_accountant_email VARCHAR(255),
  tax_accountant_phone VARCHAR(20),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### brands (브랜드)

```sql
CREATE TABLE brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  logo_url TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(company_id, name)
);
```

### stores (매장)

```sql
CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  phone VARCHAR(20),
  
  qr_code TEXT UNIQUE,                    -- QR 출퇴근용
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(brand_id, name)
);
```

### contracts (계약서)

```sql
CREATE TABLE contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number VARCHAR(50) UNIQUE,
  
  staff_id UUID NOT NULL REFERENCES users(id),
  company_id UUID NOT NULL,
  brand_id UUID NOT NULL,
  store_id UUID NOT NULL,
  
  contract_type VARCHAR(50),              -- 정규직, 계약직, 아르바이트, 인턴
  start_date DATE NOT NULL,
  end_date DATE,
  
  work_schedules JSONB NOT NULL,          -- [{daysOfWeek: [1,2,3], startTime: "09:00", endTime: "18:00"}]
  position VARCHAR(100),
  
  salary_config JSONB NOT NULL,           -- {baseSalaryType, baseSalaryAmount, allowances, bonus}
  deduction_config JSONB NOT NULL,        -- {nationalPension, healthInsurance, ...}
  
  employee_signed_at TIMESTAMP,
  employee_signature TEXT,
  employer_signed_at TIMESTAMP,
  
  status VARCHAR(20) DEFAULT 'DRAFT',     -- DRAFT, SENT, SIGNED, REJECTED
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### attendances (출퇴근)

```sql
CREATE TABLE attendances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES users(id),
  store_id UUID NOT NULL,
  work_date DATE NOT NULL,
  
  scheduled_check_in TIMESTAMP,
  scheduled_check_out TIMESTAMP,
  actual_check_in TIMESTAMP,
  actual_check_out TIMESTAMP,
  
  status VARCHAR(20),                     -- NORMAL, LATE, EARLY_LEAVE, ABSENT, VACATION
  
  work_hours DECIMAL(5,2),
  overtime_hours DECIMAL(5,2),
  night_hours DECIMAL(5,2),
  
  base_pay INTEGER,
  overtime_pay INTEGER,
  night_pay INTEGER,
  daily_total INTEGER,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(staff_id, work_date)
);
```

### salaries (급여)

```sql
CREATE TABLE salaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES users(id),
  company_id UUID NOT NULL,
  
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  
  base_salary INTEGER DEFAULT 0,
  overtime_pay INTEGER DEFAULT 0,
  night_pay INTEGER DEFAULT 0,
  meal_allowance INTEGER DEFAULT 0,
  transport_allowance INTEGER DEFAULT 0,
  other_allowances JSONB,
  
  total_gross_pay INTEGER,
  
  national_pension INTEGER DEFAULT 0,
  health_insurance INTEGER DEFAULT 0,
  employment_insurance INTEGER DEFAULT 0,
  income_tax INTEGER DEFAULT 0,
  local_income_tax INTEGER DEFAULT 0,
  other_deductions JSONB,
  
  total_deductions INTEGER,
  net_pay INTEGER,
  
  work_days INTEGER,
  total_hours DECIMAL(5,2),
  
  status VARCHAR(20) DEFAULT 'PENDING',   -- PENDING, CONFIRMED, PAID
  confirmed_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(staff_id, year, month)
);
```

### schedules (스케줄)

```sql
CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES users(id),
  store_id UUID NOT NULL,
  
  work_date DATE NOT NULL,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  break_minutes INTEGER DEFAULT 60,
  
  status VARCHAR(20) DEFAULT 'SCHEDULED', -- SCHEDULED, CONFIRMED, CANCELLED, COMPLETED
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(staff_id, work_date)
);
```

### approval_requests (승인)

```sql
CREATE TABLE approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL,              -- LEAVE, OVERTIME, PURCHASE, DISPOSAL, RESIGNATION, ABSENCE_EXCUSE
  requester_id UUID NOT NULL REFERENCES users(id),
  company_id UUID NOT NULL,
  store_id UUID,
  
  approval_line JSONB NOT NULL,           -- [{order: 1, approverId, status: 'PENDING'}]
  current_step INTEGER DEFAULT 1,
  final_status VARCHAR(20) DEFAULT 'PENDING',
  
  details JSONB NOT NULL,                 -- 승인 유형별 상세 정보
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  finalized_at TIMESTAMP
);
```

### emergency_shifts (긴급 근무)

```sql
CREATE TABLE emergency_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id),
  
  work_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  
  position VARCHAR(100),                  -- 주방, 홀, 계산
  required_count INTEGER DEFAULT 1,
  
  hourly_rate INTEGER NOT NULL,
  bonus INTEGER,
  
  status VARCHAR(20) DEFAULT 'OPEN',      -- OPEN, FILLED, CANCELLED
  deadline TIMESTAMP,
  
  invited_staff_ids JSONB,                -- [staffId1, staffId2, ...]
  applicants JSONB,                       -- [{staffId, appliedAt, status}]
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### notifications (알림)

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  
  category VARCHAR(50) NOT NULL,          -- ATTENDANCE, SALARY, APPROVAL, MESSAGE, ...
  priority VARCHAR(20) NOT NULL,          -- CRITICAL, HIGH, NORMAL, LOW
  
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  
  deep_link TEXT,
  data JSONB,
  
  sent BOOLEAN DEFAULT false,
  read BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### messages (메시지)

```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES users(id),
  recipient_id UUID NOT NULL REFERENCES users(id),
  
  subject VARCHAR(255),
  body TEXT NOT NULL,
  attachments JSONB,
  
  status VARCHAR(20) DEFAULT 'SENT',      -- SENT, READ, REPLIED
  read_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### labor_law_versions (근로기준법)

```sql
CREATE TABLE labor_law_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version VARCHAR(20) NOT NULL,           -- "2026.01"
  effective_date DATE NOT NULL,
  
  minimum_wage_hourly INTEGER NOT NULL,
  
  overtime_rate DECIMAL(3,2) DEFAULT 1.5,
  night_rate DECIMAL(3,2) DEFAULT 0.5,
  holiday_rate DECIMAL(3,2) DEFAULT 1.5,
  
  national_pension_rate DECIMAL(4,2) DEFAULT 4.5,
  health_insurance_rate DECIMAL(5,3) DEFAULT 3.545,
  employment_insurance_rate DECIMAL(4,2) DEFAULT 0.9,
  
  status VARCHAR(20) DEFAULT 'DRAFT',     -- DRAFT, VERIFIED, ACTIVE, ARCHIVED
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  activated_at TIMESTAMP
);
```

---

## 🔌 API 엔드포인트

### 인증

```
POST   /api/auth/login
POST   /api/auth/signup
POST   /api/auth/logout
GET    /api/auth/me
```

### 직원 관리

```
GET    /api/staff                # 직원 목록
POST   /api/staff                # 직원 추가
GET    /api/staff/:id            # 직원 상세
PUT    /api/staff/:id            # 직원 수정
DELETE /api/staff/:id            # 직원 삭제
```

### 계약서

```
GET    /api/contracts            # 계약서 목록
POST   /api/contracts            # 계약서 생성
GET    /api/contracts/:id        # 계약서 상세
PUT    /api/contracts/:id        # 계약서 수정
POST   /api/contracts/:id/send   # 직원에게 발송
POST   /api/contracts/:id/sign   # 직원 서명
GET    /api/contracts/:id/pdf    # PDF 다운로드
```

### 출퇴근

```
POST   /api/attendance/check-in  # 출근 (QR)
POST   /api/attendance/check-out # 퇴근 (QR)
GET    /api/attendance            # 출퇴근 기록
GET    /api/attendance/today      # 오늘 현황
```

### 스케줄

```
GET    /api/schedules             # 스케줄 목록
POST   /api/schedules             # 스케줄 생성
GET    /api/schedules/month/:date # 월간 스케줄
PUT    /api/schedules/:id         # 스케줄 수정
DELETE /api/schedules/:id         # 스케줄 삭제
```

### 급여

```
GET    /api/salaries             # 급여 목록
GET    /api/salaries/:id         # 급여 상세
POST   /api/salaries/calculate   # 급여 계산
POST   /api/salaries/:id/confirm # 급여 확정
GET    /api/salaries/:id/pdf     # 급여명세서 PDF
```

### 세무

```
POST   /api/tax/generate         # 세무 데이터 생성
POST   /api/tax/send             # 세무대리인 전송
GET    /api/tax/history          # 전송 이력
```

### 승인

```
GET    /api/approvals            # 승인 목록
POST   /api/approvals            # 승인 요청 생성
POST   /api/approvals/:id/approve # 승인
POST   /api/approvals/:id/reject  # 거부
```

### 긴급 근무

```
GET    /api/emergency-shifts              # 긴급 근무 목록
POST   /api/emergency-shifts              # 긴급 근무 생성
POST   /api/emergency-shifts/:id/invite   # 초대 발송
POST   /api/emergency-shifts/:id/apply    # 지원하기
POST   /api/emergency-shifts/:id/select   # 선발
```

### 메시지

```
GET    /api/messages/inbox       # 받은 편지함
GET    /api/messages/sent        # 보낸 편지함
POST   /api/messages             # 메시지 보내기
GET    /api/messages/:id         # 메시지 읽기
```

### 플랫폼 관리 (super_admin)

```
GET    /api/platform/companies           # 회사 목록
POST   /api/platform/companies           # 회사 생성
GET    /api/platform/labor-law           # 근로기준법 버전 목록
POST   /api/platform/labor-law           # 신규 버전 생성
POST   /api/platform/labor-law/:id/verify # 검증
```

### Cron (자동화)

```
POST   /api/cron/apply-law-updates       # 법령 자동 적용 (매일 00:00)
POST   /api/cron/calculate-salaries      # 급여 자동 계산 (매월 1일)
POST   /api/cron/send-reminders          # 알림 발송 (매시간)
```

---

## 🔐 환경 변수

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# Firebase (FCM)
FIREBASE_PROJECT_ID=abc-staff-system
FIREBASE_PRIVATE_KEY=xxx
FIREBASE_CLIENT_EMAIL=xxx

# Stripe (결제)
STRIPE_SECRET_KEY=sk_test_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx

# 암호화
ENCRYPTION_KEY=xxx # 주민번호 암호화용

# 기타
NEXT_PUBLIC_APP_URL=https://app.abcstaff.com
NEXT_PUBLIC_API_URL=https://api.abcstaff.com
```

---

## 🎨 주요 컴포넌트 인터페이스

### Button

```tsx
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}
```

### Input

```tsx
interface InputProps {
  label?: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'date';
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
}
```

### Modal

```tsx
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}
```

---

## 🔧 핵심 유틸리티

### 날짜

```typescript
// packages/shared/utils/date.ts

export function formatDate(date: Date): string;
export function formatTime(date: Date): string;
export function formatDateTime(date: Date): string;
export function addDays(date: Date, days: number): Date;
export function isWeekend(date: Date): boolean;
export function getWorkDays(start: Date, end: Date): Date[];
```

### 통화

```typescript
// packages/shared/utils/currency.ts

export function formatCurrency(amount: number): string; // ₩1,234,567
export function parseCurrency(str: string): number;
```

### 검증

```typescript
// packages/shared/utils/validation.ts

export function validateEmail(email: string): boolean;
export function validatePhone(phone: string): boolean;
export function validateSSN(ssn: string): boolean;
export function validateBusinessNumber(num: string): boolean;
```

### 암호화

```typescript
// packages/shared/utils/encryption.ts

export function encryptSSN(ssn: string): string;
export function decryptSSN(encrypted: string): string;
```

---

## 🚀 급여 계산 로직

```typescript
// packages/shared/services/salary-calculator.ts

interface SalaryCalculationInput {
  staffId: string;
  year: number;
  month: number;
}

interface SalaryCalculationOutput {
  baseSalary: number;
  overtimePay: number;
  nightPay: number;
  holidayPay: number;
  allowances: Record<string, number>;
  totalGrossPay: number;
  
  nationalPension: number;
  healthInsurance: number;
  employmentInsurance: number;
  incomeTax: number;
  localIncomeTax: number;
  deductions: Record<string, number>;
  totalDeductions: number;
  
  netPay: number;
  workDays: number;
  totalHours: number;
}

export async function calculateSalary(
  input: SalaryCalculationInput
): Promise<SalaryCalculationOutput> {
  // 1. 계약서에서 기본급 가져오기
  const contract = await getActiveContract(input.staffId);
  
  // 2. 해당 월 출퇴근 기록 가져오기
  const attendances = await getAttendances(input.staffId, input.year, input.month);
  
  // 3. 근무시간 집계
  const workHours = sumWorkHours(attendances);
  const overtimeHours = sumOvertimeHours(attendances);
  const nightHours = sumNightHours(attendances);
  
  // 4. 급여 계산
  const baseSalary = calculateBaseSalary(contract, workHours);
  const overtimePay = calculateOvertimePay(contract, overtimeHours);
  const nightPay = calculateNightPay(contract, nightHours);
  
  // 5. 수당 계산
  const allowances = calculateAllowances(contract);
  
  // 6. 총 지급액
  const totalGrossPay = baseSalary + overtimePay + nightPay + sumAllowances(allowances);
  
  // 7. 4대보험 계산 (현재 법령 요율 사용)
  const currentLaw = await getCurrentLaborLaw();
  const nationalPension = totalGrossPay * (currentLaw.nationalPensionRate / 100);
  const healthInsurance = totalGrossPay * (currentLaw.healthInsuranceRate / 100);
  const employmentInsurance = totalGrossPay * (currentLaw.employmentInsuranceRate / 100);
  
  // 8. 세금 계산
  const incomeTax = calculateIncomeTax(totalGrossPay);
  const localIncomeTax = incomeTax * 0.1; // 소득세의 10%
  
  // 9. 기타 공제
  const deductions = calculateDeductions(contract);
  
  // 10. 총 공제액
  const totalDeductions = nationalPension + healthInsurance + employmentInsurance + 
                          incomeTax + localIncomeTax + sumDeductions(deductions);
  
  // 11. 실수령액
  const netPay = totalGrossPay - totalDeductions;
  
  return {
    baseSalary,
    overtimePay,
    nightPay,
    holidayPay: 0,
    allowances,
    totalGrossPay,
    nationalPension,
    healthInsurance,
    employmentInsurance,
    incomeTax,
    localIncomeTax,
    deductions,
    totalDeductions,
    netPay,
    workDays: attendances.length,
    totalHours: workHours
  };
}
```

---

## 📝 계약서 PDF 생성

```typescript
// packages/shared/services/pdf-generator.ts

import PDFDocument from 'pdfkit';

export async function generateContractPDF(
  contract: Contract
): Promise<Buffer> {
  const pdf = new PDFDocument({ size: 'A4' });
  
  // 1. 제목
  pdf.fontSize(18).text('근 로 계 약 서', { align: 'center' });
  
  // 2. 계약 당사자
  pdf.fontSize(12).text('1. 계약 당사자');
  // ...
  
  // 3. 근무 조건
  pdf.text('2. 근무 조건');
  // ...
  
  // 4. 임금 조건
  pdf.text('3. 임금 조건');
  // ...
  
  return pdf.end();
}
```

---

## 🔔 푸시 알림

```typescript
// packages/shared/services/push-notification.ts

import { messaging } from 'firebase-admin';

interface PushNotificationPayload {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export async function sendPushNotification(
  payload: PushNotificationPayload
): Promise<void> {
  // 1. 사용자의 FCM 토큰 조회
  const user = await db.users.findById(payload.userId);
  if (!user.fcmToken) return;
  
  // 2. FCM 전송
  await messaging().send({
    token: user.fcmToken,
    notification: {
      title: payload.title,
      body: payload.body
    },
    data: payload.data,
    android: {
      priority: 'high'
    },
    apns: {
      headers: {
        'apns-priority': '10'
      }
    }
  });
  
  // 3. DB에 기록
  await db.notifications.create({
    userId: payload.userId,
    title: payload.title,
    body: payload.body,
    sent: true,
    sentAt: new Date()
  });
}
```

---

## 🎯 핵심 비즈니스 규칙

### 1. 계약서 → 스케줄 자동 생성

```typescript
// 계약서 서명 완료 시
async function onContractSigned(contractId: string) {
  const contract = await db.contracts.findById(contractId);
  
  // 계약서의 work_schedules 기반으로 스케줄 생성
  const schedules = generateSchedulesFromContract(
    contract.workSchedules,
    contract.startDate,
    contract.endDate || addMonths(contract.startDate, 3) // 3개월치
  );
  
  await db.schedules.insertMany(schedules);
}
```

### 2. 출퇴근 → 급여 자동 집계

```typescript
// 출퇴근 체크아웃 시
async function onCheckOut(attendanceId: string) {
  const attendance = await db.attendances.findById(attendanceId);
  
  // 근무시간 계산
  const workHours = calculateWorkHours(
    attendance.actualCheckIn,
    attendance.actualCheckOut
  );
  
  // 급여 계산
  const contract = await getActiveContract(attendance.staffId);
  const dailyPay = calculateDailyPay(contract, workHours);
  
  // 업데이트
  await db.attendances.update(attendanceId, {
    workHours,
    dailyTotal: dailyPay
  });
}
```

### 3. 승인 라인 순차 처리

```typescript
// 승인 처리
async function processApproval(
  requestId: string,
  approverId: string,
  decision: 'APPROVED' | 'REJECTED'
) {
  const request = await db.approvalRequests.findById(requestId);
  
  // 현재 승인자 확인
  const currentApprover = request.approvalLine[request.currentStep - 1];
  if (currentApprover.approverId !== approverId) {
    throw new Error('승인 권한 없음');
  }
  
  // 승인/거부 처리
  currentApprover.status = decision;
  
  if (decision === 'REJECTED') {
    request.finalStatus = 'REJECTED';
    await notifyRequester(request, 'REJECTED');
  } else {
    // 다음 단계로
    if (request.currentStep < request.approvalLine.length) {
      request.currentStep++;
      await notifyNextApprover(request);
    } else {
      // 최종 승인
      request.finalStatus = 'APPROVED';
      await executeApprovedAction(request);
      await notifyRequester(request, 'APPROVED');
    }
  }
  
  await db.approvalRequests.update(requestId, request);
}
```

---

## ⚠️ 주의사항

1. **RLS (Row Level Security) 필수**
   - 모든 테이블에 RLS 정책 적용
   - company_id로 데이터 격리

2. **주민번호 암호화**
   - 저장 시 반드시 암호화
   - 세무 전송 시만 복호화

3. **트랜잭션 사용**
   - 급여 계산, 승인 처리 등 중요 작업

4. **에러 처리**
   - try-catch 필수
   - Sentry로 에러 트래킹

5. **타입 안전성**
   - TypeScript strict mode
   - Zod로 런타임 검증

---

**문서 끝**

> 💡 **시작하기**: 
> 1. `packages/database/schema.sql` 실행
> 2. `.env` 파일 설정
> 3. `apps/admin` 개발 시작
