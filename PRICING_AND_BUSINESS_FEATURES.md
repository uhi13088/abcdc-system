# ABC Staff System - 요금제 및 경영 관리 기능

## 💳 요금제 구조

### 📊 전체 플랜

```
┌─────────────────────────────────────────────┐
│ 💚 FREE (무료)                               │
├─────────────────────────────────────────────┤
│ • 직원 10명까지                              │
│ • 매장 1개                                   │
│ • QR 출퇴근                                  │
│ • 기본 급여 계산                             │
│ • 모바일 앱 (직원 + 관리자)                  │
│ • 앱 푸시 알림                               │
│ • FAQ + 이메일 지원                          │
│                                             │
│ 💰 무료                                     │
│                                             │
│ 🎯 타겟: 소규모 자영업자, 시작 단계          │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ 🔵 STARTER (스타터)                          │
├─────────────────────────────────────────────┤
│ • 직원 50명까지                              │
│ • 매장 3개                                   │
│ • FREE 모든 기능 +                           │
│                                             │
│ 📋 직원 관리:                                │
│   • 스케줄 관리                              │
│   • 휴가 관리                                │
│   • 근로계약서 자동 생성                      │
│   • 계약서 전자 서명                         │
│                                             │
│ 💰 급여 관리:                                │
│   • 급여 명세서 자동 생성 (PDF)              │
│   • 이메일 자동 발송                         │
│   • 4대보험 자동 계산                        │
│   • 원천세 자동 계산                         │
│                                             │
│ 📊 리포트:                                   │
│   • 기본 리포트 (출퇴근, 급여)               │
│   • 데이터 내보내기 (엑셀)                   │
│                                             │
│ 💰 월 39,000원 (연간 390,000원 - 17% 할인)   │
│                                             │
│ 🎯 타겟: 중소 식당/카페, 매장 운영자         │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ 🟣 PRO (프로) ⭐ 추천                        │
├─────────────────────────────────────────────┤
│ • 직원 200명까지                             │
│ • 매장 무제한                                │
│ • STARTER 모든 기능 +                        │
│                                             │
│ 🎯 고급 직원 관리:                           │
│   • 긴급 근무 모집 (AI 추천)                 │
│   • 직원 평가 시스템                         │
│   • 교육 이력 관리                           │
│                                             │
│ 💰 경영 관리 (킬러 기능!) ⭐⭐⭐              │
│   • 토스 POS 자동 연동                       │
│     - 매출 자동 수집 (실시간)                │
│     - 카드/현금 구분                         │
│     - 시간대별 분석                          │
│   • 오픈뱅킹 연동                            │
│     - 비용 자동 수집                         │
│     - 거래 자동 분류 (AI)                    │
│   • 고정비 관리 (월세, 관리비 등)            │
│   • 손익계산서 자동 생성                     │
│   • 비용 분석 & 개선 제안                    │
│   • 월별/분기별/연간 리포트                  │
│   • 영업이익률 추이 분석                     │
│                                             │
│ 🎨 브랜딩:                                   │
│   • 커스텀 로고                              │
│   • 앱 색상 변경                             │
│                                             │
│ 📤 데이터:                                   │
│   • 고급 리포트 (PDF, 엑셀)                  │
│   • 모든 데이터 내보내기                     │
│                                             │
│ 💰 월 99,000원 (연간 990,000원 - 17% 할인)   │
│                                             │
│ 🎯 타겟: 체인점, 토스 POS 사용자,            │
│          경영 숫자 보고 싶은 사장님           │
│                                             │
│ 📌 토스 POS 사용자에게 특히 추천!            │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ 🏢 ENTERPRISE (엔터프라이즈)                  │
├─────────────────────────────────────────────┤
│ 🔜 추가 예정                                 │
│                                             │
│ 계획 중인 기능:                              │
│ • 직원 무제한                                │
│ • 매장 무제한                                │
│ • API 접근                                   │
│ • 온프레미스 옵션                            │
│ • SLA 보장                                   │
│ • 맞춤 개발                                  │
│                                             │
│ 💰 별도 문의                                 │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ 🏭 HACCP 애드온 (선택)                       │
├─────────────────────────────────────────────┤
│ • 어떤 플랜에도 추가 가능                     │
│ • HACCP 전용 모바일 앱                       │
│                                             │
│ 📋 9개 핵심 모듈:                            │
│   • 일일 위생 점검                           │
│   • CCP 모니터링                             │
│   • 원부재료 검사                            │
│   • 생산/출하 기록                           │
│   • 방충/방서 관리                           │
│   • CCP 검증 (월간)                          │
│   • 원료 수불                                │
│   • 반제품 관리                              │
│                                             │
│ 🤖 자동화:                                   │
│   • IoT 센서 자동 연동                       │
│   • 자동 리마인더 & 알림                     │
│   • 바코드/QR 자동 입력                      │
│   • AI 이상 감지                             │
│                                             │
│ 📊 심사 대비:                                │
│   • HACCP 심사 준비 리포트                   │
│   • 개선조치 워크플로우                      │
│   • 내부 심사 모듈                           │
│                                             │
│ 💰 월 +99,000원                              │
│                                             │
│ 🎯 타겟: 식품 제조 공장                      │
└─────────────────────────────────────────────┘
```

---

## 📊 요금제 비교표

| 기능 | FREE | STARTER | PRO | HACCP 애드온 |
|-----|------|---------|-----|-------------|
| **기본** | | | | |
| 직원 수 | 10명 | 50명 | 200명 | - |
| 매장 수 | 1개 | 3개 | 무제한 | - |
| QR 출퇴근 | ✅ | ✅ | ✅ | - |
| 모바일 앱 | ✅ | ✅ | ✅ | ✅ |
| 앱 푸시 알림 | ✅ | ✅ | ✅ | ✅ |
| | | | | |
| **직원 관리** | | | | |
| 스케줄 관리 | ❌ | ✅ | ✅ | - |
| 휴가 관리 | ❌ | ✅ | ✅ | - |
| 근로계약서 생성 | ❌ | ✅ | ✅ | - |
| 전자 서명 | ❌ | ✅ | ✅ | - |
| 긴급 근무 모집 | ❌ | ❌ | ✅ | - |
| 직원 평가 | ❌ | ❌ | ✅ | - |
| | | | | |
| **급여 관리** | | | | |
| 기본 급여 계산 | ✅ | ✅ | ✅ | - |
| 급여명세서 생성 | ❌ | ✅ | ✅ | - |
| 이메일 발송 | ❌ | ✅ | ✅ | - |
| 4대보험 계산 | ❌ | ✅ | ✅ | - |
| | | | | |
| **경영 관리** | | | | |
| 토스 POS 연동 | ❌ | ❌ | ✅ | - |
| 오픈뱅킹 연동 | ❌ | ❌ | ✅ | - |
| 손익계산서 | ❌ | ❌ | ✅ | - |
| 비용 분석 | ❌ | ❌ | ✅ | - |
| | | | | |
| **HACCP** | | | | |
| HACCP 앱 | ❌ | ❌ | ❌ | ✅ |
| 9개 모듈 | ❌ | ❌ | ❌ | ✅ |
| IoT 센서 | ❌ | ❌ | ❌ | ✅ |
| 심사 리포트 | ❌ | ❌ | ❌ | ✅ |
| | | | | |
| **리포트** | | | | |
| 기본 리포트 | ❌ | ✅ | ✅ | ✅ |
| 고급 리포트 | ❌ | ❌ | ✅ | ✅ |
| 데이터 내보내기 | ❌ | ✅ | ✅ | ✅ |
| | | | | |
| **지원** | | | | |
| FAQ | ✅ | ✅ | ✅ | ✅ |
| 이메일 지원 | ✅ | ✅ | ✅ | ✅ |
| | | | | |
| **가격** | 무료 | 39,000원/월 | 99,000원/월 | +99,000원/월 |

---

## 💰 경영 관리 기능 상세

### 🔌 토스 POS 연동

**자동으로 수집되는 데이터:**

```typescript
interface TossPOSSalesData {
  // 일별 매출
  dailySales: {
    date: Date;
    totalAmount: number;      // 총 매출
    cardAmount: number;       // 카드 매출
    cashAmount: number;       // 현금 매출
    transactionCount: number; // 거래 건수
  };
  
  // 시간대별 매출
  hourlySales: Array<{
    hour: number;            // 10, 11, 12...
    amount: number;
    transactions: number;
  }>;
  
  // 결제 수단별
  paymentMethods: {
    card: number;
    cash: number;
    transfer: number;
  };
  
  // 개별 거래
  transactions: Array<{
    time: string;
    amount: number;
    method: 'CARD' | 'CASH' | 'TRANSFER';
    items?: Array<{
      name: string;
      quantity: number;
      price: number;
    }>;
  }>;
}
```

**사용자 화면:**

```tsx
function TossPOSDashboard() {
  return (
    <Dashboard>
      {/* 오늘 매출 */}
      <SalesCard>
        <h2>오늘 매출 (실시간)</h2>
        <BigNumber>1,250,000원</BigNumber>
        
        <Breakdown>
          <Item>카드: 980,000원 (78%)</Item>
          <Item>현금: 270,000원 (22%)</Item>
        </Breakdown>
        
        <LastSync>5분 전 동기화 🔄</LastSync>
      </SalesCard>
      
      {/* 시간대별 */}
      <ChartCard>
        <h3>시간대별 매출</h3>
        <BarChart data={hourlySales} />
        
        <Insight>
          💡 점심시간(12-14시)에 매출이 집중돼요.
          이 시간대 직원을 1명 더 배치하면 좋겠어요.
        </Insight>
      </ChartCard>
    </Dashboard>
  );
}
```

---

### 💳 오픈뱅킹 연동

**자동으로 수집되는 데이터:**

```typescript
interface OpenBankingData {
  // 거래 내역
  transactions: Array<{
    date: Date;
    time: string;
    name: string;           // 거래처
    amount: number;
    type: 'IN' | 'OUT';
    
    // AI 자동 분류
    category?: '재료비' | '관리비' | '월세' | '인건비' | '기타';
    confidence?: number;    // 분류 확신도
    
    // 수동 수정 가능
    userCategory?: string;
    note?: string;
  }>;
  
  // 월별 요약
  monthlySummary: {
    totalIncome: number;
    totalExpense: number;
    expenseByCategory: {
      material: number;     // 재료비
      rent: number;         // 월세
      utilities: number;    // 관리비
      payroll: number;      // 급여 (자동 연동)
      other: number;
    };
  };
}
```

**AI 자동 분류 예시:**

```typescript
// 거래 내역 자동 분류
거래처: "농협 농수산물"
→ 분류: 재료비 (확신도: 95%)

거래처: "OO건물 관리사무소"
→ 분류: 관리비 (확신도: 98%)

거래처: "김철수"
→ 분류: 기타 (확신도: 30%)
→ 수동 확인 필요
```

**사용자 화면:**

```tsx
function ExpenseManagement() {
  return (
    <Dashboard>
      <h2>이번 달 비용</h2>
      
      {/* 자동 분류된 거래 */}
      <TransactionList>
        {transactions.map(tx => (
          <TransactionItem key={tx.id}>
            <Date>{formatDate(tx.date)}</Date>
            <Name>{tx.name}</Name>
            <Amount>-{tx.amount.toLocaleString()}원</Amount>
            
            {/* AI 분류 */}
            <CategoryBadge confidence={tx.confidence}>
              {tx.category}
              {tx.confidence < 80 && <Warning>확인 필요</Warning>}
            </CategoryBadge>
            
            {/* 수정 버튼 */}
            <EditButton onClick={() => editCategory(tx)}>
              수정
            </EditButton>
          </TransactionItem>
        ))}
      </TransactionList>
      
      {/* 카테고리별 요약 */}
      <SummaryCard>
        <h3>카테고리별 비용</h3>
        <PieChart data={expenseByCategory} />
        
        <List>
          <Item>재료비: 6,200,000원 (32.6%)</Item>
          <Item>인건비: 8,500,000원 (44.7%) ⚠️ 높음</Item>
          <Item>월세: 3,000,000원 (15.8%)</Item>
          <Item>관리비: 450,000원 (2.4%)</Item>
          <Item>기타: 850,000원 (4.5%)</Item>
        </List>
      </SummaryCard>
    </Dashboard>
  );
}
```

---

### 📊 손익계산서 자동 생성

**자동으로 만들어지는 리포트:**

```
ABC 카페 - 2024년 1월 손익계산서
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[매출]
  토스 POS (자동)     23,700,000원
  ─────────────────────────────
  총 매출            23,700,000원

[비용]
  인건비 (자동)       -8,500,000원
  재료비 (자동)       -6,200,000원
  월세 (수동)         -3,000,000원
  관리비 (자동)         -450,000원
  기타 (자동)           -850,000원
  ─────────────────────────────
  총 비용           -19,000,000원

[순이익]
  영업이익            4,700,000원
  영업이익률              19.8%
  
[전월 대비]
  매출 증가               +12.5%
  비용 감소                -3.2%
  이익 증가               +24.8%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
생성일: 2024-02-01
```

**화면:**

```tsx
function ProfitLossStatement() {
  return (
    <Report>
      <Header>
        <h1>손익계산서</h1>
        <MonthPicker value="2024-01" />
        <DownloadButton>PDF 다운로드</DownloadButton>
      </Header>
      
      {/* 요약 */}
      <Summary>
        <MetricCard>
          <Label>총 매출</Label>
          <Value>23,700,000원</Value>
          <Change color="green">+12.5% ↑</Change>
        </MetricCard>
        
        <MetricCard>
          <Label>총 비용</Label>
          <Value>19,000,000원</Value>
          <Change color="green">-3.2% ↓</Change>
        </MetricCard>
        
        <MetricCard highlighted>
          <Label>순이익</Label>
          <BigValue>4,700,000원</BigValue>
          <Change color="green">+24.8% ↑</Change>
        </MetricCard>
      </Summary>
      
      {/* 추이 차트 */}
      <TrendChart>
        <h3>최근 6개월 추이</h3>
        <LineChart 
          data={last6Months}
          lines={['매출', '비용', '순이익']}
        />
      </TrendChart>
      
      {/* 비용 구조 */}
      <CostStructure>
        <h3>비용 구조</h3>
        <PieChart data={expenseBreakdown} />
        
        <Alert severity="warning">
          ⚠️ 인건비 비율이 44.7%로 업계 평균(35%)보다 높아요.
          스케줄 최적화로 15% 절감 가능합니다.
        </Alert>
      </CostStructure>
      
      {/* AI 개선 제안 */}
      <Recommendations>
        <h3>개선 제안</h3>
        
        <Recommendation>
          <Icon>💰</Icon>
          <Content>
            <Title>인건비 최적화</Title>
            <Description>
              한가한 시간대(15-17시)의 직원을 1명 줄이면
              월 500,000원 절감 가능해요.
            </Description>
          </Content>
          <ActionButton>스케줄 보기</ActionButton>
        </Recommendation>
        
        <Recommendation>
          <Icon>📦</Icon>
          <Content>
            <Title>재료비 절감</Title>
            <Description>
              업체별 단가를 비교해보세요.
              OO식자재는 같은 품질에 15% 저렴해요.
            </Description>
          </Content>
          <ActionButton>비교하기</ActionButton>
        </Recommendation>
      </Recommendations>
    </Report>
  );
}
```

---

### 🎯 토스 POS 사용자 전용 기능

**연결 설정:**

```tsx
function TossPOSSetup() {
  return (
    <SetupWizard>
      <Step1>
        <h2>토스 POS 연결</h2>
        <InfoBox>
          <Icon>💳</Icon>
          <p>
            토스 POS와 연결하면:
            ✅ 매출이 자동으로 집계돼요
            ✅ 손익계산서가 자동으로 만들어져요
            ✅ 경영 현황을 한눈에 볼 수 있어요
          </p>
        </InfoBox>
        
        <ConnectButton onClick={connectTossPOS}>
          토스 POS 연결하기
        </ConnectButton>
      </Step1>
      
      <Step2>
        <h2>토스 로그인</h2>
        <TossLoginFrame>
          {/* 토스 OAuth 로그인 */}
        </TossLoginFrame>
      </Step2>
      
      <Step3>
        <h2>권한 승인</h2>
        <PermissionList>
          <Permission>✅ 매출 데이터 읽기</Permission>
          <Permission>✅ 거래 내역 읽기</Permission>
        </PermissionList>
        <ApproveButton>승인하기</ApproveButton>
      </Step3>
      
      <Step4>
        <SuccessMessage>
          <Icon>🎉</Icon>
          <h2>연결 완료!</h2>
          <p>지금부터 매출이 자동으로 수집됩니다.</p>
        </SuccessMessage>
        <StartButton>대시보드 보기</StartButton>
      </Step4>
    </SetupWizard>
  );
}
```

**다른 POS 사용자 안내:**

```tsx
function OtherPOSUsers() {
  return (
    <InfoPage>
      <h2>다른 POS를 사용하시나요?</h2>
      
      <CurrentSupport>
        <h3>현재 지원</h3>
        <POSCard>
          <Logo src="toss-pos.png" />
          <Name>토스 POS</Name>
          <Badge>자동 연동</Badge>
        </POSCard>
      </CurrentSupport>
      
      <PlannedSupport>
        <h3>추가 예정 (요청 많은 순)</h3>
        
        <POSRequest>
          <Name>포스뱅크</Name>
          <RequestCount>127명 요청</RequestCount>
          <RequestButton>+ 저도 사용해요</RequestButton>
        </POSRequest>
        
        <POSRequest>
          <Name>배달의민족</Name>
          <RequestCount>89명 요청</RequestCount>
          <RequestButton>+ 저도 사용해요</RequestButton>
        </POSRequest>
      </PlannedSupport>
      
      <Alternatives>
        <h3>대안</h3>
        
        <Alternative>
          <Icon>💳</Icon>
          <Title>오픈뱅킹으로 시작하기</Title>
          <Description>
            카드 매출은 계좌 거래내역으로 자동 집계돼요.
            완벽하진 않지만 대부분의 매출을 파악할 수 있어요.
          </Description>
          <Button>설정하기</Button>
        </Alternative>
        
        <Alternative>
          <Icon>✍️</Icon>
          <Title>수동 입력</Title>
          <Description>
            하루 마감 시 매출을 입력하세요. 30초면 충분해요.
          </Description>
          <Button>시작하기</Button>
        </Alternative>
      </Alternatives>
      
      <CustomRequest>
        <h4>사용 중인 POS가 없나요?</h4>
        <Input placeholder="POS 이름" />
        <SubmitButton>추가 요청</SubmitButton>
      </CustomRequest>
    </InfoPage>
  );
}
```

---

## 🎁 프로모션

### 런칭 이벤트

```
🎉 첫 100명 얼리버드 혜택

1️⃣ 평생 30% 할인
   STARTER: 39,000원 → 27,300원
   PRO: 99,000원 → 69,300원
   
2️⃣ 연간 결제 시 2개월 무료
   (17% 추가 할인)
   
3️⃣ HACCP 애드온 첫 달 무료

조건: 2024년 3월 31일까지 가입
```

### 무료 체험

```
🆓 14일 무료 체험

• 모든 플랜 14일 무료
• 신용카드 등록 필요
• 체험 종료 전 알림
• 언제든지 취소 가능
```

### 추천 프로그램

```
💝 친구 초대 이벤트

• 친구 초대 시 양쪽 모두 1개월 무료
• 무제한 초대 가능
• 누적 할인 적용
```

---

## 📈 예상 고객 분포

```
FREE (60%):
├─ 소규모 자영업자
├─ 시작 단계 사업자
└─ 직원 5명 이하

STARTER (30%):
├─ 중소 식당/카페
├─ 매장 1-2개
└─ 직원 20-40명

PRO (10%):
├─ 체인점
├─ 토스 POS 사용자 ⭐
├─ 경영 분석 필요한 사장님
└─ 여러 매장 운영

HACCP 애드온 (<5%):
└─ 식품 제조 공장
```

---

## 💻 기술 스택 (경영 관리)

```typescript
// 토스 POS API
- Endpoint: https://api.tosspayments.com/v1/pos
- 인증: OAuth 2.0
- 데이터 수집: 매시간 자동

// 오픈뱅킹 API
- Endpoint: https://openapi.open-platform.or.kr
- 인증: OAuth 2.0
- 데이터 수집: 매일 1회 (새벽 2시)

// AI 자동 분류
- 모델: GPT-4 Turbo
- 프롬프트:
  "다음 거래를 분류해주세요:
   거래처: {name}
   금액: {amount}
   
   카테고리: 재료비, 인건비, 관리비, 월세, 기타"

// 데이터베이스
CREATE TABLE revenue_sources (
  id UUID PRIMARY KEY,
  company_id UUID,
  source_type VARCHAR(20),  -- 'TOSS_POS', 'MANUAL'
  date DATE,
  amount DECIMAL(12,2),
  details JSONB
);

CREATE TABLE expense_transactions (
  id UUID PRIMARY KEY,
  company_id UUID,
  date DATE,
  merchant_name VARCHAR(255),
  amount DECIMAL(12,2),
  category VARCHAR(50),
  ai_category VARCHAR(50),
  confidence DECIMAL(3,2),
  user_confirmed BOOLEAN
);

CREATE TABLE profit_loss_statements (
  id UUID PRIMARY KEY,
  company_id UUID,
  period_start DATE,
  period_end DATE,
  total_revenue DECIMAL(12,2),
  total_expense DECIMAL(12,2),
  net_profit DECIMAL(12,2),
  details JSONB,
  generated_at TIMESTAMP
);
```

---

## 🚀 마케팅 메시지

### 기존 직원 관리 앱

```
"직원 관리, 이제 쉽게!"
```

### 우리 (PRO 플랜)

```
"토스 POS 쓰세요?
그럼 매출부터 급여까지 자동이에요!"

차별점:
✅ 급여 자동 계산
✅ 매출 자동 수집 (토스 POS)
✅ 비용 자동 분류 (AI)
✅ 손익계산서 자동 생성
✅ 개선 제안까지!

→ "세무사 없이도 경영 관리 가능!"
```

---

## 📝 다음 문서

이 요금제 정보는 다음 문서에 모두 반영되어야 합니다:

1. ✅ `PRICING.md` (이 문서)
2. 🔄 `staff_system_v2_final.md` (업데이트 필요)
3. 🔄 `CLAUDE_CODE_GUIDE.md` (개발 계획 추가 필요)
4. 🔄 `APP_STRUCTURE.md` (PRO 기능 추가 필요)

---

**문서 버전**: v2.0 (경영 관리 기능 추가)  
**작성일**: 2024-01-09  
**다음 업데이트**: Phase 2 개발 시작 시
