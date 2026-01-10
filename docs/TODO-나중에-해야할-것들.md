# ABC Staff System - 나중에 해야 할 것들

> 마지막 업데이트: 2026-01-10

---

## 🚨 필수 (실제 서비스 오픈 전 반드시!)

### 1. 사업자등록
- [ ] 사업자등록증 발급받기
- 업종 추천: "소프트웨어 개발 및 공급업" 또는 "응용소프트웨어 개발업"
- 홈택스에서 온라인 신청 가능: https://www.hometax.go.kr

### 2. 토스페이먼츠 가맹점 등록 (구독료 받기용)
- [ ] https://developers.tosspayments.com 에서 가맹점 신청
- [ ] 필요 서류:
  - 사업자등록증
  - 대표자 신분증
  - 정산받을 통장 사본
- [ ] 심사 승인 (1~3 영업일)
- [ ] **live 키 발급 후 .env 파일 업데이트:**
  ```
  NEXT_PUBLIC_TOSS_CLIENT_KEY=live_ck_xxxxx  (test → live로 변경)
  TOSS_SECRET_KEY=live_sk_xxxxx              (test → live로 변경)
  ```
- [ ] Vercel 환경변수도 live 키로 업데이트

---

## 📋 선택사항 (기능 확장 시)

### 3. Toss POS API 연동 (구독자 매출 연동 기능)
> 구독하는 사장님들이 자기 토스 POS를 연결해서 매출 데이터를 볼 수 있는 기능

- [ ] 토스 비즈니스 파트너 신청: https://business.tosspayments.com
- [ ] OAuth 앱 등록 → Client ID, Client Secret 발급
- [ ] .env 파일 업데이트:
  ```
  TOSS_CLIENT_ID=발급받은_클라이언트_ID
  TOSS_CLIENT_SECRET=발급받은_시크릿
  ```

### 4. 오픈뱅킹 API 연동 (구독자 계좌 연동 기능)
> 구독하는 사장님들이 자기 사업용 계좌를 연결해서 비용을 자동 관리하는 기능

- [ ] 금융결제원 오픈뱅킹 서비스 신청
- [ ] 사업자 심사 (1~2주 소요)
- [ ] 승인 후 Client ID, Client Secret 발급
- [ ] .env 파일 업데이트:
  ```
  OPEN_BANKING_CLIENT_ID=발급받은_클라이언트_ID
  OPEN_BANKING_CLIENT_SECRET=발급받은_시크릿
  ```

---

## 💰 비용 관련 참고

### 현재 사용 중인 서비스 비용:
| 서비스 | 무료 범위 | 초과 시 |
|--------|----------|--------|
| Supabase | 500MB DB, 1GB 스토리지 | $25/월~ |
| OpenAI (GPT-4o-mini) | - | ~$0.15/1M 토큰 (매우 저렴) |
| Resend | 월 3,000건 이메일 | $20/월~ |
| Firebase | 월 1,500건 푸시 | 거의 무료 |
| Vercel | 취미용 무료 | Pro $20/월 |
| 토스페이먼츠 | - | 결제당 3.3% 수수료 |

### 예상 월 비용 (소규모 운영 시):
- 초기: 거의 무료 (무료 티어 내)
- 성장 후: $50~100/월 예상

---

## 🚀 배포 관련

### Vercel 배포 시 환경변수 설정 필요:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_TOSS_CLIENT_KEY     ← 나중에 live 키로!
TOSS_SECRET_KEY                 ← 나중에 live 키로!
OPENAI_API_KEY
RESEND_API_KEY
FIREBASE_PROJECT_ID
FIREBASE_PRIVATE_KEY
FIREBASE_CLIENT_EMAIL
ENCRYPTION_KEY
CRON_SECRET
```

---

## ✅ 완료된 것들

- [x] Supabase 설정
- [x] 토스페이먼츠 테스트 키 설정
- [x] OpenAI API 설정
- [x] Resend API 설정
- [x] Firebase 설정
- [x] 보안 키 생성

---

## 📞 문의처

- 토스페이먼츠: https://developers.tosspayments.com/support
- 홈택스 (사업자등록): 126
- 금융결제원 오픈뱅킹: https://www.openbanking.or.kr

---

> 이 문서는 `/docs/TODO-나중에-해야할-것들.md` 에 저장되어 있습니다.
