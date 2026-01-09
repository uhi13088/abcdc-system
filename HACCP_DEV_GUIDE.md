# HACCP 관리 앱 - 개발 가이드 (식품 제조업 전용)

> **목적**: 기존 스프레드시트 기반 HACCP 관리를 모바일 앱으로 전환  
> **대상**: 식품 제조 공장 ⭐  
> **통합**: ABC Staff System과 연동  
> **확장**: 나중에 다른 업종 추가 가능하도록 설계

---

## 📋 목차

1. [HACCP 시스템 개요](#1-haccp-시스템-개요)
2. [기존 스프레드시트 분석 (9개 모듈)](#2-기존-스프레드시트-분석)
3. [데이터베이스 설계](#3-데이터베이스-설계)
4. [모바일 앱 화면 설계](#4-모바일-앱-화면-설계)
5. [API 엔드포인트](#5-api-엔드포인트)
6. [Staff System 연동](#6-staff-system-연동)
7. [자동화 및 스마트 기능](#7-자동화-및-스마트-기능)
8. [개발 우선순위](#8-개발-우선순위)
9. [확장 가능성](#9-확장-가능성)

---

## 1. HACCP 시스템 개요

### 1.1 HACCP이란?

```
HACCP (Hazard Analysis Critical Control Point)
= 위해요소 중점관리 기준

목적: 식품 안전 관리
대상: 식품 제조/가공 업체
의무: 일정 규모 이상 사업장 필수
```

### 1.2 핵심 관리 영역 (9개 모듈)

```
📊 기존 스프레드시트 기준

1. Master DB            → 기준 데이터 관리
2. 일반위생 점검        → 일일 위생 체크
3. CCP 관리            → 중요관리점 모니터링
4. 원부재료 검사        → 입고 시 품질 확인
5. 완제품 생산/출하     → 생산량 및 출하 기록
6. 방충/방서 관리       → 해충 방제
7. CCP 검증            → 월간 검증
8. 원료 수불           → 원료 입출고 관리
9. 반제품 관리         → 중간 제품 관리
```

---

## 2. 기존 스프레드시트 분석

### 2.1 Master DB (마스터 데이터)

**목적**: 기준 정보 및 기본 설정

```typescript
interface MasterData {
  // 회사 정보
  company: {
    name: string;
    businessNumber: string;
    address: string;
    representative: string;
    haccpCertNumber: string;      // HACCP 인증번호
    certExpiry: Date;              // 인증 만료일
  };
  
  // 제품 정보
  products: Array<{
    id: string;
    code: string;                  // 제품코드
    name: string;                  // 제품명
    category: string;              // 카테고리
    specification: string;         // 규격
    shelfLife: number;             // 유통기한 (일)
    storageCondition: string;      // 보관조건
  }>;
  
  // 원부재료
  materials: Array<{
    id: string;
    code: string;                  // 자재코드
    name: string;                  // 자재명
    type: '원료' | '부재료' | '포장재';
    supplier: string;              // 공급업체
    specification: string;
    storageTemp: string;           // 보관온도
  }>;
  
  // 공급업체
  suppliers: Array<{
    id: string;
    code: string;
    name: string;
    contact: string;
    address: string;
    certifications: string[];      // 인증서류
  }>;
  
  // CCP 정의
  ccpDefinitions: Array<{
    id: string;
    ccpNumber: string;             // CCP-1, CCP-2 등
    process: string;               // 공정명
    hazard: string;                // 위해요소
    controlMeasure: string;        // 관리방법
    criticalLimit: {               // 한계기준
      parameter: string;           // 측정항목 (온도, pH 등)
      min?: number;
      max?: number;
      unit: string;
    };
    monitoringMethod: string;      // 모니터링 방법
    frequency: string;             // 점검주기
  }>;
  
  // 점검 항목 템플릿
  checklistTemplates: {
    daily: Array<{                 // 일일 점검
      category: string;
      items: string[];
    }>;
    weekly: Array<{                // 주간 점검
      category: string;
      items: string[];
    }>;
    monthly: Array<{               // 월간 점검
      category: string;
      items: string[];
    }>;
  };
}
```

**DB 테이블**:
```sql
CREATE TABLE products (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  code VARCHAR(50) UNIQUE,
  name VARCHAR(255),
  category VARCHAR(100),
  specification TEXT,
  shelf_life INTEGER,
  storage_condition VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE materials (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  code VARCHAR(50) UNIQUE,
  name VARCHAR(255),
  type VARCHAR(20),
  supplier_id UUID REFERENCES suppliers(id),
  specification TEXT,
  storage_temp VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE suppliers (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  code VARCHAR(50) UNIQUE,
  name VARCHAR(255),
  contact VARCHAR(100),
  address TEXT,
  certifications JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ccp_definitions (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  ccp_number VARCHAR(20),
  process VARCHAR(100),
  hazard TEXT,
  control_measure TEXT,
  critical_limit JSONB,
  monitoring_method TEXT,
  frequency VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

### 2.2 일반위생 점검표 (일일)

**목적**: 매일 작업 전 위생 상태 점검

```typescript
interface DailyHygieneCheck {
  id: string;
  checkDate: Date;
  checkedBy: string;              // 점검자
  shift: '오전' | '오후' | '야간';
  
  // 개인위생
  personalHygiene: {
    handWashing: boolean;         // 손 씻기
    uniformClean: boolean;        // 작업복 청결
    hairNet: boolean;             // 위생모 착용
    jewelry: boolean;             // 장신구 제거
    healthCheck: boolean;         // 건강상태
    note?: string;
  };
  
  // 작업장 위생
  facilityHygiene: {
    floorClean: boolean;          // 바닥 청결
    wallClean: boolean;           // 벽면 청결
    ceilingClean: boolean;        // 천장 청결
    drainClean: boolean;          // 배수구 청소
    windowClean: boolean;         // 창문 청결
    lightingNormal: boolean;      // 조명 정상
    ventilationNormal: boolean;   // 환기 정상
    note?: string;
  };
  
  // 설비/기구 위생
  equipmentHygiene: {
    productionEquip: boolean;     // 생산 설비 세척
    cuttingTools: boolean;        // 칼/도마 소독
    containers: boolean;          // 용기 세척
    thermometers: boolean;        // 온도계 점검
    scales: boolean;              // 저울 점검
    note?: string;
  };
  
  // 원료/제품 관리
  materialManagement: {
    properStorage: boolean;       // 적정 보관
    tempControl: boolean;         // 온도 관리
    fifoCompliance: boolean;      // 선입선출 준수
    labelingProper: boolean;      // 표시 적정
    note?: string;
  };
  
  // 종합
  overallStatus: 'PASS' | 'FAIL';
  correctiveAction?: string;      // 개선조치
  verifiedBy?: string;            // 확인자
  verifiedAt?: Date;
}
```

**DB 테이블**:
```sql
CREATE TABLE daily_hygiene_checks (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  check_date DATE NOT NULL,
  checked_by UUID REFERENCES users(id),
  shift VARCHAR(20),
  
  personal_hygiene JSONB,
  facility_hygiene JSONB,
  equipment_hygiene JSONB,
  material_management JSONB,
  
  overall_status VARCHAR(20),
  corrective_action TEXT,
  verified_by UUID REFERENCES users(id),
  verified_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(company_id, check_date, shift)
);
```

---

### 2.3 HACCP CCP (중요관리점)

**목적**: 실시간 CCP 모니터링

```typescript
interface CCPRecord {
  id: string;
  ccpId: string;                  // CCP 정의 참조
  recordDate: Date;
  recordTime: string;
  recordedBy: string;
  
  // 일반 CCP (동적)
  measurement: {
    lotNumber: string;            // 제조번호
    productCode: string;
    parameter: string;            // 측정항목
    value: number;
    unit: string;
    criticalLimitMin?: number;
    criticalLimitMax?: number;
    result: 'PASS' | 'FAIL';
  };
  
  // 부적합 시 조치
  nonConformance?: {
    action: string;               // 취한 조치
    disposalMethod: string;       // 처리 방법
    actionBy: string;
    actionAt: Date;
  };
}
```

**DB 테이블**:
```sql
CREATE TABLE ccp_records (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  ccp_id UUID REFERENCES ccp_definitions(id),
  record_date DATE NOT NULL,
  record_time TIME NOT NULL,
  recorded_by UUID REFERENCES users(id),
  
  lot_number VARCHAR(50),
  product_code VARCHAR(50),
  
  measurement JSONB,              -- 측정값
  result VARCHAR(20),             -- PASS/FAIL
  
  non_conformance JSONB,          -- 부적합 조치
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_ccp_date (company_id, record_date DESC),
  INDEX idx_lot_number (company_id, lot_number)
);
```

---

### 2.4 원부재료 육안검사

**목적**: 입고 시 품질 확인

```typescript
interface MaterialInspection {
  id: string;
  inspectionDate: Date;
  inspectedBy: string;
  
  // 입고 정보
  receiving: {
    materialCode: string;
    materialName: string;
    supplier: string;
    lotNumber: string;
    quantity: number;
    unit: string;
    receivedAt: Date;
  };
  
  // 육안검사
  visualInspection: {
    packaging: 'GOOD' | 'DAMAGED' | 'CONTAMINATED';
    appearance: 'NORMAL' | 'ABNORMAL';
    color: 'NORMAL' | 'ABNORMAL';
    odor: 'NORMAL' | 'ABNORMAL';
    foreignMatter: boolean;       // 이물 여부
    expiryDate: Date;
    expiryDateValid: boolean;
    temperature?: number;
    temperatureValid?: boolean;
  };
  
  // 서류 확인
  documents: {
    invoice: boolean;             // 거래명세서
    certificate: boolean;         // 성적서/인증서
    haccp: boolean;               // HACCP 인증서
    otherDocs?: string[];
  };
  
  // 판정
  result: 'ACCEPT' | 'REJECT' | 'HOLD';
  rejectionReason?: string;
  
  // 보관
  storage: {
    location: string;
    storageTemp?: string;
    storedAt?: Date;
  };
}
```

**DB 테이블**:
```sql
CREATE TABLE material_inspections (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  inspection_date DATE NOT NULL,
  inspected_by UUID REFERENCES users(id),
  
  material_code VARCHAR(50),
  material_name VARCHAR(255),
  supplier_id UUID REFERENCES suppliers(id),
  lot_number VARCHAR(50),
  quantity DECIMAL(10,2),
  unit VARCHAR(20),
  
  visual_inspection JSONB,
  documents JSONB,
  
  result VARCHAR(20),
  rejection_reason TEXT,
  
  storage JSONB,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_inspection_date (company_id, inspection_date DESC),
  INDEX idx_material_code (company_id, material_code)
);
```

---

### 2.5 완제품 생산/출하 현황

**목적**: 생산량 및 출하 기록

```typescript
interface ProductionRecord {
  id: string;
  productionDate: Date;
  productCode: string;
  productName: string;
  lotNumber: string;              // 제조번호
  
  // 생산
  production: {
    plannedQuantity: number;
    actualQuantity: number;
    unit: string;
    shift: string;
    line: string;                 // 생산 라인
    startTime: string;
    endTime: string;
    workers: string[];
  };
  
  // 품질
  quality: {
    samplesInspected: number;
    samplesPassed: number;
    defectRate: number;           // 불량률 (%)
    defectTypes?: Array<{
      type: string;
      count: number;
    }>;
  };
  
  // 포장
  packaging: {
    packagingDate: Date;
    expiryDate: Date;
    packagingType: string;
    boxCount: number;
    unitsPerBox: number;
  };
  
  // 보관
  storage: {
    warehouse: string;
    zone: string;
    temperature?: number;
  };
}

interface ShipmentRecord {
  id: string;
  shipmentDate: Date;
  productionRecordId: string;
  
  // 출하 정보
  shipment: {
    lotNumber: string;
    productCode: string;
    quantity: number;
    unit: string;
    customer: string;
    destination: string;
    vehicleNumber: string;
    driver: string;
    shippedAt: Date;
  };
  
  // 출하 검사
  inspection: {
    packagingIntact: boolean;
    temperatureCheck?: number;
    documentComplete: boolean;
    inspectedBy: string;
  };
}
```

**DB 테이블**:
```sql
CREATE TABLE production_records (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  production_date DATE NOT NULL,
  product_code VARCHAR(50),
  product_name VARCHAR(255),
  lot_number VARCHAR(50) UNIQUE,
  
  production JSONB,
  quality JSONB,
  packaging JSONB,
  storage JSONB,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_production_date (company_id, production_date DESC),
  INDEX idx_lot_number (lot_number)
);

CREATE TABLE shipment_records (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  shipment_date DATE NOT NULL,
  production_record_id UUID REFERENCES production_records(id),
  
  lot_number VARCHAR(50),
  product_code VARCHAR(50),
  quantity DECIMAL(10,2),
  customer VARCHAR(255),
  
  shipment JSONB,
  inspection JSONB,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_shipment_date (company_id, shipment_date DESC)
);
```

---

### 2.6 방충/방서 점검표 (주간)

**목적**: 해충/쥐 방제 관리

```typescript
interface PestControlCheck {
  id: string;
  checkDate: Date;
  checkWeek: string;              // "2026-W02"
  checkedBy: string;
  
  // 포충등/포서기
  traps: Array<{
    location: string;
    trapNumber: string;
    type: '포충등' | '포서기' | '끈끈이';
    condition: 'NORMAL' | 'DAMAGED' | 'NEEDS_REPLACEMENT';
    catches: {
      flies: number;
      mosquitoes: number;
      moths: number;
      mice: number;
      cockroaches: number;
      other?: string;
    };
    cleanedOrReplaced: boolean;
    note?: string;
  }>;
  
  // 방충/방서 시설
  facilities: {
    doorScreens: 'GOOD' | 'DAMAGED';
    windowScreens: 'GOOD' | 'DAMAGED';
    airCurtains: 'WORKING' | 'NOT_WORKING';
    gaps: boolean;                // 틈새 여부
    note?: string;
  };
  
  // 환경 관리
  environment: {
    wasteDisposal: boolean;
    drainageClear: boolean;
    foodResidue: boolean;
    waterLeakage: boolean;
  };
  
  // 총평
  overallStatus: 'GOOD' | 'WARNING' | 'CRITICAL';
  correctiveAction?: string;
  followUpRequired: boolean;
  followUpBy?: Date;
}
```

**DB 테이블**:
```sql
CREATE TABLE pest_control_checks (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  check_date DATE NOT NULL,
  check_week VARCHAR(10),
  checked_by UUID REFERENCES users(id),
  
  traps JSONB,
  facilities JSONB,
  environment JSONB,
  
  overall_status VARCHAR(20),
  corrective_action TEXT,
  follow_up_required BOOLEAN,
  follow_up_by DATE,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_check_week (company_id, check_week DESC)
);
```

---

### 2.7 CCP 검증 점검표 (월간)

**목적**: CCP 운영 검증 (월 1회)

```typescript
interface CCPVerification {
  id: string;
  verificationDate: Date;
  verificationMonth: string;      // "2026-01"
  verifiedBy: string;
  
  // 각 CCP별 검증
  ccpVerifications: Array<{
    ccpId: string;
    ccpNumber: string;
    process: string;
    
    // 기록 검토
    recordReview: {
      recordsComplete: boolean;
      recordsAccurate: boolean;
      deviationsCorrected: boolean;
      reviewedRecords: number;
      totalRecords: number;
      note?: string;
    };
    
    // 한계기준 검증
    criticalLimitVerification: {
      scientificBasis: boolean;
      limitAppropriate: boolean;
      calibrationValid: boolean;
      note?: string;
    };
    
    // 모니터링 방법 검증
    monitoringVerification: {
      frequencyAdequate: boolean;
      methodEffective: boolean;
      personnelTrained: boolean;
      note?: string;
    };
    
    // 개선 조치
    correctiveActions?: Array<{
      issue: string;
      action: string;
      dueDate: Date;
      responsible: string;
    }>;
    
    status: 'VERIFIED' | 'NEEDS_IMPROVEMENT' | 'FAILED';
  }>;
  
  // 종합 평가
  overallAssessment: {
    haccpSystemEffective: boolean;
    improvementsNeeded: string[];
    nextVerificationDate: Date;
  };
  
  approvedBy?: string;
  approvedAt?: Date;
}
```

**DB 테이블**:
```sql
CREATE TABLE ccp_verifications (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  verification_date DATE NOT NULL,
  verification_month VARCHAR(7),
  verified_by UUID REFERENCES users(id),
  
  ccp_verifications JSONB,
  overall_assessment JSONB,
  
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(company_id, verification_month)
);
```

---

### 2.8 원료 수불부

**목적**: 원료 입출고 재고 관리

```typescript
interface MaterialTransaction {
  id: string;
  transactionDate: Date;
  transactionType: 'IN' | 'OUT' | 'ADJUSTMENT';
  
  // 자재 정보
  material: {
    code: string;
    name: string;
    unit: string;
  };
  
  // 입고
  receiving?: {
    supplier: string;
    lotNumber: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    expiryDate: Date;
    invoiceNumber: string;
    receivedBy: string;
  };
  
  // 출고
  issuing?: {
    purpose: string;
    lotNumber: string;
    quantity: number;
    productionLot?: string;
    issuedBy: string;
  };
  
  // 재고 조정
  adjustment?: {
    reason: string;
    beforeQty: number;
    afterQty: number;
    difference: number;
    adjustedBy: string;
  };
  
  // 재고
  stock: {
    beforeBalance: number;
    afterBalance: number;
  };
  
  note?: string;
}

interface MaterialStock {
  materialCode: string;
  materialName: string;
  currentBalance: number;
  unit: string;
  
  lots: Array<{
    lotNumber: string;
    quantity: number;
    expiryDate: Date;
    receivedDate: Date;
    location: string;
  }>;
  
  safetyStock: number;
  reorderPoint: number;
  needsReorder: boolean;
  
  lastUpdated: Date;
}
```

**DB 테이블**:
```sql
CREATE TABLE material_transactions (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  transaction_date DATE NOT NULL,
  transaction_type VARCHAR(20),
  
  material_code VARCHAR(50),
  material_name VARCHAR(255),
  unit VARCHAR(20),
  
  receiving JSONB,
  issuing JSONB,
  adjustment JSONB,
  
  before_balance DECIMAL(10,2),
  after_balance DECIMAL(10,2),
  
  note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_transaction_date (company_id, transaction_date DESC),
  INDEX idx_material_code (company_id, material_code)
);

CREATE TABLE material_stocks (
  material_code VARCHAR(50) PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  material_name VARCHAR(255),
  current_balance DECIMAL(10,2),
  unit VARCHAR(20),
  lots JSONB,
  safety_stock DECIMAL(10,2),
  reorder_point DECIMAL(10,2),
  last_updated TIMESTAMP
);
```

---

### 2.9 반제품 생산 관리

**목적**: 중간 공정 제품 관리

```typescript
interface SemiProductRecord {
  id: string;
  productionDate: Date;
  semiProductCode: string;
  semiProductName: string;
  lotNumber: string;
  
  // 투입 원료
  inputMaterials: Array<{
    materialCode: string;
    materialName: string;
    materialLot: string;
    quantity: number;
    unit: string;
  }>;
  
  // 생산
  production: {
    process: string;
    plannedQty: number;
    actualQty: number;
    unit: string;
    yield: number;                // 수율 (%)
    productionTime: {
      start: string;
      end: string;
      duration: number;
    };
    workers: string[];
  };
  
  // 품질
  quality: {
    appearance: 'NORMAL' | 'ABNORMAL';
    texture: 'NORMAL' | 'ABNORMAL';
    color: 'NORMAL' | 'ABNORMAL';
    sampleTest: boolean;
    testResult?: 'PASS' | 'FAIL';
    inspectedBy: string;
  };
  
  // 보관
  storage: {
    location: string;
    temperature?: number;
    storageCondition: string;
    storedAt: Date;
  };
  
  // 사용 현황
  usage?: {
    used: number;
    remaining: number;
    usedFor: string[];
  };
}
```

**DB 테이블**:
```sql
CREATE TABLE semi_product_records (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  production_date DATE NOT NULL,
  semi_product_code VARCHAR(50),
  semi_product_name VARCHAR(255),
  lot_number VARCHAR(50) UNIQUE,
  
  input_materials JSONB,
  production JSONB,
  quality JSONB,
  storage JSONB,
  usage JSONB,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_production_date (company_id, production_date DESC),
  INDEX idx_lot_number (lot_number)
);
```

---

## 3. 데이터베이스 설계 (전체)

### 3.1 공통 필드

모든 테이블에 공통으로 포함:

```sql
-- 감사 추적
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
created_by UUID REFERENCES users(id),

-- 회사 격리 (멀티테넌트)
company_id UUID NOT NULL REFERENCES companies(id),

-- 소프트 삭제
deleted_at TIMESTAMP,
deleted_by UUID REFERENCES users(id)
```

---

## 4. 모바일 앱 화면 설계

### 4.1 앱 구조

```
📱 ABC HACCP (식품 제조업)

하단 탭 (6개):
1. 🏠 홈
2. ✅ 일일점검
3. 📊 CCP
4. 📦 입고검사
5. 🏭 생산
6. ⚙️ 더보기
```

### 4.2 주요 화면

#### 홈 화면

```tsx
function HACCPHomeScreen() {
  return (
    <ScrollView>
      {/* 오늘 작업 요약 */}
      <TodaySummaryCard>
        <StatsRow>
          <Stat label="일일점검" value="3/5" />
          <Stat label="CCP 기록" value="12" color="warning" />
          <Stat label="입고검사" value="5" />
        </StatsRow>
      </TodaySummaryCard>
      
      {/* 알림 */}
      <AlertsCard>
        <Alert severity="high">🔴 CCP-2 온도 한계 초과 (15:30)</Alert>
        <Alert severity="medium">⚠️ 냉장고 #3 점검 필요</Alert>
      </AlertsCard>
      
      {/* 빠른 작업 */}
      <QuickActions>
        <ActionButton icon="✅" label="일일점검" />
        <ActionButton icon="🌡️" label="CCP 기록" />
        <ActionButton icon="📦" label="입고검사" />
        <ActionButton icon="🏭" label="생산기록" />
      </QuickActions>
      
      {/* 재고 알림 */}
      <StockAlertsCard>
        <StockAlert>밀가루 (재고: 50kg) - 발주 필요</StockAlert>
      </StockAlertsCard>
    </ScrollView>
  );
}
```

#### 일일 점검 화면

```tsx
function DailyCheckScreen() {
  return (
    <ScrollView>
      <Form>
        {/* 교대 선택 */}
        <SegmentedControl options={['오전', '오후', '야간']} />
        
        {/* 개인위생 */}
        <Section title="개인위생">
          <CheckItem label="손 씻기 완료" />
          <CheckItem label="작업복 청결" />
          <CheckItem label="위생모 착용" />
          <CheckItem label="장신구 제거" />
          <CheckItem label="건강상태 양호" />
          <TextArea label="비고" />
        </Section>
        
        {/* 작업장 위생 */}
        <Section title="작업장 위생">
          <CheckItem label="바닥 청결" />
          <CheckItem label="벽면 청결" />
          <CheckItem label="천장 청결" />
          {/* ... */}
        </Section>
        
        {/* 설비/기구 */}
        <Section title="설비/기구 위생">
          <CheckItem label="생산 설비 세척" />
          <CheckItem label="칼/도마 소독" />
          {/* ... */}
        </Section>
        
        {/* 원료/제품 관리 */}
        <Section title="원료/제품 관리">
          <CheckItem label="적정 보관" />
          <CheckItem label="온도 관리" />
          {/* ... */}
        </Section>
        
        <PhotoAttachment label="현장 사진 (선택)" />
        <SubmitButton>점검 완료</SubmitButton>
      </Form>
    </ScrollView>
  );
}
```

#### CCP 모니터링 화면

```tsx
function CCPMonitoringScreen() {
  const ccps = useCCPDefinitions();
  
  return (
    <View>
      {/* CCP 목록 */}
      <CCPList>
        {ccps.map(ccp => (
          <CCPCard key={ccp.id} onPress={() => navigate('CCPRecord', { ccpId: ccp.id })}>
            <CCPHeader>
              <CCPNumber>{ccp.ccpNumber}</CCPNumber>
              <CCPName>{ccp.process}</CCPName>
            </CCPHeader>
            
            <CCPInfo>
              <Label>위해요소</Label>
              <Value>{ccp.hazard}</Value>
            </CCPInfo>
            
            <CCPInfo>
              <Label>한계기준</Label>
              <Value>
                {ccp.criticalLimit.min}-{ccp.criticalLimit.max} {ccp.criticalLimit.unit}
              </Value>
            </CCPInfo>
            
            <TodayRecords>오늘 기록: 12건</TodayRecords>
          </CCPCard>
        ))}
      </CCPList>
      
      <FAB icon="+" onPress={() => navigate('QuickCCPRecord')} />
    </View>
  );
}
```

#### CCP 기록 입력 화면

```tsx
function CCPRecordScreen({ route }) {
  const { ccpId } = route.params;
  
  return (
    <ScrollView>
      <Form>
        <Input label="제조번호 (LOT)" placeholder="2026-01-09-001" />
        <Picker label="제품" items={products} />
        
        {/* 측정값 입력 */}
        <Input 
          label={`${ccp.criticalLimit.parameter} (${ccp.criticalLimit.unit})`}
          type="number"
          onChange={v => {
            // 자동 판정
            const isPass = v >= ccp.criticalLimit.min && v <= ccp.criticalLimit.max;
            setForm({...form, result: isPass ? 'PASS' : 'FAIL'});
          }}
        />
        
        {/* 판정 결과 */}
        <ResultBadge result={form.result}>
          {form.result === 'PASS' ? '✓ 적합' : '✗ 부적합'}
        </ResultBadge>
        
        {/* 부적합 시 조치사항 */}
        {form.result === 'FAIL' && (
          <Section title="개선 조치">
            <TextArea label="취한 조치" />
            <Picker label="처리 방법" items={['재작업', '폐기', '등급하향']} />
          </Section>
        )}
        
        <PhotoAttachment label="측정 사진" />
        <SubmitButton>기록 저장</SubmitButton>
      </Form>
    </ScrollView>
  );
}
```

---

## 5. API 엔드포인트

```typescript
// Master Data
GET    /api/haccp/products
GET    /api/haccp/materials
GET    /api/haccp/suppliers
GET    /api/haccp/ccp-definitions

// 일일 점검
GET    /api/haccp/daily-checks
POST   /api/haccp/daily-checks
GET    /api/haccp/daily-checks/:id

// CCP
GET    /api/haccp/ccp-records
POST   /api/haccp/ccp-records
GET    /api/haccp/ccp-records/:id
GET    /api/haccp/ccp-records/by-date/:date
GET    /api/haccp/ccp-records/by-lot/:lot

// 입고 검사
GET    /api/haccp/material-inspections
POST   /api/haccp/material-inspections

// 생산
GET    /api/haccp/production-records
POST   /api/haccp/production-records

// 출하
GET    /api/haccp/shipments
POST   /api/haccp/shipments

// 방충/방서
GET    /api/haccp/pest-control-checks
POST   /api/haccp/pest-control-checks

// CCP 검증
GET    /api/haccp/ccp-verifications
POST   /api/haccp/ccp-verifications

// 원료 수불
GET    /api/haccp/material-transactions
POST   /api/haccp/material-transactions
GET    /api/haccp/material-stocks

// 반제품
GET    /api/haccp/semi-products
POST   /api/haccp/semi-products

// 대시보드
GET    /api/haccp/dashboard/today
GET    /api/haccp/dashboard/alerts
GET    /api/haccp/dashboard/stats
```

---

## 6. Staff System 연동

### 6.1 공통 데이터

```typescript
// 직원 정보 공유
- users 테이블 공유
- 출퇴근 시 건강 체크 자동 연동
- 작업자 선택 시 Staff System의 users 사용

// 권한 관리
- HACCP 관리자: 모든 기록 조회/수정
- 생산 담당자: 생산/CCP 기록만
- 품질 담당자: 검사 기록만
```

### 6.2 연동 포인트

```typescript
// 1. 출퇴근 연동
- Staff System 출근 시 건강 체크 필수
- HACCP 기록에 작업자 자동 연결

// 2. 작업 시간 추적
- 생산 기록과 출퇴근 시간 연동
- 작업 효율성 분석

// 3. 교육 이력
- Staff System의 교육 이력 활용
- HACCP 담당자 자격 확인
```

---

## 7. 자동화 및 스마트 기능

### 7.1 IoT 센서 자동 연동 ⭐

**센서 자동 검색 및 연결**

```tsx
function SensorSetupWizard() {
  return (
    <Wizard>
      {/* Step 1: 센서 검색 */}
      <Step title="센서 검색">
        <Button onPress={scanSensors}>🔍 주변 센서 검색</Button>
        
        <SensorList>
          {sensors.map(sensor => (
            <SensorCard onPress={() => connectSensor(sensor)}>
              <SensorName>{sensor.name}</SensorName>
              <SensorType>{sensor.type} ({sensor.protocol})</SensorType>
            </SensorCard>
          ))}
        </SensorList>
      </Step>
      
      {/* Step 2: 연결 테스트 */}
      <Step title="연결 테스트">
        <LivePreview>
          <Value>{liveData?.value} {liveData?.unit}</Value>
        </LivePreview>
        <TestButton>연결 확인</TestButton>
      </Step>
      
      {/* Step 3: 설정 */}
      <Step title="센서 정보">
        <Input label="센서 이름" placeholder="냉장고 #1" />
        <Picker label="CCP 연결" items={ccpList} />
        <Input label="한계 최소값" type="number" />
        <Input label="한계 최대값" type="number" />
        <SaveButton>센서 등록 완료</SaveButton>
      </Step>
    </Wizard>
  );
}
```

**지원 프로토콜**
```typescript
- MQTT (Wi-Fi 센서)
- HTTP/REST
- Bluetooth Low Energy (BLE)
- Modbus TCP
- Serial (USB)
```

**자동 기록**
```typescript
// 1분마다 자동 측정 → CCP 기록 생성
// 한계 초과 시 즉시 알림
// 센서 오프라인 감지
```

---

### 7.2 바코드/QR 자동 입력

```typescript
// LOT 번호 자동 생성
P001-20260109-001 (제품코드-날짜-순번)

// QR 스캔으로 폼 자동 채우기
- 제품 정보
- 자재 정보
- 입고 정보
```

---

### 7.3 AI 이상 감지 및 예측

```typescript
// CCP 트렌드 분석
- 평균±2σ 벗어나면 경고
- 연속 상승/하락 감지

// 불량률 예측
- 7일 이동평균 예측
- 2% 초과 예상 시 알림

// 재고 소진 예측
- 일평균 소비량 계산
- 7일 내 소진 예상 시 알림
```

---

### 7.4 자동 점검 리마인더

```typescript
// 일일: 매일 08:00 (교대별)
// 주간: 매주 월요일
// 월간: 매월 1일

// 미완료 시 에스컬레이션
- 2시간 후 → 팀장 알림
```

---

### 7.5 개선조치 워크플로우

```typescript
부적합 발생
  ↓
즉시 조치
  ↓
근본 원인 분석
  ↓
개선 조치
  ↓
효과 검증
  ↓
종결

// 자동 추적 및 알림
```

---

### 7.6 내부 심사 모듈

```typescript
// 분기별 자동 생성
// HACCP 7원칙 12절차 체크리스트
// 부적합 사항 → 개선조치 연결
```

---

### 7.7 자동 백업 & Audit Trail

```typescript
// 매일 02:00 자동 백업
// 모든 수정 이력 기록
// 조작 불가능
```

---

## 8. 개발 우선순위

```
Phase 1 (4주): 핵심 기록
✅ Master DB 설정
✅ CCP 모니터링
✅ 일일 점검
✅ 입고 검사

Phase 2 (3주): 생산 관리
✅ 생산 기록
✅ 출하 관리
✅ 재고 관리

Phase 3 (2주): 검증 및 리포트
✅ CCP 검증
✅ 방충/방서
✅ 자동 리포트
✅ 반제품 관리

Phase 4 (1주): 자동화
✅ IoT 센서 연동
✅ Staff System 연동
✅ 알림 시스템
✅ 대시보드
```

**총 개발 기간: 10주**

---

## 9. 확장 가능성

### 9.1 향후 확장 계획

```
현재: 식품 제조업 전용 ⭐

나중에 추가 가능:
- 집단급식소 (보존식, 배식 관리)
- 음식점 (간소화 버전)
- 판매업 (진열 관리)
```

### 9.2 확장성 유지 방법

```sql
-- DB에 업종 타입 필드 준비
ALTER TABLE companies ADD COLUMN industry_type VARCHAR(50);

-- 모듈 활성화 설정
CREATE TABLE company_modules (
  company_id UUID REFERENCES companies(id),
  module_name VARCHAR(50),
  enabled BOOLEAN DEFAULT true
);
```

### 9.3 설계 원칙

```
✅ 모듈식 설계
- 각 기능 독립적
- 쉽게 추가/제거 가능

✅ 데이터 구조 유연성
- JSONB 활용
- 스키마 변경 최소화

✅ 코드 재사용성
- 공통 컴포넌트
- 공통 로직 분리
```

---

**문서 끝**

> 💡 **시작하기**:
> 1. DB 스키마 생성
> 2. Master DB 데이터 입력
> 3. 모바일 앱 개발
> 4. 센서 연동 (선택)
