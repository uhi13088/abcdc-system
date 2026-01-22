/**
 * 토스페이먼츠 결제 서비스
 * 카드결제, 계좌이체, 토스페이, 네이버페이 등 지원
 */

const TOSS_PAYMENTS_API_URL = 'https://api.tosspayments.com/v1';

interface _PaymentRequest {
  orderId: string;
  amount: number;
  orderName: string;
  customerName?: string;
  customerEmail?: string;
  successUrl: string;
  failUrl: string;
}

interface PaymentConfirmRequest {
  paymentKey: string;
  orderId: string;
  amount: number;
}

interface BillingKeyRequest {
  customerKey: string;
  cardNumber: string;
  cardExpirationYear: string;
  cardExpirationMonth: string;
  customerIdentityNumber: string; // 생년월일 6자리 또는 사업자등록번호 10자리
}

interface SubscriptionPaymentRequest {
  billingKey: string;
  customerKey: string;
  amount: number;
  orderId: string;
  orderName: string;
}

export class TossPaymentsService {
  private secretKey: string;
  private clientKey: string;

  constructor() {
    this.secretKey = process.env.TOSS_SECRET_KEY || '';
    this.clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || '';
  }

  /**
   * 인증 헤더 생성
   */
  private getAuthHeader(): string {
    const encoded = Buffer.from(`${this.secretKey}:`).toString('base64');
    return `Basic ${encoded}`;
  }

  /**
   * 결제 승인 (일반결제)
   * 사용자가 결제 완료 후 successUrl로 리다이렉트되면 호출
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async confirmPayment(request: PaymentConfirmRequest): Promise<any> {
    const response = await fetch(`${TOSS_PAYMENTS_API_URL}/payments/confirm`, {
      method: 'POST',
      headers: {
        Authorization: this.getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        paymentKey: request.paymentKey,
        orderId: request.orderId,
        amount: request.amount,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || '결제 승인 실패');
    }

    return response.json();
  }

  /**
   * 결제 조회
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getPayment(paymentKey: string): Promise<any> {
    const response = await fetch(
      `${TOSS_PAYMENTS_API_URL}/payments/${paymentKey}`,
      {
        headers: {
          Authorization: this.getAuthHeader(),
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || '결제 조회 실패');
    }

    return response.json();
  }

  /**
   * 결제 취소
   */
  async cancelPayment(
    paymentKey: string,
    cancelReason: string,
    cancelAmount?: number
  ): Promise<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: any = { cancelReason };
    if (cancelAmount) {
      body.cancelAmount = cancelAmount;
    }

    const response = await fetch(
      `${TOSS_PAYMENTS_API_URL}/payments/${paymentKey}/cancel`,
      {
        method: 'POST',
        headers: {
          Authorization: this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || '결제 취소 실패');
    }

    return response.json();
  }

  /**
   * 빌링키 발급 (자동결제/정기결제용)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async issueBillingKey(request: BillingKeyRequest): Promise<any /* PaymentResponse */> {
    const response = await fetch(
      `${TOSS_PAYMENTS_API_URL}/billing/authorizations/card`,
      {
        method: 'POST',
        headers: {
          Authorization: this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerKey: request.customerKey,
          cardNumber: request.cardNumber,
          cardExpirationYear: request.cardExpirationYear,
          cardExpirationMonth: request.cardExpirationMonth,
          customerIdentityNumber: request.customerIdentityNumber,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || '빌링키 발급 실패');
    }

    return response.json();
  }

  /**
   * 빌링키로 자동결제 실행
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async payWithBillingKey(request: SubscriptionPaymentRequest): Promise<any /* PaymentResponse */> {
    const response = await fetch(
      `${TOSS_PAYMENTS_API_URL}/billing/${request.billingKey}`,
      {
        method: 'POST',
        headers: {
          Authorization: this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerKey: request.customerKey,
          amount: request.amount,
          orderId: request.orderId,
          orderName: request.orderName,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || '자동결제 실패');
    }

    return response.json();
  }

  /**
   * 현금영수증 발급
   */
  async issueCashReceipt(
    paymentKey: string,
    type: 'INCOME' | 'EXPENDITURE',
    registrationNumber: string
  ): Promise<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
    const response = await fetch(
      `${TOSS_PAYMENTS_API_URL}/payments/${paymentKey}/cash-receipt`,
      {
        method: 'POST',
        headers: {
          Authorization: this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type,
          registrationNumber,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || '현금영수증 발급 실패');
    }

    return response.json();
  }

  /**
   * 가상계좌 환불
   */
  async refundVirtualAccount(
    paymentKey: string,
    cancelReason: string,
    refundReceiveAccount: {
      bank: string;
      accountNumber: string;
      holderName: string;
    }
  ): Promise<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
    const response = await fetch(
      `${TOSS_PAYMENTS_API_URL}/payments/${paymentKey}/cancel`,
      {
        method: 'POST',
        headers: {
          Authorization: this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cancelReason,
          refundReceiveAccount,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || '가상계좌 환불 실패');
    }

    return response.json();
  }

  /**
   * 클라이언트 키 반환 (프론트엔드용)
   */
  getClientKey(): string {
    return this.clientKey;
  }
}

export const tossPaymentsService = new TossPaymentsService();
