# HACCP 웹 시스템 개발 가이드

> **버전**: 3.0 (Web Edition)  
> **최종 수정**: 2026-01-21  
> **목적**: Google Sheets 기반 HACCP 시스템을 웹/모바일 앱으로 전환  

---

# 1. 시스템 아키텍처

## 1.1 기존 vs 신규 아키텍처 비교

```
[기존: Google Sheets 기반]
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Google Form │ ──▶ │Google Sheet │ ──▶ │ Apps Script │
└─────────────┘     └─────────────┘     └─────────────┘
                          │
                    ┌─────┴─────┐
                    │ QR Prefill│
                    └───────────┘

[신규: 웹 기반]
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Mobile App │     │   Web App   │     │  Admin Web  │
│    (PWA)    │     │  (React)    │     │  (React)    │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
                    ┌──────▼──────┐
                    │   API GW    │
                    │  (Gateway)  │
                    └──────┬──────┘
                           │
       ┌───────────────────┼───────────────────┐
       │                   │                   │
┌──────▼──────┐     ┌──────▼──────┐     ┌──────▼──────┐
│  Auth API   │     │  Core API   │     │ Report API  │
│  (Supabase) │     │  (Node.js)  │     │  (Node.js)  │
└─────────────┘     └──────┬──────┘     └─────────────┘
                           │
                    ┌──────▼──────┐
                    │ PostgreSQL  │
                    │  (Supabase) │
                    └─────────────┘
```

## 1.2 기술 스택 권장

### Backend
| 구분 | 기술 | 이유 |
|------|------|------|
| Runtime | Node.js 20+ | 빠른 개발, 풍부한 생태계 |
| Framework | NestJS 또는 Express | 구조화된 API 개발 |
| ORM | Prisma | 타입 안전, 마이그레이션 |
| Database | PostgreSQL (Supabase) | 관계형, 실시간 구독 |
| Auth | Supabase Auth | 소셜 로그인, RLS |
| Cache | Redis | 세션, 실시간 데이터 |

### Frontend
| 구분 | 기술 | 이유 |
|------|------|------|
| Framework | Next.js 14+ | SSR, App Router |
| State | Zustand | 가벼움, 간단함 |
| Form | React Hook Form + Zod | 검증, 타입 안전 |
| UI | Tailwind + shadcn/ui | 빠른 개발 |
| Chart | Recharts | 대시보드 시각화 |

### Mobile
| 구분 | 기술 | 이유 |
|------|------|------|
| Framework | React Native + Expo | 크로스 플랫폼 |
| 대안 | PWA | 웹 기술 재사용 |

## 1.3 핵심 기능 매핑 (기존 → 신규)

| 기존 (Sheets) | 신규 (Web) | 변경 포인트 |
|---------------|------------|-------------|
| Forms 입력 | 웹/앱 폼 | 실시간 검증, UX 개선 |
| QR 프리필 URL | QR → 딥링크 | 앱 내 라우팅 |
| Apps Script 트리거 | Cron Job / WebHook | 서버 스케줄러 |
| 시트 간 IMPORTRANGE | DB JOIN | 정규화된 쿼리 |
| 피벗 테이블 | SQL 집계 / 뷰 | 실시간 계산 |
| 월별 시트 | 파티션 테이블 | 성능 최적화 |
| 조건부 서식 | 프론트 로직 | 실시간 피드백 |

## 1.4 멀티테넌시 설계

```typescript
// 모든 테이블에 company_id 포함
interface BaseEntity {
  id: string;
  company_id: string;  // 테넌트 식별
  created_at: Date;
  updated_at: Date;
}

// Row Level Security (Supabase)
// 사용자는 자신의 company_id 데이터만 접근
```

## 1.5 오프라인 지원 전략

```
[온라인]
App ──▶ API ──▶ DB

[오프라인]
App ──▶ IndexedDB (로컬 저장)
         │
         ▼ (온라인 복귀 시)
       동기화 ──▶ API ──▶ DB
```

- **IndexedDB**: 오프라인 데이터 저장
- **Background Sync**: 연결 복구 시 자동 동기화
- **Conflict Resolution**: 타임스탬프 기반 충돌 해결

---

# 2. 프로젝트 구조

## 2.1 모노레포 구조 (권장)

```
haccp-system/
├── apps/
│   ├── web/                 # 관리자 웹 (Next.js)
│   ├── mobile/              # 현장 앱 (React Native)
│   └── api/                 # 백엔드 API (NestJS)
├── packages/
│   ├── database/            # Prisma 스키마, 마이그레이션
│   ├── shared/              # 공통 타입, 유틸리티
│   └── ui/                  # 공통 UI 컴포넌트
├── docker-compose.yml
├── turbo.json               # Turborepo 설정
└── package.json
```

## 2.2 API 프로젝트 구조

```
apps/api/
├── src/
│   ├── modules/
│   │   ├── auth/            # 인증/인가
│   │   ├── company/         # 회사(테넌트) 관리
│   │   ├── master/          # 마스터 데이터
│   │   │   ├── material/    # 원료
│   │   │   ├── product/     # 제품
│   │   │   ├── semi-product/# 반제품
│   │   │   ├── recipe/      # 레시피(BOM)
│   │   │   ├── supplier/    # 구매처
│   │   │   └── customer/    # 납품처
│   │   ├── ccp/             # CCP 관리
│   │   │   ├── definition/  # CCP 정의
│   │   │   ├── record/      # CCP 기록
│   │   │   ├── deviation/   # 이탈 관리
│   │   │   └── batch/       # 배치 관리
│   │   ├── inspection/      # 점검 관리
│   │   │   ├── daily/       # 일일 위생
│   │   │   ├── pest/        # 방충방서
│   │   │   └── verification/# CCP 검증
│   │   ├── production/      # 생산 관리
│   │   │   ├── record/      # 생산 기록
│   │   │   ├── shipment/    # 출하 관리
│   │   │   └── inventory/   # 재고 관리
│   │   ├── material-ledger/ # 원료 수불부
│   │   └── report/          # 보고서
│   ├── common/
│   │   ├── guards/          # 인증 가드
│   │   ├── interceptors/    # 로깅, 변환
│   │   ├── filters/         # 예외 처리
│   │   └── decorators/      # 커스텀 데코레이터
│   └── main.ts
├── prisma/
│   ├── schema.prisma
│   └── migrations/
└── test/
```
# 3. 데이터베이스 스키마 (정규화)

## 3.1 ERD 개요

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              MASTER DATA                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │ companies│◀───│  users   │    │ materials│    │ products │              │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘              │
│       │                               │               │                      │
│       │          ┌──────────┐         │               │                      │
│       └─────────▶│ suppliers│         └───────┬───────┘                      │
│       │          └──────────┘                 │                              │
│       │          ┌──────────┐          ┌──────▼─────┐                        │
│       └─────────▶│ customers│          │  recipes   │                        │
│                  └──────────┘          │   (BOM)    │                        │
│                                        └────────────┘                        │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              CCP MODULE                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐                │
│  │ccp_definitions│◀───│  ccp_records  │───▶│ccp_deviations │                │
│  └───────────────┘    └───────────────┘    └───────────────┘                │
│                              │                                               │
│                       ┌──────▼──────┐                                        │
│                       │   batches   │                                        │
│                       └─────────────┘                                        │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           PRODUCTION MODULE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐          │
│  │material_receipts│    │production_records│───▶│    shipments    │          │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘          │
│          │                      │                      │                     │
│          └──────────────────────┼──────────────────────┘                     │
│                                 ▼                                            │
│                    ┌────────────────────────┐                                │
│                    │  inventory_transactions│                                │
│                    └────────────────────────┘                                │
│                                 │                                            │
│                    ┌────────────▼───────────┐                                │
│                    │   inventory_balances   │                                │
│                    └────────────────────────┘                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 3.2 Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================================
// 기본 테이블
// ============================================================

model Company {
  id              String   @id @default(cuid())
  name            String
  businessNumber  String?  @map("business_number")
  address         String?
  phone           String?
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  // Relations
  users               User[]
  materials           Material[]
  semiProducts        SemiProduct[]
  products            Product[]
  recipes             Recipe[]
  suppliers           Supplier[]
  customers           Customer[]
  ccpDefinitions      CcpDefinition[]
  ccpRecords          CcpRecord[]
  batches             Batch[]
  dailyInspections    DailyInspection[]
  pestInspections     PestInspection[]
  ccpVerifications    CcpVerification[]
  materialReceipts    MaterialReceipt[]
  productionRecords   ProductionRecord[]
  shipments           Shipment[]
  inventoryTransactions InventoryTransaction[]

  @@map("companies")
}

model User {
  id            String   @id @default(cuid())
  companyId     String   @map("company_id")
  email         String   @unique
  name          String
  role          UserRole @default(STAFF)
  position      String?
  signatureUrl  String?  @map("signature_url")
  isActive      Boolean  @default(true) @map("is_active")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  company       Company  @relation(fields: [companyId], references: [id])

  // Relations (작성자로서)
  ccpRecords         CcpRecord[]
  dailyInspections   DailyInspection[]
  pestInspections    PestInspection[]
  productionRecords  ProductionRecord[]

  @@map("users")
}

enum UserRole {
  ADMIN
  MANAGER
  STAFF
}

// ============================================================
// 마스터 데이터
// ============================================================

model Material {
  id              String   @id @default(cuid())
  companyId       String   @map("company_id")
  code            String   // "RM-001"
  category        String?  // "01. 유가공품"
  brand           String?
  name            String   // "휘핑크림_벌크"
  weight          Decimal?
  unit            String?  // "L", "kg", "g"
  integratedName  String?  @map("integrated_name") // 레시피 매칭용
  storageType     StorageType @default(ROOM_TEMP) @map("storage_type")
  tempMin         Decimal? @map("temp_min")
  tempMax         Decimal? @map("temp_max")
  supplierId      String?  @map("supplier_id")
  imageUrl        String?  @map("image_url")
  isActive        Boolean  @default(true) @map("is_active")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  company         Company   @relation(fields: [companyId], references: [id])
  supplier        Supplier? @relation(fields: [supplierId], references: [id])
  recipes         Recipe[]
  receipts        MaterialReceipt[]
  inventoryTransactions InventoryTransaction[]

  @@unique([companyId, code])
  @@map("materials")
}

model SemiProduct {
  id              String   @id @default(cuid())
  companyId       String   @map("company_id")
  code            String   // "S-001"
  name            String   // "제누와즈 화이트"
  category        String?
  productionUnit  String?  @map("production_unit") // "Batch"
  unitWeight      Decimal? @map("unit_weight") // g 환산
  storageType     StorageType @default(FROZEN) @map("storage_type")
  shelfLifeDays   Int?     @map("shelf_life_days")
  isActive        Boolean  @default(true) @map("is_active")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  company         Company  @relation(fields: [companyId], references: [id])
  recipes         Recipe[]

  @@unique([companyId, code])
  @@map("semi_products")
}

model Product {
  id              String   @id @default(cuid())
  companyId       String   @map("company_id")
  code            String   // "P001"
  name            String   // "바닐라 까눌레"
  category        String?  // "01. 납품용"
  specCode        String?  @map("spec_code") // 규격코드
  specName        String?  @map("spec_name") // 규격명 "팩"
  shelfLifeDays   Int      @map("shelf_life_days") // 보존기간
  storageType     StorageType @default(FROZEN) @map("storage_type")
  imageUrl        String?  @map("image_url")
  isActive        Boolean  @default(true) @map("is_active")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  company         Company  @relation(fields: [companyId], references: [id])
  recipes         Recipe[]
  productionRecords ProductionRecord[]
  ccpDefinitions  CcpDefinition[]

  @@unique([companyId, code])
  @@map("products")
}

enum StorageType {
  REFRIGERATED  // 냉장 -2~5°C
  FROZEN        // 냉동 -18°C 이하
  ROOM_TEMP     // 실온 1~35°C
}

// ============================================================
// 레시피 (BOM) - 정규화
// ============================================================

model Recipe {
  id              String   @id @default(cuid())
  companyId       String   @map("company_id")
  
  // 생산 대상 (제품 또는 반제품)
  productId       String?  @map("product_id")
  semiProductId   String?  @map("semi_product_id")
  
  // 원료 정보
  materialId      String?  @map("material_id")
  materialName    String   @map("material_name") // 원료코드 없는 경우 대비
  
  componentName   String?  @map("component_name") // 구성명 "까눌레반죽"
  batchSize       Int      @default(1) @map("batch_size") // 배치 기준
  amount          Decimal  // 배합량
  unit            String   @default("g")
  outputQuantity  Int      @default(1) @map("output_quantity") // 생산 수량
  unitConsumption Decimal  @map("unit_consumption") // 1개당 소요량
  
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  company         Company      @relation(fields: [companyId], references: [id])
  product         Product?     @relation(fields: [productId], references: [id])
  semiProduct     SemiProduct? @relation(fields: [semiProductId], references: [id])
  material        Material?    @relation(fields: [materialId], references: [id])

  @@map("recipes")
}

// ============================================================
// 거래처
// ============================================================

model Supplier {
  id              String   @id @default(cuid())
  companyId       String   @map("company_id")
  name            String   // "선인", "고문당"
  businessNumber  String?  @map("business_number")
  address         String?
  phone           String?
  isActive        Boolean  @default(true) @map("is_active")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  company         Company    @relation(fields: [companyId], references: [id])
  materials       Material[]
  materialReceipts MaterialReceipt[]

  @@map("suppliers")
}

model Customer {
  id                String   @id @default(cuid())
  companyId         String   @map("company_id")
  code              String   // "CL-001"
  name              String   // "주식회사 제이더블유푸드"
  businessNumber    String?  @map("business_number")
  representative    String?  // 대표자
  businessType      String?  @map("business_type") // 업태
  businessCategory  String?  @map("business_category") // 종목
  address           String?
  phone             String?
  registrationUrl   String?  @map("registration_url") // 사업자등록증
  isActive          Boolean  @default(true) @map("is_active")
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  company           Company    @relation(fields: [companyId], references: [id])
  shipments         Shipment[]

  @@unique([companyId, code])
  @@map("customers")
}

// ============================================================
// CCP 관리
// ============================================================

model CcpDefinition {
  id              String   @id @default(cuid())
  companyId       String   @map("company_id")
  code            String   // "CCP-1B-COOKIE-TEMP"
  processName     String   @map("process_name") // "오븐(굽기)-과자-가열온도"
  productGroup    CcpProductGroup @map("product_group")
  measurementType String   @map("measurement_type") // "TEMP", "TIME", "BOOL"
  lowerLimit      Decimal? @map("lower_limit")
  upperLimit      Decimal? @map("upper_limit")
  unit            String   // "°C", "분", "Bool"
  frequency       String?  // "시작전/2시간마다/변경시/종료"
  isActive        Boolean  @default(true) @map("is_active")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  company         Company     @relation(fields: [companyId], references: [id])
  ccpRecords      CcpRecord[]

  @@unique([companyId, code])
  @@map("ccp_definitions")
}

enum CcpProductGroup {
  COOKIE          // 과자류
  BREAD           // 빵류
  CREAM           // 크림
  SYRUP           // 시럽가열
  WASHING         // 세척
  METAL_DETECTION // 금속검출
}

model Batch {
  id              String   @id @default(cuid())
  companyId       String   @map("company_id")
  batchNumber     String   @map("batch_number") // "251214-CREAM-001"
  productName     String   @map("product_name")
  productGroup    CcpProductGroup @map("product_group")
  status          BatchStatus @default(IN_PROGRESS)
  note            String?
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  company         Company     @relation(fields: [companyId], references: [id])
  ccpRecords      CcpRecord[]
  deviations      CcpDeviation[]

  @@unique([companyId, batchNumber])
  @@map("batches")
}

enum BatchStatus {
  IN_PROGRESS  // 진행
  COMPLETED    // 완료
  ON_HOLD      // 보류 (이탈 발생)
}

model CcpRecord {
  id              String   @id @default(cuid())
  companyId       String   @map("company_id")
  batchId         String   @map("batch_id")
  ccpDefinitionId String   @map("ccp_definition_id")
  userId          String   @map("user_id")
  
  measuredValue   Decimal  @map("measured_value")
  result          CcpResult // 자동 계산
  checkpoint      Checkpoint @default(START)
  measuredAt      DateTime @default(now()) @map("measured_at")
  
  createdAt       DateTime @default(now()) @map("created_at")

  company         Company       @relation(fields: [companyId], references: [id])
  batch           Batch         @relation(fields: [batchId], references: [id])
  ccpDefinition   CcpDefinition @relation(fields: [ccpDefinitionId], references: [id])
  user            User          @relation(fields: [userId], references: [id])
  deviation       CcpDeviation?

  @@map("ccp_records")
}

enum CcpResult {
  PASS      // 적합
  FAIL      // 이탈
}

enum Checkpoint {
  START     // 시작
  MIDDLE    // 중간
  END       // 종료
}

model CcpDeviation {
  id              String   @id @default(cuid())
  companyId       String   @map("company_id")
  ccpRecordId     String   @unique @map("ccp_record_id")
  batchId         String   @map("batch_id")
  
  measuredValue   Decimal  @map("measured_value")
  limitRange      String   @map("limit_range") // "34~40"
  immediateAction String   @map("immediate_action") // "hold requested"
  correctiveAction String? @map("corrective_action")
  resolvedAt      DateTime? @map("resolved_at")
  resolvedBy      String?  @map("resolved_by")
  
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  ccpRecord       CcpRecord @relation(fields: [ccpRecordId], references: [id])
  batch           Batch     @relation(fields: [batchId], references: [id])

  @@map("ccp_deviations")
}

// ============================================================
// 점검 관리
// ============================================================

model DailyInspection {
  id              String   @id @default(cuid())
  companyId       String   @map("company_id")
  userId          String   @map("user_id")
  inspectionDate  DateTime @map("inspection_date")
  period          InspectionPeriod // 작업전/중/후
  
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  company         Company  @relation(fields: [companyId], references: [id])
  user            User     @relation(fields: [userId], references: [id])
  items           DailyInspectionItem[]
  temperatures    DailyTemperatureRecord[]

  @@map("daily_inspections")
}

enum InspectionPeriod {
  BEFORE_WORK   // 작업 전
  DURING_WORK   // 작업 중
  AFTER_WORK    // 작업 후
}

model DailyInspectionItem {
  id              String   @id @default(cuid())
  inspectionId    String   @map("inspection_id")
  category        String   // "개인위생", "방충방서", "이물" 등
  question        String   // 점검 질문
  result          Boolean  // O/X
  note            String?
  
  inspection      DailyInspection @relation(fields: [inspectionId], references: [id], onDelete: Cascade)

  @@map("daily_inspection_items")
}

model DailyTemperatureRecord {
  id              String   @id @default(cuid())
  inspectionId    String   @map("inspection_id")
  location        String   // "냉동창고", "배합실 냉장고" 등
  temperature     Decimal
  
  inspection      DailyInspection @relation(fields: [inspectionId], references: [id], onDelete: Cascade)

  @@map("daily_temperature_records")
}

// 방충방서 점검
model PestInspection {
  id              String   @id @default(cuid())
  companyId       String   @map("company_id")
  userId          String   @map("user_id")
  inspectionDate  DateTime @map("inspection_date")
  season          Season
  
  // 설비 점검
  trapLightOk     Boolean  @default(true) @map("trap_light_ok")
  uvLampOk        Boolean  @default(true) @map("uv_lamp_ok")
  
  note            String?
  action          String?
  
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  company         Company  @relation(fields: [companyId], references: [id])
  user            User     @relation(fields: [userId], references: [id])
  details         PestInspectionDetail[]

  @@map("pest_inspections")
}

enum Season {
  WINTER  // 동절기 11~3월
  SUMMER  // 하절기 4~10월
}

model PestInspectionDetail {
  id              String   @id @default(cuid())
  inspectionId    String   @map("inspection_id")
  zone            String   // "탈의실", "배합실" 등
  zoneGrade       ZoneGrade @map("zone_grade")
  pestCategory    PestCategory @map("pest_category")
  pestType        String   @map("pest_type") // "바퀴벌레", "파리" 등
  count           Int      @default(0)
  
  inspection      PestInspection @relation(fields: [inspectionId], references: [id], onDelete: Cascade)

  @@map("pest_inspection_details")
}

enum ZoneGrade {
  CLEAN   // 청결구역
  GENERAL // 일반구역
}

enum PestCategory {
  FLYING    // 비래해충
  CRAWLING  // 보행해충
  RODENT    // 설치류
}

// 방충방서 관리기준
model PestCriteria {
  id              String   @id @default(cuid())
  companyId       String   @map("company_id")
  season          Season
  zoneGrade       ZoneGrade @map("zone_grade")
  pestCategory    PestCategory @map("pest_category")
  level           Int      // 1단계, 2단계
  threshold       Int      // 상한값
  
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  @@unique([companyId, season, zoneGrade, pestCategory, level])
  @@map("pest_criteria")
}

// CCP 검증 (월간)
model CcpVerification {
  id              String   @id @default(cuid())
  companyId       String   @map("company_id")
  userId          String   @map("user_id")
  verificationDate DateTime @map("verification_date")
  
  note            String?
  action          String?
  
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  company         Company  @relation(fields: [companyId], references: [id])
  items           CcpVerificationItem[]

  @@map("ccp_verifications")
}

model CcpVerificationItem {
  id              String   @id @default(cuid())
  verificationId  String   @map("verification_id")
  ccpProcess      String   @map("ccp_process") // "가열(오븐)", "크림제조" 등
  question        String
  result          Boolean
  
  verification    CcpVerification @relation(fields: [verificationId], references: [id], onDelete: Cascade)

  @@map("ccp_verification_items")
}

// ============================================================
// 생산/재고 관리
// ============================================================

model MaterialReceipt {
  id              String   @id @default(cuid())
  companyId       String   @map("company_id")
  materialId      String   @map("material_id")
  supplierId      String?  @map("supplier_id")
  
  receiptDate     DateTime @map("receipt_date")
  quantity        Decimal
  weight          Decimal?
  unit            String
  lotNumber       String?  @map("lot_number")
  brand           String?
  
  // 육안검사 결과
  packagingOk     Boolean  @default(true) @map("packaging_ok")
  sensoryOk       Boolean  @default(true) @map("sensory_ok")
  temperature     Decimal?
  result          InspectionResult @default(PASS)
  
  immediateAction String?  @map("immediate_action")
  note            String?
  imageUrl        String?  @map("image_url")
  
  createdAt       DateTime @default(now()) @map("created_at")

  company         Company   @relation(fields: [companyId], references: [id])
  material        Material  @relation(fields: [materialId], references: [id])
  supplier        Supplier? @relation(fields: [supplierId], references: [id])
  transaction     InventoryTransaction?

  @@map("material_receipts")
}

enum InspectionResult {
  PASS  // 적합
  FAIL  // 부적합
}

model ProductionRecord {
  id              String   @id @default(cuid())
  companyId       String   @map("company_id")
  productId       String   @map("product_id")
  userId          String   @map("user_id")
  
  productionDate  DateTime @map("production_date")
  lotNumber       String   @map("lot_number") // "20251214-P024-001"
  goodQuantity    Int      @map("good_quantity") // 양품
  defectQuantity  Int      @default(0) @map("defect_quantity") // 불량
  expiryDate      DateTime @map("expiry_date")
  status          ProductStatus @default(AVAILABLE)
  
  note            String?
  createdAt       DateTime @default(now()) @map("created_at")

  company         Company   @relation(fields: [companyId], references: [id])
  product         Product   @relation(fields: [productId], references: [id])
  user            User      @relation(fields: [userId], references: [id])
  transactions    InventoryTransaction[]
  shipmentItems   ShipmentItem[]

  @@unique([companyId, lotNumber])
  @@map("production_records")
}

enum ProductStatus {
  AVAILABLE  // 가용
  ON_HOLD    // 보류
  SHIPPED    // 출하완료
  DISPOSED   // 폐기
}

model Shipment {
  id              String   @id @default(cuid())
  companyId       String   @map("company_id")
  customerId      String   @map("customer_id")
  
  shipmentDate    DateTime @map("shipment_date")
  shippingMethod  String   @map("shipping_method") // "택배", "냉장", "냉동"
  
  note            String?
  createdAt       DateTime @default(now()) @map("created_at")

  company         Company        @relation(fields: [companyId], references: [id])
  customer        Customer       @relation(fields: [customerId], references: [id])
  items           ShipmentItem[]

  @@map("shipments")
}

model ShipmentItem {
  id                String   @id @default(cuid())
  shipmentId        String   @map("shipment_id")
  productionRecordId String  @map("production_record_id")
  quantity          Int
  
  shipment          Shipment         @relation(fields: [shipmentId], references: [id], onDelete: Cascade)
  productionRecord  ProductionRecord @relation(fields: [productionRecordId], references: [id])
  transaction       InventoryTransaction?

  @@map("shipment_items")
}

// ============================================================
// 재고 관리 (원료 수불부 대체)
// ============================================================

model InventoryTransaction {
  id                  String   @id @default(cuid())
  companyId           String   @map("company_id")
  materialId          String   @map("material_id")
  transactionDate     DateTime @map("transaction_date")
  transactionType     TransactionType @map("transaction_type")
  
  quantity            Decimal
  unit                String
  
  // 참조 (하나만 연결)
  materialReceiptId   String?  @unique @map("material_receipt_id")
  productionRecordId  String?  @map("production_record_id")
  shipmentItemId      String?  @unique @map("shipment_item_id")
  
  note                String?
  createdAt           DateTime @default(now()) @map("created_at")

  company             Company           @relation(fields: [companyId], references: [id])
  material            Material          @relation(fields: [materialId], references: [id])
  materialReceipt     MaterialReceipt?  @relation(fields: [materialReceiptId], references: [id])
  productionRecord    ProductionRecord? @relation(fields: [productionRecordId], references: [id])
  shipmentItem        ShipmentItem?     @relation(fields: [shipmentItemId], references: [id])

  @@map("inventory_transactions")
}

enum TransactionType {
  IN      // 입고
  OUT     // 출고 (생산 사용)
  ADJUST  // 조정
}

// 재고 현황 (집계 뷰 대체, 트리거로 업데이트)
model InventoryBalance {
  id              String   @id @default(cuid())
  companyId       String   @map("company_id")
  materialId      String   @map("material_id")
  balanceDate     DateTime @map("balance_date") @db.Date
  
  openingBalance  Decimal  @map("opening_balance") // 전일재고
  totalIn         Decimal  @map("total_in") // 입고량
  totalOut        Decimal  @map("total_out") // 사용량
  closingBalance  Decimal  @map("closing_balance") // 현재고
  unit            String
  
  updatedAt       DateTime @updatedAt @map("updated_at")

  @@unique([companyId, materialId, balanceDate])
  @@map("inventory_balances")
}
```

## 3.3 시트 → 테이블 매핑

| 기존 시트 | 신규 테이블 | 비고 |
|-----------|-------------|------|
| Staff | users | 인증 통합 |
| 원료코드 | materials | 정규화 |
| 반제품 | semi_products | - |
| 제품 | products | - |
| 기초정보_레시피 | recipes | FK 연결 |
| 구매처 | suppliers | - |
| 납품처 | customers | - |
| Master_CCP | ccp_definitions | - |
| CCP_Log | ccp_records | 정규화 |
| CCP_Log_Detail | ccp_records | 통합 |
| Deviation | ccp_deviations | - |
| Batch | batches | - |
| 설문지 응답 (01) | daily_inspections + items | 분리 |
| 폼응답원본 (05) | pest_inspections + details | 분리 |
| 관리기준 (05) | pest_criteria | - |
| 설문지 응답 (06) | ccp_verifications + items | 분리 |
| 원부자재_육안검사 | material_receipts | - |
| 응답_생산 (04) | production_records | - |
| 응답_출하 (04) | shipments + items | 분리 |
| 재고카드 (04) | inventory_transactions | - |
| DB_재고 (07) | inventory_balances | 집계 |
# 4. API 설계

## 4.1 API 규칙

### 기본 URL
```
Production: https://api.haccp.example.com/v1
Development: http://localhost:3000/api/v1
```

### 인증
```http
Authorization: Bearer {access_token}
X-Company-ID: {company_id}  # 멀티테넌시
```

### 응답 형식
```typescript
// 성공
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}

// 실패
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "측정값이 범위를 벗어났습니다",
    "details": [
      { "field": "measuredValue", "message": "34~40 범위여야 합니다" }
    ]
  }
}
```

## 4.2 API 엔드포인트

### 4.2.1 인증 (Auth)

```yaml
POST   /auth/login           # 로그인
POST   /auth/logout          # 로그아웃
POST   /auth/refresh         # 토큰 갱신
GET    /auth/me              # 현재 사용자 정보
PUT    /auth/me              # 프로필 수정
PUT    /auth/me/signature    # 서명 업로드
```

### 4.2.2 마스터 데이터

```yaml
# 원료
GET    /materials            # 목록 (필터: category, storageType, isActive)
GET    /materials/:id        # 상세
POST   /materials            # 생성
PUT    /materials/:id        # 수정
DELETE /materials/:id        # 삭제 (soft delete)

# 반제품
GET    /semi-products
GET    /semi-products/:id
POST   /semi-products
PUT    /semi-products/:id

# 제품
GET    /products
GET    /products/:id
POST   /products
PUT    /products/:id

# 레시피 (BOM)
GET    /recipes              # 필터: productId, semiProductId
GET    /recipes/by-product/:productId
GET    /recipes/by-semi-product/:semiProductId
POST   /recipes/bulk         # 대량 등록
PUT    /recipes/:id
DELETE /recipes/:id

# 거래처
GET    /suppliers
POST   /suppliers
GET    /customers
POST   /customers
```

### 4.2.3 CCP 관리 (★ 핵심)

```yaml
# CCP 정의
GET    /ccp/definitions                    # 목록
GET    /ccp/definitions/:code              # 코드로 조회
GET    /ccp/definitions/by-group/:group    # 제품군별 조회

# 배치
GET    /ccp/batches                        # 목록 (필터: status, date)
GET    /ccp/batches/:batchNumber           # 상세 (기록 포함)
POST   /ccp/batches                        # 생성
PUT    /ccp/batches/:id/status             # 상태 변경

# CCP 기록 (★ 가장 중요)
GET    /ccp/records                        # 목록 (필터: batchId, date, result)
GET    /ccp/records/today                  # 오늘 기록
POST   /ccp/records                        # 기록 추가 (자동 판정)
POST   /ccp/records/bulk                   # 일괄 기록 (한 배치의 여러 측정값)

# 이탈 관리
GET    /ccp/deviations                     # 목록 (필터: resolved)
GET    /ccp/deviations/unresolved          # 미해결 이탈
PUT    /ccp/deviations/:id/resolve         # 이탈 해결
```

### 4.2.4 점검 관리

```yaml
# 일일 위생 점검
GET    /inspections/daily                  # 목록 (필터: date, period)
GET    /inspections/daily/:id              # 상세
POST   /inspections/daily                  # 점검 제출
GET    /inspections/daily/questions        # 점검 질문 목록

# 방충방서 점검
GET    /inspections/pest                   # 목록
GET    /inspections/pest/:id               # 상세
POST   /inspections/pest                   # 점검 제출
GET    /inspections/pest/criteria          # 관리기준 조회
GET    /inspections/pest/zones             # 구역 및 해충 목록

# CCP 검증 (월간)
GET    /inspections/verification           # 목록
POST   /inspections/verification           # 검증 제출
GET    /inspections/verification/questions # 검증 질문 목록
```

### 4.2.5 생산/재고 관리

```yaml
# 원료 입고 (육안검사)
GET    /material-receipts                  # 목록
POST   /material-receipts                  # 입고 등록 (재고 자동 반영)

# 생산
GET    /production                         # 목록 (필터: date, productId, status)
GET    /production/:lotNumber              # LOT 조회
POST   /production                         # 생산 등록 (LOT 자동 생성, 원료 차감)
PUT    /production/:id/status              # 상태 변경

# 출하
GET    /shipments                          # 목록
GET    /shipments/:id                      # 상세
POST   /shipments                          # 출하 등록 (재고 차감)

# 재고 조회
GET    /inventory/materials                # 원료 재고 현황
GET    /inventory/materials/:id/history    # 원료별 입출고 이력
GET    /inventory/products                 # 제품 재고 현황
GET    /inventory/products/:lotNumber      # LOT별 재고
```

### 4.2.6 대시보드/리포트

```yaml
# 대시보드
GET    /dashboard/today                    # 오늘 현황
GET    /dashboard/ccp-summary              # CCP 요약 (적합/이탈 수)
GET    /dashboard/production-summary       # 생산 요약
GET    /dashboard/inventory-alerts         # 재고 경고 (마이너스, 유통기한 임박)

# 리포트
GET    /reports/daily/:date                # 일일 보고서
GET    /reports/weekly                     # 주간 보고서
GET    /reports/monthly/:yearMonth         # 월간 보고서
GET    /reports/ccp/:yearMonth             # CCP 월간 집계
```

## 4.3 핵심 API 상세

### 4.3.1 CCP 기록 등록 (★ 가장 중요)

```typescript
// POST /ccp/records
// 요청
interface CreateCcpRecordRequest {
  batchNumber: string;           // "251214-CREAM-001"
  productName: string;           // "밤티_샌딩크림"
  productGroup: CcpProductGroup; // "CREAM"
  measurements: {
    ccpCode: string;             // "CCP-2B-CREAM-MASS"
    value: number;               // 3.2
    checkpoint?: Checkpoint;     // "START"
  }[];
}

// 응답
interface CreateCcpRecordResponse {
  success: true;
  data: {
    batchId: string;
    batchNumber: string;
    records: {
      id: string;
      ccpCode: string;
      measuredValue: number;
      lowerLimit: number;
      upperLimit: number;
      unit: string;
      result: "PASS" | "FAIL";   // ★ 자동 계산
    }[];
    hasDeviation: boolean;        // ★ 이탈 발생 여부
    deviations?: {
      ccpCode: string;
      measuredValue: number;
      limitRange: string;
      immediateAction: string;
    }[];
    batchStatus: BatchStatus;     // 이탈 시 "ON_HOLD"
  };
}
```

**서버 로직:**
```typescript
// services/ccp.service.ts
async createCcpRecords(dto: CreateCcpRecordRequest, userId: string, companyId: string) {
  return this.prisma.$transaction(async (tx) => {
    // 1. 배치 생성 또는 조회
    const batch = await tx.batch.upsert({
      where: { companyId_batchNumber: { companyId, batchNumber: dto.batchNumber } },
      create: {
        companyId,
        batchNumber: dto.batchNumber,
        productName: dto.productName,
        productGroup: dto.productGroup,
        status: 'IN_PROGRESS',
      },
      update: {},
    });

    const results = [];
    const deviations = [];

    // 2. 각 측정값 처리
    for (const measurement of dto.measurements) {
      // CCP 정의 조회
      const definition = await tx.ccpDefinition.findUnique({
        where: { companyId_code: { companyId, code: measurement.ccpCode } },
      });

      // ★ 자동 판정
      const result = this.judgeCcp(measurement.value, definition);

      // 기록 저장
      const record = await tx.ccpRecord.create({
        data: {
          companyId,
          batchId: batch.id,
          ccpDefinitionId: definition.id,
          userId,
          measuredValue: measurement.value,
          result,
          checkpoint: measurement.checkpoint || 'START',
        },
      });

      results.push({
        id: record.id,
        ccpCode: measurement.ccpCode,
        measuredValue: measurement.value,
        lowerLimit: definition.lowerLimit,
        upperLimit: definition.upperLimit,
        unit: definition.unit,
        result,
      });

      // 3. 이탈 시 Deviation 생성
      if (result === 'FAIL') {
        const deviation = await tx.ccpDeviation.create({
          data: {
            companyId,
            ccpRecordId: record.id,
            batchId: batch.id,
            measuredValue: measurement.value,
            limitRange: `${definition.lowerLimit}~${definition.upperLimit}`,
            immediateAction: 'hold requested',
          },
        });
        deviations.push(deviation);
      }
    }

    // 4. 이탈 발생 시 배치 상태 변경
    let batchStatus = batch.status;
    if (deviations.length > 0) {
      await tx.batch.update({
        where: { id: batch.id },
        data: { status: 'ON_HOLD' },
      });
      batchStatus = 'ON_HOLD';

      // 5. 실시간 알림 발송
      await this.notificationService.sendDeviationAlert(companyId, deviations);
    }

    return {
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      records: results,
      hasDeviation: deviations.length > 0,
      deviations: deviations.map(d => ({
        ccpCode: results.find(r => r.id === d.ccpRecordId)?.ccpCode,
        measuredValue: d.measuredValue,
        limitRange: d.limitRange,
        immediateAction: d.immediateAction,
      })),
      batchStatus,
    };
  });
}

// ★ CCP 판정 로직
private judgeCcp(value: number, definition: CcpDefinition): CcpResult {
  // Boolean 타입 (금속검출)
  if (definition.unit === 'Bool') {
    return value === 1 ? 'PASS' : 'FAIL';
  }
  
  // 숫자 범위 타입
  const lower = definition.lowerLimit?.toNumber() ?? -Infinity;
  const upper = definition.upperLimit?.toNumber() ?? Infinity;
  
  return (value >= lower && value <= upper) ? 'PASS' : 'FAIL';
}
```

### 4.3.2 생산 등록 (LOT 자동 생성, 원료 차감)

```typescript
// POST /production
interface CreateProductionRequest {
  productId: string;
  productionDate: string;        // "2025-12-14"
  goodQuantity: number;          // 양품 수량
  defectQuantity?: number;       // 불량 수량
  status?: ProductStatus;        // 기본 "AVAILABLE"
}

interface CreateProductionResponse {
  success: true;
  data: {
    id: string;
    lotNumber: string;           // ★ 자동 생성 "20251214-P024-001"
    expiryDate: string;          // ★ 자동 계산
    materialUsage: {             // ★ BOM 기반 원료 사용량
      materialId: string;
      materialName: string;
      usedQuantity: number;
      unit: string;
      remainingStock: number;    // 차감 후 재고
    }[];
  };
}
```

**서버 로직:**
```typescript
async createProduction(dto: CreateProductionRequest, userId: string, companyId: string) {
  return this.prisma.$transaction(async (tx) => {
    // 1. 제품 정보 조회
    const product = await tx.product.findUnique({
      where: { id: dto.productId },
    });

    // 2. LOT 번호 생성
    const lotNumber = await this.generateLotNumber(tx, companyId, product.code, dto.productionDate);

    // 3. 유통기한 계산
    const productionDate = new Date(dto.productionDate);
    const expiryDate = addDays(productionDate, product.shelfLifeDays);

    // 4. 생산 기록 저장
    const production = await tx.productionRecord.create({
      data: {
        companyId,
        productId: dto.productId,
        userId,
        productionDate,
        lotNumber,
        goodQuantity: dto.goodQuantity,
        defectQuantity: dto.defectQuantity || 0,
        expiryDate,
        status: dto.status || 'AVAILABLE',
      },
    });

    // 5. BOM 기반 원료 차감
    const recipes = await tx.recipe.findMany({
      where: { companyId, productId: dto.productId },
      include: { material: true },
    });

    const totalQuantity = dto.goodQuantity + (dto.defectQuantity || 0);
    const materialUsage = [];

    for (const recipe of recipes) {
      const usedQuantity = recipe.unitConsumption.toNumber() * totalQuantity;
      
      // 재고 트랜잭션 생성
      await tx.inventoryTransaction.create({
        data: {
          companyId,
          materialId: recipe.materialId,
          transactionDate: productionDate,
          transactionType: 'OUT',
          quantity: usedQuantity,
          unit: recipe.unit,
          productionRecordId: production.id,
          note: `생산: ${lotNumber}`,
        },
      });

      // 재고 잔액 업데이트
      const balance = await this.updateInventoryBalance(
        tx, companyId, recipe.materialId, productionDate, 0, usedQuantity
      );

      materialUsage.push({
        materialId: recipe.materialId,
        materialName: recipe.material?.name || recipe.materialName,
        usedQuantity,
        unit: recipe.unit,
        remainingStock: balance.closingBalance.toNumber(),
      });
    }

    return {
      id: production.id,
      lotNumber,
      expiryDate: expiryDate.toISOString().split('T')[0],
      materialUsage,
    };
  });
}

// LOT 번호 생성
private async generateLotNumber(
  tx: PrismaClient,
  companyId: string,
  productCode: string,
  dateStr: string
): Promise<string> {
  const date = dateStr.replace(/-/g, ''); // "20251214"
  
  // 당일 해당 제품의 마지막 시리얼 조회
  const lastRecord = await tx.productionRecord.findFirst({
    where: {
      companyId,
      lotNumber: { startsWith: `${date}-${productCode}-` },
    },
    orderBy: { lotNumber: 'desc' },
  });

  let serial = 1;
  if (lastRecord) {
    const lastSerial = parseInt(lastRecord.lotNumber.split('-').pop() || '0');
    serial = lastSerial + 1;
  }

  return `${date}-${productCode}-${serial.toString().padStart(3, '0')}`;
}
```

### 4.3.3 방충방서 점검 등록 (자동 판정)

```typescript
// POST /inspections/pest
interface CreatePestInspectionRequest {
  inspectionDate: string;
  details: {
    zone: string;           // "배합실"
    pestType: string;       // "파리"
    pestCategory: PestCategory;
    count: number;
  }[];
  trapLightOk: boolean;
  uvLampOk: boolean;
  note?: string;
}

interface CreatePestInspectionResponse {
  success: true;
  data: {
    id: string;
    season: Season;
    results: {
      zone: string;
      pestCategory: PestCategory;
      totalCount: number;
      level1Threshold: number;
      level2Threshold: number;
      judgement: "NORMAL" | "LEVEL1" | "LEVEL2";
    }[];
    hasAlert: boolean;
    alertMessage?: string;
  };
}
```

## 4.4 실시간 기능 (WebSocket)

```typescript
// WebSocket 이벤트

// 서버 → 클라이언트
interface WsEvents {
  // CCP 이탈 알림
  'ccp:deviation': {
    batchNumber: string;
    ccpCode: string;
    measuredValue: number;
    limitRange: string;
    timestamp: string;
  };
  
  // 재고 경고
  'inventory:alert': {
    materialId: string;
    materialName: string;
    currentStock: number;
    alertType: 'LOW_STOCK' | 'NEGATIVE' | 'EXPIRY_SOON';
  };
  
  // 대시보드 업데이트
  'dashboard:update': {
    type: 'CCP' | 'PRODUCTION' | 'INSPECTION';
    data: any;
  };
}
```

## 4.5 오프라인 동기화 API

```yaml
# 오프라인에서 저장된 데이터 동기화
POST   /sync/upload           # 로컬 데이터 업로드
GET    /sync/download         # 최신 데이터 다운로드
GET    /sync/status           # 동기화 상태 확인

# 충돌 해결
POST   /sync/resolve-conflict
```

```typescript
// POST /sync/upload
interface SyncUploadRequest {
  clientId: string;
  lastSyncAt: string;
  operations: {
    id: string;              // 클라이언트 생성 ID
    type: 'CREATE' | 'UPDATE';
    entity: string;          // "ccpRecord", "dailyInspection" 등
    data: any;
    timestamp: string;
  }[];
}

// 응답
interface SyncUploadResponse {
  success: true;
  data: {
    processed: number;
    conflicts: {
      operationId: string;
      serverData: any;
      clientData: any;
    }[];
    serverTimestamp: string;
  };
}
```
# 5. 프론트엔드 설계

## 5.1 앱 구조

### 5.1.1 두 가지 앱

```
1. 현장 앱 (Mobile/PWA)
   - 대상: 현장 작업자
   - 기능: CCP 기록, 점검 입력, QR 스캔
   - 특징: 오프라인 지원, 빠른 입력

2. 관리 웹 (Admin Web)
   - 대상: 관리자, 품질담당자
   - 기능: 마스터 관리, 대시보드, 리포트
   - 특징: 데이터 분석, 설정 관리
```

### 5.1.2 현장 앱 네비게이션

```
┌─────────────────────────────────────────┐
│                 Header                   │
│  ← 뒤로  │  현재 페이지명  │  알림 🔔    │
├─────────────────────────────────────────┤
│                                          │
│                                          │
│              Main Content                │
│                                          │
│                                          │
├─────────────────────────────────────────┤
│   🏠    │   📋    │   🎯   │   📦   │   ⋯  │
│   홈    │  점검   │  CCP  │  생산  │ 더보기│
└─────────────────────────────────────────┘
```

## 5.2 화면 설계

### 5.2.1 홈 화면 (대시보드)

```
┌─────────────────────────────────────────┐
│ 안녕하세요, 김호성님 👋                   │
│ 2025년 12월 14일 (토) 오후 5:24          │
├─────────────────────────────────────────┤
│                                          │
│  ┌─────────────┐  ┌─────────────┐       │
│  │ 오늘 CCP    │  │ 이탈 현황   │       │
│  │    12건     │  │    0건     │       │
│  │   ✅ 정상   │  │   ✅ 양호  │       │
│  └─────────────┘  └─────────────┘       │
│                                          │
│  ┌─────────────┐  ┌─────────────┐       │
│  │ 일일점검    │  │ 생산 현황   │       │
│  │   완료 ✓    │  │   24개     │       │
│  │  작업후 남음 │  │  양품 24개 │       │
│  └─────────────┘  └─────────────┘       │
│                                          │
├─────────────────────────────────────────┤
│  ⚠️ 알림                                 │
│  ├─ 크림 소진시간 기록 필요 (14:30)      │
│  └─ 냉동창고 온도 확인 필요              │
├─────────────────────────────────────────┤
│  📌 빠른 실행                            │
│                                          │
│  [CCP 기록] [일일점검] [생산등록] [QR]   │
│                                          │
└─────────────────────────────────────────┘
```

### 5.2.2 CCP 기록 화면 (★ 핵심)

```
┌─────────────────────────────────────────┐
│ ← CCP 기록                              │
├─────────────────────────────────────────┤
│                                          │
│  제품군 선택                             │
│  ┌─────┐ ┌─────┐ ┌─────┐               │
│  │ 🍪  │ │ 🍞  │ │ 🍦  │               │
│  │과자류│ │빵류 │ │크림 │               │
│  └─────┘ └─────┘ └─────┘               │
│  ┌─────┐ ┌─────┐ ┌─────┐               │
│  │ 🍯  │ │ 🚿  │ │ 🔍  │               │
│  │시럽 │ │세척 │ │금속 │               │
│  └─────┘ └─────┘ └─────┘               │
│                                          │
├─────────────────────────────────────────┤
│  배치 정보                               │
│                                          │
│  배치번호  [251214-CREAM-001    ]       │
│  제품명    [밤티_샌딩크림       ] ▼     │
│  시점      ○ 시작  ● 중간  ○ 종료      │
│                                          │
├─────────────────────────────────────────┤
│  측정값 입력                             │
│                                          │
│  배합량 (kg)          [    3.2    ] kg  │
│  ├─ 기준: 0 ~ 3.5 ✅                    │
│                                          │
│  품온-제조직후 (°C)   [    12     ] °C  │
│  ├─ 기준: -99 ~ 15 ✅                   │
│                                          │
│  품온-소진직전 (°C)   [    14     ] °C  │
│  ├─ 기준: -99 ~ 15 ✅                   │
│                                          │
│  소진시간 (분)        [    45     ] 분  │
│  ├─ 기준: 34 ~ 40 ❌ 이탈!              │
│  └─ ⚠️ 한계기준 초과                    │
│                                          │
│  작업장 온도 (°C)     [    21     ] °C  │
│  ├─ 기준: 0 ~ 23 ✅                     │
│                                          │
├─────────────────────────────────────────┤
│                                          │
│  [         기록 저장         ]           │
│                                          │
└─────────────────────────────────────────┘
```

### 5.2.3 이탈 발생 시 모달

```
┌─────────────────────────────────────────┐
│                                          │
│           ⚠️ 한계기준 이탈              │
│                                          │
│  ┌─────────────────────────────────┐    │
│  │ CCP-2B-CREAM-USE-TIME          │    │
│  │ 소진시간 (분)                   │    │
│  │                                 │    │
│  │ 측정값: 45분                    │    │
│  │ 기준: 34 ~ 40분                 │    │
│  └─────────────────────────────────┘    │
│                                          │
│  즉시 조치가 필요합니다.                 │
│  해당 배치는 "보류" 상태로 변경됩니다.   │
│                                          │
│  ┌─────────────────────────────────┐    │
│  │ 즉시 조치 내용 (선택)           │    │
│  │ [                             ] │    │
│  │ [                             ] │    │
│  └─────────────────────────────────┘    │
│                                          │
│    [취소]              [확인 및 저장]    │
│                                          │
└─────────────────────────────────────────┘
```

### 5.2.4 일일 위생 점검 화면

```
┌─────────────────────────────────────────┐
│ ← 일일 위생 점검                        │
├─────────────────────────────────────────┤
│  작성 시점                               │
│  [● 작업 전] [○ 작업 중] [○ 작업 후]   │
├─────────────────────────────────────────┤
│  [개인위생]                              │
│                                          │
│  위생복장과 외출복장이 구분하여          │
│  보관되고 있는가?                        │
│           [  O  ]    [  X  ]             │
│                                          │
│  종업원의 건강상태는 양호하고            │
│  개인장신구 등을 소지하지 않으며,        │
│  청결한 위생복장을 착용하고 있는가?      │
│           [  O  ]    [  X  ]             │
│                                          │
├─────────────────────────────────────────┤
│  [온도 기록]                             │
│                                          │
│  냉동창고         [  -22  ] °C          │
│  배합실 냉장고    [   3   ] °C          │
│  내포장실 냉장고  [   4   ] °C          │
│                                          │
├─────────────────────────────────────────┤
│  특이사항                                │
│  [                                    ]  │
│                                          │
├─────────────────────────────────────────┤
│                                          │
│  [           점검 완료           ]       │
│                                          │
└─────────────────────────────────────────┘
```

### 5.2.5 생산 등록 화면

```
┌─────────────────────────────────────────┐
│ ← 생산 등록                             │
├─────────────────────────────────────────┤
│                                          │
│  생산일자                                │
│  [2025-12-14                       ] 📅 │
│                                          │
│  제품 선택                               │
│  [요거트복숭아케이크(JW)_16ea      ] ▼  │
│                                          │
│  ┌─ 제품 정보 ─────────────────────┐    │
│  │ 제품코드: P024                   │    │
│  │ 규격: 팩                         │    │
│  │ 보존기간: 180일                  │    │
│  │ 보관조건: 냉동                   │    │
│  └─────────────────────────────────┘    │
│                                          │
│  양품 수량        [      5      ]        │
│  불량 수량        [      0      ]        │
│                                          │
│  ┌─ 자동 생성 정보 ────────────────┐    │
│  │ LOT번호: 20251214-P024-001      │    │
│  │ 유통기한: 2026-06-12            │    │
│  └─────────────────────────────────┘    │
│                                          │
│  ┌─ 원료 사용량 (BOM 기준) ────────┐    │
│  │ 전란      2,392g × 5 = 11,960g  │    │
│  │ 노른자      520g × 5 =  2,600g  │    │
│  │ 설탕      1,320g × 5 =  6,600g  │    │
│  │ ...                              │    │
│  │ ───────────────────────────────  │    │
│  │ 총 12종 원료, 합계 54,830g      │    │
│  └─────────────────────────────────┘    │
│                                          │
│  [           생산 등록           ]       │
│                                          │
└─────────────────────────────────────────┘
```

## 5.3 React 컴포넌트 구조

```
src/
├── app/                      # Next.js App Router
│   ├── (auth)/
│   │   ├── login/
│   │   └── layout.tsx
│   ├── (main)/
│   │   ├── dashboard/
│   │   ├── ccp/
│   │   │   ├── page.tsx       # CCP 목록
│   │   │   ├── record/
│   │   │   │   └── page.tsx   # CCP 기록 입력
│   │   │   └── [batchId]/
│   │   │       └── page.tsx   # 배치 상세
│   │   ├── inspection/
│   │   │   ├── daily/
│   │   │   ├── pest/
│   │   │   └── verification/
│   │   ├── production/
│   │   │   ├── page.tsx
│   │   │   └── new/
│   │   ├── inventory/
│   │   └── layout.tsx
│   └── layout.tsx
├── components/
│   ├── ui/                    # 기본 UI (shadcn/ui)
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── card.tsx
│   │   └── ...
│   ├── forms/                 # 폼 컴포넌트
│   │   ├── CcpRecordForm.tsx
│   │   ├── DailyInspectionForm.tsx
│   │   ├── ProductionForm.tsx
│   │   └── ...
│   ├── display/               # 표시 컴포넌트
│   │   ├── CcpResultBadge.tsx
│   │   ├── BatchStatusBadge.tsx
│   │   ├── TemperatureGauge.tsx
│   │   └── ...
│   └── layout/
│       ├── Header.tsx
│       ├── BottomNav.tsx
│       └── Sidebar.tsx
├── hooks/
│   ├── useCcpRecord.ts
│   ├── useProduction.ts
│   ├── useOfflineSync.ts
│   └── ...
├── stores/                    # Zustand 스토어
│   ├── authStore.ts
│   ├── ccpStore.ts
│   └── offlineStore.ts
├── lib/
│   ├── api.ts                 # API 클라이언트
│   ├── db.ts                  # IndexedDB (오프라인)
│   └── utils.ts
└── types/
    └── index.ts
```

## 5.4 핵심 컴포넌트 구현

### 5.4.1 CCP 기록 폼

```tsx
// components/forms/CcpRecordForm.tsx
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCcpDefinitions, useCreateCcpRecord } from '@/hooks/useCcp';

const ccpRecordSchema = z.object({
  batchNumber: z.string().min(1, '배치번호를 입력하세요'),
  productName: z.string().min(1, '제품명을 선택하세요'),
  productGroup: z.enum(['COOKIE', 'BREAD', 'CREAM', 'SYRUP', 'WASHING', 'METAL_DETECTION']),
  checkpoint: z.enum(['START', 'MIDDLE', 'END']),
  measurements: z.record(z.number()),
});

type CcpRecordFormData = z.infer<typeof ccpRecordSchema>;

export function CcpRecordForm() {
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const { data: definitions } = useCcpDefinitions(selectedGroup);
  const { mutate: createRecord, isLoading } = useCreateCcpRecord();

  const form = useForm<CcpRecordFormData>({
    resolver: zodResolver(ccpRecordSchema),
    defaultValues: {
      checkpoint: 'START',
      measurements: {},
    },
  });

  // 실시간 검증 결과
  const validateMeasurement = (code: string, value: number) => {
    const def = definitions?.find(d => d.code === code);
    if (!def) return null;
    
    if (def.unit === 'Bool') {
      return value === 1 ? 'pass' : 'fail';
    }
    
    const lower = def.lowerLimit ?? -Infinity;
    const upper = def.upperLimit ?? Infinity;
    return (value >= lower && value <= upper) ? 'pass' : 'fail';
  };

  const onSubmit = (data: CcpRecordFormData) => {
    const measurements = Object.entries(data.measurements).map(([code, value]) => ({
      ccpCode: code,
      value,
      checkpoint: data.checkpoint,
    }));

    createRecord({
      batchNumber: data.batchNumber,
      productName: data.productName,
      productGroup: data.productGroup as any,
      measurements,
    });
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {/* 제품군 선택 */}
      <ProductGroupSelector
        value={selectedGroup}
        onChange={(group) => {
          setSelectedGroup(group);
          form.setValue('productGroup', group as any);
        }}
      />

      {/* 배치 정보 */}
      {selectedGroup && (
        <>
          <div className="space-y-4">
            <Input
              label="배치번호"
              {...form.register('batchNumber')}
              placeholder="251214-CREAM-001"
            />
            <ProductSelect
              productGroup={selectedGroup}
              {...form.register('productName')}
            />
            <CheckpointRadio {...form.register('checkpoint')} />
          </div>

          {/* 측정값 입력 */}
          <div className="space-y-4">
            <h3 className="font-medium">측정값 입력</h3>
            {definitions?.map((def) => {
              const value = form.watch(`measurements.${def.code}`);
              const result = value !== undefined ? validateMeasurement(def.code, value) : null;

              return (
                <MeasurementInput
                  key={def.code}
                  definition={def}
                  value={value}
                  onChange={(v) => form.setValue(`measurements.${def.code}`, v)}
                  result={result}
                />
              );
            })}
          </div>

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? '저장 중...' : '기록 저장'}
          </Button>
        </>
      )}
    </form>
  );
}

// 측정값 입력 컴포넌트
function MeasurementInput({ definition, value, onChange, result }) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">
        {definition.processName.split('-').pop()}
      </label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          step="0.1"
          value={value ?? ''}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className={cn(
            result === 'fail' && 'border-red-500 bg-red-50'
          )}
        />
        <span className="text-sm text-gray-500">{definition.unit}</span>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span className="text-gray-500">
          기준: {definition.lowerLimit} ~ {definition.upperLimit}
        </span>
        {result === 'pass' && <span className="text-green-600">✅</span>}
        {result === 'fail' && <span className="text-red-600">❌ 이탈!</span>}
      </div>
    </div>
  );
}
```

### 5.4.2 오프라인 동기화 훅

```tsx
// hooks/useOfflineSync.ts
import { useEffect, useState } from 'react';
import { openDB, DBSchema } from 'idb';

interface HaccpDB extends DBSchema {
  pendingOperations: {
    key: string;
    value: {
      id: string;
      type: 'CREATE' | 'UPDATE';
      entity: string;
      data: any;
      timestamp: string;
    };
  };
  cachedData: {
    key: string;
    value: any;
  };
}

const DB_NAME = 'haccp-offline';
const DB_VERSION = 1;

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 온라인 복귀 시 동기화
  useEffect(() => {
    if (isOnline) {
      syncPendingOperations();
    }
  }, [isOnline]);

  const getDB = async () => {
    return openDB<HaccpDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore('pendingOperations', { keyPath: 'id' });
        db.createObjectStore('cachedData');
      },
    });
  };

  // 오프라인 저장
  const saveOffline = async (entity: string, data: any) => {
    const db = await getDB();
    const operation = {
      id: crypto.randomUUID(),
      type: 'CREATE' as const,
      entity,
      data,
      timestamp: new Date().toISOString(),
    };
    await db.add('pendingOperations', operation);
    setPendingCount((c) => c + 1);
    return operation.id;
  };

  // 동기화 실행
  const syncPendingOperations = async () => {
    const db = await getDB();
    const operations = await db.getAll('pendingOperations');

    if (operations.length === 0) return;

    try {
      const response = await fetch('/api/v1/sync/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: getClientId(),
          lastSyncAt: localStorage.getItem('lastSyncAt'),
          operations,
        }),
      });

      if (response.ok) {
        // 성공한 작업 삭제
        const tx = db.transaction('pendingOperations', 'readwrite');
        for (const op of operations) {
          await tx.store.delete(op.id);
        }
        await tx.done;

        setPendingCount(0);
        localStorage.setItem('lastSyncAt', new Date().toISOString());
      }
    } catch (error) {
      console.error('Sync failed:', error);
    }
  };

  return {
    isOnline,
    pendingCount,
    saveOffline,
    syncPendingOperations,
  };
}
```

## 5.5 QR 코드 처리

### 기존 방식 (Google Forms Prefill URL)
```
https://docs.google.com/forms/d/e/xxx/viewform?usp=pp_url
  &entry.123456=제누와즈%20화이트
```

### 신규 방식 (앱 딥링크)
```
// QR 코드 내용
haccp://ccp/record?
  productGroup=CREAM
  &productName=밤티_샌딩크림
  &batchPrefix=CREAM

// 웹 폴백
https://app.haccp.example.com/ccp/record?
  productGroup=CREAM
  &productName=밤티_샌딩크림
```

```tsx
// 앱에서 QR 스캔 처리
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

export function QRHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const productGroup = searchParams.get('productGroup');
    const productName = searchParams.get('productName');

    if (productGroup && productName) {
      // 자동으로 CCP 기록 화면으로 이동하며 값 채우기
      router.push(`/ccp/record?productGroup=${productGroup}&productName=${productName}`);
    }
  }, [searchParams]);

  return null;
}
```
# 6. 비즈니스 로직 상세

## 6.1 CCP 판정 로직

### 6.1.1 판정 규칙

```typescript
// 전체 20개 CCP 정의 및 판정 기준

const CCP_DEFINITIONS = {
  // ========== CCP-1B: 오븐 가열 (6개) ==========
  'CCP-1B-COOKIE-TEMP': { lower: 180, upper: 210, unit: '°C' },
  'CCP-1B-COOKIE-TIME': { lower: 50, upper: 60, unit: '분' },
  'CCP-1B-COOKIE-CORE': { lower: 80, upper: 210, unit: '°C' },
  'CCP-1B-BREAD-TEMP': { lower: 145, upper: 225, unit: '°C' },
  'CCP-1B-BREAD-TIME': { lower: 30, upper: 60, unit: '분' },
  'CCP-1B-BREAD-CORE': { lower: 90, upper: 200, unit: '°C' },

  // ========== CCP-2B: 크림 휘핑 (5개) ==========
  'CCP-2B-CREAM-MASS': { lower: 0, upper: 3.5, unit: 'kg' },
  'CCP-2B-CREAM-TEMP-START': { lower: -99, upper: 15, unit: '°C' },
  'CCP-2B-CREAM-TEMP-END': { lower: -99, upper: 15, unit: '°C' },
  'CCP-2B-CREAM-USE-TIME': { lower: 34, upper: 40, unit: '분' },  // ★ 이탈 다발
  'CCP-2B-ENV-ROOM-TEMP': { lower: 0, upper: 23, unit: '°C' },

  // ========== CCP-3B: 시럽 가열 (3개) ==========
  'CCP-3B-SYRUP-TEMP': { lower: 85, upper: 95, unit: '°C' },
  'CCP-3B-SYRUP-TIME': { lower: 5, upper: 62, unit: '분' },
  'CCP-3B-SYRUP-CORE': { lower: 80, upper: 999, unit: '°C' },

  // ========== CCP-4B: 세척 (3개) ==========
  'CCP-4B-RAWWT': { lower: 0, upper: 500, unit: 'g' },
  'CCP-4B-WASH-VOL': { lower: 3, upper: 9999, unit: 'L' },
  'CCP-4B-WASH-TIME': { lower: 5, upper: 9999, unit: '분' },

  // ========== CCP-5P: 금속검출 (3개) - Boolean ==========
  'CCP-5P-PIECE-FE20': { lower: 1, upper: 1, unit: 'Bool' },   // 반드시 1(통과)
  'CCP-5P-PIECE-SUS25': { lower: 1, upper: 1, unit: 'Bool' },  // 반드시 1(통과)
  'CCP-5P-PROD': { lower: 1, upper: 1, unit: 'Bool' },         // 반드시 1(불검출)
};

// 판정 함수
function judgeCcp(ccpCode: string, measuredValue: number): 'PASS' | 'FAIL' {
  const def = CCP_DEFINITIONS[ccpCode];
  if (!def) throw new Error(`Unknown CCP code: ${ccpCode}`);

  // Boolean 타입 (금속검출)
  if (def.unit === 'Bool') {
    return measuredValue === 1 ? 'PASS' : 'FAIL';
  }

  // 숫자 범위 타입
  return (measuredValue >= def.lower && measuredValue <= def.upper) 
    ? 'PASS' 
    : 'FAIL';
}
```

### 6.1.2 제품군 → CCP 매핑

```typescript
// 제품군 선택 시 입력해야 할 CCP 항목
const PRODUCT_GROUP_CCP_MAP = {
  COOKIE: ['CCP-1B-COOKIE-TEMP', 'CCP-1B-COOKIE-TIME', 'CCP-1B-COOKIE-CORE'],
  BREAD: ['CCP-1B-BREAD-TEMP', 'CCP-1B-BREAD-TIME', 'CCP-1B-BREAD-CORE'],
  CREAM: [
    'CCP-2B-CREAM-MASS',
    'CCP-2B-CREAM-TEMP-START',
    'CCP-2B-CREAM-TEMP-END',
    'CCP-2B-CREAM-USE-TIME',
    'CCP-2B-ENV-ROOM-TEMP',
  ],
  SYRUP: ['CCP-3B-SYRUP-TEMP', 'CCP-3B-SYRUP-TIME', 'CCP-3B-SYRUP-CORE'],
  WASHING: ['CCP-4B-RAWWT', 'CCP-4B-WASH-VOL', 'CCP-4B-WASH-TIME'],
  METAL_DETECTION: ['CCP-5P-PIECE-FE20', 'CCP-5P-PIECE-SUS25', 'CCP-5P-PROD'],
};
```

## 6.2 LOT 번호 생성

```typescript
// LOT 번호 형식: YYYYMMDD-{제품코드}-{3자리 시리얼}
// 예: 20251214-P024-001

async function generateLotNumber(
  prisma: PrismaClient,
  companyId: string,
  productCode: string,
  productionDate: Date
): Promise<string> {
  // 날짜 포맷
  const dateStr = format(productionDate, 'yyyyMMdd');
  const prefix = `${dateStr}-${productCode}-`;

  // 당일 해당 제품의 마지막 LOT 조회
  const lastRecord = await prisma.productionRecord.findFirst({
    where: {
      companyId,
      lotNumber: { startsWith: prefix },
    },
    orderBy: { lotNumber: 'desc' },
  });

  // 시리얼 계산
  let serial = 1;
  if (lastRecord) {
    const lastSerial = parseInt(lastRecord.lotNumber.slice(-3));
    serial = lastSerial + 1;
  }

  return `${prefix}${serial.toString().padStart(3, '0')}`;
}

// 유통기한 계산
function calculateExpiryDate(productionDate: Date, shelfLifeDays: number): Date {
  return addDays(productionDate, shelfLifeDays);
}
```

## 6.3 BOM 기반 원료 사용량 계산

```typescript
// 생산 시 원료 자동 차감

interface MaterialUsage {
  materialId: string;
  materialName: string;
  usedQuantity: number;
  unit: string;
}

async function calculateMaterialUsage(
  prisma: PrismaClient,
  companyId: string,
  productId: string,
  totalQuantity: number  // 양품 + 불량
): Promise<MaterialUsage[]> {
  // BOM 조회
  const recipes = await prisma.recipe.findMany({
    where: { companyId, productId },
    include: { material: true },
  });

  return recipes.map((recipe) => ({
    materialId: recipe.materialId,
    materialName: recipe.material?.name || recipe.materialName,
    usedQuantity: recipe.unitConsumption.toNumber() * totalQuantity,
    unit: recipe.unit,
  }));
}

// 예시: P024 (요거트복숭아케이크) 5개 생산 시
// 제누와즈 화이트 레시피 기준 (12종 원료):
// - 전란: 2,392g × 5 = 11,960g
// - 노른자: 520g × 5 = 2,600g
// - 설탕: 1,320g × 5 = 6,600g
// ...
```

## 6.4 방충방서 판정 로직

```typescript
// 관리기준 (20개)
const PEST_CRITERIA = [
  // 동절기(11~3월)
  { season: 'WINTER', zone: 'CLEAN', category: 'FLYING', level: 1, threshold: 2 },
  { season: 'WINTER', zone: 'CLEAN', category: 'FLYING', level: 2, threshold: 4 },
  { season: 'WINTER', zone: 'GENERAL', category: 'FLYING', level: 1, threshold: 3 },
  { season: 'WINTER', zone: 'GENERAL', category: 'FLYING', level: 2, threshold: 10 },
  { season: 'WINTER', zone: 'CLEAN', category: 'CRAWLING', level: 1, threshold: 1 },
  { season: 'WINTER', zone: 'CLEAN', category: 'CRAWLING', level: 2, threshold: 3 },
  { season: 'WINTER', zone: 'GENERAL', category: 'CRAWLING', level: 1, threshold: 1 },
  { season: 'WINTER', zone: 'GENERAL', category: 'CRAWLING', level: 2, threshold: 5 },
  { season: 'WINTER', zone: 'GENERAL', category: 'RODENT', level: 1, threshold: 0 },
  { season: 'WINTER', zone: 'GENERAL', category: 'RODENT', level: 2, threshold: 2 },
  
  // 하절기(4~10월)
  { season: 'SUMMER', zone: 'CLEAN', category: 'FLYING', level: 1, threshold: 3 },
  { season: 'SUMMER', zone: 'CLEAN', category: 'FLYING', level: 2, threshold: 10 },
  { season: 'SUMMER', zone: 'GENERAL', category: 'FLYING', level: 1, threshold: 5 },
  { season: 'SUMMER', zone: 'GENERAL', category: 'FLYING', level: 2, threshold: 15 },
  { season: 'SUMMER', zone: 'CLEAN', category: 'CRAWLING', level: 1, threshold: 1 },
  { season: 'SUMMER', zone: 'CLEAN', category: 'CRAWLING', level: 2, threshold: 3 },
  { season: 'SUMMER', zone: 'GENERAL', category: 'CRAWLING', level: 1, threshold: 2 },
  { season: 'SUMMER', zone: 'GENERAL', category: 'CRAWLING', level: 2, threshold: 10 },
  { season: 'SUMMER', zone: 'GENERAL', category: 'RODENT', level: 1, threshold: 0 },
  { season: 'SUMMER', zone: 'GENERAL', category: 'RODENT', level: 2, threshold: 2 },
];

// 구역 등급 (실제 데이터: 모두 일반구역)
const ZONE_GRADES = {
  '탈의실': 'GENERAL',
  '위생전실': 'GENERAL',
  '배합실': 'GENERAL',
  '가열실': 'GENERAL',
  '내포장실': 'GENERAL',
  '외포장실': 'GENERAL',
  '실온창고': 'GENERAL',
  '입출고실': 'GENERAL',
  '외곽출입구': 'GENERAL',
  '부대': 'GENERAL',
};

// 시즌 자동 판정
function getCurrentSeason(date: Date): 'WINTER' | 'SUMMER' {
  const month = date.getMonth() + 1; // 0-indexed
  return (month >= 11 || month <= 3) ? 'WINTER' : 'SUMMER';
}

// 판정 함수
function judgePestCount(
  zone: string,
  category: 'FLYING' | 'CRAWLING' | 'RODENT',
  count: number,
  date: Date
): 'NORMAL' | 'LEVEL1' | 'LEVEL2' {
  const season = getCurrentSeason(date);
  const zoneGrade = ZONE_GRADES[zone] || 'GENERAL';

  const criteria = PEST_CRITERIA.filter(
    (c) => c.season === season && c.zone === zoneGrade && c.category === category
  );

  const level1 = criteria.find((c) => c.level === 1)?.threshold ?? 0;
  const level2 = criteria.find((c) => c.level === 2)?.threshold ?? Infinity;

  if (count > level2) return 'LEVEL2';
  if (count > level1) return 'LEVEL1';
  return 'NORMAL';
}
```

## 6.5 재고 관리 로직

```typescript
// 재고 트랜잭션 처리

async function updateInventoryBalance(
  prisma: PrismaClient,
  companyId: string,
  materialId: string,
  transactionDate: Date,
  inQuantity: number,
  outQuantity: number
): Promise<InventoryBalance> {
  const balanceDate = startOfDay(transactionDate);

  // 전일 재고 조회
  const previousBalance = await prisma.inventoryBalance.findFirst({
    where: {
      companyId,
      materialId,
      balanceDate: { lt: balanceDate },
    },
    orderBy: { balanceDate: 'desc' },
  });

  const openingBalance = previousBalance?.closingBalance.toNumber() ?? 0;

  // 현재 잔액 계산
  return prisma.inventoryBalance.upsert({
    where: {
      companyId_materialId_balanceDate: {
        companyId,
        materialId,
        balanceDate,
      },
    },
    create: {
      companyId,
      materialId,
      balanceDate,
      openingBalance,
      totalIn: inQuantity,
      totalOut: outQuantity,
      closingBalance: openingBalance + inQuantity - outQuantity,
      unit: 'g',
    },
    update: {
      totalIn: { increment: inQuantity },
      totalOut: { increment: outQuantity },
      closingBalance: { increment: inQuantity - outQuantity },
    },
  });
}
```

---

# 7. 마이그레이션 가이드

## 7.1 데이터 마이그레이션 순서

```
1단계: 마스터 데이터 (의존성 없음)
├── companies (수동 생성)
├── users (Staff 시트)
├── suppliers (구매처 시트)
├── customers (납품처 시트)
└── materials (원료코드 시트)

2단계: 마스터 데이터 (1단계 의존)
├── semi_products (반제품 시트)
├── products (제품 시트)
└── ccp_definitions (Master_CCP 시트)

3단계: BOM 데이터
└── recipes (기초정보_레시피 시트) ★ 원료코드 NULL 처리 필요

4단계: 기준 데이터
└── pest_criteria (관리기준 시트)

5단계: 트랜잭션 데이터 (선택)
├── ccp_records (CCP_Log_Detail 시트)
├── batches (Batch 시트)
├── ccp_deviations (Deviation 시트)
├── production_records (응답_생산 시트)
└── inventory_transactions (DB_재고 시트)
```

## 7.2 마이그레이션 스크립트

```typescript
// scripts/migrate-from-sheets.ts

import { parse } from 'xlsx';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateAll(companyId: string) {
  console.log('Starting migration...');

  // 1. 원료
  await migrateMaterials(companyId, './data/00__Master_DB.xlsx');
  
  // 2. 제품
  await migrateProducts(companyId, './data/00__Master_DB.xlsx');
  
  // 3. 레시피 (★ 주의: 원료코드 NULL 처리)
  await migrateRecipes(companyId, './data/00__Master_DB.xlsx');
  
  // 4. CCP 정의
  await migrateCcpDefinitions(companyId, './data/02__HACCP_CCP.xlsx');
  
  // 5. 방충방서 기준
  await migratePestCriteria(companyId, './data/05__방충_방서_주간_점검표.xlsx');

  console.log('Migration completed!');
}

// 원료 마이그레이션
async function migrateMaterials(companyId: string, filePath: string) {
  const workbook = parse(fs.readFileSync(filePath));
  const sheet = workbook.Sheets['원료코드'];
  const data = utils.sheet_to_json(sheet, { header: 1 });

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0] || !row[2]) continue; // 사용여부, 원료코드 체크

    await prisma.material.upsert({
      where: { companyId_code: { companyId, code: row[2] } },
      create: {
        companyId,
        code: row[2],           // 원료코드
        category: row[1],       // 대분류
        brand: row[3],          // 브랜드
        name: row[4],           // 품명
        weight: row[5],         // 중량
        unit: row[6],           // 규격/단위
        integratedName: row[7], // 통합관리명
        storageType: mapStorageType(row[8]),
        tempMin: row[9],
        tempMax: row[10],
        isActive: row[0] === true || row[0] === 'TRUE',
      },
      update: {},
    });
  }
}

// 레시피 마이그레이션 (★ 원료코드 NULL 처리)
async function migrateRecipes(companyId: string, filePath: string) {
  const workbook = parse(fs.readFileSync(filePath));
  const sheet = workbook.Sheets['기초정보_레시피'];
  const data = utils.sheet_to_json(sheet, { header: 1 });

  // 원료 목록 조회 (이름으로 매칭용)
  const materials = await prisma.material.findMany({ where: { companyId } });

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0] || !row[1]) continue;

    // 원료코드가 NULL인 경우 이름으로 매칭
    let materialId = null;
    if (row[5]) {
      const material = materials.find((m) => m.code === row[5]);
      materialId = material?.id;
    } else if (row[6]) {
      // 원료명으로 매칭 시도
      const material = materials.find(
        (m) => m.name === row[6] || m.integratedName === row[6]
      );
      materialId = material?.id;
    }

    await prisma.recipe.create({
      data: {
        companyId,
        productId: null, // 별도 매칭 필요
        materialId,
        materialName: row[6],   // 원료명 (materialId 없어도 저장)
        componentName: row[3],  // 구성명
        batchSize: row[4] || 1,
        amount: row[7],         // 배합량
        unit: row[8] || 'g',
        outputQuantity: row[9] || 1,
        unitConsumption: row[10], // 1개당 소요량
      },
    });
  }
}

// 보관구분 매핑
function mapStorageType(value: string): 'REFRIGERATED' | 'FROZEN' | 'ROOM_TEMP' {
  switch (value) {
    case '냉장': return 'REFRIGERATED';
    case '냉동': return 'FROZEN';
    default: return 'ROOM_TEMP';
  }
}
```

## 7.3 병행 운영 전략

```
Phase 1: 준비 (1주)
├── 개발 환경 구축
├── 마스터 데이터 마이그레이션
└── 테스트 데이터 검증

Phase 2: 파일럿 (2주)
├── 일부 기능 신규 시스템 전환 (CCP 기록)
├── Google Sheets와 병행 운영
└── 데이터 정합성 모니터링

Phase 3: 전환 (2주)
├── 전체 기능 신규 시스템 전환
├── Google Sheets는 읽기 전용
└── 문제 발생 시 롤백 준비

Phase 4: 안정화 (2주)
├── Google Sheets 접근 중단
├── 히스토리 데이터 아카이브
└── 모니터링 및 최적화
```

---

# 8. 개발 일정

## 8.1 권장 일정 (12주)

```
Week 1-2: 프로젝트 셋업
├── 모노레포 구성
├── DB 스키마 설계 및 마이그레이션
├── 인증 시스템 구축
└── API 기본 구조

Week 3-4: 마스터 데이터 모듈
├── 원료/제품/반제품 CRUD
├── 레시피(BOM) 관리
├── 거래처 관리
└── 관리자 웹 기본 화면

Week 5-6: CCP 모듈 (★ 핵심)
├── CCP 정의 관리
├── CCP 기록 API (자동 판정)
├── 이탈 관리
├── 배치 상태 관리
└── 현장 앱 CCP 화면

Week 7-8: 점검 모듈
├── 일일 위생 점검
├── 방충방서 점검 (자동 판정)
├── CCP 검증 (월간)
└── 현장 앱 점검 화면

Week 9-10: 생산/재고 모듈
├── 생산 기록 (LOT 자동 생성)
├── 출하 관리
├── 재고 트랜잭션
├── 원료 수불부 기능
└── 현장 앱 생산 화면

Week 11-12: 마무리
├── 대시보드
├── 리포트 생성
├── 오프라인 동기화
├── 테스트 및 버그 수정
└── 배포
```

## 8.2 MVP 범위 (6주 단축 버전)

```
필수 기능만 구현:
├── CCP 기록 및 자동 판정
├── 일일 위생 점검
├── 생산 기록 (LOT 생성)
├── 기본 대시보드

제외 (후속 개발):
├── 방충방서 점검
├── CCP 검증 (월간)
├── 출하 관리
├── 원료 수불부
├── 오프라인 동기화
├── 리포트 생성
```

---

# 9. 부록: 실제 데이터 참조

## 9.1 원료 데이터 (26개)

| 코드 | 품명 | 보관 | 온도범위 |
|------|------|------|----------|
| RM-001 | 휘핑크림_벌크 | 냉장 | -2~5°C |
| RM-002 | 휘핑크림_1L | 냉장 | -2~5°C |
| RM-003 | 생크림_1L(무가당) | 냉장 | -2~5°C |
| ... | ... | ... | ... |
| RM-026 | 내수용6구케이크박스 | 실온 | 1~35°C |

## 9.2 제품 데이터 (12개)

| 코드 | 제품명 | 보존기간 | 보관 |
|------|--------|----------|------|
| P001 | 바닐라 까눌레 | 60일 | 냉동 |
| P002 | 요거트복숭아케이크(JW)_16ea | 180일 | 냉동 |
| ... | ... | ... | ... |
| P012 | 얼그레이 생과일케이크_6ea | 180일 | 냉동 |

## 9.3 납품처 데이터 (4개)

| 코드 | 상호명 |
|------|--------|
| CL-001 | 주식회사 제이더블유푸드 |
| CL-002 | 맛남살롱_부천시청점 |
| CL-003 | 맛남살롱_상동점 |
| CL-004 | 맛남살롱_부천역사점 |
