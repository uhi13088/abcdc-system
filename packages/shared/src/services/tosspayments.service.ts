/**
 * TossPayments 결제 서비스
 *
 * 정기결제(빌링) 연동을 위한 서비스
 * - 빌링키 발급 (결제창 방식)
 * - 정기결제 승인
 * - 결제 취소
 *
 * @see https://docs.tosspayments.com/guides/v2/billing
 */

const TOSS_API_URL = 'https://api.tosspayments.com/v1';

interface TossPaymentsConfig {
  secretKey: string;
  clientKey?: string;
}

interface BillingKeyResponse {
  mId: string;
  customerKey: string;
  authenticatedAt: string;
  method: string;
  billingKey: string;
  card: {
    issuerCode: string;
    acquirerCode: string;
    number: string;
    cardType: string;
    ownerType: string;
  };
}

interface PaymentResponse {
  mId: string;
  version: string;
  paymentKey: string;
  status: string;
  orderId: string;
  orderName: string;
  requestedAt: string;
  approvedAt: string;
  card: {
    amount: number;
    issuerCode: string;
    acquirerCode: string;
    number: string;
    cardType: string;
    ownerType: string;
  };
  totalAmount: number;
  balanceAmount: number;
  suppliedAmount: number;
  vat: number;
  method: string;
}

interface CancelResponse {
  paymentKey: string;
  orderId: string;
  status: string;
  cancels: Array<{
    cancelAmount: number;
    cancelReason: string;
    canceledAt: string;
    transactionKey: string;
  }>;
}

interface TossPaymentsError {
  code: string;
  message: string;
}

/**
 * Base64 인코딩된 인증 헤더 생성
 */
function createAuthHeader(secretKey: string): string {
  // 시크릿 키 뒤에 콜론(:)을 붙여서 Base64 인코딩
  const encoded = Buffer.from(`${secretKey}:`).toString('base64');
  return `Basic ${encoded}`;
}

/**
 * 토스페이먼츠 API 요청
 */
async function tossRequest<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'DELETE',
  secretKey: string,
  body?: Record<string, unknown>
): Promise<{ data?: T; error?: TossPaymentsError }> {
  try {
    const response = await fetch(`${TOSS_API_URL}${endpoint}`, {
      method,
      headers: {
        Authorization: createAuthHeader(secretKey),
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        error: {
          code: data.code || 'UNKNOWN_ERROR',
          message: data.message || '알 수 없는 오류가 발생했습니다.',
        },
      };
    }

    return { data: data as T };
  } catch (error) {
    console.error('TossPayments API error:', error);
    return {
      error: {
        code: 'NETWORK_ERROR',
        message: '네트워크 오류가 발생했습니다.',
      },
    };
  }
}

/**
 * 결제창에서 발급된 authKey로 빌링키 발급
 *
 * @param config - TossPayments 설정
 * @param authKey - 결제창에서 받은 인증키
 * @param customerKey - 고객 식별키
 */
export async function issueBillingKey(
  config: TossPaymentsConfig,
  authKey: string,
  customerKey: string
): Promise<{ data?: BillingKeyResponse; error?: TossPaymentsError }> {
  return tossRequest<BillingKeyResponse>(
    '/billing/authorizations/issue',
    'POST',
    config.secretKey,
    {
      authKey,
      customerKey,
    }
  );
}

/**
 * 빌링키로 자동결제 승인
 *
 * @param config - TossPayments 설정
 * @param billingKey - 빌링키
 * @param customerKey - 고객 식별키
 * @param amount - 결제 금액
 * @param orderId - 주문 ID (고유해야 함)
 * @param orderName - 주문명
 */
export async function approvePayment(
  config: TossPaymentsConfig,
  billingKey: string,
  customerKey: string,
  amount: number,
  orderId: string,
  orderName: string
): Promise<{ data?: PaymentResponse; error?: TossPaymentsError }> {
  return tossRequest<PaymentResponse>(
    `/billing/${billingKey}`,
    'POST',
    config.secretKey,
    {
      customerKey,
      amount,
      orderId,
      orderName,
    }
  );
}

/**
 * 결제 취소
 *
 * @param config - TossPayments 설정
 * @param paymentKey - 결제키
 * @param cancelReason - 취소 사유
 * @param cancelAmount - 취소 금액 (부분 취소 시)
 */
export async function cancelPayment(
  config: TossPaymentsConfig,
  paymentKey: string,
  cancelReason: string,
  cancelAmount?: number
): Promise<{ data?: CancelResponse; error?: TossPaymentsError }> {
  const body: Record<string, unknown> = { cancelReason };
  if (cancelAmount) {
    body.cancelAmount = cancelAmount;
  }

  return tossRequest<CancelResponse>(
    `/payments/${paymentKey}/cancel`,
    'POST',
    config.secretKey,
    body
  );
}

/**
 * 결제 조회
 *
 * @param config - TossPayments 설정
 * @param paymentKey - 결제키
 */
export async function getPayment(
  config: TossPaymentsConfig,
  paymentKey: string
): Promise<{ data?: PaymentResponse; error?: TossPaymentsError }> {
  return tossRequest<PaymentResponse>(
    `/payments/${paymentKey}`,
    'GET',
    config.secretKey
  );
}

/**
 * 주문 ID로 결제 조회
 *
 * @param config - TossPayments 설정
 * @param orderId - 주문 ID
 */
export async function getPaymentByOrderId(
  config: TossPaymentsConfig,
  orderId: string
): Promise<{ data?: PaymentResponse; error?: TossPaymentsError }> {
  return tossRequest<PaymentResponse>(
    `/payments/orders/${orderId}`,
    'GET',
    config.secretKey
  );
}

/**
 * 고객 키 생성 (UUID 기반)
 * 회사 ID를 기반으로 고유한 고객 키 생성
 */
export function generateCustomerKey(companyId: string): string {
  // companyId를 기반으로 고객키 생성 (UUID 형식 유지)
  return `cust_${companyId.replace(/-/g, '')}`;
}

/**
 * 주문 ID 생성
 * 구독 결제용 고유 주문 ID
 */
export function generateOrderId(companyId: string, type: 'subscription' | 'addon' = 'subscription'): string {
  const timestamp = Date.now();
  const shortCompanyId = companyId.substring(0, 8);
  return `${type}_${shortCompanyId}_${timestamp}`;
}

/**
 * 카드사 코드를 한글명으로 변환
 */
export function getCardIssuerName(issuerCode: string): string {
  const issuers: Record<string, string> = {
    '3K': '기업BC',
    '46': '광주',
    '71': '롯데',
    '30': 'KDB산업',
    '31': 'BC',
    '51': '삼성',
    '38': '새마을',
    '41': '신한',
    '62': '신협',
    '36': '씨티',
    '33': '우리BC',
    'W1': '우리',
    '37': '우체국',
    '39': '저축',
    '35': '전북',
    '42': '제주',
    '15': '카카오뱅크',
    '3A': '케이뱅크',
    '24': '토스뱅크',
    '21': '하나',
    '61': '현대',
    '11': 'KB국민',
    '91': 'NH농협',
    '34': 'Sh수협',
  };

  return issuers[issuerCode] || issuerCode;
}

/**
 * 결제 상태 한글 변환
 */
export function getPaymentStatusText(status: string): string {
  const statuses: Record<string, string> = {
    READY: '결제 대기',
    IN_PROGRESS: '결제 진행 중',
    WAITING_FOR_DEPOSIT: '입금 대기',
    DONE: '결제 완료',
    CANCELED: '결제 취소',
    PARTIAL_CANCELED: '부분 취소',
    ABORTED: '결제 중단',
    EXPIRED: '결제 만료',
  };

  return statuses[status] || status;
}

// Export types
export type {
  TossPaymentsConfig,
  BillingKeyResponse,
  PaymentResponse,
  CancelResponse,
  TossPaymentsError,
};
