# ABC Staff System v2.0 - 실무 중심 기능명세서

> **문서 버전**: 2.0 (Revised)  
> **작성일**: 2026-01-09  
> **목적**: 실무에 최적화된 확장 가능한 직원 관리 시스템

---

## 📋 목차

1. [시스템 개요](#1-시스템-개요)
2. [역할 및 권한](#2-역할-및-권한)
3. [핵심 기능 상세](#3-핵심-기능-상세)
4. [데이터베이스 설계](#4-데이터베이스-설계)
5. [UI/UX 가이드](#5-uiux-가이드)
6. [확장성 설계](#6-확장성-설계)
7. [개발 로드맵](#7-개발-로드맵)

---

## 1. 시스템 개요

### 1.1 핵심 개선 방향

```
🎯 5대 핵심 원칙
├─ 1. 계약의 정확성: 누락 없는 완벽한 계약서
├─ 2. 세무 연동: 세무대리인 자동 전송
├─ 3. 계층 분리: 회사>브랜드>매장 명확한 구분
├─ 4. 승인 체계: 모든 의사결정 승인 프로세스
└─ 5. 확장 대비: 발주 시스템 연동 준비
```

### 1.2 비용 최적화 인프라

```yaml
🎯 월 예상 비용: $20~50 (초기 100명 기준)

# 옵션 1: Supabase 중심 (가장 간단, 추천)
Database: Supabase (PostgreSQL 호스팅)
  - 무료: 500MB DB, 1GB 파일 저장, 50,000 월간 활성 사용자
  - Pro: $25/월 - 8GB DB, 100GB 파일, 100,000 사용자
  - 장점: PostgreSQL + Auth + Storage + Realtime 통합
  - Row Level Security 기본 지원

Backend: Vercel (Next.js API Routes)
  - 무료: Hobby tier
  - Pro: $20/월 - 상용 사용 가능
  - 장점: 자동 배포, Edge Functions, 무제한 대역폭

Frontend: Vercel (Next.js)
  - Backend와 동일

Mobile: Expo (React Native)
  - 무료: 빌드 및 배포
  - 비용: Apple Developer ($99/년) + Google Play ($25 일회성)

File Storage: Supabase Storage
  - Database와 통합

Push Notifications: Firebase Cloud Messaging (FCM)
  - 완전 무료
  - 속도: 평균 1초 이내 도달 (Google 인프라)
  - 신뢰성: 99.9% 전달률
  - 배치 전송: 500개/초 가능
  - 장점: Google이 직접 운영, 안정적
  - 단점: 중국에서 차단됨 (국내 사용은 문제 없음)
  
  대안 (필요시):
  - OneSignal: 무료 tier 있음, 대시보드 제공
  - Pusher Beams: 유료 ($49/월~)
  - 자체 구축: WebSocket + Redis Pub/Sub (복잡함)

총 예상 비용 (Pro):
  - Supabase Pro: $25/월
  - Vercel Pro: $20/월
  - 합계: $45/월 (약 60,000원)

# 옵션 2: 최저 비용 (VPS 자체 호스팅)
Server: Hetzner VPS
  - CPX21 (3 vCPU, 4GB RAM): €5.83/월 (약 8,500원)
  - CPX31 (4 vCPU, 8GB RAM): €11.90/월 (약 17,000원)
  - 장점: 가장 저렴, 전체 제어

Database: 자체 PostgreSQL
  - 서버에 직접 설치 (추가 비용 없음)
  - 백업: Hetzner Storage Box (100GB €3.81/월)

File Storage: 자체 MinIO
  - 서버에 직접 설치 (추가 비용 없음)

Domain: Cloudflare
  - 무료 CDN + DNS + SSL

총 예상 비용:
  - Hetzner CPX31: €11.90/월
  - Storage Box: €3.81/월
  - Domain: $10/년
  - 합계: ~€16/월 (약 23,000원)

# 옵션 3: 중간 (관리형 + 자체 호스팅 혼합)
Database: Railway PostgreSQL
  - Starter: $5/월 (1GB RAM, 1GB 디스크)
  - Developer: $20/월 (8GB RAM, 100GB 디스크)
  - 장점: 자동 백업, 쉬운 관리

Backend: Railway
  - Database와 동일 플랫폼

File Storage: Cloudflare R2
  - $0.015/GB 저장 (10GB = $0.15/월)
  - 무료 egress (다운로드 비용 없음)

총 예상 비용:
  - Railway Developer: $20/월
  - R2 Storage: ~$1/월
  - 합계: $21/월 (약 28,000원)
```

### 1.4 애플리케이션 구조

```
📱 4개의 독립된 애플리케이션

1. 🌐 랜딩페이지 (공개)
   - 주소: https://abcstaff.com
   - 목적: 신규 고객 유치 (멀티테넌트)
   - 기능: 
     * 서비스 소개
     * 요금제 안내
     * 무료 체험 신청
     * 고객 후기
     * FAQ
   - 기술: Next.js (Static Export)
   - 호스팅: Vercel

2. 🔧 플랫폼 대시보드 (super_admin 전용)
   - 주소: https://admin.abcstaff.com
   - 사용자: 플랫폼 운영자
   - 기능:
     * 전체 회사 목록 및 관리
     * 구독 관리 (요금제, 결제)
     * 사용량 모니터링
     * 근로기준법 업데이트 관리
     * 시스템 설정
     * 통계 대시보드
   - 기술: Next.js + PostgreSQL RLS
   - 인증: Supabase Auth (role=platform_admin)

3. 💼 관리자 대시보드 (회사 관리자용)
   - 주소: https://app.abcstaff.com
   - 사용자: 회사 관리자, 본사 관리자, 매장 관리자
   - 기능:
     * 직원 관리
     * 출퇴근 현황
     * 급여 관리
     * 스케줄 관리
     * 승인 처리
     * 계약서 작성
     * 매장/브랜드 관리
   - 기술: Next.js + PostgreSQL RLS
   - 인증: Supabase Auth (company별 격리)

4. 📱 직원 모바일 앱
   - iOS/Android
   - 사용자: 일반 직원
   - 기능:
     * 출퇴근 QR 체크
     * 내 급여 조회
     * 내 스케줄 확인
     * 휴가/초과근무 신청
     * 메시지 확인
   - 기술: React Native (Expo)
   - 인증: Supabase Auth

데이터 격리:
┌─────────────────────────────────────┐
│ 플랫폼 DB (PostgreSQL + RLS)        │
├─────────────────────────────────────┤
│ 회사 A (company_id=1)                │
│   ├─ 브랜드 1 → 매장 1,2,3          │
│   └─ 브랜드 2 → 매장 4,5            │
├─────────────────────────────────────┤
│ 회사 B (company_id=2)                │
│   └─ 브랜드 1 → 매장 1              │
└─────────────────────────────────────┘

RLS로 완벽한 데이터 격리 보장
```



```yaml
# 프론트엔드
Web: Next.js 14 + TypeScript + Tailwind CSS
Mobile: React Native (Expo)
UI: shadcn/ui (웹), React Native Paper (모바일)
State: Zustand + React Query

# 백엔드
Framework: Next.js API Routes (서버리스) 또는 NestJS (VPS)
Language: TypeScript
Validation: Zod

# 데이터베이스
Primary: PostgreSQL 16 (Supabase 또는 자체 호스팅)
Cache: Redis (선택사항, 트래픽 많을 때)
File: Supabase Storage 또는 MinIO

# 인증
Supabase Auth 또는 NextAuth.js

# 푸시
Firebase Cloud Messaging (FCM)

# 결제 (구독)
Stripe 또는 Tosspayments

# 모니터링
무료: Vercel Analytics
유료: Sentry (에러 트래킹)

# CI/CD
GitHub Actions (무료)
```

### 1.3 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│                    프론트엔드                            │
│  웹 대시보드 (관리자)          모바일 앱 (직원)         │
└────────────────┬────────────────────────────────────────┘
                 │
┌────────────────┴────────────────────────────────────────┐
│                  API Gateway (인증/라우팅)               │
└────────────────┬────────────────────────────────────────┘
                 │
┌────────────────┴────────────────────────────────────────┐
│                 핵심 서비스 (NestJS)                     │
├─────────────────────────────────────────────────────────┤
│ • 인증/권한    • 직원관리    • 출퇴근    • 급여        │
│ • 계약서       • 승인관리    • 스케줄    • 세무연동    │
│ • 브랜드/매장  • 알림        • 메시지    • 공지사항    │
└────────────────┬────────────────────────────────────────┘
                 │
┌────────────────┴────────────────────────────────────────┐
│              PostgreSQL (주 데이터베이스)                │
│  + Redis (캐시)  + MinIO (파일)                         │
└─────────────────────────────────────────────────────────┘
```

---

## 2. 역할 및 권한

### 2.1 역할 계층

```
🌐 플랫폼 레벨
└─ platform_admin
    └─ 전체 시스템 관리

🏢 회사 레벨
├─ company_admin (회사 관리자)
│   ├─ 회사 정보 관리
│   ├─ 브랜드 생성/관리
│   ├─ 전체 리포트
│   └─ 세무대리인 정보 관리
│
└─ manager (본사 관리자)
    ├─ 급여 최종 승인
    ├─ 구매/폐기 승인
    └─ 전사 공지

🏪 브랜드 > 매장 레벨
├─ store_manager (매장 관리자)
│   ├─ 매장 직원 관리
│   ├─ 스케줄 관리
│   ├─ 계약서 작성
│   ├─ 출퇴근 관리
│   ├─ 긴급 근무 모집
│   └─ 매장 승인 (구매/폐기 1차)
│
└─ team_leader (팀장)
    ├─ 팀원 출퇴근 확인
    ├─ 팀 스케줄 조율
    ├─ 소액 구매 요청
    └─ 팀 공지

👤 직원 레벨
└─ staff
    ├─ 출퇴근 체크
    ├─ 급여 조회
    ├─ 결재 신청 (휴가, 초과근무, 구매, 폐기)
    └─ 긴급 근무 지원
```

### 2.2 계층별 데이터 격리

```sql
-- PostgreSQL Row Level Security (RLS) 예시

-- 회사별 데이터 격리
CREATE POLICY company_isolation ON staff
  USING (company_id = current_setting('app.current_company_id')::uuid);

-- 브랜드별 데이터 격리
CREATE POLICY brand_isolation ON stores
  USING (
    brand_id IN (
      SELECT id FROM brands 
      WHERE company_id = current_setting('app.current_company_id')::uuid
    )
  );

-- 매장별 데이터 격리
CREATE POLICY store_isolation ON attendance
  USING (
    store_id IN (
      SELECT id FROM stores 
      WHERE brand_id IN (
        SELECT id FROM brands 
        WHERE company_id = current_setting('app.current_company_id')::uuid
      )
    )
  );
```

---

## 3. 핵심 기능 상세

### 3.1 계약서 작성 시스템 (최우선)

#### 3.1.1 계약서 구성 요소

```typescript
interface ComprehensiveContract {
  // 기본 정보
  basic: {
    contractNumber: string;          // 계약번호 (자동생성)
    employeeId: string;
    employeeName: string;
    employeeSSN: string;             // 주민등록번호 (암호화)
    employeeAddress: string;         // 집주소
    employeePhone: string;
    
    companyId: string;
    brandId: string;
    storeId: string;
    
    startDate: Date;
    endDate?: Date;                  // 무기계약 시 null
    contractType: '정규직' | '계약직' | '아르바이트' | '인턴';
    probationPeriod?: number;        // 수습기간 (개월)
  };
  
  // 근무 조건
  workConditions: {
    workDays: WorkDaySchedule[];     // 복수 패턴 가능
    position: string;                // 직책
    department?: string;             // 부서
    teamId?: string;                 // 팀
    duties: string[];                // 업무 내용
  };
  
  // 급여 조건 (상세)
  salary: {
    // 기본급
    baseSalaryType: '시급' | '일급' | '월급' | '연봉';
    baseSalaryAmount: number;
    
    // 추가 수당
    allowances: {
      // 법정 수당
      overtimeAllowance: boolean;    // 연장근로수당 (1.5배)
      nightAllowance: boolean;       // 야간근로수당 (0.5배)
      holidayAllowance: boolean;     // 휴일근로수당 (1.5배)
      weeklyHolidayPay: boolean;     // 주휴수당
      
      // 추가 수당
      mealAllowance?: number;        // 식대
      transportAllowance?: number;   // 교통비
      positionAllowance?: number;    // 직책수당
      specialtyAllowance?: number;   // 자격수당
      familyAllowance?: number;      // 가족수당
      housingAllowance?: number;     // 주택수당
      childcareAllowance?: number;   // 육아수당
      perfomanceBonus?: {            // 성과급
        type: '월별' | '분기별' | '연간';
        basis: string;
        rate?: number;
      };
    };
    
    // 상여금
    bonus?: {
      annualBonus: number;           // 연간 상여금 (%)
      schedule: string;              // 지급 시기
    };
    
    // 급여 지급
    paymentDate: number;             // 매월 급여일 (1~31)
    paymentMethod: '계좌이체' | '현금' | '혼합';
  };
  
  // 공제 항목 (상세)
  deductions: {
    // 4대 보험
    nationalPension: boolean;        // 국민연금 (4.5%)
    healthInsurance: boolean;        // 건강보험 (3.545%)
    employmentInsurance: boolean;    // 고용보험 (0.9%)
    industrialAccident: boolean;     // 산재보험 (회사부담)
    
    // 세금
    incomeTax: boolean;              // 소득세
    localIncomeTax: boolean;         // 지방소득세
    
    // 기타 공제
    dormitoryFee?: number;           // 기숙사비
    mealDeduction?: number;          // 식비 공제
    uniformDeposit?: number;         // 유니폼 보증금
    otherDeductions?: Array<{
      name: string;
      amount: number;
      description: string;
    }>;
  };
  
  // 근무시간 및 휴게
  workingHours: {
    standardHoursPerWeek: number;    // 주 40시간
    standardHoursPerDay: number;     // 일 8시간
    breakTime: number;               // 휴게시간 (분)
    flexibleWorkSystem?: boolean;    // 탄력근무제
  };
  
  // 휴가
  leave: {
    annualLeave: number;             // 연차 일수
    paidLeave: number;               // 유급휴가
    sickLeave: number;               // 병가
    maternityLeave: boolean;         // 출산휴가
    paternityLeave: boolean;         // 배우자 출산휴가
    familyEventLeave: number;        // 경조사 휴가
  };
  
  // 복리후생
  benefits?: {
    healthCheckup: boolean;          // 건강검진
    retirementPlan: boolean;         // 퇴직연금
    educationSupport?: string;       // 교육 지원
    others?: string[];
  };
  
  // 계약 조건
  terms: {
    confidentiality: boolean;        // 기밀유지 의무
    nonCompete?: {                   // 경업금지
      enabled: boolean;
      period: number;                // 개월
      scope: string;
    };
    intellectualProperty: boolean;   // 지적재산권
    terminationNotice: number;       // 퇴사 통보 기간 (일)
  };
  
  // 계약 해지
  termination: {
    employeeNotice: number;          // 직원 퇴사 시 통보 (일)
    employerNotice: number;          // 회사 해고 시 통보 (일)
    severancePay: boolean;           // 퇴직금
    penaltyClause?: string;          // 위약금 조항
  };
  
  // 서명
  signatures: {
    employeeSignedAt?: Date;
    employeeSignature?: string;      // Base64 이미지
    employerSignedAt?: Date;
    employerSignature?: string;
    witnessName?: string;
    witnessSignedAt?: Date;
  };
  
  // 첨부 서류
  attachments: {
    resume?: string;                 // 이력서
    certificates?: string[];         // 자격증
    healthCertificate?: string;      // 건강진단서
    idCopy?: string;                 // 신분증 사본
    others?: Array<{
      name: string;
      fileUrl: string;
    }>;
  };
}

// 근무 패턴 (복수 가능)
interface WorkDaySchedule {
  daysOfWeek: number[];              // 0-6 (일-토)
  startTime: string;                 // "09:00"
  endTime: string;                   // "18:00"
  breakMinutes: number;              // 60
  effectiveFrom?: Date;              // 변경 시작일
}
```

#### 3.1.2 계약서 작성 UI 플로우

```
계약서 작성 마법사 (7단계)

1단계: 직원 기본 정보
├─ 이름, 주민번호, 주소, 연락처
├─ 소속: 회사 > 브랜드 > 매장 선택
└─ 직책, 팀 배정

2단계: 계약 유형 및 기간
├─ 계약 유형 (정규/계약/알바/인턴)
├─ 시작일, 종료일
└─ 수습 기간 (선택)

3단계: 근무 조건
├─ 근무 요일 및 시간 (복수 패턴 가능)
│   예) 월화수: 09:00-18:00
│       목금:   14:00-22:00
├─ 휴게 시간
└─ 업무 내용

4단계: 급여 조건 ⭐ 핵심
├─ 기본급 (시급/일급/월급/연봉)
├─ 법정 수당 체크박스
│   ☑ 연장근로수당 (1.5배)
│   ☑ 야간근로수당 (0.5배)
│   ☑ 휴일근로수당 (1.5배)
│   ☑ 주휴수당
├─ 추가 수당 입력
│   ├─ 식대: ___원
│   ├─ 교통비: ___원
│   ├─ 직책수당: ___원
│   └─ 기타: [+ 추가]
├─ 상여금
│   └─ 연 ___%
└─ 급여 지급일: 매월 __일

5단계: 공제 항목 ⭐ 핵심
├─ 4대 보험
│   ☑ 국민연금 (4.5%)
│   ☑ 건강보험 (3.545%)
│   ☑ 고용보험 (0.9%)
│   ☑ 산재보험
├─ 세금
│   ☑ 소득세
│   ☑ 지방소득세
└─ 기타 공제
    ├─ 기숙사비: ___원
    ├─ 식비 공제: ___원
    └─ 기타: [+ 추가]

6단계: 복리후생 및 휴가
├─ 연차 일수
├─ 건강검진
├─ 퇴직연금
└─ 기타 혜택

7단계: 계약 조건 및 확인
├─ 기밀유지 동의
├─ 퇴사 통보 기간
├─ 계약서 미리보기 (PDF)
└─ 직원에게 발송
```

#### 3.1.3 계약서 PDF 템플릿

```typescript
// 계약서 PDF 생성
class ContractPDFGenerator {
  async generate(contract: ComprehensiveContract): Promise<Buffer> {
    // 공식 근로계약서 양식 준수
    const pdf = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 }
    });
    
    // 제목
    pdf.fontSize(18).font('NanumGothicBold')
       .text('근 로 계 약 서', { align: 'center' });
    
    pdf.moveDown();
    
    // 계약 당사자
    this.addSection(pdf, '1. 계약 당사자');
    this.addTable(pdf, [
      ['회사명', contract.company.name],
      ['사업자등록번호', contract.company.businessNumber],
      ['대표자', contract.company.ceo],
      ['주소', contract.company.address],
      ['', ''],
      ['근로자 성명', contract.basic.employeeName],
      ['주민등록번호', this.maskSSN(contract.basic.employeeSSN)],
      ['주소', contract.basic.employeeAddress],
      ['연락처', contract.basic.employeePhone]
    ]);
    
    // 계약 기간
    this.addSection(pdf, '2. 계약 기간');
    pdf.fontSize(10)
       .text(`${contract.basic.startDate} ~ ${contract.basic.endDate || '무기계약'}`);
    
    // 근무 장소
    this.addSection(pdf, '3. 근무 장소');
    pdf.text(`${contract.store.address} (${contract.brand.name} ${contract.store.name})`);
    
    // 업무 내용
    this.addSection(pdf, '4. 업무 내용');
    contract.workConditions.duties.forEach(duty => {
      pdf.text(`• ${duty}`);
    });
    
    // 근무 시간
    this.addSection(pdf, '5. 근무 시간');
    contract.workConditions.workDays.forEach(schedule => {
      const days = schedule.daysOfWeek.map(d => ['일','월','화','수','목','금','토'][d]).join(', ');
      pdf.text(`${days}: ${schedule.startTime} ~ ${schedule.endTime} (휴게 ${schedule.breakMinutes}분)`);
    });
    
    // 임금 조건 (상세)
    this.addSection(pdf, '6. 임금 조건');
    
    // 기본급
    pdf.fontSize(11).font('NanumGothicBold')
       .text('가. 기본급');
    pdf.fontSize(10).font('NanumGothic')
       .text(`   ${contract.salary.baseSalaryType}: ${contract.salary.baseSalaryAmount.toLocaleString()}원`);
    
    // 수당
    if (Object.keys(contract.salary.allowances).length > 0) {
      pdf.fontSize(11).font('NanumGothicBold')
         .text('나. 제수당');
      
      // 법정 수당
      if (contract.salary.allowances.overtimeAllowance) {
        pdf.fontSize(10).font('NanumGothic')
           .text('   • 연장근로수당: 통상시급의 150%');
      }
      if (contract.salary.allowances.nightAllowance) {
        pdf.text('   • 야간근로수당: 통상시급의 50% 가산');
      }
      if (contract.salary.allowances.holidayAllowance) {
        pdf.text('   • 휴일근로수당: 통상시급의 150%');
      }
      if (contract.salary.allowances.weeklyHolidayPay) {
        pdf.text('   • 주휴수당: 주 15시간 이상 근무 시');
      }
      
      // 추가 수당
      if (contract.salary.allowances.mealAllowance) {
        pdf.text(`   • 식대: ${contract.salary.allowances.mealAllowance.toLocaleString()}원`);
      }
      if (contract.salary.allowances.transportAllowance) {
        pdf.text(`   • 교통비: ${contract.salary.allowances.transportAllowance.toLocaleString()}원`);
      }
      if (contract.salary.allowances.positionAllowance) {
        pdf.text(`   • 직책수당: ${contract.salary.allowances.positionAllowance.toLocaleString()}원`);
      }
    }
    
    // 상여금
    if (contract.salary.bonus) {
      pdf.fontSize(11).font('NanumGothicBold')
         .text('다. 상여금');
      pdf.fontSize(10).font('NanumGothic')
         .text(`   연 ${contract.salary.bonus.annualBonus}% (${contract.salary.bonus.schedule})`);
    }
    
    // 급여 지급일
    pdf.fontSize(11).font('NanumGothicBold')
       .text('라. 임금 지급일');
    pdf.fontSize(10).font('NanumGothic')
       .text(`   매월 ${contract.salary.paymentDate}일 (${contract.salary.paymentMethod})`);
    
    // 공제 항목
    this.addSection(pdf, '7. 공제 사항');
    
    if (contract.deductions.nationalPension) {
      pdf.text('   • 국민연금: 4.5%');
    }
    if (contract.deductions.healthInsurance) {
      pdf.text('   • 건강보험: 3.545%');
    }
    if (contract.deductions.employmentInsurance) {
      pdf.text('   • 고용보험: 0.9%');
    }
    if (contract.deductions.incomeTax) {
      pdf.text('   • 소득세 및 지방소득세');
    }
    
    // 기타 공제
    if (contract.deductions.otherDeductions) {
      contract.deductions.otherDeductions.forEach(ded => {
        pdf.text(`   • ${ded.name}: ${ded.amount.toLocaleString()}원 (${ded.description})`);
      });
    }
    
    // 휴가
    this.addSection(pdf, '8. 휴가');
    pdf.text(`   • 연차휴가: ${contract.leave.annualLeave}일`);
    pdf.text(`   • 경조사휴가: ${contract.leave.familyEventLeave}일`);
    if (contract.leave.maternityLeave) {
      pdf.text('   • 출산휴가: 법정 기준');
    }
    
    // 계약 해지
    this.addSection(pdf, '9. 계약 해지');
    pdf.text(`   • 근로자 퇴사 시 통보: ${contract.termination.employeeNotice}일 전`);
    pdf.text(`   • 사용자 해고 시 통보: ${contract.termination.employerNotice}일 전`);
    if (contract.termination.severancePay) {
      pdf.text('   • 퇴직금: 근로기준법에 따름');
    }
    
    // 기타 조항
    this.addSection(pdf, '10. 기타');
    if (contract.terms.confidentiality) {
      pdf.text('   • 재직 중 및 퇴사 후 업무상 취득한 정보에 대한 기밀유지 의무');
    }
    if (contract.terms.nonCompete?.enabled) {
      pdf.text(`   • 퇴사 후 ${contract.terms.nonCompete.period}개월간 동종업계 취업 제한`);
    }
    
    pdf.moveDown(2);
    
    // 날짜
    pdf.fontSize(10)
       .text(`계약일: ${new Date().toLocaleDateString('ko-KR')}`, { align: 'center' });
    
    pdf.moveDown(2);
    
    // 서명란
    this.addSignatureSection(pdf, contract);
    
    return pdf.end();
  }
  
  private maskSSN(ssn: string): string {
    // 주민번호 뒷자리 마스킹
    return ssn.substring(0, 8) + '******';
  }
}
```

### 3.2 세무대리인 전송 시스템

```typescript
interface TaxAccountantIntegration {
  // 세무대리인 정보
  taxAccountant: {
    name: string;
    businessNumber: string;
    phone: string;
    email: string;
    faxNumber?: string;
  };
  
  // 전송 설정
  transmissionSettings: {
    method: 'EMAIL' | 'FAX' | 'API' | 'MANUAL';
    frequency: 'MONTHLY' | 'SEMI_MONTHLY' | 'CUSTOM';
    autoSend: boolean;
    sendDay: number;                  // 매월 n일
    includeAttachments: boolean;
  };
  
  // 전송 포맷
  format: 'EXCEL' | 'PDF' | 'JSON' | 'HOMTAX_FORMAT';
}

// 세무 전송 데이터 구조
interface TaxTransmissionData {
  period: {
    year: number;
    month: number;
  };
  
  company: {
    name: string;
    businessNumber: string;
    ceoName: string;
    address: string;
  };
  
  employees: Array<{
    // 개인 정보
    name: string;
    ssn: string;                      // 주민등록번호 (전체)
    address: string;                  // 집주소
    phone: string;
    
    // 급여 정보
    baseSalary: number;               // 기본급
    allowances: {
      meal: number;
      transport: number;
      position: number;
      others: Array<{ name: string; amount: number }>;
    };
    totalGrossPay: number;            // 총 지급액
    
    // 공제 정보
    deductions: {
      nationalPension: number;
      healthInsurance: number;
      longTermCare: number;           // 장기요양보험
      employmentInsurance: number;
      incomeTax: number;
      localIncomeTax: number;
      others: Array<{ name: string; amount: number }>;
    };
    totalDeductions: number;          // 총 공제액
    
    netPay: number;                   // 실수령액
    
    // 근무 정보
    workDays: number;
    workHours: number;
    overtimeHours: number;
    
    // 계약 정보
    contractType: string;
    hireDate: Date;
    resignDate?: Date;
  }>;
  
  // 요약
  summary: {
    totalEmployees: number;
    totalGrossPay: number;
    totalDeductions: number;
    totalNetPay: number;
  };
}

// 세무 전송 서비스
class TaxTransmissionService {
  // 월급여 데이터 생성
  async generateMonthlyData(companyId: string, year: number, month: number): Promise<TaxTransmissionData> {
    const salaries = await this.getSalariesForMonth(companyId, year, month);
    const employees = await this.getEmployeeDetails(salaries.map(s => s.staffId));
    
    return {
      period: { year, month },
      company: await this.getCompanyInfo(companyId),
      employees: employees.map(emp => ({
        name: emp.name,
        ssn: emp.ssn,                 // 암호화된 주민번호 복호화
        address: emp.profile.address,
        phone: emp.profile.phone,
        
        // 급여 정보 매핑
        baseSalary: emp.salary.baseSalary,
        allowances: emp.salary.allowances,
        totalGrossPay: emp.salary.totalGrossPay,
        
        deductions: emp.salary.deductions,
        totalDeductions: emp.salary.totalDeductions,
        
        netPay: emp.salary.netPay,
        
        workDays: emp.attendance.workDays,
        workHours: emp.attendance.totalHours,
        overtimeHours: emp.attendance.overtimeHours,
        
        contractType: emp.contract.type,
        hireDate: emp.hireDate,
        resignDate: emp.resignDate
      })),
      summary: this.calculateSummary(salaries)
    };
  }
  
  // 엑셀 파일 생성 (세무 표준 양식)
  async generateExcelReport(data: TaxTransmissionData): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('급여대장');
    
    // 헤더
    sheet.columns = [
      { header: '성명', key: 'name', width: 10 },
      { header: '주민등록번호', key: 'ssn', width: 15 },
      { header: '주소', key: 'address', width: 30 },
      { header: '기본급', key: 'baseSalary', width: 12 },
      { header: '식대', key: 'mealAllowance', width: 10 },
      { header: '교통비', key: 'transportAllowance', width: 10 },
      { header: '기타수당', key: 'otherAllowances', width: 12 },
      { header: '총지급액', key: 'totalGrossPay', width: 12 },
      { header: '국민연금', key: 'nationalPension', width: 10 },
      { header: '건강보험', key: 'healthInsurance', width: 10 },
      { header: '고용보험', key: 'employmentInsurance', width: 10 },
      { header: '소득세', key: 'incomeTax', width: 10 },
      { header: '지방소득세', key: 'localIncomeTax', width: 10 },
      { header: '총공제액', key: 'totalDeductions', width: 12 },
      { header: '실수령액', key: 'netPay', width: 12 },
      { header: '근무일수', key: 'workDays', width: 10 },
      { header: '근무시간', key: 'workHours', width: 10 }
    ];
    
    // 데이터 추가
    data.employees.forEach(emp => {
      sheet.addRow({
        name: emp.name,
        ssn: emp.ssn,
        address: emp.address,
        baseSalary: emp.baseSalary,
        mealAllowance: emp.allowances.meal,
        transportAllowance: emp.allowances.transport,
        otherAllowances: emp.allowances.others.reduce((sum, a) => sum + a.amount, 0),
        totalGrossPay: emp.totalGrossPay,
        nationalPension: emp.deductions.nationalPension,
        healthInsurance: emp.deductions.healthInsurance,
        employmentInsurance: emp.deductions.employmentInsurance,
        incomeTax: emp.deductions.incomeTax,
        localIncomeTax: emp.deductions.localIncomeTax,
        totalDeductions: emp.totalDeductions,
        netPay: emp.netPay,
        workDays: emp.workDays,
        workHours: emp.workHours
      });
    });
    
    // 합계 행
    sheet.addRow({});
    const summaryRow = sheet.addRow({
      name: '합계',
      totalGrossPay: data.summary.totalGrossPay,
      totalDeductions: data.summary.totalDeductions,
      netPay: data.summary.totalNetPay
    });
    summaryRow.font = { bold: true };
    
    return await workbook.xlsx.writeBuffer();
  }
  
  // 자동 전송
  async autoTransmit(companyId: string) {
    const settings = await this.getTransmissionSettings(companyId);
    
    if (!settings.autoSend) return;
    
    const today = new Date();
    if (today.getDate() !== settings.sendDay) return;
    
    const data = await this.generateMonthlyData(
      companyId,
      today.getFullYear(),
      today.getMonth()
    );
    
    switch (settings.method) {
      case 'EMAIL':
        const excel = await this.generateExcelReport(data);
        await this.sendEmail(settings.taxAccountant.email, excel);
        break;
        
      case 'FAX':
        const pdf = await this.generatePDFReport(data);
        await this.sendFax(settings.taxAccountant.faxNumber, pdf);
        break;
        
      case 'API':
        await this.sendViaAPI(settings.taxAccountant.apiEndpoint, data);
        break;
    }
    
    // 전송 이력 기록
    await this.logTransmission(companyId, data);
  }
}
```

### 3.3 승인 관리 시스템 (확장)

```typescript
// 승인 유형 확장
enum ApprovalType {
  // 기존
  LEAVE = 'LEAVE',                   // 휴가
  OVERTIME = 'OVERTIME',             // 초과근무
  SCHEDULE_CHANGE = 'SCHEDULE_CHANGE', // 근무조정
  
  // 신규 추가
  PURCHASE = 'PURCHASE',             // 구매
  DISPOSAL = 'DISPOSAL',             // 폐기
  RESIGNATION = 'RESIGNATION',       // 사직서
  ABSENCE_EXCUSE = 'ABSENCE_EXCUSE', // 결근 사유서
  EXPENSE = 'EXPENSE',               // 경비 지출
  DOCUMENT = 'DOCUMENT',             // 문서 결재
  OTHER = 'OTHER'                    // 기타
}

interface ApprovalRequest {
  id: string;
  type: ApprovalType;
  requesterId: string;
  requesterName: string;
  requesterRole: string;
  
  companyId: string;
  brandId?: string;
  storeId?: string;
  
  // 승인 라인
  approvalLine: Array<{
    order: number;                   // 1차, 2차, 3차
    approverId: string;
    approverName: string;
    approverRole: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    comment?: string;
    decidedAt?: Date;
  }>;
  
  currentStep: number;
  finalStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  
  // 요청 내용
  details: PurchaseDetails | DisposalDetails | ResignationDetails | AbsenceDetails;
  
  // 첨부 파일
  attachments?: Array<{
    name: string;
    url: string;
    type: string;
  }>;
  
  createdAt: Date;
  updatedAt: Date;
  finalizedAt?: Date;
}

// 구매 승인
interface PurchaseDetails {
  category: '소모품' | '식자재' | '설비' | '기타';
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  vendor: string;
  purpose: string;
  urgency: '긴급' | '일반' | '정기';
  deliveryDate?: Date;
  quotationUrl?: string;           // 견적서
}

// 폐기 승인
interface DisposalDetails {
  category: '식자재' | '소모품' | '설비' | '기타';
  itemName: string;
  quantity: number;
  estimatedValue: number;
  reason: '유통기한만료' | '파손' | '불량' | '재고조정' | '기타';
  disposalMethod: '폐기' | '기부' | '재활용';
  photoUrls: string[];             // 폐기 대상 사진
}

// 사직서
interface ResignationDetails {
  resignationType: '자진퇴사' | '권고사직' | '계약만료' | '해고';
  resignationDate: Date;           // 최종 근무일
  noticeDate: Date;                // 통보일
  noticePeriod: number;            // 통보 기간 (일)
  reason: string;
  returnItems: Array<{             // 반납 물품
    item: string;
    returned: boolean;
  }>;
  finalSettlement: {               // 최종 정산
    remainingSalary: number;
    severancePay: number;
    unusedVacationPay: number;
    deductions: number;
    total: number;
  };
}

// 결근 사유서
interface AbsenceDetails {
  absenceDate: Date;
  absenceType: '병가' | '개인사정' | '가족돌봄' | '기타';
  reason: string;
  evidenceUrl?: string;            // 증빙 서류 (진단서 등)
  makeupWork: boolean;             // 대체 근무 여부
  makeupDate?: Date;
}

// 승인 라인 자동 설정
class ApprovalLineManager {
  async getApprovalLine(request: ApprovalRequest): Promise<Approver[]> {
    const line: Approver[] = [];
    
    switch (request.type) {
      case ApprovalType.PURCHASE:
        const purchase = request.details as PurchaseDetails;
        
        // 금액별 승인 라인
        if (purchase.totalAmount < 100000) {
          // 10만원 미만: 매장 관리자
          line.push(await this.getStoreManager(request.storeId));
        } else if (purchase.totalAmount < 500000) {
          // 50만원 미만: 매장 관리자 → 본사 관리자
          line.push(await this.getStoreManager(request.storeId));
          line.push(await this.getManager(request.companyId));
        } else {
          // 50만원 이상: 매장 관리자 → 본사 관리자 → 회사 대표
          line.push(await this.getStoreManager(request.storeId));
          line.push(await this.getManager(request.companyId));
          line.push(await this.getCompanyAdmin(request.companyId));
        }
        break;
        
      case ApprovalType.DISPOSAL:
        // 폐기: 매장 관리자 → 본사 관리자
        line.push(await this.getStoreManager(request.storeId));
        line.push(await this.getManager(request.companyId));
        break;
        
      case ApprovalType.RESIGNATION:
        // 사직: 매장 관리자 → 본사 관리자 → 회사 대표
        line.push(await this.getStoreManager(request.storeId));
        line.push(await this.getManager(request.companyId));
        line.push(await this.getCompanyAdmin(request.companyId));
        break;
        
      case ApprovalType.ABSENCE_EXCUSE:
        // 결근 사유: 팀장 → 매장 관리자
        if (request.teamId) {
          line.push(await this.getTeamLeader(request.teamId));
        }
        line.push(await this.getStoreManager(request.storeId));
        break;
    }
    
    return line.map((approver, index) => ({
      order: index + 1,
      ...approver,
      status: 'PENDING'
    }));
  }
  
  // 순차 승인 처리
  async processApproval(requestId: string, approverId: string, decision: 'APPROVED' | 'REJECTED', comment?: string) {
    const request = await this.getRequest(requestId);
    const currentApprover = request.approvalLine[request.currentStep - 1];
    
    if (currentApprover.approverId !== approverId) {
      throw new Error('승인 권한이 없습니다');
    }
    
    // 승인/거부 처리
    currentApprover.status = decision;
    currentApprover.comment = comment;
    currentApprover.decidedAt = new Date();
    
    if (decision === 'REJECTED') {
      // 거부 시 전체 프로세스 종료
      request.finalStatus = 'REJECTED';
      request.finalizedAt = new Date();
      
      // 신청자에게 알림
      await this.notifyRejection(request);
      
    } else {
      // 승인 시 다음 단계로
      if (request.currentStep < request.approvalLine.length) {
        request.currentStep++;
        
        // 다음 승인자에게 알림
        const nextApprover = request.approvalLine[request.currentStep - 1];
        await this.notifyNextApprover(request, nextApprover);
        
      } else {
        // 최종 승인 완료
        request.finalStatus = 'APPROVED';
        request.finalizedAt = new Date();
        
        // 승인 완료 처리
        await this.executeApprovedAction(request);
        
        // 신청자에게 알림
        await this.notifyApproval(request);
      }
    }
    
    await this.updateRequest(request);
  }
  
  // 승인 완료 후 실행
  async executeApprovedAction(request: ApprovalRequest) {
    switch (request.type) {
      case ApprovalType.PURCHASE:
        // 구매 승인 → 발주 시스템으로 전달 (향후 확장)
        await this.createPurchaseOrder(request);
        break;
        
      case ApprovalType.DISPOSAL:
        // 폐기 승인 → 재고에서 차감 (향후 확장)
        await this.recordDisposal(request);
        break;
        
      case ApprovalType.RESIGNATION:
        // 사직 승인 → 퇴사 처리
        await this.processResignation(request);
        break;
        
      case ApprovalType.LEAVE:
        // 휴가 승인 → 스케줄 업데이트
        await this.updateScheduleForLeave(request);
        break;
    }
  }
}
```

### 3.4 긴급 근무 모집 시스템

```typescript
interface EmergencyShiftRequest {
  id: string;
  storeId: string;
  storeName: string;
  
  // 필요한 시간
  date: Date;
  startTime: string;
  endTime: string;
  positions: Array<{
    role: string;                    // 예: "주방", "홀", "계산"
    count: number;                   // 필요 인원
  }>;
  
  // 사유
  reason: '명절' | '공휴일' | '결근대체' | '행사' | '기타';
  description: string;
  
  // 조건
  hourlyRate: number;                // 시급 (일반보다 높게)
  bonus?: number;                    // 추가 보너스
  benefits?: string[];               // 혜택 (식사 제공 등)
  
  // 상태
  status: 'OPEN' | 'FILLED' | 'CANCELLED';
  deadline: Date;                    // 모집 마감
  
  // 지원자
  applicants: Array<{
    staffId: string;
    staffName: string;
    appliedAt: Date;
    status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
    aiScore?: number;                // AI 추천 점수
  }>;
  
  createdBy: string;
  createdAt: Date;
}

// 단순 추천 시스템 (스케줄 기반)
class EmergencyShiftRecommender {
  async recommendStaff(request: EmergencyShiftRequest): Promise<StaffRecommendation[]> {
    // 1. 해당 시간에 스케줄 없는 직원 찾기
    const availableStaff = await this.getAvailableStaff(
      request.storeId,
      request.date,
      request.startTime,
      request.endTime
    );
    
    // 2. 경험치 정보 추가
    const withExperience = await Promise.all(
      availableStaff.map(async (staff) => {
        const experience = await this.getExperience(staff.id, request.positions[0].role);
        return {
          staffId: staff.id,
          staffName: staff.name,
          staffPhone: staff.phone,
          hasExperience: experience.hasExperience,
          workCount: experience.workCount,  // 해당 포지션 근무 횟수
          lastWorked: experience.lastWorked  // 마지막 근무일
        };
      })
    );
    
    // 3. 경험자 우선 정렬
    withExperience.sort((a, b) => {
      if (a.hasExperience && !b.hasExperience) return -1;
      if (!a.hasExperience && b.hasExperience) return 1;
      return b.workCount - a.workCount;  // 경험 많은 순
    });
    
    return withExperience;
  }
  
  // 해당 시간에 스케줄 없는 직원 조회
  private async getAvailableStaff(
    storeId: string,
    date: Date,
    startTime: string,
    endTime: string
  ): Promise<Staff[]> {
    // 같은 매장 직원 중 해당 날짜에 스케줄 없는 사람
    const allStaff = await db.users
      .where('storeId', '==', storeId)
      .where('status', '==', 'ACTIVE')
      .get();
    
    const available = [];
    
    for (const staff of allStaff) {
      const hasSchedule = await db.schedules
        .where('staffId', '==', staff.id)
        .where('workDate', '==', date)
        .exists();
      
      if (!hasSchedule) {
        available.push(staff);
      }
    }
    
    return available;
  }
  
  // 경험 정보 조회
  private async getExperience(staffId: string, position: string) {
    // 과거 해당 포지션 근무 이력
    const pastWorks = await db.schedules
      .where('staffId', '==', staffId)
      .where('extensions.position', '==', position)
      .where('status', '==', 'COMPLETED')
      .orderBy('workDate', 'desc')
      .get();
    
    return {
      hasExperience: pastWorks.length > 0,
      workCount: pastWorks.length,
      lastWorked: pastWorks[0]?.workDate
    };
  }
}

// 긴급 근무 모집 UI
class EmergencyShiftUI {
  // 1. 매장 관리자가 모집 생성
  async createRequest(data: Partial<EmergencyShiftRequest>) {
    const request = await this.save(data);
    
    // 2. AI가 추천 후보 생성
    const recommendations = await emergencyShiftAI.recommendStaff(request);
    
    // 3. 추천 순위 표시
    return {
      request,
      recommendations: recommendations.slice(0, 10)  // 상위 10명
    };
  }
  
  // 4. 관리자가 선택한 직원에게 알림 발송
  async sendInvitations(requestId: string, staffIds: string[]) {
    const request = await this.getRequest(requestId);
    
    for (const staffId of staffIds) {
      await pushNotification.send(staffId, {
        type: 'EMERGENCY_SHIFT_INVITATION',
        title: '긴급 근무 요청',
        body: `${request.date.toLocaleDateString()} ${request.startTime}~${request.endTime} 근무 가능하신가요?`,
        data: {
          requestId: request.id,
          hourlyRate: request.hourlyRate,
          bonus: request.bonus
        },
        actions: [
          { id: 'ACCEPT', title: '지원하기' },
          { id: 'DECLINE', title: '거절하기' }
        ]
      });
    }
  }
  
  // 5. 직원이 지원
  async applyForShift(requestId: string, staffId: string) {
    await this.addApplicant(requestId, staffId);
    
    // 매장 관리자에게 알림
    await this.notifyManager(requestId, `${staffName}님이 긴급 근무에 지원했습니다`);
  }
  
  // 6. 관리자가 선발
  async selectApplicants(requestId: string, selectedIds: string[]) {
    const request = await this.getRequest(requestId);
    
    for (const applicant of request.applicants) {
      if (selectedIds.includes(applicant.staffId)) {
        applicant.status = 'ACCEPTED';
        
        // 스케줄 자동 생성
        await this.createSchedule(request, applicant.staffId);
        
        // 알림
        await pushNotification.send(applicant.staffId, {
          title: '긴급 근무 확정',
          body: '축하합니다! 긴급 근무가 확정되었습니다.'
        });
      } else {
        applicant.status = 'REJECTED';
      }
    }
    
    request.status = 'FILLED';
    await this.updateRequest(request);
  }
}
```

### 3.5 푸시 알림 시스템 (명확화)

```typescript
// 푸시 알림 우선순위 및 분류
enum NotificationPriority {
  CRITICAL = 'CRITICAL',             // 즉시 확인 필요
  HIGH = 'HIGH',                     // 중요
  NORMAL = 'NORMAL',                 // 일반
  LOW = 'LOW'                        // 참고
}

enum NotificationCategory {
  // 출퇴근
  ATTENDANCE = 'ATTENDANCE',
  
  // 급여
  SALARY = 'SALARY',
  
  // 스케줄
  SCHEDULE = 'SCHEDULE',
  
  // 승인
  APPROVAL = 'APPROVAL',
  
  // 긴급 근무
  EMERGENCY_SHIFT = 'EMERGENCY_SHIFT',
  
  // 계약
  CONTRACT = 'CONTRACT',
  
  // 공지
  NOTICE = 'NOTICE',
  
  // 메시지
  MESSAGE = 'MESSAGE',
  
  // 시스템
  SYSTEM = 'SYSTEM'
}

interface PushNotification {
  id: string;
  userId: string;
  
  // 분류
  category: NotificationCategory;
  priority: NotificationPriority;
  
  // 내용
  title: string;
  body: string;
  imageUrl?: string;
  
  // 액션
  actions?: Array<{
    id: string;
    title: string;
    icon?: string;
  }>;
  
  // 딥링크
  deepLink?: string;                 // 앱 내 특정 화면으로 이동
  
  // 데이터
  data?: Record<string, any>;
  
  // 설정
  sound?: string;
  vibration?: boolean;
  badge?: number;                    // 앱 아이콘 뱃지
  
  // 상태
  sent: boolean;
  sentAt?: Date;
  read: boolean;
  readAt?: Date;
  
  createdAt: Date;
  expiresAt?: Date;
}

// 알림 규칙 (누가, 언제, 무엇을)
const notificationRules = {
  // 계약서 서명 요청
  CONTRACT_SIGN_REQUEST: {
    trigger: 'contract.sent',
    recipients: (event) => [event.staffId],
    priority: NotificationPriority.HIGH,
    template: {
      title: '계약서 서명 요청',
      body: '새로운 근로계약서가 발송되었습니다. 확인 후 서명해주세요.',
      deepLink: '/contracts/:contractId',
      actions: [
        { id: 'VIEW', title: '확인하기' },
        { id: 'LATER', title: '나중에' }
      ]
    }
  },
  
  // 계약서 서명 완료
  CONTRACT_SIGNED: {
    trigger: 'contract.signed',
    recipients: (event) => [event.managerId],
    priority: NotificationPriority.NORMAL,
    template: {
      title: '계약서 서명 완료',
      body: '{staffName}님이 계약서에 서명했습니다.',
      deepLink: '/contracts/:contractId'
    }
  },
  
  // 출퇴근 알림 (출근 시간 30분 전)
  SHIFT_REMINDER: {
    trigger: 'schedule.upcoming',
    recipients: (event) => [event.staffId],
    priority: NotificationPriority.NORMAL,
    template: {
      title: '출근 시간 알림',
      body: '30분 후 출근 시간입니다. ({startTime})',
      deepLink: '/attendance/check-in',
      actions: [
        { id: 'CHECK_IN', title: '지금 출근' }
      ]
    }
  },
  
  // 급여 확정
  SALARY_CONFIRMED: {
    trigger: 'salary.confirmed',
    recipients: (event) => [event.staffId],
    priority: NotificationPriority.HIGH,
    template: {
      title: '{year}년 {month}월 급여 확정',
      body: '급여가 확정되었습니다. 실수령액: {netPay}원',
      deepLink: '/salary/:salaryId',
      actions: [
        { id: 'VIEW_DETAIL', title: '상세 보기' },
        { id: 'DOWNLOAD_PDF', title: 'PDF 다운로드' }
      ]
    }
  },
  
  // 승인 요청
  APPROVAL_REQUEST: {
    trigger: 'approval.created',
    recipients: (event) => [event.nextApproverId],
    priority: NotificationPriority.HIGH,
    template: {
      title: '{approvalType} 승인 요청',
      body: '{requesterName}님이 {approvalType}을(를) 신청했습니다.',
      deepLink: '/approvals/:approvalId',
      actions: [
        { id: 'APPROVE', title: '승인' },
        { id: 'REJECT', title: '거부' },
        { id: 'VIEW', title: '상세보기' }
      ]
    }
  },
  
  // 승인 완료
  APPROVAL_APPROVED: {
    trigger: 'approval.approved',
    recipients: (event) => [event.requesterId],
    priority: NotificationPriority.NORMAL,
    template: {
      title: '{approvalType} 승인됨',
      body: '신청하신 {approvalType}이(가) 승인되었습니다.',
      deepLink: '/approvals/:approvalId'
    }
  },
  
  // 승인 거부
  APPROVAL_REJECTED: {
    trigger: 'approval.rejected',
    recipients: (event) => [event.requesterId],
    priority: NotificationPriority.HIGH,
    template: {
      title: '{approvalType} 거부됨',
      body: '신청하신 {approvalType}이(가) 거부되었습니다. 사유: {reason}',
      deepLink: '/approvals/:approvalId'
    }
  },
  
  // 긴급 근무 모집
  EMERGENCY_SHIFT_INVITATION: {
    trigger: 'emergency.created',
    recipients: (event) => event.invitedStaffIds,
    priority: NotificationPriority.HIGH,
    template: {
      title: '긴급 근무 요청',
      body: '{date} {startTime}~{endTime} 근무 가능하신가요? (시급: {hourlyRate}원)',
      imageUrl: '/images/emergency-shift.png',
      deepLink: '/emergency-shifts/:shiftId',
      actions: [
        { id: 'ACCEPT', title: '지원하기' },
        { id: 'DECLINE', title: '거절' }
      ]
    }
  },
  
  // 공지사항
  NOTICE_PUBLISHED: {
    trigger: 'notice.published',
    recipients: (event) => event.targetStaffIds,
    priority: (event) => event.isImportant ? NotificationPriority.HIGH : NotificationPriority.NORMAL,
    template: {
      title: '{isImportant ? "[중요]" : ""} {noticeTitle}',
      body: '{noticePreview}',
      deepLink: '/notices/:noticeId',
      actions: [
        { id: 'VIEW', title: '확인하기' }
      ]
    }
  },
  
  // 메시지 수신
  MESSAGE_RECEIVED: {
    trigger: 'message.sent',
    recipients: (event) => [event.recipientId],
    priority: NotificationPriority.NORMAL,
    template: {
      title: '{senderName}님의 메시지',
      body: '{messagePreview}',
      deepLink: '/messages/:messageId',
      actions: [
        { id: 'REPLY', title: '답장' },
        { id: 'VIEW', title: '확인' }
      ]
    }
  }
};

// 푸시 알림 서비스
class PushNotificationService {
  // 알림 전송
  async send(notification: PushNotification) {
    // 1. 사용자 설정 확인
    const userPrefs = await this.getUserPreferences(notification.userId);
    
    // 카테고리 비활성화 확인
    if (!userPrefs.categories[notification.category]?.enabled) {
      return;  // 알림 전송 안함
    }
    
    // 2. 방해 금지 시간 확인
    if (this.isQuietHours(userPrefs) && notification.priority !== NotificationPriority.CRITICAL) {
      // 나중에 전송 (방해 금지 시간 종료 후)
      await this.scheduleForLater(notification);
      return;
    }
    
    // 3. FCM으로 전송
    await fcm.send({
      token: userPrefs.fcmToken,
      notification: {
        title: notification.title,
        body: notification.body,
        imageUrl: notification.imageUrl
      },
      data: {
        ...notification.data,
        deepLink: notification.deepLink,
        notificationId: notification.id
      },
      android: {
        priority: this.mapPriority(notification.priority),
        notification: {
          sound: notification.sound,
          channelId: notification.category
        }
      },
      apns: {
        payload: {
          aps: {
            sound: notification.sound,
            badge: notification.badge
          }
        }
      }
    });
    
    // 4. DB에 기록
    notification.sent = true;
    notification.sentAt = new Date();
    await this.save(notification);
  }
  
  // 인앱 알림 목록 조회
  async getNotifications(userId: string, filters?: {
    category?: NotificationCategory;
    unreadOnly?: boolean;
    limit?: number;
  }): Promise<PushNotification[]> {
    let query = db.notifications.where('userId', '==', userId);
    
    if (filters?.category) {
      query = query.where('category', '==', filters.category);
    }
    
    if (filters?.unreadOnly) {
      query = query.where('read', '==', false);
    }
    
    query = query.orderBy('createdAt', 'desc');
    
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    
    return await query.get();
  }
  
  // 읽음 처리
  async markAsRead(notificationId: string) {
    await db.notifications.doc(notificationId).update({
      read: true,
      readAt: new Date()
    });
  }
  
  // 전체 읽음 처리
  async markAllAsRead(userId: string) {
    const unread = await db.notifications
      .where('userId', '==', userId)
      .where('read', '==', false)
      .get();
    
    const batch = db.batch();
    unread.forEach(doc => {
      batch.update(doc.ref, { read: true, readAt: new Date() });
    });
    
    await batch.commit();
  }
}
```

### 3.6 메시지 보내기 기능

```typescript
// 일대일 메시지 (대화 아님)
interface Message {
  id: string;
  
  // 발신자
  senderId: string;
  senderName: string;
  senderRole: string;
  
  // 수신자
  recipientId: string;
  recipientName: string;
  recipientRole: string;
  
  // 내용
  subject?: string;                  // 제목 (선택)
  body: string;                      // 본문
  
  // 첨부
  attachments?: Array<{
    name: string;
    url: string;
    size: number;
    type: string;
  }>;
  
  // 상태
  status: 'SENT' | 'READ' | 'REPLIED';
  readAt?: Date;
  
  // 답장
  replyTo?: string;                  // 원본 메시지 ID
  hasReplies: boolean;
  replyCount: number;
  
  createdAt: Date;
}

// 메시지 UI (모달)
class MessageModal {
  // 메시지 작성 모달
  render() {
    return `
      <div class="modal">
        <div class="modal-header">
          <h2>메시지 보내기</h2>
          <button class="close">×</button>
        </div>
        
        <div class="modal-body">
          <!-- 수신자 선택 -->
          <div class="form-group">
            <label>받는 사람 *</label>
            <select name="recipientId" required>
              <option value="">선택하세요</option>
              
              <!-- 관리자가 보낼 때 -->
              <optgroup label="팀장">
                <option value="leader1">홍길동 (주방팀)</option>
                <option value="leader2">김철수 (홀팀)</option>
              </optgroup>
              <optgroup label="직원">
                <option value="staff1">이영희</option>
                <option value="staff2">박민수</option>
              </optgroup>
              
              <!-- 직원이 보낼 때 -->
              <optgroup label="관리자">
                <option value="manager1">매장 관리자</option>
                <option value="admin1">본사 관리자</option>
              </optgroup>
            </select>
          </div>
          
          <!-- 제목 (선택) -->
          <div class="form-group">
            <label>제목</label>
            <input type="text" name="subject" placeholder="제목을 입력하세요 (선택사항)">
          </div>
          
          <!-- 본문 -->
          <div class="form-group">
            <label>내용 *</label>
            <textarea name="body" rows="6" required 
                      placeholder="메시지 내용을 입력하세요"></textarea>
          </div>
          
          <!-- 첨부 파일 -->
          <div class="form-group">
            <label>첨부 파일</label>
            <input type="file" name="attachments" multiple>
            <small>최대 5개, 각 10MB 이하</small>
          </div>
        </div>
        
        <div class="modal-footer">
          <button class="btn-secondary" onclick="closeModal()">취소</button>
          <button class="btn-primary" onclick="sendMessage()">전송</button>
        </div>
      </div>
    `;
  }
  
  // 메시지 전송
  async sendMessage(data: {
    recipientId: string;
    subject?: string;
    body: string;
    attachments?: File[];
  }) {
    // 1. 첨부 파일 업로드
    const attachmentUrls = await this.uploadAttachments(data.attachments);
    
    // 2. 메시지 생성
    const message = await db.messages.create({
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderRole: currentUser.role,
      recipientId: data.recipientId,
      recipientName: await this.getRecipientName(data.recipientId),
      recipientRole: await this.getRecipientRole(data.recipientId),
      subject: data.subject,
      body: data.body,
      attachments: attachmentUrls,
      status: 'SENT',
      hasReplies: false,
      replyCount: 0,
      createdAt: new Date()
    });
    
    // 3. 수신자에게 푸시 알림
    await pushNotification.send({
      userId: data.recipientId,
      category: NotificationCategory.MESSAGE,
      priority: NotificationPriority.NORMAL,
      title: `${currentUser.name}님의 메시지`,
      body: data.subject || data.body.substring(0, 50),
      deepLink: `/messages/${message.id}`,
      actions: [
        { id: 'REPLY', title: '답장' },
        { id: 'VIEW', title: '확인' }
      ]
    });
    
    // 4. 모달 닫기
    this.close();
    
    // 5. 성공 메시지
    toast.success('메시지가 전송되었습니다');
  }
  
  // 메시지 보기 모달
  renderViewModal(message: Message) {
    return `
      <div class="modal">
        <div class="modal-header">
          <div class="message-meta">
            <div class="sender">
              <strong>${message.senderName}</strong>
              <span class="role">${message.senderRole}</span>
            </div>
            <div class="timestamp">
              ${formatDate(message.createdAt)}
            </div>
          </div>
          <button class="close">×</button>
        </div>
        
        <div class="modal-body">
          <!-- 제목 -->
          ${message.subject ? `
            <div class="message-subject">
              <h3>${message.subject}</h3>
            </div>
          ` : ''}
          
          <!-- 본문 -->
          <div class="message-body">
            ${message.body}
          </div>
          
          <!-- 첨부 파일 -->
          ${message.attachments?.length > 0 ? `
            <div class="message-attachments">
              <h4>첨부 파일</h4>
              <ul>
                ${message.attachments.map(att => `
                  <li>
                    <a href="${att.url}" download="${att.name}">
                      📎 ${att.name} (${formatFileSize(att.size)})
                    </a>
                  </li>
                `).join('')}
              </ul>
            </div>
          ` : ''}
          
          <!-- 답장 내역 -->
          ${message.replyCount > 0 ? `
            <div class="message-replies">
              <h4>답장 (${message.replyCount})</h4>
              <!-- 답장 목록 표시 -->
            </div>
          ` : ''}
        </div>
        
        <div class="modal-footer">
          <button class="btn-secondary" onclick="closeModal()">닫기</button>
          <button class="btn-primary" onclick="replyToMessage('${message.id}')">
            답장하기
          </button>
        </div>
      </div>
    `;
  }
}

// 메시지 목록 (받은 편지함 / 보낸 편지함)
class MessageInbox {
  async getInbox(userId: string) {
    return await db.messages
      .where('recipientId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();
  }
  
  async getSentbox(userId: string) {
    return await db.messages
      .where('senderId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();
  }
  
  async getUnreadCount(userId: string): Promise<number> {
    const unread = await db.messages
      .where('recipientId', '==', userId)
      .where('status', '==', 'SENT')
      .count();
    
    return unread;
  }
}
```

### 3.7 계층 구조 명확화

```typescript
// 엄격한 계층 관계
interface HierarchyStructure {
  company: {
    id: string;
    name: string;
    // 회사는 독립적
  };
  
  brand: {
    id: string;
    name: string;
    companyId: string;           // 반드시 회사에 속함
    // 브랜드는 반드시 회사 아래
  };
  
  store: {
    id: string;
    name: string;
    companyId: string;           // 회사 ID
    brandId: string;             // 반드시 브랜드에 속함
    // 매장은 반드시 브랜드 아래
  };
  
  staff: {
    id: string;
    name: string;
    companyId: string;           // 회사 ID
    brandId: string;             // 브랜드 ID
    storeId: string;             // 반드시 매장에 속함
    // 직원은 반드시 매장 아래
  };
}

// 데이터베이스 제약 조건
const databaseConstraints = `
  -- 브랜드는 반드시 회사에 속함
  ALTER TABLE brands
    ADD CONSTRAINT fk_brands_company
    FOREIGN KEY (company_id)
    REFERENCES companies(id)
    ON DELETE CASCADE;
  
  -- 매장은 반드시 브랜드에 속함
  ALTER TABLE stores
    ADD CONSTRAINT fk_stores_brand
    FOREIGN KEY (brand_id)
    REFERENCES brands(id)
    ON DELETE CASCADE;
  
  -- 매장의 회사 ID는 브랜드의 회사 ID와 일치해야 함
  ALTER TABLE stores
    ADD CONSTRAINT chk_stores_company
    CHECK (
      company_id = (
        SELECT company_id FROM brands WHERE id = brand_id
      )
    );
  
  -- 직원은 반드시 매장에 속함
  ALTER TABLE staff
    ADD CONSTRAINT fk_staff_store
    FOREIGN KEY (store_id)
    REFERENCES stores(id)
    ON DELETE RESTRICT;  -- 직원이 있으면 매장 삭제 불가
  
  -- 직원의 브랜드/회사 ID는 매장의 것과 일치해야 함
  ALTER TABLE staff
    ADD CONSTRAINT chk_staff_hierarchy
    CHECK (
      company_id = (SELECT company_id FROM stores WHERE id = store_id)
      AND
      brand_id = (SELECT brand_id FROM stores WHERE id = store_id)
    );
`;

// API 레벨 검증
class HierarchyValidator {
  // 매장 생성 시 검증
  async validateStoreCreation(data: {
    companyId: string;
    brandId: string;
  }) {
    const brand = await db.brands.findById(data.brandId);
    
    if (!brand) {
      throw new Error('브랜드가 존재하지 않습니다');
    }
    
    if (brand.companyId !== data.companyId) {
      throw new Error('브랜드가 해당 회사에 속하지 않습니다');
    }
  }
  
  // 직원 등록 시 검증
  async validateStaffCreation(data: {
    companyId: string;
    brandId: string;
    storeId: string;
  }) {
    const store = await db.stores.findById(data.storeId);
    
    if (!store) {
      throw new Error('매장이 존재하지 않습니다');
    }
    
    if (store.brandId !== data.brandId) {
      throw new Error('매장이 해당 브랜드에 속하지 않습니다');
    }
    
    if (store.companyId !== data.companyId) {
      throw new Error('매장이 해당 회사에 속하지 않습니다');
    }
  }
  
  // 데이터 조회 시 계층 필터
  async getStoresWithHierarchy(filters: {
    companyId?: string;
    brandId?: string;
  }) {
    let query = db.stores.query();
    
    if (filters.companyId) {
      query = query.where('companyId', '==', filters.companyId);
    }
    
    if (filters.brandId) {
      query = query.where('brandId', '==', filters.brandId);
      
      // 브랜드 ID로 필터할 때 회사 ID도 자동 확인
      const brand = await db.brands.findById(filters.brandId);
      if (brand && filters.companyId && brand.companyId !== filters.companyId) {
        throw new Error('계층 구조가 일치하지 않습니다');
      }
    }
    
    return await query.get();
  }
}

// UI에서 계층 선택
class HierarchySelector {
  render() {
    return `
      <!-- 1. 회사 선택 (플랫폼 관리자만) -->
      <select name="companyId" onchange="loadBrands(this.value)">
        <option value="">회사 선택</option>
        <!-- 회사 목록 -->
      </select>
      
      <!-- 2. 브랜드 선택 (회사 선택 후 활성화) -->
      <select name="brandId" disabled onchange="loadStores(this.value)">
        <option value="">브랜드 선택</option>
        <!-- 선택된 회사의 브랜드만 표시 -->
      </select>
      
      <!-- 3. 매장 선택 (브랜드 선택 후 활성화) -->
      <select name="storeId" disabled>
        <option value="">매장 선택</option>
        <!-- 선택된 브랜드의 매장만 표시 -->
      </select>
    `;
  }
  
  // 계층적 로딩
  async loadBrands(companyId: string) {
    const brands = await api.get(`/companies/${companyId}/brands`);
    // brandId select 업데이트
    // storeId select 초기화 및 비활성화
  }
  
  async loadStores(brandId: string) {
    const stores = await api.get(`/brands/${brandId}/stores`);
    // storeId select 업데이트
  }
}
```

---

## 4. 데이터베이스 설계

### 4.1 PostgreSQL 스키마

```sql
-- 회사
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  business_number VARCHAR(20) UNIQUE,
  ceo_name VARCHAR(100),
  address TEXT,
  phone VARCHAR(20),
  subscription_plan_id UUID,
  status VARCHAR(20) DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 브랜드
CREATE TABLE brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  logo_url TEXT,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(company_id, name)  -- 같은 회사 내 브랜드명 중복 방지
);

-- 매장
CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  phone VARCHAR(20),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  allowed_radius INTEGER DEFAULT 100,  -- 미터
  early_checkin_minutes INTEGER DEFAULT 30,
  early_checkout_minutes INTEGER DEFAULT 30,
  default_hourly_rate INTEGER,
  qr_code TEXT UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- 계층 검증
  CONSTRAINT chk_stores_company CHECK (
    company_id = (SELECT company_id FROM brands WHERE id = brand_id)
  ),
  
  UNIQUE(brand_id, name)  -- 같은 브랜드 내 매장명 중복 방지
);

-- 사용자
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(50) NOT NULL,  -- platform_admin, company_admin, manager, store_manager, team_leader, staff
  
  company_id UUID REFERENCES companies(id),
  brand_id UUID REFERENCES brands(id),
  store_id UUID REFERENCES stores(id),
  team_id UUID,
  
  phone VARCHAR(20),
  address TEXT,
  birth_date DATE,
  ssn_encrypted TEXT,  -- 주민번호 암호화
  position VARCHAR(100),
  
  bank_name VARCHAR(100),
  bank_account VARCHAR(50),
  account_holder VARCHAR(100),
  
  status VARCHAR(20) DEFAULT 'PENDING',  -- PENDING, ACTIVE, INACTIVE, SUSPENDED
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP,
  
  -- 계층 검증
  CONSTRAINT chk_users_hierarchy CHECK (
    (store_id IS NULL) OR
    (
      company_id = (SELECT company_id FROM stores WHERE id = store_id)
      AND
      brand_id = (SELECT brand_id FROM stores WHERE id = store_id)
    )
  )
);

-- 팀
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  brand_id UUID NOT NULL REFERENCES brands(id),
  store_id UUID NOT NULL REFERENCES stores(id),
  name VARCHAR(100) NOT NULL,
  leader_id UUID REFERENCES users(id),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(store_id, name)
);

-- 계약서
CREATE TABLE contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number VARCHAR(50) UNIQUE,
  
  staff_id UUID NOT NULL REFERENCES users(id),
  company_id UUID NOT NULL,
  brand_id UUID NOT NULL,
  store_id UUID NOT NULL,
  
  -- 기본 정보
  contract_type VARCHAR(50),  -- 정규직, 계약직, 아르바이트, 인턴
  start_date DATE NOT NULL,
  end_date DATE,
  probation_months INTEGER,
  
  -- 근무 조건
  work_schedules JSONB,  -- 복수 패턴
  position VARCHAR(100),
  department VARCHAR(100),
  duties TEXT[],
  
  -- 급여 (상세)
  salary_config JSONB NOT NULL,  -- 기본급, 수당, 상여금
  deduction_config JSONB NOT NULL,  -- 공제 항목
  
  -- 근무시간
  standard_hours_per_week INTEGER DEFAULT 40,
  standard_hours_per_day INTEGER DEFAULT 8,
  break_minutes INTEGER DEFAULT 60,
  
  -- 휴가
  annual_leave_days INTEGER,
  paid_leave_days INTEGER,
  sick_leave_days INTEGER,
  
  -- 복리후생
  benefits JSONB,
  
  -- 계약 조건
  terms JSONB,
  
  -- 해지
  termination_config JSONB,
  
  -- 서명
  employee_signed_at TIMESTAMP,
  employee_signature TEXT,
  employer_signed_at TIMESTAMP,
  employer_signature TEXT,
  
  -- 첨부
  attachments JSONB,
  
  status VARCHAR(20) DEFAULT 'DRAFT',  -- DRAFT, SENT, SIGNED, REJECTED
  
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 출퇴근 기록
CREATE TABLE attendances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES users(id),
  company_id UUID NOT NULL,
  brand_id UUID NOT NULL,
  store_id UUID NOT NULL,
  
  work_date DATE NOT NULL,
  
  -- 시간
  scheduled_check_in TIMESTAMP,
  scheduled_check_out TIMESTAMP,
  actual_check_in TIMESTAMP,
  actual_check_out TIMESTAMP,
  
  -- 상태
  status VARCHAR(20),  -- NORMAL, LATE, EARLY_LEAVE, ABSENT, VACATION
  
  -- 위치
  check_in_lat DECIMAL(10, 8),
  check_in_lng DECIMAL(11, 8),
  check_out_lat DECIMAL(10, 8),
  check_out_lng DECIMAL(11, 8),
  check_in_method VARCHAR(20),  -- QR, GEOFENCE, BEACON, MANUAL
  
  -- 시간 계산
  work_hours DECIMAL(5, 2),
  break_hours DECIMAL(5, 2),
  overtime_hours DECIMAL(5, 2),
  night_hours DECIMAL(5, 2),
  holiday_hours DECIMAL(5, 2),
  
  -- 금액
  base_pay INTEGER,
  overtime_pay INTEGER,
  night_pay INTEGER,
  holiday_pay INTEGER,
  daily_total INTEGER,
  
  -- 이상 감지
  anomalies JSONB,
  
  -- 확장 필드 (플러그인용)
  extensions JSONB,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(staff_id, work_date)
);

-- 급여
CREATE TABLE salaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES users(id),
  company_id UUID NOT NULL,
  
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  
  -- 기본급
  base_salary INTEGER DEFAULT 0,
  
  -- 수당
  overtime_pay INTEGER DEFAULT 0,
  night_pay INTEGER DEFAULT 0,
  holiday_pay INTEGER DEFAULT 0,
  weekly_holiday_pay INTEGER DEFAULT 0,
  
  -- 추가 수당
  meal_allowance INTEGER DEFAULT 0,
  transport_allowance INTEGER DEFAULT 0,
  position_allowance INTEGER DEFAULT 0,
  other_allowances JSONB,
  
  -- 총 지급액
  total_gross_pay INTEGER,
  
  -- 공제
  national_pension INTEGER DEFAULT 0,
  health_insurance INTEGER DEFAULT 0,
  long_term_care INTEGER DEFAULT 0,
  employment_insurance INTEGER DEFAULT 0,
  income_tax INTEGER DEFAULT 0,
  local_income_tax INTEGER DEFAULT 0,
  other_deductions JSONB,
  
  total_deductions INTEGER,
  
  -- 실수령액
  net_pay INTEGER,
  
  -- 근무 정보
  work_days INTEGER,
  total_hours DECIMAL(5, 2),
  
  -- 상태
  status VARCHAR(20) DEFAULT 'PENDING',  -- PENDING, CONFIRMED, PAID
  confirmed_at TIMESTAMP,
  confirmed_by UUID REFERENCES users(id),
  paid_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(staff_id, year, month)
);

-- 스케줄
CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES users(id),
  team_id UUID,
  company_id UUID NOT NULL,
  brand_id UUID NOT NULL,
  store_id UUID NOT NULL,
  
  work_date DATE NOT NULL,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  break_minutes INTEGER DEFAULT 60,
  
  status VARCHAR(20) DEFAULT 'SCHEDULED',  -- SCHEDULED, CONFIRMED, CANCELLED, COMPLETED
  
  -- AI 생성
  generated_by VARCHAR(20),  -- AI, MANUAL, CONTRACT
  ai_confidence DECIMAL(3, 2),
  
  -- 교환
  trade_request JSONB,
  
  -- 확장
  extensions JSONB,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(staff_id, work_date)
);

-- 승인 요청
CREATE TABLE approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL,
  requester_id UUID NOT NULL REFERENCES users(id),
  company_id UUID NOT NULL,
  brand_id UUID,
  store_id UUID,
  
  -- 승인 라인
  approval_line JSONB NOT NULL,
  current_step INTEGER DEFAULT 1,
  
  final_status VARCHAR(20) DEFAULT 'PENDING',
  
  -- 상세 내용
  details JSONB NOT NULL,
  
  -- 첨부
  attachments JSONB,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  finalized_at TIMESTAMP
);

-- 긴급 근무 모집
CREATE TABLE emergency_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id),
  company_id UUID NOT NULL,
  brand_id UUID NOT NULL,
  
  work_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  
  positions JSONB NOT NULL,  -- [{role, count}]
  
  reason VARCHAR(50),
  description TEXT,
  
  hourly_rate INTEGER NOT NULL,
  bonus INTEGER,
  benefits TEXT[],
  
  status VARCHAR(20) DEFAULT 'OPEN',
  deadline TIMESTAMP,
  
  applicants JSONB,
  
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 알림
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  category VARCHAR(50) NOT NULL,
  priority VARCHAR(20) NOT NULL,
  
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  image_url TEXT,
  
  actions JSONB,
  deep_link TEXT,
  data JSONB,
  
  sent BOOLEAN DEFAULT false,
  sent_at TIMESTAMP,
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP
);

CREATE INDEX idx_notifications_user ON notifications(user_id, read, created_at DESC);

-- 메시지
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES users(id),
  recipient_id UUID NOT NULL REFERENCES users(id),
  
  subject VARCHAR(255),
  body TEXT NOT NULL,
  
  attachments JSONB,
  
  status VARCHAR(20) DEFAULT 'SENT',
  read_at TIMESTAMP,
  
  reply_to UUID REFERENCES messages(id),
  has_replies BOOLEAN DEFAULT false,
  reply_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_messages_inbox ON messages(recipient_id, created_at DESC);
CREATE INDEX idx_messages_sentbox ON messages(sender_id, created_at DESC);

-- 세무 전송 이력
CREATE TABLE tax_transmissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  
  method VARCHAR(20),  -- EMAIL, FAX, API
  
  data JSONB NOT NULL,
  file_url TEXT,
  
  transmitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  transmitted_by UUID REFERENCES users(id),
  
  status VARCHAR(20) DEFAULT 'SUCCESS',
  error TEXT
);

-- Row Level Security (RLS) 활성화
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE salaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;

-- RLS 정책 예시 (회사별 격리)
CREATE POLICY company_isolation ON companies
  USING (id = current_setting('app.current_company_id')::uuid);

CREATE POLICY brand_isolation ON brands
  USING (company_id = current_setting('app.current_company_id')::uuid);

CREATE POLICY store_isolation ON stores
  USING (company_id = current_setting('app.current_company_id')::uuid);
```

### 4.2 인덱스 최적화

```sql
-- 성능 최적화 인덱스
CREATE INDEX idx_users_company ON users(company_id, status);
CREATE INDEX idx_users_store ON users(store_id, status);
CREATE INDEX idx_users_email ON users(email);

CREATE INDEX idx_attendances_staff_date ON attendances(staff_id, work_date DESC);
CREATE INDEX idx_attendances_store_date ON attendances(store_id, work_date DESC);

CREATE INDEX idx_salaries_staff ON salaries(staff_id, year DESC, month DESC);
CREATE INDEX idx_salaries_company ON salaries(company_id, year DESC, month DESC);

CREATE INDEX idx_schedules_staff_date ON schedules(staff_id, work_date);
CREATE INDEX idx_schedules_store_date ON schedules(store_id, work_date);

CREATE INDEX idx_approval_line ON approval_requests USING GIN(approval_line);

-- Full-Text Search
CREATE INDEX idx_users_search ON users USING GIN(to_tsvector('korean', name || ' ' || COALESCE(email, '')));
```

---

## 5. 모바일 최적화 UI/UX

### 5.1 모바일 퍼스트 원칙

```
🎯 핵심 원칙
├─ 터치 우선: 최소 44x44pt 터치 영역
├─ 단순화: 한 화면 하나의 작업
├─ 빠른 접근: 3탭 이내 모든 기능 도달
└─ 오프라인: 네트워크 끊어져도 기본 작업 가능
```

### 5.2 모바일 화면 설계

#### 직원 앱 (하단 탭 네비게이션)

```typescript
const StaffAppTabs = [
  {
    icon: '🏠',
    label: '홈',
    screen: 'HomeScreen',
    // 대시보드 + 빠른 작업
  },
  {
    icon: '⏰',
    label: '출퇴근',
    screen: 'AttendanceScreen',
    // QR 스캔 + 출퇴근 기록
  },
  {
    icon: '💰',
    label: '급여',
    screen: 'SalaryScreen',
    // 급여 조회 + 명세서
  },
  {
    icon: '📅',
    label: '스케줄',
    screen: 'ScheduleScreen',
    // 내 스케줄 + 교환 요청
  },
  {
    icon: '👤',
    label: '더보기',
    screen: 'MoreScreen',
    // 설정, 메시지, 공지사항
  }
];
```

#### 관리자 앱 (드로어 네비게이션)

```typescript
// 햄버거 메뉴 (왼쪽 슬라이드)
const AdminAppDrawer = [
  {
    section: '관리',
    items: [
      { icon: '📊', label: '대시보드', screen: 'Dashboard' },
      { icon: '👥', label: '직원 관리', screen: 'StaffManagement' },
      { icon: '⏰', label: '출퇴근 현황', screen: 'AttendanceManagement' },
      { icon: '💰', label: '급여 관리', screen: 'SalaryManagement' },
      { icon: '📅', label: '스케줄', screen: 'ScheduleManagement' }
    ]
  },
  {
    section: '승인',
    items: [
      { icon: '✅', label: '승인 관리', screen: 'ApprovalManagement', badge: 5 },
      { icon: '🚨', label: '긴급 근무', screen: 'EmergencyShift' }
    ]
  },
  {
    section: '설정',
    items: [
      { icon: '📝', label: '계약서', screen: 'ContractManagement' },
      { icon: '🏪', label: '매장 관리', screen: 'StoreManagement' },
      { icon: '📢', label: '공지사항', screen: 'NoticeManagement' },
      { icon: '⚙️', label: '설정', screen: 'Settings' }
    ]
  }
];
```

### 5.3 핵심 화면 UI

#### 직원 홈 화면 (모바일)

```jsx
function StaffHomeScreen() {
  return (
    <ScrollView>
      {/* 상단: 오늘 출퇴근 카드 */}
      <TodayAttendanceCard>
        {!checkedIn ? (
          <BigButton onPress={handleCheckIn}>
            🟢 출근하기
          </BigButton>
        ) : !checkedOut ? (
          <>
            <Text>출근 시간: 09:00</Text>
            <BigButton onPress={handleCheckOut}>
              🔴 퇴근하기
            </BigButton>
          </>
        ) : (
          <Text>✅ 오늘 근무 완료</Text>
        )}
      </TodayAttendanceCard>
      
      {/* 이번 달 통계 */}
      <StatsRow>
        <StatCard>
          <StatValue>22</StatValue>
          <StatLabel>근무일</StatLabel>
        </StatCard>
        <StatCard>
          <StatValue>176h</StatValue>
          <StatLabel>근무시간</StatLabel>
        </StatCard>
        <StatCard>
          <StatValue>₩1.2M</StatValue>
          <StatLabel>예상급여</StatLabel>
        </StatCard>
      </StatsRow>
      
      {/* 빠른 작업 */}
      <QuickActions>
        <QuickActionButton icon="🏖️" label="휴가 신청" />
        <QuickActionButton icon="⏰" label="초과근무" />
        <QuickActionButton icon="💌" label="메시지" />
        <QuickActionButton icon="📋" label="공지사항" />
      </QuickActions>
      
      {/* 다가오는 스케줄 */}
      <SectionTitle>이번 주 스케줄</SectionTitle>
      <ScheduleList>
        <ScheduleItem date="월" time="09:00-18:00" />
        <ScheduleItem date="화" time="휴무" isOff />
        <ScheduleItem date="수" time="14:00-22:00" />
      </ScheduleList>
      
      {/* 최근 알림 */}
      <SectionTitle>알림</SectionTitle>
      <NotificationList>
        <NotificationItem 
          title="급여 확정" 
          body="12월 급여가 확정되었습니다"
          time="1시간 전"
        />
      </NotificationList>
    </ScrollView>
  );
}

// 큰 터치 영역의 버튼
const BigButton = styled.TouchableOpacity`
  height: 60px;
  background: #3B82F6;
  border-radius: 12px;
  justify-content: center;
  align-items: center;
  margin: 16px 0;
`;
```

#### QR 출퇴근 화면 (전체 화면)

```jsx
function QRScanScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {/* QR 카메라 */}
      <Camera style={{ flex: 1 }}>
        {/* 가이드 영역 */}
        <ScanGuide>
          <CornerTL />
          <CornerTR />
          <CornerBL />
          <CornerBR />
        </ScanGuide>
        
        <GuideText>
          매장 QR 코드를 스캔하세요
        </GuideText>
      </Camera>
      
      {/* 하단 버튼 */}
      <BottomActions>
        <Button onPress={toggleFlash}>
          💡 플래시
        </Button>
        <Button onPress={closeCamera}>
          ✕ 닫기
        </Button>
      </BottomActions>
    </View>
  );
}
```

#### 승인 화면 (스와이프 액션)

```jsx
function ApprovalListScreen() {
  return (
    <SwipeableFlatList
      data={approvals}
      renderItem={({ item }) => (
        <SwipeableRow
          leftActions={[
            {
              text: '승인',
              color: '#22C55E',
              onPress: () => handleApprove(item.id)
            }
          ]}
          rightActions={[
            {
              text: '거부',
              color: '#EF4444',
              onPress: () => handleReject(item.id)
            }
          ]}
        >
          <ApprovalCard>
            <ApprovalHeader>
              <Avatar src={item.requester.avatar} />
              <div>
                <Name>{item.requester.name}</Name>
                <Type>{item.type}</Type>
              </div>
              <Badge>{item.status}</Badge>
            </ApprovalHeader>
            
            <ApprovalBody>
              {item.type === 'LEAVE' && (
                <>
                  <Row>
                    <Label>기간</Label>
                    <Value>{item.details.period}</Value>
                  </Row>
                  <Row>
                    <Label>사유</Label>
                    <Value>{item.details.reason}</Value>
                  </Row>
                </>
              )}
            </ApprovalBody>
            
            <ApprovalFooter>
              <Time>{formatTime(item.createdAt)}</Time>
              <Arrow>›</Arrow>
            </ApprovalFooter>
          </ApprovalCard>
        </SwipeableRow>
      )}
    />
  );
}

// 사용 팁 표시
<HelpBanner>
  ← 왼쪽으로 밀어서 승인 | 오른쪽으로 밀어서 거부 →
</HelpBanner>
```

#### 긴급 근무 모집 화면 (단순화)

```jsx
function EmergencyShiftScreen() {
  const [availableStaff, setAvailableStaff] = useState([]);
  
  // 가능한 직원 조회
  const loadAvailableStaff = async () => {
    const staff = await api.post('/emergency-shifts/recommend', {
      storeId: currentStore.id,
      date: selectedDate,
      startTime: startTime,
      endTime: endTime,
      position: selectedPosition
    });
    setAvailableStaff(staff);
  };
  
  return (
    <Container>
      {/* 모집 정보 입력 */}
      <Form>
        <DatePicker label="날짜" value={date} onChange={setDate} />
        <TimePicker label="시작" value={startTime} onChange={setStartTime} />
        <TimePicker label="종료" value={endTime} onChange={setEndTime} />
        <Picker label="포지션" value={position} onChange={setPosition}>
          <option>주방</option>
          <option>홀</option>
          <option>계산</option>
        </Picker>
        <Input label="시급" value={hourlyRate} onChange={setHourlyRate} />
      </Form>
      
      <BigButton onPress={loadAvailableStaff}>
        📋 가능한 직원 찾기
      </BigButton>
      
      {/* 추천 직원 목록 */}
      <SectionTitle>
        가능한 직원 ({availableStaff.length}명)
      </SectionTitle>
      
      <StaffList>
        {availableStaff.map(staff => (
          <StaffCard 
            key={staff.id}
            selected={selectedStaff.includes(staff.id)}
            onPress={() => toggleStaff(staff.id)}
          >
            <Checkbox checked={selectedStaff.includes(staff.id)} />
            
            <StaffInfo>
              <StaffName>{staff.name}</StaffName>
              <StaffPhone>{staff.phone}</StaffPhone>
            </StaffInfo>
            
            {/* 경험 표시 */}
            <ExperienceBadge>
              {staff.hasExperience ? (
                <ExperienceText>
                  ✅ {staff.workCount}회 근무
                </ExperienceText>
              ) : (
                <NoExperienceText>
                  신규
                </NoExperienceText>
              )}
            </ExperienceBadge>
          </StaffCard>
        ))}
      </StaffList>
      
      {/* 선택한 직원에게 알림 발송 */}
      <FixedBottom>
        <BigButton 
          onPress={sendInvitations}
          disabled={selectedStaff.length === 0}
        >
          {selectedStaff.length}명에게 초대 발송
        </BigButton>
      </FixedBottom>
    </Container>
  );
}
```

### 5.4 모바일 디자인 시스템

```typescript
// 모바일 최적화 디자인 토큰
const mobileDesign = {
  // 터치 영역
  touchTarget: {
    minimum: 44,      // 최소 44x44pt
    recommended: 48   // 권장 48x48pt
  },
  
  // 여백 (작은 화면 대응)
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32
  },
  
  // 폰트 크기 (가독성)
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,         // 본문 기본
    lg: 18,
    xl: 20,
    '2xl': 24,        // 제목
    '3xl': 30         // 큰 숫자
  },
  
  // 버튼 높이
  button: {
    small: 36,
    medium: 44,
    large: 56
  },
  
  // 색상 (명확한 대비)
  colors: {
    primary: '#3B82F6',
    success: '#22C55E',
    warning: '#F59E0B',
    error: '#EF4444',
    gray: {
      50: '#F9FAFB',
      100: '#F3F4F6',
      500: '#6B7280',
      900: '#111827'
    }
  },
  
  // 그림자 (깊이감)
  shadow: {
    sm: '0 1px 2px rgba(0,0,0,0.05)',
    md: '0 4px 6px rgba(0,0,0,0.1)',
    lg: '0 10px 15px rgba(0,0,0,0.1)'
  },
  
  // 애니메이션 (부드러움)
  animation: {
    fast: '150ms',
    normal: '300ms',
    slow: '500ms'
  }
};

// 공통 컴포넌트
const MobileComponents = {
  // 큰 버튼
  BigButton: styled.TouchableOpacity`
    height: 56px;
    background-color: ${props => props.variant === 'primary' ? '#3B82F6' : '#6B7280'};
    border-radius: 12px;
    justify-content: center;
    align-items: center;
    margin: 16px;
  `,
  
  // 카드
  Card: styled.View`
    background-color: white;
    border-radius: 12px;
    padding: 16px;
    margin: 8px 16px;
    shadow-color: #000;
    shadow-offset: 0px 2px;
    shadow-opacity: 0.1;
    shadow-radius: 4px;
    elevation: 3;
  `,
  
  // 입력 필드
  Input: styled.TextInput`
    height: 48px;
    border: 1px solid #E5E7EB;
    border-radius: 8px;
    padding: 0 16px;
    font-size: 16px;
    background-color: white;
  `,
  
  // 리스트 아이템
  ListItem: styled.TouchableOpacity`
    flex-direction: row;
    align-items: center;
    padding: 16px;
    border-bottom: 1px solid #F3F4F6;
    min-height: 60px;
  `,
  
  // 뱃지
  Badge: styled.View`
    background-color: ${props => props.color || '#EF4444'};
    border-radius: 12px;
    padding: 4px 12px;
    align-self: flex-start;
  `
};
```

### 5.5 제스처 및 인터랙션

```typescript
// 자주 쓰는 제스처
const GesturePatterns = {
  // 당겨서 새로고침
  pullToRefresh: (
    <ScrollView
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {content}
    </ScrollView>
  ),
  
  // 스와이프 삭제/액션
  swipeActions: (
    <Swipeable
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
    >
      {content}
    </Swipeable>
  ),
  
  // 길게 눌러서 메뉴
  longPress: (
    <TouchableOpacity
      onLongPress={() => showContextMenu()}
      delayLongPress={500}
    >
      {content}
    </TouchableOpacity>
  ),
  
  // 햅틱 피드백
  hapticFeedback: {
    light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
    medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
    heavy: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
    success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
    error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
  }
};

// 사용 예시
async function handleCheckIn() {
  await api.checkIn();
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  showToast('출근 완료!');
}
```

### 5.6 오프라인 지원

```typescript
// 오프라인 큐 시스템
class OfflineQueue {
  async queueAction(action: Action) {
    // 로컬 DB에 저장
    await AsyncStorage.setItem(
      `offline_action_${action.id}`,
      JSON.stringify(action)
    );
  }
  
  async syncWhenOnline() {
    if (!NetInfo.isConnected) return;
    
    // 저장된 액션 가져오기
    const keys = await AsyncStorage.getAllKeys();
    const offlineKeys = keys.filter(k => k.startsWith('offline_action_'));
    
    for (const key of offlineKeys) {
      const actionStr = await AsyncStorage.getItem(key);
      const action = JSON.parse(actionStr);
      
      try {
        await api.execute(action);
        await AsyncStorage.removeItem(key);
      } catch (error) {
        console.error('Sync failed:', error);
      }
    }
  }
}

// 네트워크 상태 표시
function NetworkBanner() {
  const [isOnline, setIsOnline] = useState(true);
  
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected);
    });
    
    return unsubscribe;
  }, []);
  
  if (isOnline) return null;
  
  return (
    <OfflineBanner>
      ⚠️ 오프라인 모드 - 연결 시 자동 동기화됩니다
    </OfflineBanner>
  );
}
```

---

## 6. 확장성 설계

### 6.1 근로기준법 자동 업데이트 시스템

#### 📅 근로기준법 업데이트 주기

```
실제 업데이트 주기:
- 최저임금: 매년 1월 1일 (전년도 8월 결정)
- 4대보험 요율: 매년 1월 또는 7월 변경
- 법령 개정: 부정기적 (시행령, 시행규칙)

예시:
2025년 1월 1일: 최저시급 9,860원
2026년 1월 1일: 최저시급 10,030원 (예정)
```

#### 🔄 업데이트 방법 (3단계)

```typescript
// 방법 1: 수동 업데이트 (가장 안전, 권장) ✅
// 플랫폼 관리자가 직접 입력

1. 고용노동부 공식 발표 확인
   - https://www.moel.go.kr (고용노동부)
   - 최저임금위원회 고시
   - 국민연금공단/건강보험공단 공지

2. 플랫폼 대시보드에서 신규 버전 생성
   - 버전명: "2026.01"
   - 시행일: 2026-01-01
   - 최저시급: 10,030원 입력
   - 보험 요율 입력

3. 검증 및 승인
   - 법무팀/세무사 검토
   - 시행일 전에 미리 등록
   - 시행일 00:00에 자동 적용

4. 자동 적용
   - 시행일이 되면 Cron Job 실행
   - 모든 회사에 자동 반영
   - 급여 계산 로직 업데이트

// 방법 2: 반자동 (웹 크롤링) - 향후
interface LaborLawCrawler {
  // 정부 사이트 주기적 모니터링
  async checkGovernmentWebsite() {
    const sources = [
      'https://www.moel.go.kr',  // 고용노동부
      'https://www.nps.or.kr',   // 국민연금
      'https://www.nhis.or.kr'   // 건강보험
    ];
    
    for (const url of sources) {
      const updates = await this.scrapeUpdates(url);
      if (updates.length > 0) {
        await this.notifyPlatformAdmin(updates);
      }
    }
  }
  
  // 플랫폼 관리자가 최종 승인
  async approveAndApply(updateId: string) {
    const update = await db.lawUpdates.findById(updateId);
    update.status = 'APPROVED';
    await this.scheduleAutoApply(update);
  }
}

// 방법 3: 완전 자동 (API 연동) - 정부 API 제공 시
// 현재는 공식 Open API 없음
// 향후 고용노동부에서 제공할 경우 연동
```

#### 🗄️ 근로기준법 데이터 구조

```sql
-- 법령 버전 테이블
CREATE TABLE labor_law_versions (
  id UUID PRIMARY KEY,
  version VARCHAR(20) NOT NULL,           -- "2026.01"
  effective_date DATE NOT NULL,           -- 2026-01-01
  source TEXT,                            -- 출처 URL
  
  -- 핵심 데이터
  minimum_wage_hourly INTEGER NOT NULL,  -- 10030 (원)
  
  -- 근로시간
  standard_daily_hours INTEGER DEFAULT 8,
  standard_weekly_hours INTEGER DEFAULT 40,
  max_weekly_hours INTEGER DEFAULT 52,   -- 연장 포함
  
  -- 수당 비율 (배수)
  overtime_rate DECIMAL(3,2) DEFAULT 1.5,
  night_rate DECIMAL(3,2) DEFAULT 0.5,
  holiday_rate DECIMAL(3,2) DEFAULT 1.5,
  
  -- 4대보험 요율 (%)
  national_pension_rate DECIMAL(4,2) DEFAULT 4.5,
  health_insurance_rate DECIMAL(5,3) DEFAULT 3.545,
  long_term_care_rate DECIMAL(5,3) DEFAULT 12.81,  -- 건보의 %
  employment_insurance_rate DECIMAL(4,2) DEFAULT 0.9,
  
  -- 상태
  status VARCHAR(20) DEFAULT 'DRAFT',    -- DRAFT, VERIFIED, ACTIVE, ARCHIVED
  verified_by UUID,                       -- 검증자 (플랫폼 관리자)
  verified_at TIMESTAMP,
  
  -- 변경 이력
  changelog TEXT,
  previous_version_id UUID REFERENCES labor_law_versions(id),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  activated_at TIMESTAMP                  -- 실제 적용 시각
);

-- 변경사항 로그
CREATE TABLE law_change_logs (
  id UUID PRIMARY KEY,
  version_id UUID REFERENCES labor_law_versions(id),
  field_name VARCHAR(100),
  old_value TEXT,
  new_value TEXT,
  impact_level VARCHAR(20),              -- HIGH, MEDIUM, LOW
  affected_companies INTEGER,            -- 영향받는 회사 수
  affected_contracts INTEGER,            -- 영향받는 계약서 수
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 🔔 업데이트 프로세스

```typescript
// Step 1: 플랫폼 관리자가 신규 버전 생성
async function createNewLawVersion(data: {
  version: string;
  effectiveDate: Date;
  minimumWage: number;
  insuranceRates: InsuranceRates;
}) {
  // 1. 버전 생성
  const newVersion = await db.laborLawVersions.create({
    version: data.version,
    effectiveDate: data.effectiveDate,
    minimumWageHourly: data.minimumWage,
    ...data.insuranceRates,
    status: 'DRAFT'
  });
  
  // 2. 현재 버전과 비교
  const currentVersion = await db.laborLawVersions
    .where('status', '==', 'ACTIVE')
    .first();
  
  const changes = compareVersions(currentVersion, newVersion);
  
  // 3. 변경 로그 생성
  for (const change of changes) {
    await db.lawChangeLogs.create({
      versionId: newVersion.id,
      fieldName: change.field,
      oldValue: change.oldValue,
      newValue: change.newValue,
      impactLevel: change.impact
    });
  }
  
  // 4. 영향도 분석
  const analysis = await analyzeImpact(newVersion);
  
  return { newVersion, changes, analysis };
}

// Step 2: 시행일에 자동 적용 (Cron Job - 매일 00:00 실행)
async function applyScheduledLawUpdates() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // 오늘 시행되는 법령 찾기
  const pendingUpdates = await db.laborLawVersions
    .where('effectiveDate', '==', today)
    .where('status', '==', 'VERIFIED')
    .get();
  
  for (const update of pendingUpdates) {
    await applyLawUpdate(update);
  }
}

async function applyLawUpdate(version: LaborLawVersion) {
  // 1. 현재 활성 버전을 ARCHIVED로
  await db.laborLawVersions
    .where('status', '==', 'ACTIVE')
    .update({ status: 'ARCHIVED' });
  
  // 2. 새 버전을 ACTIVE로
  await db.laborLawVersions
    .doc(version.id)
    .update({ 
      status: 'ACTIVE',
      activatedAt: new Date()
    });
  
  // 3. 시스템 전역 설정 업데이트
  await updateGlobalConfig({
    currentLawVersion: version.id,
    minimumWage: version.minimumWageHourly,
    insuranceRates: {
      nationalPension: version.nationalPensionRate,
      healthInsurance: version.healthInsuranceRate,
      employmentInsurance: version.employmentInsuranceRate
    }
  });
  
  // 4. 모든 회사 관리자에게 알림
  await notifyAllCompanies(version);
  
  // 5. 급여 계산 캐시 무효화
  await invalidateSalaryCache();
  
  console.log(`✅ 법령 ${version.version} 적용 완료`);
}
```

#### 📊 플랫폼 관리자 UI

```tsx
// 플랫폼 대시보드 > 근로기준법 관리
function LaborLawManagementPage() {
  return (
    <Container>
      {/* 현재 적용 중인 법령 */}
      <CurrentLawCard>
        <Title>현재 적용 중</Title>
        <Version>2025.01</Version>
        <Details>
          <Row>
            <Label>최저시급</Label>
            <Value>₩9,860</Value>
          </Row>
          <Row>
            <Label>시행일</Label>
            <Value>2025-01-01</Value>
          </Row>
          <Row>
            <Label>적용 회사</Label>
            <Value>1,247개</Value>
          </Row>
        </Details>
      </CurrentLawCard>
      
      {/* 예정된 업데이트 */}
      <UpcomingUpdatesCard>
        <Title>예정된 업데이트</Title>
        <UpdateItem status="VERIFIED">
          <Version>2026.01</Version>
          <EffectiveDate>2026-01-01 시행</EffectiveDate>
          <Changes>
            <Change>최저시급: ₩9,860 → ₩10,030 (+1.7%)</Change>
            <Change>건강보험: 3.545% → 3.595% (+0.05%p)</Change>
          </Changes>
          <Badge variant="success">검증 완료</Badge>
        </UpdateItem>
      </UpcomingUpdatesCard>
      
      {/* 신규 버전 생성 */}
      <Button onClick={openCreateModal}>
        + 신규 법령 버전 추가
      </Button>
      
      {/* 생성 모달 */}
      <CreateLawModal>
        <Form>
          <Input label="버전" placeholder="2026.01" />
          <DatePicker label="시행일" />
          <Input label="최저시급 (원)" type="number" />
          
          <Section title="4대보험 요율">
            <Input label="국민연금 (%)" defaultValue="4.5" />
            <Input label="건강보험 (%)" defaultValue="3.545" />
            <Input label="고용보험 (%)" defaultValue="0.9" />
          </Section>
          
          <Section title="수당 비율">
            <Input label="연장근로 (배)" defaultValue="1.5" />
            <Input label="야간근로 (배)" defaultValue="0.5" />
            <Input label="휴일근로 (배)" defaultValue="1.5" />
          </Section>
          
          <TextArea label="변경사항 설명" rows={5} />
          
          <Buttons>
            <Button variant="secondary">임시저장</Button>
            <Button variant="primary">검증 요청</Button>
          </Buttons>
        </Form>
      </CreateLawModal>
    </Container>
  );
}
```

#### 🔄 Cron Job 설정

```yaml
# Vercel Cron (vercel.json)
{
  "crons": [
    {
      "path": "/api/cron/apply-law-updates",
      "schedule": "0 0 * * *"  # 매일 00:00
    }
  ]
}

# 또는 자체 서버
# crontab -e
0 0 * * * curl https://api.abcstaff.com/cron/apply-law-updates
```

**요약:**
1. 플랫폼 관리자가 정부 발표 확인 후 수동 입력 (가장 안전)
2. 시행일 전에 미리 등록 및 검증
3. 시행일 00:00에 Cron Job이 자동 적용
4. 모든 회사에 즉시 반영 + 알림 발송


```typescript
// 근로기준법 설정 관리
interface LaborLawConfig {
  version: string;              // 예: "2026.01"
  effectiveDate: Date;          // 시행일
  
  // 근로시간
  workingHours: {
    standardDaily: number;      // 1일 8시간
    standardWeekly: number;     // 주 40시간
    maxWeeklyWithOT: number;    // 주 52시간 (연장 포함)
  };
  
  // 임금
  minimumWage: {
    hourly: number;             // 최저시급
    effectiveDate: Date;
  };
  
  // 수당 비율
  allowanceRates: {
    overtime: number;           // 연장근로 1.5배
    night: number;              // 야간근로 0.5배
    holiday: number;            // 휴일근로 1.5배
  };
  
  // 휴게시간
  breakTime: {
    for4Hours: number;          // 4시간당 30분
    for8Hours: number;          // 8시간당 1시간
  };
  
  // 주휴수당
  weeklyHolidayPay: {
    minimumHours: number;       // 주 15시간 이상
    paymentRate: number;        // 1일치 급여
  };
  
  // 연차
  annualLeave: {
    basicDays: number;          // 기본 15일
    perYear: number;            // 매 2년마다 1일 추가
    maxDays: number;            // 최대 25일
  };
  
  // 퇴직금
  severancePay: {
    minimumService: number;     // 1년 이상 근무
    calculationBase: number;    // 30일분 평균임금
  };
  
  // 4대보험 요율
  insuranceRates: {
    nationalPension: number;    // 4.5%
    healthInsurance: number;    // 3.545%
    longTermCare: number;       // 건보의 12.81%
    employmentInsurance: number; // 0.9%
  };
}

// 법령 자동 업데이트 서비스
class LaborLawUpdateService {
  // 정기 확인 (매일 1회)
  async checkForUpdates() {
    try {
      // 고용노동부 공식 API 또는 크롤링
      const latestLaw = await this.fetchLatestLaw();
      const currentLaw = await this.getCurrentLaw();
      
      if (latestLaw.version !== currentLaw.version) {
        await this.notifyAdmins(latestLaw);
        await this.prepareUpdate(latestLaw);
      }
    } catch (error) {
      console.error('법령 확인 실패:', error);
    }
  }
  
  // 최신 법령 조회
  private async fetchLatestLaw(): Promise<LaborLawConfig> {
    // 방법 1: 고용노동부 Open API (있다면)
    // 방법 2: 공식 웹사이트 크롤링
    // 방법 3: 자체 관리형 DB (수동 업데이트)
    
    // 예시: 자체 관리
    const response = await fetch('https://api.yourservice.com/labor-law/latest');
    return await response.json();
  }
  
  // 관리자에게 알림
  private async notifyAdmins(newLaw: LaborLawConfig) {
    const admins = await db.users
      .where('role', 'in', ['platform_admin', 'company_admin'])
      .get();
    
    for (const admin of admins) {
      await notification.send(admin.id, {
        type: NotificationCategory.SYSTEM,
        priority: NotificationPriority.HIGH,
        title: '⚖️ 근로기준법 업데이트 알림',
        body: `새로운 근로기준법(${newLaw.version})이 ${formatDate(newLaw.effectiveDate)}부터 시행됩니다.`,
        data: { newLaw },
        actions: [
          { id: 'REVIEW', title: '변경사항 확인' },
          { id: 'APPLY', title: '적용하기' }
        ]
      });
    }
  }
  
  // 업데이트 준비
  private async prepareUpdate(newLaw: LaborLawConfig) {
    // 변경사항 분석
    const changes = await this.analyzeChanges(newLaw);
    
    // 영향받는 계약서 및 급여 계산 확인
    const impactedContracts = await this.findImpactedContracts(changes);
    const impactedSalaries = await this.findImpactedSalaries(changes);
    
    // 업데이트 로그 생성
    await db.lawUpdates.create({
      version: newLaw.version,
      effectiveDate: newLaw.effectiveDate,
      changes: changes,
      impactedContracts: impactedContracts.length,
      impactedSalaries: impactedSalaries.length,
      status: 'PENDING_REVIEW'
    });
  }
  
  // 자동 적용 (시행일에)
  async autoApplyUpdate(lawId: string) {
    const law = await db.laborLaws.findById(lawId);
    
    if (new Date() < law.effectiveDate) {
      // 아직 시행일 전
      return;
    }
    
    // 1. 최저임금 업데이트
    if (law.minimumWage) {
      await this.updateMinimumWage(law.minimumWage);
    }
    
    // 2. 보험 요율 업데이트
    if (law.insuranceRates) {
      await this.updateInsuranceRates(law.insuranceRates);
    }
    
    // 3. 급여 계산 로직 업데이트
    await this.updateSalaryCalculation(law);
    
    // 4. 계약서 템플릿 업데이트
    await this.updateContractTemplates(law);
    
    // 5. 관리자에게 완료 알림
    await this.notifyUpdateCompleted(law);
  }
  
  // 영향 분석
  private async analyzeChanges(newLaw: LaborLawConfig) {
    const currentLaw = await this.getCurrentLaw();
    const changes: LawChange[] = [];
    
    // 최저임금 변경
    if (newLaw.minimumWage.hourly !== currentLaw.minimumWage.hourly) {
      changes.push({
        type: 'MINIMUM_WAGE',
        field: '최저시급',
        oldValue: currentLaw.minimumWage.hourly,
        newValue: newLaw.minimumWage.hourly,
        impact: 'HIGH'
      });
    }
    
    // 근로시간 변경
    if (newLaw.workingHours.maxWeeklyWithOT !== currentLaw.workingHours.maxWeeklyWithOT) {
      changes.push({
        type: 'WORKING_HOURS',
        field: '최대 주간 근로시간',
        oldValue: currentLaw.workingHours.maxWeeklyWithOT,
        newValue: newLaw.workingHours.maxWeeklyWithOT,
        impact: 'MEDIUM'
      });
    }
    
    // 보험 요율 변경
    Object.keys(newLaw.insuranceRates).forEach(key => {
      if (newLaw.insuranceRates[key] !== currentLaw.insuranceRates[key]) {
        changes.push({
          type: 'INSURANCE_RATE',
          field: key,
          oldValue: currentLaw.insuranceRates[key],
          newValue: newLaw.insuranceRates[key],
          impact: 'MEDIUM'
        });
      }
    });
    
    return changes;
  }
  
  // 급여 재계산 (소급 적용 필요 시)
  async recalculateSalaries(fromDate: Date, toDate: Date, changes: LawChange[]) {
    const salaries = await db.salaries
      .where('year', '>=', fromDate.getFullYear())
      .where('month', '>=', fromDate.getMonth() + 1)
      .get();
    
    for (const salary of salaries) {
      const recalculated = await this.calculateSalaryWithNewLaw(salary, changes);
      
      if (recalculated.netPay !== salary.netPay) {
        // 차액 발생
        await db.salaryAdjustments.create({
          salaryId: salary.id,
          staffId: salary.staffId,
          reason: `근로기준법 개정 (${changes.map(c => c.field).join(', ')})`,
          oldAmount: salary.netPay,
          newAmount: recalculated.netPay,
          difference: recalculated.netPay - salary.netPay,
          status: 'PENDING_APPROVAL'
        });
      }
    }
  }
}

// 관리자 대시보드에 법령 업데이트 섹션
function LaborLawUpdatePanel() {
  const [pendingUpdates, setPendingUpdates] = useState([]);
  
  useEffect(() => {
    loadPendingUpdates();
  }, []);
  
  return (
    <Panel title="⚖️ 근로기준법 업데이트">
      {pendingUpdates.length === 0 ? (
        <EmptyState>
          ✅ 최신 근로기준법이 적용되어 있습니다.
        </EmptyState>
      ) : (
        <UpdateList>
          {pendingUpdates.map(update => (
            <UpdateCard key={update.id}>
              <UpdateHeader>
                <Version>{update.version}</Version>
                <EffectiveDate>
                  시행일: {formatDate(update.effectiveDate)}
                </EffectiveDate>
              </UpdateHeader>
              
              <ChangesList>
                {update.changes.map(change => (
                  <ChangeItem impact={change.impact}>
                    <ChangeType>{change.field}</ChangeType>
                    <ChangeValue>
                      {change.oldValue} → {change.newValue}
                    </ChangeValue>
                  </ChangeItem>
                ))}
              </ChangesList>
              
              <ImpactSummary>
                <ImpactItem>
                  영향받는 계약서: {update.impactedContracts}건
                </ImpactItem>
                <ImpactItem>
                  재계산 필요 급여: {update.impactedSalaries}건
                </ImpactItem>
              </ImpactSummary>
              
              <UpdateActions>
                <Button variant="secondary" onClick={() => reviewChanges(update.id)}>
                  변경사항 상세 보기
                </Button>
                <Button variant="primary" onClick={() => applyUpdate(update.id)}>
                  적용하기
                </Button>
              </UpdateActions>
            </UpdateCard>
          ))}
        </UpdateList>
      )}
    </Panel>
  );
}
```

**법령 데이터 관리 전략**

```typescript
// 1. 자체 관리 DB (권장)
// - 플랫폼 관리자가 수동으로 업데이트
// - 검증된 데이터만 사용
// - 법무팀 검토 후 적용

// 2. 외부 API 연동 (고도화)
// - 고용노동부 Open API (있다면)
// - 법제처 국가법령정보센터 API
// - 주기적 크롤링 + 관리자 승인

// 3. 버전 관리
interface LaborLawVersion {
  id: string;
  version: string;
  effectiveDate: Date;
  source: string;              // 출처
  verifiedBy: string;          // 검증자
  verifiedAt: Date;
  config: LaborLawConfig;
  previousVersionId?: string;
  changelog: string;
  status: 'DRAFT' | 'VERIFIED' | 'ACTIVE' | 'ARCHIVED';
}

// 4. 롤백 기능
async function rollbackToVersion(versionId: string) {
  const version = await db.laborLaws.findById(versionId);
  await LaborLawUpdateService.applyUpdate(version);
  
  // 영향받은 급여 재계산
  await LaborLawUpdateService.recalculateSalaries(
    version.effectiveDate,
    new Date(),
    []
  );
}
```

### 6.2 발주 시스템 연동 준비

```typescript
// 발주 플러그인 인터페이스
interface PurchaseOrderPlugin {
  // 발주서 생성
  createPurchaseOrder(data: {
    approvalId: string;        // 승인된 구매 요청
    vendorId: string;
    items: PurchaseItem[];
    deliveryDate: Date;
  }): Promise<PurchaseOrder>;
  
  // 입고 처리
  receiveOrder(orderId: string, receivedItems: ReceivedItem[]): Promise<void>;
  
  // 재고 연동
  updateInventory(items: InventoryUpdate[]): Promise<void>;
  
  // 회계 연동
  syncToAccounting(orderId: string): Promise<void>;
}

// 발주서 데이터 구조
interface PurchaseOrder {
  id: string;
  orderNumber: string;
  
  storeId: string;
  vendorId: string;
  
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  
  subtotal: number;
  tax: number;
  total: number;
  
  status: 'ORDERED' | 'CONFIRMED' | 'SHIPPED' | 'RECEIVED' | 'CANCELLED';
  
  orderedAt: Date;
  expectedDeliveryDate: Date;
  receivedAt?: Date;
}
```

---

## 7. 개발 로드맵

### Phase 1: MVP (6주) ⭐ 최우선

```
Week 1-2: 기반 인프라
✅ Supabase 설정 (DB + Auth + Storage)
✅ Next.js 프로젝트 초기화
✅ 데이터베이스 스키마 생성
✅ 기본 인증 (로그인/회원가입)
✅ 계층 구조 (회사>브랜드>매장)

Week 3-4: 계약서 시스템 🔥 핵심
✅ 상세 계약서 작성 폼
✅ 모든 급여/공제 항목 입력
✅ PDF 생성 (주민번호, 주소 포함)
✅ 전자서명
✅ 계약서 기반 스케줄 자동 생성

Week 5-6: 출퇴근 & 급여
✅ QR 코드 생성
✅ QR 스캔 출퇴근
✅ 근태 자동 기록
✅ 급여 자동 계산
✅ 세무대리인 엑셀 생성
```

### Phase 2: 모바일 & 핵심 기능 (4주)

```
Week 7-8: React Native 앱
✅ 직원 앱 (하단 탭)
  - 홈 (출퇴근 카드)
  - 출퇴근 (QR 스캔)
  - 급여 조회
  - 스케줄 확인
✅ 푸시 알림 (FCM)
✅ 오프라인 모드

Week 9-10: 승인 & 긴급근무
✅ 확장된 승인 시스템
  - 휴가, 초과근무
  - 구매, 폐기
  - 사직서, 결근 사유
✅ 긴급 근무 모집
  - 가능 인원 조회
  - 경험치 표시
  - 푸시 초대
✅ 메시지 시스템 (모달)
```

### Phase 3: 완성도 & 배포 (2주)

```
Week 11: 마무리
✅ 공지사항 기능
✅ 근로기준법 자동 업데이트 (수동 관리)
✅ 관리자 웹 대시보드 완성
✅ UI/UX 개선
✅ 성능 최적화

Week 12: 테스트 & 배포
✅ 통합 테스트
✅ 버그 수정
✅ 문서화
✅ 배포
  - 웹: Vercel
  - 앱: App Store / Play Store
```

### 주요 마일스톤

```
📅 6주차: MVP 완성
  - 계약서 작성 → 스케줄 생성 → 출퇴근 → 급여 계산
  - 데모 가능

📅 10주차: 베타 버전
  - 모바일 앱 완성
  - 실제 매장에서 테스트 가능

📅 12주차: 정식 출시
  - 모든 기능 완성
  - 프로덕션 배포
```

### 개발 우선순위

```
Priority 1 (필수):
├─ 계약서 시스템 (완벽해야 함)
├─ 출퇴근 QR
├─ 급여 자동 계산
├─ 세무 전송
└─ 모바일 앱

Priority 2 (중요):
├─ 승인 관리
├─ 긴급 근무 모집
├─ 푸시 알림
└─ 메시지 시스템

Priority 3 (향후):
├─ 근로기준법 자동 업데이트 (고도화)
├─ HACCP 플러그인
└─ 발주 시스템
```

### 팀 구성 (권장)

```
최소 인원 (3명):
├─ 풀스택 개발자 1명 (백엔드 + 웹)
├─ React Native 개발자 1명 (모바일)
└─ UI/UX 디자이너 0.5명 (파트타임)

이상적 (5명):
├─ 백엔드 개발자 1명 (NestJS/PostgreSQL)
├─ 프론트엔드 개발자 1명 (Next.js)
├─ 모바일 개발자 1명 (React Native)
├─ UI/UX 디자이너 1명
└─ PM/QA 1명
```

---

## 8. 체크리스트

### 개발 전 확인사항

```
인프라:
☐ Supabase 계정 생성
☐ Vercel 계정 생성
☐ Firebase 프로젝트 생성 (FCM)
☐ Apple Developer 계정 ($99/년)
☐ Google Play Console ($25)
☐ 도메인 구매

법률/컴플라이언스:
☐ 개인정보처리방침 작성
☐ 이용약관 작성
☐ 근로기준법 검토
☐ 전자계약 법적 효력 확인
☐ 개인정보보호법 준수

디자인:
☐ 브랜딩 (로고, 컬러)
☐ 웹 디자인 시스템
☐ 모바일 UI 디자인
☐ 아이콘 세트

기능:
☐ 계약서 양식 (법무 검토)
☐ 급여 계산 로직 (세무사 검토)
☐ QR 코드 생성 방식
☐ 푸시 알림 메시지
```

### 출시 전 체크리스트

```
기술:
☐ 보안 감사
☐ 성능 테스트
☐ 부하 테스트
☐ 모바일 호환성 (iOS/Android)
☐ 브라우저 호환성
☐ 오류 모니터링 (Sentry)
☐ 백업 시스템

법률:
☐ 개인정보처리방침 게시
☐ 이용약관 게시
☐ 사업자등록증
☐ 통신판매업 신고

마케팅:
☐ 랜딩 페이지
☐ 데모 영상
☐ 사용자 매뉴얼
☐ 고객지원 채널
```

---

**문서 끝**

> 💡 **다음 단계**: 
> 1. Supabase 프로젝트 생성
> 2. 데이터베이스 스키마 적용
> 3. Next.js 프로젝트 초기화
> 4. 계약서 작성 UI부터 시작!
