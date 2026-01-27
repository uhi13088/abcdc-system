/**
 * 토스페이먼츠 웹훅 핸들러
 * 결제 상태 변경, 가상계좌 입금 등의 이벤트 처리
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@abc/shared';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
}

interface TossWebhookPayload {
  eventType: string;
  createdAt: string;
  data: {
    paymentKey: string;
    orderId: string;
    status: string;
    totalAmount: number;
    method: string;
    secret?: string;
    virtualAccount?: {
      accountNumber: string;
      bank: string;
      customerName: string;
      dueDate: string;
    };
  };
}

export async function POST(request: NextRequest) {
  const _supabase = getSupabaseClient();
  try {
    const payload: TossWebhookPayload = await request.json();

    logger.log('[Toss Webhook] Received:', payload.eventType);

    switch (payload.eventType) {
      case 'PAYMENT_STATUS_CHANGED':
        await handlePaymentStatusChanged(payload.data);
        break;

      case 'VIRTUAL_ACCOUNT_DEPOSIT':
        await handleVirtualAccountDeposit(payload.data);
        break;

      case 'PAYMENT_CANCELED':
        await handlePaymentCanceled(payload.data);
        break;

      default:
        logger.log('[Toss Webhook] Unhandled event:', payload.eventType);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Toss Webhook] Error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

/**
 * 결제 상태 변경 처리
 */
async function handlePaymentStatusChanged(data: TossWebhookPayload['data']) {
  const supabase = getSupabaseClient();
  const { paymentKey, status } = data;

  await supabase
    .from('payment_history')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('payment_key', paymentKey);

  logger.log(`[Toss Webhook] Payment ${paymentKey} status changed to ${status}`);
}

/**
 * 가상계좌 입금 처리
 */
async function handleVirtualAccountDeposit(data: TossWebhookPayload['data']) {
  const supabase = getSupabaseClient();
  const { paymentKey, orderId, totalAmount, secret: _secret } = data;

  // 결제 상태 업데이트
  await supabase
    .from('payment_history')
    .update({
      status: 'DONE',
      deposited_at: new Date().toISOString(),
    })
    .eq('payment_key', paymentKey);

  // 구독 결제인 경우
  if (orderId.startsWith('subscription_')) {
    const subscriptionId = orderId.replace('subscription_', '').split('_')[0];

    await supabase
      .from('company_subscriptions')
      .update({
        status: 'ACTIVE',
        last_payment_at: new Date().toISOString(),
      })
      .eq('id', subscriptionId);

    // 회사 관리자에게 알림
    const { data: subscription } = await supabase
      .from('company_subscriptions')
      .select('company_id')
      .eq('id', subscriptionId)
      .single();

    if (subscription) {
      const { data: admins } = await supabase
        .from('users')
        .select('id')
        .eq('company_id', subscription.company_id)
        .eq('role', 'COMPANY_ADMIN');

      for (const admin of admins || []) {
        await supabase.from('notifications').insert({
          user_id: admin.id,
          category: 'BILLING',
          priority: 'NORMAL',
          title: '결제 완료',
          body: `${totalAmount.toLocaleString()}원 결제가 완료되었습니다.`,
          deep_link: '/settings/subscription',
        });
      }
    }
  }

  logger.log(`[Toss Webhook] Virtual account deposit received for ${paymentKey}`);
}

/**
 * 결제 취소 처리
 */
async function handlePaymentCanceled(data: TossWebhookPayload['data']) {
  const supabase = getSupabaseClient();
  const { paymentKey, orderId } = data;

  await supabase
    .from('payment_history')
    .update({
      status: 'CANCELED',
      canceled_at: new Date().toISOString(),
    })
    .eq('payment_key', paymentKey);

  // 구독 결제 취소인 경우
  if (orderId.startsWith('subscription_')) {
    const subscriptionId = orderId.replace('subscription_', '').split('_')[0];

    await supabase
      .from('company_subscriptions')
      .update({ status: 'CANCELED' })
      .eq('id', subscriptionId);
  }

  logger.log(`[Toss Webhook] Payment ${paymentKey} canceled`);
}
