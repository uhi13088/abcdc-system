# ABC Staff System - 기능 구현 현황 보고서

> **최초 작성일**: 2026-01-10
> **최종 업데이트**: 2026-01-16
> **분석 기준**: staff_system_v2_final.md, PRICING_AND_BUSINESS_FEATURES.md, HACCP_DEV_GUIDE.md

---

## 요약

문서에 명시된 기능 중 대부분의 핵심 기능이 구현 완료되었습니다. 아래는 기능별 구현 현황입니다.

**구현 완료율**: ~75%

---

## 1. PRO 플랜 "킬러 기능들" (경영 관리)

### 1.1 토스 POS 연동
| 기능 | 상태 | 파일 위치 |
|-----|------|---------|
| 토스 POS OAuth 연결 | ✅ 구현됨 | `apps/admin/src/lib/services/toss-pos.service.ts` |
| 매출 자동 수집 (실시간) | ✅ 구현됨 | 위 파일 + cron |
| 카드/현금 구분 수집 | ✅ 구현됨 | |
| 시간대별 매출 분석 | ✅ 구현됨 | |
| 매시간 자동 동기화 (Cron) | ✅ 구현됨 | `apps/admin/src/app/api/cron/sync-toss-pos/route.ts` |

### 1.2 오픈뱅킹 연동
| 기능 | 상태 | 설명 |
|-----|------|-----|
| 오픈뱅킹 OAuth 연결 | ❌ 미구현 | 실제 오픈뱅킹 API 연동 필요 |
| 거래 내역 자동 수집 | ❌ 미구현 | |
| 비용 자동 수집 | ❌ 미구현 | |

### 1.3 AI 비용 자동 분류 (GPT-4)
| 기능 | 상태 | 파일 위치 |
|-----|------|---------|
| GPT-4 연동 | ✅ 구현됨 | `apps/admin/src/lib/services/expense-classifier.service.ts` |
| 비용 자동 분류 | ✅ 구현됨 | |
| 분류 확신도 표시 | ✅ 구현됨 | confidence 필드 |
| 수동 분류 수정 | ✅ 구현됨 | |

### 1.4 손익계산서
| 기능 | 상태 | 파일 위치 |
|-----|------|---------|
| 손익계산서 자동 생성 | ✅ 구현됨 | `apps/admin/src/lib/services/profit-loss.service.ts` |
| 매출/비용 자동 집계 | ✅ 구현됨 | |
| 인건비 자동 연동 (급여에서) | ✅ 구현됨 | |
| 전월 대비 분석 | ✅ 구현됨 | compareMonths() |
| 영업이익률 추이 | ✅ 구현됨 | |
| PDF 다운로드 | ✅ 구현됨 | `packages/shared/src/utils/pdf-generator.ts` |

### 1.5 AI 비용 분석 & 개선 제안
| 기능 | 상태 | 파일 위치 |
|-----|------|---------|
| 인건비 최적화 제안 | ✅ 구현됨 | `profit-loss.service.ts` generateRecommendations() |
| 비용 구조 분석 | ✅ 구현됨 | |
| 재료비 절감 제안 | ⚠️ 부분 구현 | 기본 분석만 |

---

## 2. 계약서 시스템

### 2.1 계약서 작성
| 기능 | 상태 | 파일 위치 |
|-----|------|---------|
| 계약서 폼 | ✅ 구현됨 | `apps/admin/src/app/contracts` |
| 상세 급여/공제 항목 | ✅ 구현됨 | |
| 복수 근무 패턴 | ✅ 구현됨 | work_schedules 배열 지원 |
| 첨부 서류 관리 | ✅ 구현됨 | attachments JSONB |

### 2.2 계약서 PDF
| 기능 | 상태 | 파일 위치 |
|-----|------|---------|
| PDF 생성 | ✅ 구현됨 | `packages/shared/src/utils/pdf-generator.ts` |
| 주민번호 마스킹 | ✅ 구현됨 | formatSSN() |
| 모든 항목 포함 | ✅ 구현됨 | |

### 2.3 전자서명
| 기능 | 상태 | 파일 위치 |
|-----|------|---------|
| 서명 캡처 UI | ✅ 구현됨 | Mobile app |
| 서명 저장 (Base64) | ✅ 구현됨 | contracts.employee_signature |
| 직원 서명 요청 발송 | ✅ 구현됨 | `apps/admin/src/app/api/contracts/[id]/request-signature/route.ts` |
| 서명 완료 알림 | ✅ 구현됨 | |

### 2.4 계약서 발송
| 기능 | 상태 | 파일 위치 |
|-----|------|---------|
| 이메일 발송 | ✅ 구현됨 | `packages/shared/src/services/email.service.ts` |
| 푸시 알림 | ✅ 구현됨 | `packages/shared/src/services/push-notification.service.ts` |

---

## 3. 세무대리인 연동 시스템

| 기능 | 상태 | 파일 위치 |
|-----|------|---------|
| 세무대리인 정보 관리 | ✅ 구현됨 | companies.tax_accountant |
| 급여대장 엑셀 자동 생성 | ✅ 구현됨 | `apps/admin/src/lib/services/payroll-export.service.ts` |
| 자동 이메일 전송 | ✅ 구현됨 | cron + email.service |
| 전송 이력 관리 | ✅ 구현됨 | |
| 홈택스 양식 지원 | ✅ 구현됨 | |
| 자동 FAX 전송 | ❌ 미구현 | FAX API 연동 필요 |

---

## 4. 승인 시스템

### 4.1 기본 승인
| 기능 | 상태 | 파일 위치 |
|-----|------|---------|
| 승인 목록 페이지 | ✅ 구현됨 | `apps/admin/src/app/approvals` |
| 휴가 승인 | ✅ 구현됨 | |
| 초과근무 승인 | ✅ 구현됨 | |

### 4.2 확장 승인 유형
| 기능 | 상태 | 설명 |
|-----|------|-----|
| 구매 승인 | ⚠️ 부분 구현 | DB 스키마만 존재 |
| 폐기 승인 | ⚠️ 부분 구현 | DB 스키마만 존재 |
| 사직서 승인 | ❌ 미구현 | |
| 결근 사유서 | ❌ 미구현 | |

### 4.3 승인 라인
| 기능 | 상태 | 파일 위치 |
|-----|------|---------|
| 금액별 자동 승인 라인 | ✅ 구현됨 | approval_policies 테이블 |
| 다단계 순차 승인 | ✅ 구현됨 | approval_line JSONB |
| 에스컬레이션 | ⚠️ 부분 구현 | |

---

## 5. 긴급 근무 모집

| 기능 | 상태 | 파일 위치 |
|-----|------|---------|
| 긴급 근무 페이지 | ✅ 구현됨 | `apps/admin/src/app/emergency` |
| 가능 인원 자동 추천 | ✅ 구현됨 | `apps/admin/src/app/api/emergency-shifts/[id]/invite/route.ts` |
| 경험치 표시 | ✅ 구현됨 | experience_score 계산 |
| 경험자 우선 정렬 | ✅ 구현됨 | 동일 파일 getStaffCandidates() |
| 선택 직원에게 푸시 초대 | ✅ 구현됨 | |
| 지원/거절 액션 버튼 | ✅ 구현됨 | |
| 선발 후 스케줄 자동 생성 | ⚠️ 부분 구현 | |

---

## 6. 푸시 알림 시스템 (FCM)

| 기능 | 상태 | 파일 위치 |
|-----|------|---------|
| FCM 연동 | ✅ 구현됨 | `packages/shared/src/services/push-notification.service.ts` |
| 알림 카테고리 | ✅ 구현됨 | ATTENDANCE, SCHEDULE, SALARY 등 |
| 우선순위 | ✅ 구현됨 | CRITICAL, HIGH, NORMAL, LOW |
| 딥링크 | ✅ 구현됨 | |
| 액션 버튼 | ✅ 구현됨 | |
| 방해 금지 시간 | ✅ 구현됨 | doNotDisturb 설정 |
| 인앱 알림 목록 | ✅ 구현됨 | notifications 테이블 |
| 읽음 처리 | ✅ 구현됨 | |

---

## 7. 급여 시스템

| 기능 | 상태 | 파일 위치 |
|-----|------|---------|
| 급여 목록 페이지 | ✅ 구현됨 | `apps/admin/src/app/salaries` |
| 급여 자동 계산 | ✅ 구현됨 | `apps/admin/src/lib/services/salary-calculator.service.ts` |
| 연장/야간/휴일 수당 계산 | ✅ 구현됨 | |
| 주휴수당 계산 | ✅ 구현됨 | |
| 4대보험 자동 계산 | ✅ 구현됨 | |
| 소득세 자동 계산 | ✅ 구현됨 | |
| 급여 명세서 PDF | ✅ 구현됨 | `packages/shared/src/utils/pdf-generator.ts` |
| 급여 명세서 이메일 발송 | ✅ 구현됨 | `apps/admin/src/app/api/salaries/[id]/send-email/route.ts` |
| 급여 확정 시 직원 알림 | ✅ 구현됨 | 푸시 알림 발송 |

---

## 8. 스케줄 시스템

| 기능 | 상태 | 파일 위치 |
|-----|------|---------|
| 스케줄 목록 페이지 | ✅ 구현됨 | `apps/admin/src/app/schedules` |
| 계약서 기반 자동 생성 | ✅ 구현됨 | `apps/admin/src/lib/services/schedule-generator.service.ts` |
| 스케줄 교환 요청 | ✅ 구현됨 | `apps/admin/src/app/api/schedules/trade/route.ts` |
| 스케줄 교환 승인 | ✅ 구현됨 | PUT/PATCH 메서드 |
| 출근 30분 전 알림 | ✅ 구현됨 | `apps/admin/src/app/api/cron/work-reminder/route.ts` |

---

## 9. 출퇴근 시스템

| 기능 | 상태 | 파일 위치 |
|-----|------|---------|
| 출퇴근 목록 페이지 | ✅ 구현됨 | `apps/admin/src/app/attendance` |
| QR 코드 생성 (매장별) | ✅ 구현됨 | `apps/admin/src/lib/services/qr-code.service.ts` |
| QR 스캔 출퇴근 | ✅ 구현됨 | `apps/mobile/src/app/qr-scan/page.tsx` |
| 지오펜스 확인 | ✅ 구현됨 | `apps/admin/src/app/api/attendance/checkin/route.ts` |
| 비콘 체크인 | ✅ 구현됨 | 동일 파일 beaconId 지원 |
| 이상 감지 알림 | ✅ 구현됨 | `apps/admin/src/app/api/cron/attendance-anomaly-check/route.ts` |
| 지각/조퇴 자동 판정 | ✅ 구현됨 | |

---

## 10. 근로기준법 자동 업데이트

| 기능 | 상태 | 파일 위치 |
|-----|------|---------|
| 법령 버전 관리 | ✅ 구현됨 | labor_law_versions 테이블 |
| 최저임금 관리 | ✅ 구현됨 | |
| 4대보험 요율 관리 | ✅ 구현됨 | |
| 수당 비율 관리 | ✅ 구현됨 | |
| 시행일 자동 적용 (Cron) | ✅ 구현됨 | `apps/admin/src/app/api/cron/apply-law-updates/route.ts` |
| 플랫폼 관리자 UI | ⚠️ 부분 구현 | |
| 영향도 분석 | ⚠️ 부분 구현 | |
| 모든 회사에 알림 | ✅ 구현됨 | |

---

## 11. HACCP 모듈

### 11.1 기본 기능
| 기능 | 상태 | 파일 위치 |
|-----|------|---------|
| 9개 모듈 페이지 | ✅ 구현됨 | `apps/haccp/src/app` |
| Master DB 관리 | ✅ 구현됨 | |
| CCP 모니터링 | ✅ 구현됨 | |

### 11.2 자동화 기능
| 기능 | 상태 | 파일 위치 |
|-----|------|---------|
| IoT 센서 자동 연동 | ✅ 구현됨 | `apps/haccp/src/lib/services/iot-sensor.service.ts` |
| 자동 점검 리마인더 | ✅ 구현됨 | `apps/haccp/src/app/api/cron/haccp-reminder/route.ts` |
| 바코드/QR 자동 입력 | ⚠️ 부분 구현 | |
| AI 이상 감지 | ✅ 구현됨 | `apps/haccp/src/lib/services/haccp-anomaly-detection.service.ts` |
| 불량률 예측 | ⚠️ 부분 구현 | |
| 재고 소진 예측 | ⚠️ 부분 구현 | |

### 11.3 심사 대비
| 기능 | 상태 | 설명 |
|-----|------|-----|
| HACCP 심사 준비 리포트 | ⚠️ 부분 구현 | 기본 리포트만 |
| 개선조치 워크플로우 | ✅ 구현됨 | |
| 내부 심사 모듈 | ⚠️ 부분 구현 | |

---

## 12. 플랫폼 관리 (super_admin)

| 기능 | 상태 | 설명 |
|-----|------|-----|
| 전체 회사 목록 | ✅ 구현됨 | |
| 회사별 사용량 모니터링 | ⚠️ 부분 구현 | |
| 구독 관리 | ✅ 구현됨 | subscriptions 테이블 |
| 결제 관리 | ⚠️ 부분 구현 | |
| 근로기준법 관리 | ✅ 구현됨 | |
| 시스템 설정 | ⚠️ 부분 구현 | |
| 통계 대시보드 | ⚠️ 부분 구현 | |

---

## 13. 결제 시스템

| 기능 | 상태 | 설명 |
|-----|------|-----|
| Stripe/Tosspayments 연동 | ❌ 미구현 | 실제 결제 API 연동 필요 |
| 구독 플랜 선택 | ✅ 구현됨 | UI 존재 |
| 카드 등록 | ❌ 미구현 | |
| 자동 결제 | ❌ 미구현 | |
| 결제 이력 | ⚠️ 부분 구현 | DB 스키마 존재 |
| 플랜 변경 | ⚠️ 부분 구현 | |
| 취소/환불 | ❌ 미구현 | |

---

## 14. 모바일 앱

| 기능 | 상태 | 파일 위치 |
|-----|------|---------|
| Next.js PWA 앱 | ✅ 구현됨 | `apps/mobile` |
| 직원 앱 (5탭) | ✅ 구현됨 | 홈, 출퇴근, 급여, 스케줄, 더보기 |
| QR 스캔 화면 | ✅ 구현됨 | `apps/mobile/src/app/qr-scan/page.tsx` |
| 오프라인 모드 | ⚠️ 부분 구현 | PWA 캐싱 |
| 관리자 앱 (드로어) | ✅ 구현됨 | 별도 admin 앱 |

---

## 15. 랜딩 페이지

| 기능 | 상태 | 파일 위치 |
|-----|------|---------|
| 서비스 소개 | ✅ 구현됨 | `apps/web` |
| 요금제 안내 상세 | ✅ 구현됨 | |
| 무료 체험 신청 | ✅ 구현됨 | |
| 고객 후기 | ⚠️ 부분 구현 | |
| 데모 요청 | ⚠️ 부분 구현 | |

---

## 미구현 기능 요약

### 우선순위 HIGH
| 기능 | 설명 |
|-----|-----|
| 오픈뱅킹 연동 | 실제 오픈뱅킹 API 연동 필요 |
| 실제 결제 시스템 | Stripe/토스페이먼츠 연동 필요 |

### 우선순위 MEDIUM
| 기능 | 설명 |
|-----|-----|
| FAX 자동 전송 | FAX API 연동 필요 |
| 사직서 승인 | 승인 유형 확장 |
| 결근 사유서 | 승인 유형 확장 |

### 우선순위 LOW
| 기능 | 설명 |
|-----|-----|
| 고객 후기 섹션 | 랜딩 페이지 보완 |
| 데모 요청 기능 | 랜딩 페이지 보완 |

---

## 최근 구현 완료 기능 (2026-01-16)

1. **출근 30분 전 알림 Cron** - `apps/admin/src/app/api/cron/work-reminder/route.ts`
2. **긴급 근무 푸시 초대 + 경험자 우선 정렬** - `apps/admin/src/app/api/emergency-shifts/[id]/invite/route.ts`
3. **비콘 체크인 로직** - `apps/admin/src/app/api/attendance/checkin/route.ts`
4. **출퇴근 이상 감지 알림 Cron** - `apps/admin/src/app/api/cron/attendance-anomaly-check/route.ts`

---

## 결론

2026-01-10 분석 대비 대부분의 핵심 기능이 구현 완료되었습니다.

**구현 완료된 주요 기능:**
- 급여 자동 계산 + 명세서 PDF + 이메일 발송
- 계약서 PDF 생성 + 전자서명 + 발송
- 스케줄 자동 생성 + 교환 기능
- 출퇴근 QR/지오펜스/비콘 지원
- FCM 푸시 알림 시스템
- 손익계산서 자동 생성 + AI 분석
- 토스 POS 연동
- HACCP 모듈 기본 기능
- 모바일 PWA 앱

**주요 미구현 기능:**
- 오픈뱅킹 실제 API 연동
- Stripe/토스페이먼츠 결제 연동
- FAX 자동 전송

---

**문서 끝**
