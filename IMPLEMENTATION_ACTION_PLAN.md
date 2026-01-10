# ABC Staff System - 전체 구현 액션플랜

> **작성일**: 2026-01-10
> **목표**: 문서에 명시된 모든 기능 100% 구현

---

## 전체 구현 로드맵 개요

```
Phase 1: 핵심 인프라 (1주)
    ↓
Phase 2: 급여/계약 핵심 로직 (2주)
    ↓
Phase 3: 출퇴근/스케줄 시스템 (1주)
    ↓
Phase 4: 승인/알림 시스템 (1주)
    ↓
Phase 5: PRO 경영관리 기능 (2주)
    ↓
Phase 6: HACCP 고도화 (1주)
    ↓
Phase 7: 플랫폼 관리/결제 (1주)
    ↓
Phase 8: 모바일 앱 개발 (2주)
    ↓
Phase 9: 테스트/최적화/배포 (1주)
```

**총 예상 기간: 12주**

---

# Phase 1: 핵심 인프라 구축

## 1.1 데이터베이스 스키마 완성

### Task 1.1.1: 근로기준법 테이블
```sql
-- 파일: packages/database/migrations/001_labor_law.sql

CREATE TABLE labor_law_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version VARCHAR(20) NOT NULL,
  effective_date DATE NOT NULL,
  minimum_wage_hourly INTEGER NOT NULL,
  overtime_rate DECIMAL(3,2) DEFAULT 1.5,
  night_rate DECIMAL(3,2) DEFAULT 0.5,
  holiday_rate DECIMAL(3,2) DEFAULT 1.5,
  national_pension_rate DECIMAL(4,2) DEFAULT 4.5,
  health_insurance_rate DECIMAL(5,3) DEFAULT 3.545,
  long_term_care_rate DECIMAL(5,3) DEFAULT 12.81,
  employment_insurance_rate DECIMAL(4,2) DEFAULT 0.9,
  status VARCHAR(20) DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 초기 데이터 삽입
INSERT INTO labor_law_versions (version, effective_date, minimum_wage_hourly)
VALUES ('2026.01', '2026-01-01', 10030);
```

### Task 1.1.2: 세무대리인 테이블
```sql
-- 파일: packages/database/migrations/002_tax_accountant.sql

CREATE TABLE tax_accountants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  name VARCHAR(100) NOT NULL,
  business_number VARCHAR(20),
  phone VARCHAR(20),
  email VARCHAR(255),
  fax_number VARCHAR(20),
  transmission_method VARCHAR(20) DEFAULT 'EMAIL',
  auto_send BOOLEAN DEFAULT false,
  send_day INTEGER DEFAULT 5,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tax_transmissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  method VARCHAR(20),
  file_url TEXT,
  status VARCHAR(20) DEFAULT 'SUCCESS',
  transmitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Task 1.1.3: 경영관리 테이블
```sql
-- 파일: packages/database/migrations/003_business_management.sql

CREATE TABLE revenue_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  source_type VARCHAR(20) NOT NULL, -- TOSS_POS, OPENBANKING, MANUAL
  source_name VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  connection_data JSONB,
  last_synced_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE daily_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  revenue_source_id UUID REFERENCES revenue_sources(id),
  sales_date DATE NOT NULL,
  total_amount DECIMAL(12,2),
  card_amount DECIMAL(12,2),
  cash_amount DECIMAL(12,2),
  transaction_count INTEGER,
  hourly_breakdown JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, revenue_source_id, sales_date)
);

CREATE TABLE expense_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  transaction_date DATE NOT NULL,
  merchant_name VARCHAR(255),
  amount DECIMAL(12,2),
  category VARCHAR(50),
  ai_category VARCHAR(50),
  ai_confidence DECIMAL(3,2),
  user_confirmed BOOLEAN DEFAULT false,
  source VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Task 1.1.4: 구독/결제 테이블
```sql
-- 파일: packages/database/migrations/004_subscriptions.sql

CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL,
  display_name VARCHAR(100),
  price_monthly INTEGER,
  price_yearly INTEGER,
  max_employees INTEGER,
  max_stores INTEGER,
  features JSONB,
  active BOOLEAN DEFAULT true
);

CREATE TABLE company_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  plan_id UUID REFERENCES subscription_plans(id),
  status VARCHAR(20) DEFAULT 'ACTIVE',
  billing_cycle VARCHAR(20),
  current_period_start DATE,
  current_period_end DATE,
  stripe_subscription_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES company_subscriptions(id),
  amount INTEGER,
  status VARCHAR(20),
  stripe_payment_id VARCHAR(100),
  paid_at TIMESTAMP
);

-- 초기 플랜 데이터
INSERT INTO subscription_plans (name, display_name, price_monthly, max_employees, max_stores, features) VALUES
('FREE', '무료', 0, 10, 1, '{"qrCheckin": true, "basicPayroll": true}'),
('STARTER', '스타터', 39000, 50, 3, '{"qrCheckin": true, "scheduling": true, "contracts": true, "payslip": true}'),
('PRO', '프로', 99000, 200, -1, '{"all": true, "tossPOS": true, "openBanking": true, "ai": true}');
```

## 1.2 공통 유틸리티 생성

### Task 1.2.1: PDF 생성 유틸리티
```typescript
// 파일: packages/shared/src/utils/pdf-generator.ts

import PDFDocument from 'pdfkit';

export class PDFGenerator {
  static async generateContract(contract: Contract): Promise<Buffer> {
    // 계약서 PDF 생성 로직
  }

  static async generatePayslip(salary: Salary): Promise<Buffer> {
    // 급여명세서 PDF 생성 로직
  }

  static async generateProfitLoss(statement: ProfitLossStatement): Promise<Buffer> {
    // 손익계산서 PDF 생성 로직
  }
}
```

### Task 1.2.2: 이메일 서비스
```typescript
// 파일: packages/shared/src/services/email.service.ts

import { Resend } from 'resend';

export class EmailService {
  private resend = new Resend(process.env.RESEND_API_KEY);

  async sendContractForSignature(to: string, contractId: string): Promise<void> {}
  async sendPayslip(to: string, payslipPdf: Buffer): Promise<void> {}
  async sendTaxReport(to: string, excelFile: Buffer): Promise<void> {}
  async sendNotification(to: string, subject: string, body: string): Promise<void> {}
}
```

### Task 1.2.3: 푸시 알림 서비스 (FCM)
```typescript
// 파일: packages/shared/src/services/push-notification.service.ts

import * as admin from 'firebase-admin';

export class PushNotificationService {
  private messaging: admin.messaging.Messaging;

  constructor() {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!))
    });
    this.messaging = admin.messaging();
  }

  async send(userId: string, notification: PushNotification): Promise<void> {}
  async sendToMultiple(userIds: string[], notification: PushNotification): Promise<void> {}
  async registerToken(userId: string, fcmToken: string): Promise<void> {}
}
```

### Task 1.2.4: 엑셀 생성 유틸리티
```typescript
// 파일: packages/shared/src/utils/excel-generator.ts

import ExcelJS from 'exceljs';

export class ExcelGenerator {
  static async generatePayrollReport(data: PayrollData[]): Promise<Buffer> {
    // 세무용 급여대장 엑셀 생성
  }

  static async generateAttendanceReport(data: AttendanceData[]): Promise<Buffer> {
    // 출퇴근 리포트 엑셀
  }
}
```

---

# Phase 2: 급여/계약 핵심 로직 구현

## 2.1 급여 자동 계산 시스템

### Task 2.1.1: 급여 계산 서비스
```typescript
// 파일: apps/admin/src/lib/services/salary-calculation.service.ts

export class SalaryCalculationService {
  // 근로기준법 데이터 로드
  async getLaborLaw(): Promise<LaborLawVersion> {}

  // 기본급 계산
  calculateBaseSalary(contract: Contract, workHours: number): number {}

  // 연장근로수당 (1.5배)
  calculateOvertimePay(hours: number, hourlyRate: number, rate: number): number {}

  // 야간근로수당 (0.5배 가산)
  calculateNightPay(hours: number, hourlyRate: number): number {}

  // 휴일근로수당 (1.5배)
  calculateHolidayPay(hours: number, hourlyRate: number): number {}

  // 주휴수당 (주 15시간 이상)
  calculateWeeklyHolidayPay(weeklyHours: number, hourlyRate: number): number {}

  // 4대보험 계산
  calculateInsurance(grossPay: number, rates: InsuranceRates): InsuranceDeductions {}

  // 소득세 계산
  calculateIncomeTax(grossPay: number, deductions: number): TaxDeductions {}

  // 전체 급여 계산
  async calculateMonthlySalary(staffId: string, year: number, month: number): Promise<SalaryCalculation> {}
}
```

### Task 2.1.2: 급여 계산 API
```typescript
// 파일: apps/admin/src/app/api/salaries/calculate/route.ts

export async function POST(request: Request) {
  const { staffId, year, month } = await request.json();

  const service = new SalaryCalculationService();
  const calculation = await service.calculateMonthlySalary(staffId, year, month);

  // 급여 테이블에 저장
  await supabase.from('salaries').upsert({
    staff_id: staffId,
    year,
    month,
    ...calculation
  });

  return Response.json(calculation);
}
```

### Task 2.1.3: 급여 명세서 PDF 생성
```typescript
// 파일: apps/admin/src/app/api/salaries/[id]/pdf/route.ts

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const salary = await getSalary(params.id);
  const pdf = await PDFGenerator.generatePayslip(salary);

  return new Response(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="payslip-${salary.year}-${salary.month}.pdf"`
    }
  });
}
```

### Task 2.1.4: 급여 명세서 이메일 발송
```typescript
// 파일: apps/admin/src/app/api/salaries/[id]/send-email/route.ts

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const salary = await getSalary(params.id);
  const staff = await getStaff(salary.staff_id);
  const pdf = await PDFGenerator.generatePayslip(salary);

  await emailService.sendPayslip(staff.email, pdf);

  // 푸시 알림 발송
  await pushService.send(staff.id, {
    title: `${salary.year}년 ${salary.month}월 급여 확정`,
    body: `실수령액: ${salary.net_pay.toLocaleString()}원`,
    category: 'SALARY',
    deepLink: `/salary/${salary.id}`
  });

  return Response.json({ success: true });
}
```

## 2.2 계약서 시스템 완성

### Task 2.2.1: 계약서 PDF 생성
```typescript
// 파일: apps/admin/src/lib/services/contract-pdf.service.ts

export class ContractPDFService {
  async generate(contract: Contract): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4' });

    // 제목
    doc.fontSize(18).text('근 로 계 약 서', { align: 'center' });

    // 계약 당사자 정보
    this.addContractParties(doc, contract);

    // 계약 기간
    this.addContractPeriod(doc, contract);

    // 근무 조건
    this.addWorkConditions(doc, contract);

    // 급여 조건 (상세)
    this.addSalaryConditions(doc, contract);

    // 공제 항목
    this.addDeductions(doc, contract);

    // 휴가
    this.addLeavePolicy(doc, contract);

    // 계약 해지
    this.addTerminationClause(doc, contract);

    // 서명란
    this.addSignatureSection(doc, contract);

    return doc.end();
  }

  private maskSSN(ssn: string): string {
    return ssn.substring(0, 8) + '******';
  }
}
```

### Task 2.2.2: 전자서명 컴포넌트
```typescript
// 파일: apps/admin/src/components/signature-pad.tsx

'use client';
import SignatureCanvas from 'react-signature-canvas';

export function SignaturePad({ onSave }: { onSave: (signature: string) => void }) {
  const sigRef = useRef<SignatureCanvas>(null);

  const handleSave = () => {
    if (sigRef.current) {
      const dataUrl = sigRef.current.toDataURL('image/png');
      onSave(dataUrl);
    }
  };

  return (
    <div className="border rounded-lg p-4">
      <SignatureCanvas
        ref={sigRef}
        canvasProps={{ className: 'w-full h-48 border' }}
      />
      <div className="flex gap-2 mt-2">
        <Button variant="outline" onClick={() => sigRef.current?.clear()}>
          지우기
        </Button>
        <Button onClick={handleSave}>서명 완료</Button>
      </div>
    </div>
  );
}
```

### Task 2.2.3: 계약서 서명 요청 API
```typescript
// 파일: apps/admin/src/app/api/contracts/[id]/request-signature/route.ts

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const contract = await getContract(params.id);
  const staff = await getStaff(contract.staff_id);

  // 상태 업데이트
  await supabase.from('contracts')
    .update({ status: 'SENT', sent_at: new Date() })
    .eq('id', params.id);

  // 이메일 발송
  await emailService.sendContractForSignature(staff.email, params.id);

  // 푸시 알림
  await pushService.send(staff.id, {
    title: '계약서 서명 요청',
    body: '새로운 근로계약서가 발송되었습니다. 확인 후 서명해주세요.',
    category: 'CONTRACT',
    deepLink: `/contracts/${params.id}/sign`,
    actions: [
      { id: 'VIEW', title: '확인하기' }
    ]
  });

  return Response.json({ success: true });
}
```

### Task 2.2.4: 계약서 서명 처리 API
```typescript
// 파일: apps/admin/src/app/api/contracts/[id]/sign/route.ts

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { signature } = await request.json();

  // 서명 저장
  await supabase.from('contracts')
    .update({
      status: 'SIGNED',
      employee_signature: signature,
      employee_signed_at: new Date()
    })
    .eq('id', params.id);

  // 관리자에게 알림
  const contract = await getContract(params.id);
  await pushService.send(contract.created_by, {
    title: '계약서 서명 완료',
    body: `${contract.staff_name}님이 계약서에 서명했습니다.`,
    category: 'CONTRACT'
  });

  // 서명된 PDF 생성 및 저장
  const pdf = await ContractPDFService.generate(contract);
  const { data } = await supabase.storage
    .from('contracts')
    .upload(`${params.id}/signed.pdf`, pdf);

  return Response.json({ success: true, pdfUrl: data?.path });
}
```

## 2.3 세무대리인 연동 시스템

### Task 2.3.1: 세무대리인 설정 페이지
```typescript
// 파일: apps/admin/src/app/settings/tax-accountant/page.tsx

export default function TaxAccountantSettingsPage() {
  // 세무대리인 정보 관리 UI
  // - 이름, 사업자번호, 연락처, 이메일, FAX
  // - 전송 방법 (이메일/FAX/수동)
  // - 자동 전송 설정 (매월 n일)
}
```

### Task 2.3.2: 급여대장 엑셀 생성 API
```typescript
// 파일: apps/admin/src/app/api/tax/payroll-report/route.ts

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get('year')!);
  const month = parseInt(searchParams.get('month')!);

  const salaries = await getSalariesForMonth(year, month);
  const excel = await ExcelGenerator.generatePayrollReport(salaries);

  return new Response(excel, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="payroll-${year}-${month}.xlsx"`
    }
  });
}
```

### Task 2.3.3: 세무대리인 자동 전송 Cron
```typescript
// 파일: apps/admin/src/app/api/cron/send-tax-report/route.ts

export async function GET() {
  const today = new Date();

  // 오늘이 전송일인 회사들 조회
  const taxAccountants = await supabase
    .from('tax_accountants')
    .select('*')
    .eq('auto_send', true)
    .eq('send_day', today.getDate());

  for (const ta of taxAccountants.data || []) {
    const prevMonth = subMonths(today, 1);
    const excel = await generatePayrollReport(ta.company_id, prevMonth);

    if (ta.transmission_method === 'EMAIL') {
      await emailService.sendTaxReport(ta.email, excel);
    }

    // 전송 이력 저장
    await supabase.from('tax_transmissions').insert({
      company_id: ta.company_id,
      year: prevMonth.getFullYear(),
      month: prevMonth.getMonth() + 1,
      method: ta.transmission_method,
      status: 'SUCCESS'
    });
  }

  return Response.json({ success: true });
}
```

---

# Phase 3: 출퇴근/스케줄 시스템

## 3.1 QR 출퇴근 시스템

### Task 3.1.1: QR 코드 생성
```typescript
// 파일: apps/admin/src/lib/services/qr-code.service.ts

import QRCode from 'qrcode';

export class QRCodeService {
  async generateStoreQR(storeId: string): Promise<string> {
    const payload = {
      type: 'STORE_CHECKIN',
      storeId,
      timestamp: Date.now()
    };

    const token = jwt.sign(payload, process.env.QR_SECRET!, { expiresIn: '24h' });
    const qrDataUrl = await QRCode.toDataURL(`abcstaff://checkin/${token}`);

    // 저장
    await supabase.from('stores')
      .update({ qr_code: qrDataUrl, qr_token: token })
      .eq('id', storeId);

    return qrDataUrl;
  }

  async verifyQR(token: string): Promise<{ storeId: string; valid: boolean }> {
    try {
      const decoded = jwt.verify(token, process.env.QR_SECRET!) as any;
      return { storeId: decoded.storeId, valid: true };
    } catch {
      return { storeId: '', valid: false };
    }
  }
}
```

### Task 3.1.2: 출퇴근 체크인 API
```typescript
// 파일: apps/admin/src/app/api/attendance/checkin/route.ts

export async function POST(request: Request) {
  const { qrToken, latitude, longitude } = await request.json();
  const userId = await getCurrentUserId();

  // QR 검증
  const { storeId, valid } = await qrService.verifyQR(qrToken);
  if (!valid) {
    return Response.json({ error: 'Invalid QR code' }, { status: 400 });
  }

  // 위치 검증 (지오펜스)
  const store = await getStore(storeId);
  const distance = calculateDistance(
    { lat: latitude, lng: longitude },
    { lat: store.latitude, lng: store.longitude }
  );

  if (distance > store.allowed_radius) {
    return Response.json({ error: 'Outside allowed area' }, { status: 400 });
  }

  // 출근 기록
  const today = format(new Date(), 'yyyy-MM-dd');
  const schedule = await getScheduleForDate(userId, today);

  const isLate = schedule && new Date() > new Date(schedule.start_time);

  await supabase.from('attendances').upsert({
    staff_id: userId,
    store_id: storeId,
    work_date: today,
    actual_check_in: new Date(),
    check_in_lat: latitude,
    check_in_lng: longitude,
    check_in_method: 'QR',
    status: isLate ? 'LATE' : 'NORMAL'
  });

  return Response.json({ success: true, isLate });
}
```

### Task 3.1.3: QR 스캔 화면 (모바일용)
```typescript
// 파일: apps/mobile/src/screens/QRScanScreen.tsx

export function QRScanScreen() {
  const [hasPermission, setHasPermission] = useState(false);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    const token = data.replace('abcstaff://checkin/', '');

    const location = await Location.getCurrentPositionAsync();

    const result = await api.post('/attendance/checkin', {
      qrToken: token,
      latitude: location.coords.latitude,
      longitude: location.coords.longitude
    });

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('출근 완료!', result.isLate ? '지각 처리되었습니다.' : '정상 출근입니다.');
    }
  };

  return (
    <Camera onBarCodeScanned={handleBarCodeScanned}>
      <QRFrameOverlay />
    </Camera>
  );
}
```

## 3.2 스케줄 자동 생성

### Task 3.2.1: 계약서 기반 스케줄 생성
```typescript
// 파일: apps/admin/src/lib/services/schedule-generator.service.ts

export class ScheduleGeneratorService {
  async generateFromContract(contractId: string, startDate: Date, endDate: Date) {
    const contract = await getContract(contractId);
    const workSchedules = contract.work_schedules as WorkSchedule[];

    const schedules = [];
    let currentDate = startDate;

    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();

      for (const ws of workSchedules) {
        if (ws.daysOfWeek.includes(dayOfWeek)) {
          schedules.push({
            staff_id: contract.staff_id,
            store_id: contract.store_id,
            work_date: format(currentDate, 'yyyy-MM-dd'),
            start_time: `${format(currentDate, 'yyyy-MM-dd')}T${ws.startTime}`,
            end_time: `${format(currentDate, 'yyyy-MM-dd')}T${ws.endTime}`,
            break_minutes: ws.breakMinutes,
            status: 'SCHEDULED',
            generated_by: 'CONTRACT'
          });
        }
      }

      currentDate = addDays(currentDate, 1);
    }

    await supabase.from('schedules').insert(schedules);
    return schedules;
  }
}
```

### Task 3.2.2: 스케줄 교환 기능
```typescript
// 파일: apps/admin/src/app/api/schedules/trade/route.ts

export async function POST(request: Request) {
  const { myScheduleId, targetScheduleId, reason } = await request.json();

  // 교환 요청 생성
  await supabase.from('schedule_trade_requests').insert({
    requester_schedule_id: myScheduleId,
    target_schedule_id: targetScheduleId,
    reason,
    status: 'PENDING'
  });

  // 상대방에게 알림
  const targetSchedule = await getSchedule(targetScheduleId);
  await pushService.send(targetSchedule.staff_id, {
    title: '스케줄 교환 요청',
    body: '스케줄 교환 요청이 있습니다.',
    category: 'SCHEDULE'
  });

  return Response.json({ success: true });
}
```

---

# Phase 4: 승인/알림 시스템

## 4.1 확장 승인 시스템

### Task 4.1.1: 승인 유형별 상세 폼
```typescript
// 파일: apps/admin/src/components/approvals/purchase-approval-form.tsx

export function PurchaseApprovalForm() {
  return (
    <Form>
      <Select name="category" label="분류">
        <option value="소모품">소모품</option>
        <option value="식자재">식자재</option>
        <option value="설비">설비</option>
      </Select>
      <Input name="itemName" label="품목명" />
      <Input name="quantity" label="수량" type="number" />
      <Input name="unitPrice" label="단가" type="number" />
      <Input name="totalAmount" label="총액" type="number" disabled />
      <Input name="vendor" label="업체" />
      <Textarea name="purpose" label="구매 목적" />
      <Select name="urgency" label="긴급도">
        <option value="긴급">긴급</option>
        <option value="일반">일반</option>
        <option value="정기">정기</option>
      </Select>
      <FileUpload name="quotation" label="견적서" />
    </Form>
  );
}

// 폐기 승인 폼
export function DisposalApprovalForm() {
  return (
    <Form>
      <Select name="category" label="분류" />
      <Input name="itemName" label="품목명" />
      <Input name="quantity" label="수량" />
      <Input name="estimatedValue" label="추정 가치" type="number" />
      <Select name="reason" label="폐기 사유">
        <option value="유통기한만료">유통기한 만료</option>
        <option value="파손">파손</option>
        <option value="불량">불량</option>
      </Select>
      <Select name="disposalMethod" label="처리 방법">
        <option value="폐기">폐기</option>
        <option value="기부">기부</option>
        <option value="재활용">재활용</option>
      </Select>
      <MultiFileUpload name="photos" label="폐기 대상 사진" />
    </Form>
  );
}

// 사직서 폼
export function ResignationApprovalForm() {
  return (
    <Form>
      <Select name="resignationType" label="퇴사 유형">
        <option value="자진퇴사">자진퇴사</option>
        <option value="권고사직">권고사직</option>
        <option value="계약만료">계약만료</option>
      </Select>
      <DatePicker name="resignationDate" label="최종 근무일" />
      <Textarea name="reason" label="퇴사 사유" />
      <ReturnItemsChecklist />
      <FinalSettlementPreview />
    </Form>
  );
}
```

### Task 4.1.2: 금액별 승인 라인 자동 설정
```typescript
// 파일: apps/admin/src/lib/services/approval-line.service.ts

export class ApprovalLineService {
  async getApprovalLine(type: ApprovalType, details: any, storeId: string): Promise<Approver[]> {
    const line: Approver[] = [];

    switch (type) {
      case 'PURCHASE':
        const amount = details.totalAmount;

        if (amount < 100000) {
          // 10만원 미만: 매장관리자만
          line.push(await this.getStoreManager(storeId));
        } else if (amount < 500000) {
          // 50만원 미만: 매장관리자 → 본사관리자
          line.push(await this.getStoreManager(storeId));
          line.push(await this.getManager(storeId));
        } else {
          // 50만원 이상: 매장관리자 → 본사관리자 → 대표
          line.push(await this.getStoreManager(storeId));
          line.push(await this.getManager(storeId));
          line.push(await this.getCompanyAdmin(storeId));
        }
        break;

      case 'DISPOSAL':
        line.push(await this.getStoreManager(storeId));
        line.push(await this.getManager(storeId));
        break;

      case 'RESIGNATION':
        line.push(await this.getStoreManager(storeId));
        line.push(await this.getManager(storeId));
        line.push(await this.getCompanyAdmin(storeId));
        break;
    }

    return line;
  }
}
```

### Task 4.1.3: 순차 승인 처리
```typescript
// 파일: apps/admin/src/app/api/approvals/[id]/process/route.ts

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { decision, comment } = await request.json();
  const currentUserId = await getCurrentUserId();

  const approval = await getApproval(params.id);
  const currentStep = approval.approval_line[approval.current_step - 1];

  // 권한 확인
  if (currentStep.approverId !== currentUserId) {
    return Response.json({ error: 'Not authorized' }, { status: 403 });
  }

  // 승인/거부 처리
  currentStep.status = decision;
  currentStep.comment = comment;
  currentStep.decidedAt = new Date();

  if (decision === 'REJECTED') {
    approval.final_status = 'REJECTED';
    approval.finalized_at = new Date();

    // 신청자에게 거부 알림
    await pushService.send(approval.requester_id, {
      title: `${approval.type} 거부됨`,
      body: `사유: ${comment}`,
      category: 'APPROVAL'
    });
  } else if (approval.current_step < approval.approval_line.length) {
    // 다음 단계로
    approval.current_step++;

    // 다음 승인자에게 알림
    const nextApprover = approval.approval_line[approval.current_step - 1];
    await pushService.send(nextApprover.approverId, {
      title: `${approval.type} 승인 요청`,
      body: `${approval.requester_name}님의 요청`,
      category: 'APPROVAL',
      actions: [
        { id: 'APPROVE', title: '승인' },
        { id: 'REJECT', title: '거부' }
      ]
    });
  } else {
    // 최종 승인
    approval.final_status = 'APPROVED';
    approval.finalized_at = new Date();

    // 후처리
    await executeApprovedAction(approval);

    // 신청자에게 승인 알림
    await pushService.send(approval.requester_id, {
      title: `${approval.type} 승인됨`,
      body: '신청이 승인되었습니다.',
      category: 'APPROVAL'
    });
  }

  await updateApproval(params.id, approval);

  return Response.json({ success: true });
}
```

## 4.2 푸시 알림 시스템 (FCM) 완성

### Task 4.2.1: 알림 저장 및 조회 API
```typescript
// 파일: apps/admin/src/app/api/notifications/route.ts

export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  const { searchParams } = new URL(request.url);
  const unreadOnly = searchParams.get('unread') === 'true';

  let query = supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (unreadOnly) {
    query = query.eq('read', false);
  }

  const { data } = await query;
  return Response.json(data);
}

// 읽음 처리
export async function PATCH(request: Request) {
  const { notificationIds } = await request.json();

  await supabase
    .from('notifications')
    .update({ read: true, read_at: new Date() })
    .in('id', notificationIds);

  return Response.json({ success: true });
}
```

### Task 4.2.2: FCM 토큰 등록
```typescript
// 파일: apps/admin/src/app/api/notifications/register-token/route.ts

export async function POST(request: Request) {
  const { fcmToken } = await request.json();
  const userId = await getCurrentUserId();

  await supabase
    .from('user_fcm_tokens')
    .upsert({
      user_id: userId,
      fcm_token: fcmToken,
      updated_at: new Date()
    });

  return Response.json({ success: true });
}
```

### Task 4.2.3: 알림 센터 컴포넌트
```typescript
// 파일: apps/admin/src/components/notification-center.tsx

export function NotificationCenter() {
  const { data: notifications } = useNotifications();
  const unreadCount = notifications?.filter(n => !n.read).length || 0;

  return (
    <Popover>
      <PopoverTrigger>
        <Button variant="ghost" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1">{unreadCount}</Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-semibold">알림</h3>
          <Button variant="link" size="sm" onClick={markAllAsRead}>
            모두 읽음
          </Button>
        </div>
        <ScrollArea className="h-96">
          {notifications?.map(notification => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onClick={() => handleClick(notification)}
            />
          ))}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
```

---

# Phase 5: PRO 경영관리 기능

## 5.1 토스 POS 연동

### Task 5.1.1: 토스 OAuth 연동
```typescript
// 파일: apps/admin/src/lib/services/toss-pos.service.ts

export class TossPOSService {
  private readonly clientId = process.env.TOSS_CLIENT_ID!;
  private readonly clientSecret = process.env.TOSS_CLIENT_SECRET!;
  private readonly redirectUri = process.env.TOSS_REDIRECT_URI!;

  getAuthUrl(): string {
    return `https://api.tosspayments.com/oauth/authorize?client_id=${this.clientId}&redirect_uri=${this.redirectUri}&response_type=code&scope=pos.sales.read`;
  }

  async exchangeCodeForToken(code: string): Promise<TossTokens> {
    const response = await fetch('https://api.tosspayments.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        code
      })
    });

    return response.json();
  }

  async fetchSales(accessToken: string, startDate: string, endDate: string): Promise<TossSalesData> {
    const response = await fetch(
      `https://api.tosspayments.com/v1/pos/sales?startDate=${startDate}&endDate=${endDate}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    return response.json();
  }
}
```

### Task 5.1.2: 토스 POS 연결 페이지
```typescript
// 파일: apps/admin/src/app/integrations/toss-pos/page.tsx

export default function TossPOSIntegrationPage() {
  const [connected, setConnected] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const handleConnect = () => {
    const authUrl = tossPOSService.getAuthUrl();
    window.location.href = authUrl;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>토스 POS 연동</CardTitle>
          <CardDescription>
            토스 POS와 연결하면 매출이 자동으로 집계됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {connected ? (
            <div className="space-y-4">
              <Alert variant="success">
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>연결됨 (마지막 동기화: {lastSync})</AlertDescription>
              </Alert>
              <Button variant="outline" onClick={handleSync}>
                지금 동기화
              </Button>
            </div>
          ) : (
            <Button onClick={handleConnect}>
              토스 POS 연결하기
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

### Task 5.1.3: 매출 자동 동기화 Cron
```typescript
// 파일: apps/admin/src/app/api/cron/sync-toss-pos/route.ts

export async function GET() {
  // 연결된 모든 토스 POS 소스 조회
  const sources = await supabase
    .from('revenue_sources')
    .select('*')
    .eq('source_type', 'TOSS_POS')
    .eq('is_active', true);

  for (const source of sources.data || []) {
    try {
      const tokens = source.connection_data;

      // 토큰 갱신 필요시
      if (new Date(tokens.expiresAt) < new Date()) {
        const newTokens = await tossPOSService.refreshToken(tokens.refreshToken);
        await updateSourceTokens(source.id, newTokens);
      }

      // 매출 데이터 조회 (어제~오늘)
      const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
      const today = format(new Date(), 'yyyy-MM-dd');

      const sales = await tossPOSService.fetchSales(tokens.accessToken, yesterday, today);

      // 일별로 저장
      for (const daySales of sales.daily) {
        await supabase.from('daily_sales').upsert({
          company_id: source.company_id,
          revenue_source_id: source.id,
          sales_date: daySales.date,
          total_amount: daySales.totalAmount,
          card_amount: daySales.cardAmount,
          cash_amount: daySales.cashAmount,
          transaction_count: daySales.transactionCount,
          hourly_breakdown: daySales.hourly
        });
      }

      // 마지막 동기화 시간 업데이트
      await supabase.from('revenue_sources')
        .update({ last_synced_at: new Date() })
        .eq('id', source.id);

    } catch (error) {
      console.error(`Sync failed for source ${source.id}:`, error);
    }
  }

  return Response.json({ success: true });
}
```

## 5.2 오픈뱅킹 연동

### Task 5.2.1: 오픈뱅킹 OAuth
```typescript
// 파일: apps/admin/src/lib/services/open-banking.service.ts

export class OpenBankingService {
  private readonly baseUrl = 'https://openapi.open-platform.or.kr';

  getAuthUrl(): string {
    return `${this.baseUrl}/oauth/2.0/authorize?...`;
  }

  async getTransactions(accessToken: string, accountNo: string, fromDate: string, toDate: string) {
    const response = await fetch(
      `${this.baseUrl}/v2.0/account/transaction_list/fin_num?...`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    return response.json();
  }
}
```

### Task 5.2.2: AI 비용 자동 분류
```typescript
// 파일: apps/admin/src/lib/services/expense-classifier.service.ts

import OpenAI from 'openai';

export class ExpenseClassifierService {
  private openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  async classifyExpense(merchantName: string, amount: number): Promise<ClassificationResult> {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: `당신은 비용 분류 전문가입니다. 다음 거래를 분류해주세요.
카테고리: 재료비, 인건비, 관리비, 월세, 수도광열비, 마케팅비, 기타
응답 형식: {"category": "카테고리", "confidence": 0.0~1.0}`
        },
        {
          role: 'user',
          content: `거래처: ${merchantName}\n금액: ${amount}원`
        }
      ],
      response_format: { type: 'json_object' }
    });

    return JSON.parse(response.choices[0].message.content!);
  }

  async classifyBatch(transactions: Transaction[]): Promise<ClassificationResult[]> {
    return Promise.all(
      transactions.map(tx => this.classifyExpense(tx.merchantName, tx.amount))
    );
  }
}
```

### Task 5.2.3: 비용 관리 페이지
```typescript
// 파일: apps/admin/src/app/business/expenses/page.tsx

export default function ExpensesPage() {
  const { data: transactions } = useExpenseTransactions();

  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <h1 className="text-2xl font-bold">비용 관리</h1>
        <Button onClick={syncOpenBanking}>
          <RefreshCw className="mr-2 h-4 w-4" />
          거래 동기화
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>이번 달 비용</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>날짜</TableHead>
                <TableHead>거래처</TableHead>
                <TableHead>금액</TableHead>
                <TableHead>분류</TableHead>
                <TableHead>확신도</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions?.map(tx => (
                <TableRow key={tx.id}>
                  <TableCell>{format(tx.transaction_date, 'MM/dd')}</TableCell>
                  <TableCell>{tx.merchant_name}</TableCell>
                  <TableCell>{tx.amount.toLocaleString()}원</TableCell>
                  <TableCell>
                    <Badge variant={tx.user_confirmed ? 'default' : 'outline'}>
                      {tx.category || tx.ai_category}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {tx.ai_confidence && (
                      <span className={tx.ai_confidence < 0.8 ? 'text-orange-500' : ''}>
                        {Math.round(tx.ai_confidence * 100)}%
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => editCategory(tx)}>
                      수정
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
```

## 5.3 손익계산서 자동 생성

### Task 5.3.1: 손익계산서 생성 서비스
```typescript
// 파일: apps/admin/src/lib/services/profit-loss.service.ts

export class ProfitLossService {
  async generate(companyId: string, year: number, month: number): Promise<ProfitLossStatement> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = endOfMonth(startDate);

    // 매출 집계
    const sales = await supabase
      .from('daily_sales')
      .select('*')
      .eq('company_id', companyId)
      .gte('sales_date', format(startDate, 'yyyy-MM-dd'))
      .lte('sales_date', format(endDate, 'yyyy-MM-dd'));

    const totalRevenue = sales.data?.reduce((sum, s) => sum + s.total_amount, 0) || 0;

    // 비용 집계
    const expenses = await supabase
      .from('expense_transactions')
      .select('*')
      .eq('company_id', companyId)
      .gte('transaction_date', format(startDate, 'yyyy-MM-dd'))
      .lte('transaction_date', format(endDate, 'yyyy-MM-dd'));

    const expenseByCategory = expenses.data?.reduce((acc, e) => {
      const cat = e.category || e.ai_category || '기타';
      acc[cat] = (acc[cat] || 0) + e.amount;
      return acc;
    }, {} as Record<string, number>) || {};

    // 인건비 (급여에서)
    const salaries = await supabase
      .from('salaries')
      .select('total_gross_pay')
      .eq('company_id', companyId)
      .eq('year', year)
      .eq('month', month);

    const payrollExpense = salaries.data?.reduce((sum, s) => sum + s.total_gross_pay, 0) || 0;
    expenseByCategory['인건비'] = payrollExpense;

    const totalExpense = Object.values(expenseByCategory).reduce((sum, v) => sum + v, 0);
    const netProfit = totalRevenue - totalExpense;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    // 전월 대비
    const prevMonth = await this.get(companyId, month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1);

    const revenueChange = prevMonth ? ((totalRevenue - prevMonth.total_revenue) / prevMonth.total_revenue) * 100 : 0;
    const expenseChange = prevMonth ? ((totalExpense - prevMonth.total_expense) / prevMonth.total_expense) * 100 : 0;
    const profitChange = prevMonth ? ((netProfit - prevMonth.net_profit) / Math.abs(prevMonth.net_profit)) * 100 : 0;

    // 저장
    const statement = {
      company_id: companyId,
      period_type: 'MONTHLY',
      period_start: format(startDate, 'yyyy-MM-dd'),
      period_end: format(endDate, 'yyyy-MM-dd'),
      total_revenue: totalRevenue,
      total_expense: totalExpense,
      payroll_expense: payrollExpense,
      expense_by_category: expenseByCategory,
      net_profit: netProfit,
      profit_margin: profitMargin,
      revenue_change: revenueChange,
      expense_change: expenseChange,
      profit_change: profitChange
    };

    await supabase.from('profit_loss_statements').upsert(statement);

    return statement;
  }
}
```

### Task 5.3.2: 손익계산서 페이지 완성
```typescript
// 파일: apps/admin/src/app/business/profit-loss/page.tsx

export default function ProfitLossPage() {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const { data: statement } = useProfitLossStatement(selectedMonth);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">손익계산서</h1>
        <div className="flex gap-2">
          <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
          <Button onClick={() => downloadPDF(statement)}>
            <Download className="mr-2 h-4 w-4" />
            PDF 다운로드
          </Button>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-4">
        <MetricCard
          title="총 매출"
          value={statement?.total_revenue}
          change={statement?.revenue_change}
        />
        <MetricCard
          title="총 비용"
          value={statement?.total_expense}
          change={statement?.expense_change}
          invertChange
        />
        <MetricCard
          title="순이익"
          value={statement?.net_profit}
          change={statement?.profit_change}
          highlighted
        />
      </div>

      {/* 비용 구조 차트 */}
      <Card>
        <CardHeader>
          <CardTitle>비용 구조</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <PieChart data={statement?.expense_by_category} />
            <div>
              {Object.entries(statement?.expense_by_category || {}).map(([cat, amount]) => (
                <div key={cat} className="flex justify-between py-2 border-b">
                  <span>{cat}</span>
                  <span>{amount.toLocaleString()}원</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI 개선 제안 */}
      <AIRecommendations statement={statement} />
    </div>
  );
}
```

### Task 5.3.3: AI 개선 제안
```typescript
// 파일: apps/admin/src/components/business/ai-recommendations.tsx

export function AIRecommendations({ statement }: { statement: ProfitLossStatement }) {
  const recommendations = useMemo(() => {
    const recs: Recommendation[] = [];

    // 인건비 비율 체크
    const payrollRatio = (statement.payroll_expense / statement.total_revenue) * 100;
    if (payrollRatio > 35) {
      recs.push({
        icon: '💰',
        title: '인건비 최적화',
        description: `인건비 비율이 ${payrollRatio.toFixed(1)}%로 업계 평균(35%)보다 높습니다. 한가한 시간대 인력 조정을 검토해보세요.`,
        action: '스케줄 분석'
      });
    }

    // 재료비 비율 체크
    const materialRatio = ((statement.expense_by_category['재료비'] || 0) / statement.total_revenue) * 100;
    if (materialRatio > 40) {
      recs.push({
        icon: '📦',
        title: '재료비 절감',
        description: `재료비 비율이 ${materialRatio.toFixed(1)}%입니다. 업체별 단가 비교를 해보세요.`,
        action: '업체 비교'
      });
    }

    // 이익률 체크
    if (statement.profit_margin < 10) {
      recs.push({
        icon: '📊',
        title: '이익률 개선 필요',
        description: `이익률이 ${statement.profit_margin.toFixed(1)}%로 낮습니다. 매출 증대 또는 비용 절감이 필요합니다.`,
        action: '상세 분석'
      });
    }

    return recs;
  }, [statement]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>💡 AI 개선 제안</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recommendations.map((rec, idx) => (
            <div key={idx} className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg">
              <span className="text-2xl">{rec.icon}</span>
              <div className="flex-1">
                <h4 className="font-semibold">{rec.title}</h4>
                <p className="text-sm text-slate-600">{rec.description}</p>
              </div>
              <Button variant="outline" size="sm">{rec.action}</Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

---

# Phase 6: HACCP 고도화

## 6.1 자동화 기능

### Task 6.1.1: IoT 센서 연동
```typescript
// 파일: apps/admin/src/lib/services/iot-sensor.service.ts

export class IoTSensorService {
  // BLE 센서 검색
  async scanBLESensors(): Promise<Sensor[]> {}

  // 센서 연결
  async connectSensor(sensorId: string): Promise<void> {}

  // 센서 데이터 구독
  subscribeSensorData(sensorId: string, callback: (data: SensorData) => void): void {}

  // CCP 자동 기록
  async autoRecordCCP(sensorData: SensorData): Promise<void> {
    const ccpDef = await getCCPBySensor(sensorData.sensorId);

    const isWithinLimit =
      sensorData.value >= ccpDef.critical_limit.min &&
      sensorData.value <= ccpDef.critical_limit.max;

    await supabase.from('ccp_records').insert({
      ccp_id: ccpDef.id,
      record_date: format(new Date(), 'yyyy-MM-dd'),
      record_time: format(new Date(), 'HH:mm:ss'),
      measurement: {
        value: sensorData.value,
        unit: ccpDef.critical_limit.unit,
        result: isWithinLimit ? 'PASS' : 'FAIL'
      }
    });

    // 한계 초과시 알림
    if (!isWithinLimit) {
      await pushService.sendToRole('HACCP_MANAGER', {
        title: '🚨 CCP 한계 초과',
        body: `${ccpDef.process}: ${sensorData.value}${ccpDef.critical_limit.unit}`,
        priority: 'CRITICAL'
      });
    }
  }
}
```

### Task 6.1.2: 자동 점검 리마인더
```typescript
// 파일: apps/admin/src/app/api/cron/haccp-reminder/route.ts

export async function GET() {
  const now = new Date();
  const currentHour = now.getHours();

  // 일일 점검 리마인더 (08:00, 14:00, 22:00)
  if ([8, 14, 22].includes(currentHour)) {
    const shift = currentHour === 8 ? '오전' : currentHour === 14 ? '오후' : '야간';

    // 아직 점검 안 된 회사들
    const uncheckedCompanies = await getUncheckedCompanies('daily', shift);

    for (const company of uncheckedCompanies) {
      await pushService.sendToRole('HACCP_STAFF', {
        title: '일일 위생 점검 필요',
        body: `${shift} 교대 위생 점검을 완료해주세요.`,
        category: 'HACCP'
      }, company.id);
    }
  }

  // 주간 점검 리마인더 (월요일 09:00)
  if (now.getDay() === 1 && currentHour === 9) {
    // 방충/방서 점검 리마인더
    await sendWeeklyCheckReminder();
  }

  // 월간 검증 리마인더 (1일 09:00)
  if (now.getDate() === 1 && currentHour === 9) {
    await sendMonthlyVerificationReminder();
  }

  return Response.json({ success: true });
}
```

### Task 6.1.3: AI 이상 감지
```typescript
// 파일: apps/admin/src/lib/services/haccp-anomaly-detection.service.ts

export class HACCPAnomalyDetectionService {
  // CCP 트렌드 분석
  async analyzeCCPTrend(ccpId: string, days: number = 7): Promise<TrendAnalysis> {
    const records = await getCCPRecords(ccpId, days);

    const values = records.map(r => r.measurement.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const std = Math.sqrt(values.map(v => Math.pow(v - mean, 2)).reduce((a, b) => a + b, 0) / values.length);

    const latestValue = values[values.length - 1];
    const zScore = (latestValue - mean) / std;

    // 2σ 벗어나면 경고
    if (Math.abs(zScore) > 2) {
      return {
        status: 'WARNING',
        message: `측정값이 평균에서 ${zScore.toFixed(1)}σ 벗어났습니다.`,
        recommendation: '점검이 필요합니다.'
      };
    }

    // 연속 상승/하락 감지
    const trend = this.detectTrend(values);
    if (trend !== 'STABLE') {
      return {
        status: 'ATTENTION',
        message: `측정값이 연속 ${trend === 'RISING' ? '상승' : '하락'} 중입니다.`,
        recommendation: '추이를 주시해주세요.'
      };
    }

    return { status: 'NORMAL' };
  }

  // 불량률 예측
  async predictDefectRate(companyId: string): Promise<DefectPrediction> {
    const records = await getProductionRecords(companyId, 30);

    const defectRates = records.map(r => r.quality.defect_rate);
    const movingAvg = this.calculate7DayMovingAverage(defectRates);

    if (movingAvg > 2) {
      return {
        predicted: movingAvg,
        alert: true,
        message: '7일 평균 불량률이 2%를 초과했습니다.'
      };
    }

    return { predicted: movingAvg, alert: false };
  }
}
```

## 6.2 심사 대비 기능

### Task 6.2.1: HACCP 심사 준비 리포트
```typescript
// 파일: apps/admin/src/app/api/haccp/audit-report/route.ts

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate')!;
  const endDate = searchParams.get('endDate')!;

  const report = {
    period: { startDate, endDate },

    // 일일 점검 완료율
    dailyHygieneChecks: await getDailyCheckStats(startDate, endDate),

    // CCP 모니터링 기록
    ccpRecords: await getCCPStats(startDate, endDate),

    // 부적합 및 개선조치
    nonConformances: await getNonConformanceStats(startDate, endDate),

    // 입고검사 기록
    materialInspections: await getInspectionStats(startDate, endDate),

    // 생산/출하 기록
    productionRecords: await getProductionStats(startDate, endDate),

    // CCP 검증 (월간)
    ccpVerifications: await getVerificationStats(startDate, endDate),

    // 교육 이력
    trainingRecords: await getTrainingStats(startDate, endDate)
  };

  return Response.json(report);
}
```

### Task 6.2.2: 개선조치 워크플로우
```typescript
// 파일: apps/admin/src/lib/services/corrective-action.service.ts

export class CorrectiveActionService {
  // 부적합 발생 시 개선조치 생성
  async createFromNonConformance(nonConformanceId: string): Promise<CorrectiveAction> {
    const nc = await getNonConformance(nonConformanceId);

    return await supabase.from('corrective_actions').insert({
      non_conformance_id: nonConformanceId,
      status: 'IMMEDIATE_ACTION',
      workflow: [
        { step: 'IMMEDIATE_ACTION', status: 'IN_PROGRESS', dueDate: addHours(new Date(), 4) },
        { step: 'ROOT_CAUSE_ANALYSIS', status: 'PENDING', dueDate: addDays(new Date(), 2) },
        { step: 'CORRECTIVE_ACTION', status: 'PENDING', dueDate: addDays(new Date(), 7) },
        { step: 'VERIFICATION', status: 'PENDING', dueDate: addDays(new Date(), 14) },
        { step: 'CLOSURE', status: 'PENDING' }
      ]
    });
  }

  // 단계 진행
  async progressStep(actionId: string, stepData: StepData): Promise<void> {
    const action = await getCorrectiveAction(actionId);
    const currentStepIdx = action.workflow.findIndex(w => w.status === 'IN_PROGRESS');

    // 현재 단계 완료
    action.workflow[currentStepIdx].status = 'COMPLETED';
    action.workflow[currentStepIdx].completedAt = new Date();
    action.workflow[currentStepIdx].data = stepData;

    // 다음 단계 시작
    if (currentStepIdx < action.workflow.length - 1) {
      action.workflow[currentStepIdx + 1].status = 'IN_PROGRESS';
      action.status = action.workflow[currentStepIdx + 1].step;
    } else {
      action.status = 'CLOSED';
      action.closedAt = new Date();
    }

    await updateCorrectiveAction(actionId, action);
  }
}
```

---

# Phase 7: 플랫폼 관리/결제

## 7.1 플랫폼 관리자 대시보드

### Task 7.1.1: 플랫폼 관리자 앱 구조
```
apps/platform-admin/
├── src/
│   ├── app/
│   │   ├── companies/          # 회사 관리
│   │   ├── subscriptions/      # 구독 관리
│   │   ├── labor-law/          # 근로기준법 관리
│   │   ├── analytics/          # 통계
│   │   └── settings/           # 시스템 설정
```

### Task 7.1.2: 회사 목록/관리
```typescript
// 파일: apps/platform-admin/src/app/companies/page.tsx

export default function CompaniesPage() {
  const { data: companies } = useCompanies();

  return (
    <div>
      <h1>회사 관리</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>회사명</TableHead>
            <TableHead>플랜</TableHead>
            <TableHead>직원 수</TableHead>
            <TableHead>매장 수</TableHead>
            <TableHead>상태</TableHead>
            <TableHead>가입일</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {companies?.map(company => (
            <TableRow key={company.id}>
              <TableCell>{company.name}</TableCell>
              <TableCell><Badge>{company.plan}</Badge></TableCell>
              <TableCell>{company.employeeCount}/{company.maxEmployees}</TableCell>
              <TableCell>{company.storeCount}/{company.maxStores}</TableCell>
              <TableCell>{company.status}</TableCell>
              <TableCell>{format(company.created_at, 'yyyy-MM-dd')}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

### Task 7.1.3: 근로기준법 관리
```typescript
// 파일: apps/platform-admin/src/app/labor-law/page.tsx

export default function LaborLawPage() {
  const { data: versions } = useLaborLawVersions();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <h1 className="text-2xl font-bold">근로기준법 관리</h1>
        <Button onClick={() => setIsCreateOpen(true)}>
          + 신규 버전 추가
        </Button>
      </div>

      {/* 현재 적용 중인 법령 */}
      <Card>
        <CardHeader>
          <CardTitle>현재 적용 중</CardTitle>
        </CardHeader>
        <CardContent>
          {versions?.find(v => v.status === 'ACTIVE') && (
            <LaborLawDetail version={versions.find(v => v.status === 'ACTIVE')!} />
          )}
        </CardContent>
      </Card>

      {/* 예정된 업데이트 */}
      <Card>
        <CardHeader>
          <CardTitle>예정된 업데이트</CardTitle>
        </CardHeader>
        <CardContent>
          {versions?.filter(v => v.status === 'VERIFIED').map(version => (
            <LaborLawDetail key={version.id} version={version} />
          ))}
        </CardContent>
      </Card>

      {/* 신규 버전 생성 모달 */}
      <CreateLaborLawModal open={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
    </div>
  );
}
```

## 7.2 결제 시스템 (Stripe)

### Task 7.2.1: Stripe 연동
```typescript
// 파일: apps/admin/src/lib/services/stripe.service.ts

import Stripe from 'stripe';

export class StripeService {
  private stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  async createCustomer(email: string, name: string): Promise<string> {
    const customer = await this.stripe.customers.create({ email, name });
    return customer.id;
  }

  async createSubscription(customerId: string, priceId: string): Promise<Stripe.Subscription> {
    return await this.stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent']
    });
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    await this.stripe.subscriptions.cancel(subscriptionId);
  }

  async changePlan(subscriptionId: string, newPriceId: string): Promise<void> {
    const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
    await this.stripe.subscriptions.update(subscriptionId, {
      items: [{
        id: subscription.items.data[0].id,
        price: newPriceId
      }]
    });
  }
}
```

### Task 7.2.2: 구독 관리 페이지
```typescript
// 파일: apps/admin/src/app/settings/subscription/page.tsx

export default function SubscriptionPage() {
  const { data: subscription } = useSubscription();
  const { data: plans } = usePlans();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">구독 관리</h1>

      {/* 현재 플랜 */}
      <Card>
        <CardHeader>
          <CardTitle>현재 플랜</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold">{subscription?.plan_name}</h3>
              <p className="text-slate-600">
                다음 결제일: {format(subscription?.current_period_end, 'yyyy-MM-dd')}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">
                {subscription?.price?.toLocaleString()}원/월
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 플랜 비교 */}
      <h2 className="text-xl font-semibold">플랜 변경</h2>
      <div className="grid grid-cols-3 gap-4">
        {plans?.map(plan => (
          <PlanCard
            key={plan.id}
            plan={plan}
            isCurrent={plan.id === subscription?.plan_id}
            onSelect={() => changePlan(plan.id)}
          />
        ))}
      </div>

      {/* 결제 수단 */}
      <Card>
        <CardHeader>
          <CardTitle>결제 수단</CardTitle>
        </CardHeader>
        <CardContent>
          <PaymentMethodForm />
        </CardContent>
      </Card>

      {/* 결제 이력 */}
      <Card>
        <CardHeader>
          <CardTitle>결제 이력</CardTitle>
        </CardHeader>
        <CardContent>
          <PaymentHistoryTable />
        </CardContent>
      </Card>
    </div>
  );
}
```

### Task 7.2.3: Stripe Webhook
```typescript
// 파일: apps/admin/src/app/api/webhooks/stripe/route.ts

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature')!;

  const event = stripe.webhooks.constructEvent(
    body,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!
  );

  switch (event.type) {
    case 'invoice.paid':
      await handleInvoicePaid(event.data.object);
      break;
    case 'invoice.payment_failed':
      await handlePaymentFailed(event.data.object);
      break;
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object);
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionCancelled(event.data.object);
      break;
  }

  return Response.json({ received: true });
}
```

---

# Phase 8: 모바일 앱 개발

## 8.1 React Native 프로젝트 설정

### Task 8.1.1: Expo 프로젝트 생성
```bash
# 명령어
cd apps
npx create-expo-app@latest mobile --template blank-typescript
cd mobile
npx expo install expo-camera expo-location expo-notifications expo-haptics @react-navigation/native @react-navigation/bottom-tabs react-native-gesture-handler react-native-reanimated
```

### Task 8.1.2: 프로젝트 구조
```
apps/mobile/
├── src/
│   ├── screens/
│   │   ├── HomeScreen.tsx
│   │   ├── AttendanceScreen.tsx
│   │   ├── QRScanScreen.tsx
│   │   ├── SalaryScreen.tsx
│   │   ├── ScheduleScreen.tsx
│   │   ├── MoreScreen.tsx
│   │   └── ...
│   ├── components/
│   │   ├── BigButton.tsx
│   │   ├── Card.tsx
│   │   ├── StatCard.tsx
│   │   └── ...
│   ├── navigation/
│   │   ├── TabNavigator.tsx
│   │   └── AppNavigator.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useNotifications.ts
│   │   └── ...
│   ├── services/
│   │   ├── api.ts
│   │   ├── push.ts
│   │   └── offline.ts
│   └── store/
│       └── index.ts
├── app.json
└── package.json
```

## 8.2 핵심 화면 구현

### Task 8.2.1: 직원 홈 화면
```typescript
// 파일: apps/mobile/src/screens/HomeScreen.tsx

export function HomeScreen() {
  const { data: todayAttendance } = useTodayAttendance();
  const { data: stats } = useMonthlyStats();
  const { data: schedule } = useWeeklySchedule();

  return (
    <ScrollView style={styles.container}>
      {/* 오늘 출퇴근 카드 */}
      <Card style={styles.attendanceCard}>
        {!todayAttendance?.check_in ? (
          <BigButton onPress={navigateToQRScan}>
            🟢 출근하기
          </BigButton>
        ) : !todayAttendance?.check_out ? (
          <>
            <Text>출근 시간: {format(todayAttendance.check_in, 'HH:mm')}</Text>
            <BigButton onPress={handleCheckOut} variant="danger">
              🔴 퇴근하기
            </BigButton>
          </>
        ) : (
          <Text style={styles.completed}>✅ 오늘 근무 완료</Text>
        )}
      </Card>

      {/* 이번 달 통계 */}
      <View style={styles.statsRow}>
        <StatCard label="근무일" value={stats?.workDays} />
        <StatCard label="근무시간" value={`${stats?.totalHours}h`} />
        <StatCard label="예상급여" value={`₩${stats?.estimatedSalary?.toLocaleString()}`} />
      </View>

      {/* 빠른 작업 */}
      <View style={styles.quickActions}>
        <QuickActionButton icon="🏖️" label="휴가 신청" onPress={() => {}} />
        <QuickActionButton icon="⏰" label="초과근무" onPress={() => {}} />
        <QuickActionButton icon="💌" label="메시지" onPress={() => {}} />
        <QuickActionButton icon="📋" label="공지사항" onPress={() => {}} />
      </View>

      {/* 이번 주 스케줄 */}
      <Text style={styles.sectionTitle}>이번 주 스케줄</Text>
      <WeeklyScheduleList schedule={schedule} />
    </ScrollView>
  );
}
```

### Task 8.2.2: QR 스캔 화면
```typescript
// 파일: apps/mobile/src/screens/QRScanScreen.tsx

export function QRScanScreen() {
  const [scanned, setScanned] = useState(false);
  const navigation = useNavigation();

  const handleBarCodeScanned = async ({ data }: BarCodeScannerResult) => {
    if (scanned) return;
    setScanned(true);

    try {
      // 위치 가져오기
      const location = await Location.getCurrentPositionAsync();

      // 출근 API 호출
      const result = await api.post('/attendance/checkin', {
        qrToken: data.replace('abcstaff://checkin/', ''),
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      });

      // 햅틱 피드백
      await Haptics.notificationAsync(
        result.success
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Error
      );

      if (result.success) {
        Alert.alert('출근 완료!', result.isLate ? '지각 처리되었습니다.' : '정상 출근입니다.');
        navigation.goBack();
      } else {
        Alert.alert('오류', result.error);
        setScanned(false);
      }
    } catch (error) {
      Alert.alert('오류', '출근 처리 중 오류가 발생했습니다.');
      setScanned(false);
    }
  };

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFillObject}
        onBarCodeScanned={handleBarCodeScanned}
        barCodeScannerSettings={{
          barCodeTypes: [BarCodeScanner.Constants.BarCodeType.qr]
        }}
      />
      <View style={styles.overlay}>
        <View style={styles.scanArea}>
          <View style={styles.cornerTL} />
          <View style={styles.cornerTR} />
          <View style={styles.cornerBL} />
          <View style={styles.cornerBR} />
        </View>
        <Text style={styles.guideText}>매장 QR 코드를 스캔하세요</Text>
      </View>
    </View>
  );
}
```

### Task 8.2.3: 급여 조회 화면
```typescript
// 파일: apps/mobile/src/screens/SalaryScreen.tsx

export function SalaryScreen() {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const { data: salary } = useSalary(selectedMonth);

  return (
    <ScrollView style={styles.container}>
      {/* 월 선택 */}
      <MonthSelector value={selectedMonth} onChange={setSelectedMonth} />

      {/* 급여 요약 카드 */}
      <Card style={styles.summaryCard}>
        <Text style={styles.label}>실수령액</Text>
        <Text style={styles.bigAmount}>
          {salary?.net_pay?.toLocaleString()}원
        </Text>
        <Text style={styles.status}>
          {salary?.status === 'CONFIRMED' ? '✅ 확정됨' : '⏳ 계산 중'}
        </Text>
      </Card>

      {/* 지급 내역 */}
      <Card>
        <Text style={styles.cardTitle}>지급 내역</Text>
        <DetailRow label="기본급" value={salary?.base_salary} />
        <DetailRow label="연장근로수당" value={salary?.overtime_pay} />
        <DetailRow label="야간근로수당" value={salary?.night_pay} />
        <DetailRow label="주휴수당" value={salary?.weekly_holiday_pay} />
        <DetailRow label="식대" value={salary?.meal_allowance} />
        <Divider />
        <DetailRow label="총 지급액" value={salary?.total_gross_pay} bold />
      </Card>

      {/* 공제 내역 */}
      <Card>
        <Text style={styles.cardTitle}>공제 내역</Text>
        <DetailRow label="국민연금" value={salary?.national_pension} negative />
        <DetailRow label="건강보험" value={salary?.health_insurance} negative />
        <DetailRow label="고용보험" value={salary?.employment_insurance} negative />
        <DetailRow label="소득세" value={salary?.income_tax} negative />
        <DetailRow label="지방소득세" value={salary?.local_income_tax} negative />
        <Divider />
        <DetailRow label="총 공제액" value={salary?.total_deductions} negative bold />
      </Card>

      {/* PDF 다운로드 */}
      <Button onPress={() => downloadPayslip(salary?.id)}>
        급여명세서 다운로드
      </Button>
    </ScrollView>
  );
}
```

## 8.3 푸시 알림 연동

### Task 8.3.1: FCM 설정
```typescript
// 파일: apps/mobile/src/services/push.ts

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true
  })
});

export async function registerForPushNotifications() {
  if (!Device.isDevice) return;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return;
  }

  const token = (await Notifications.getExpoPushTokenAsync()).data;

  // 서버에 토큰 등록
  await api.post('/notifications/register-token', { fcmToken: token });

  return token;
}

export function usePushNotifications() {
  useEffect(() => {
    registerForPushNotifications();

    // 알림 클릭 리스너
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const deepLink = response.notification.request.content.data?.deepLink;
      if (deepLink) {
        // 딥링크 처리
        Linking.openURL(`abcstaff://${deepLink}`);
      }
    });

    return () => subscription.remove();
  }, []);
}
```

## 8.4 오프라인 지원

### Task 8.4.1: 오프라인 큐
```typescript
// 파일: apps/mobile/src/services/offline.ts

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

class OfflineQueue {
  private readonly QUEUE_KEY = 'offline_queue';

  async enqueue(action: OfflineAction) {
    const queue = await this.getQueue();
    queue.push({ ...action, id: Date.now().toString(), createdAt: new Date() });
    await AsyncStorage.setItem(this.QUEUE_KEY, JSON.stringify(queue));
  }

  async getQueue(): Promise<OfflineAction[]> {
    const data = await AsyncStorage.getItem(this.QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  }

  async processQueue() {
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) return;

    const queue = await this.getQueue();
    const processed: string[] = [];

    for (const action of queue) {
      try {
        await api.post(action.endpoint, action.data);
        processed.push(action.id);
      } catch (error) {
        console.error('Failed to process offline action:', error);
      }
    }

    // 처리된 항목 제거
    const remaining = queue.filter(a => !processed.includes(a.id));
    await AsyncStorage.setItem(this.QUEUE_KEY, JSON.stringify(remaining));
  }
}

export const offlineQueue = new OfflineQueue();

// 네트워크 상태 변경시 자동 동기화
NetInfo.addEventListener(state => {
  if (state.isConnected) {
    offlineQueue.processQueue();
  }
});
```

---

# Phase 9: 테스트/최적화/배포

## 9.1 테스트

### Task 9.1.1: 단위 테스트
```typescript
// 파일: apps/admin/src/lib/services/__tests__/salary-calculation.test.ts

describe('SalaryCalculationService', () => {
  const service = new SalaryCalculationService();

  describe('calculateOvertimePay', () => {
    it('should calculate overtime pay at 1.5x rate', () => {
      const result = service.calculateOvertimePay(10, 10000, 1.5);
      expect(result).toBe(150000); // 10시간 * 10000원 * 1.5
    });
  });

  describe('calculateWeeklyHolidayPay', () => {
    it('should return 0 for less than 15 hours', () => {
      const result = service.calculateWeeklyHolidayPay(14, 10000);
      expect(result).toBe(0);
    });

    it('should calculate weekly holiday pay for 15+ hours', () => {
      const result = service.calculateWeeklyHolidayPay(40, 10000);
      expect(result).toBe(80000); // 8시간 * 10000원
    });
  });
});
```

### Task 9.1.2: E2E 테스트
```typescript
// 파일: apps/admin/e2e/salary.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Salary Management', () => {
  test('should calculate and confirm salary', async ({ page }) => {
    await page.goto('/salaries');

    // 급여 계산 버튼 클릭
    await page.click('button:has-text("급여 계산")');

    // 계산 완료 확인
    await expect(page.locator('.salary-calculated')).toBeVisible();

    // 확정 버튼 클릭
    await page.click('button:has-text("확정")');

    // 확정 완료 확인
    await expect(page.locator('.status-confirmed')).toBeVisible();
  });
});
```

## 9.2 배포

### Task 9.2.1: Vercel 배포 설정
```json
// 파일: vercel.json
{
  "buildCommand": "turbo run build",
  "outputDirectory": "apps/admin/.next",
  "crons": [
    { "path": "/api/cron/sync-toss-pos", "schedule": "0 * * * *" },
    { "path": "/api/cron/send-tax-report", "schedule": "0 9 * * *" },
    { "path": "/api/cron/apply-law-updates", "schedule": "0 0 * * *" },
    { "path": "/api/cron/haccp-reminder", "schedule": "0 8,14,22 * * *" }
  ]
}
```

### Task 9.2.2: 모바일 앱 빌드
```bash
# iOS
eas build --platform ios --profile production

# Android
eas build --platform android --profile production

# 스토어 제출
eas submit --platform ios
eas submit --platform android
```

---

# 체크리스트

## Phase 1: 핵심 인프라 ☐
- [ ] 데이터베이스 마이그레이션 실행
- [ ] PDF 생성 유틸리티 구현
- [ ] 이메일 서비스 구현
- [ ] FCM 푸시 서비스 구현
- [ ] 엑셀 생성 유틸리티 구현

## Phase 2: 급여/계약 ☐
- [ ] 급여 자동 계산 서비스
- [ ] 급여 명세서 PDF
- [ ] 급여 이메일 발송
- [ ] 계약서 PDF 생성
- [ ] 전자서명 컴포넌트
- [ ] 세무대리인 연동

## Phase 3: 출퇴근/스케줄 ☐
- [ ] QR 코드 생성
- [ ] QR 스캔 출퇴근
- [ ] 지오펜스 검증
- [ ] 계약서 기반 스케줄 생성
- [ ] 스케줄 교환 기능

## Phase 4: 승인/알림 ☐
- [ ] 확장 승인 유형 (구매/폐기/사직)
- [ ] 금액별 승인 라인
- [ ] 순차 승인 처리
- [ ] 알림 센터 UI
- [ ] FCM 연동 완료

## Phase 5: PRO 경영관리 ☐
- [ ] 토스 POS OAuth
- [ ] 매출 자동 동기화
- [ ] 오픈뱅킹 연동
- [ ] AI 비용 분류
- [ ] 손익계산서 자동 생성
- [ ] AI 개선 제안

## Phase 6: HACCP 고도화 ☐
- [ ] IoT 센서 연동
- [ ] 자동 점검 리마인더
- [ ] AI 이상 감지
- [ ] 심사 준비 리포트
- [ ] 개선조치 워크플로우

## Phase 7: 플랫폼/결제 ☐
- [ ] 플랫폼 관리자 대시보드
- [ ] 회사 관리 기능
- [ ] 근로기준법 관리 UI
- [ ] Stripe 연동
- [ ] 구독 관리 페이지

## Phase 8: 모바일 앱 ☐
- [ ] Expo 프로젝트 설정
- [ ] 홈 화면
- [ ] QR 스캔 화면
- [ ] 급여 조회 화면
- [ ] 스케줄 화면
- [ ] 푸시 알림 연동
- [ ] 오프라인 지원

## Phase 9: 배포 ☐
- [ ] 단위 테스트 작성
- [ ] E2E 테스트 작성
- [ ] Vercel 배포
- [ ] iOS 앱 스토어 제출
- [ ] Android 플레이스토어 제출

---

**총 예상 작업량**: 약 200개 Task
**총 예상 기간**: 12주

---

**문서 끝**
