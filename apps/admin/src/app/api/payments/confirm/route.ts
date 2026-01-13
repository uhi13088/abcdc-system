/**
 * 토스페이먼츠 결제 승인 API
 * 결제창에서 결제 완료 후 호출됨
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { tossPaymentsService } from '@/lib/services/toss-payments.service';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseClient();
  try {
    const { paymentKey, orderId, amount } = await request.json();

    if (!paymentKey || !orderId || !amount) {
      return NextResponse.json(
        { error: '필수 파라미터가 누락되었습니다.' },
        { status: 400 }
      );
    }

    // 토스페이먼츠 결제 승인
    const payment = await tossPaymentsService.confirmPayment({
      paymentKey,
      orderId,
      amount,
    });

    // 결제 정보 저장
    const { error: insertError } = await supabase.from('payment_history').insert({
      order_id: orderId,
      payment_key: paymentKey,
      amount: payment.totalAmount,
      status: payment.status,
      method: payment.method,
      provider: 'TOSS_PAYMENTS',
      card_company: payment.card?.company,
      card_number: payment.card?.number,
      receipt_url: payment.receipt?.url,
      approved_at: payment.approvedAt,
      raw_data: payment,
    });

    if (insertError) {
      console.error('Failed to save payment:', insertError);
    }

    // 구독 결제인 경우 구독 상태 업데이트
    if (orderId.startsWith('subscription_')) {
      const subscriptionId = orderId.replace('subscription_', '').split('_')[0];

      await supabase
        .from('company_subscriptions')
        .update({
          status: 'ACTIVE',
          last_payment_at: new Date().toISOString(),
        })
        .eq('id', subscriptionId);
    }

    return NextResponse.json({
      success: true,
      payment: {
        paymentKey: payment.paymentKey,
        orderId: payment.orderId,
        amount: payment.totalAmount,
        status: payment.status,
        method: payment.method,
        approvedAt: payment.approvedAt,
        receiptUrl: payment.receipt?.url,
      },
    });
  } catch (error) {
    console.error('Payment confirmation failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '결제 승인 실패' },
      { status: 500 }
    );
  }
}
