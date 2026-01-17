/**
 * 토스페이먼츠 결제 승인 API
 * 결제창에서 결제 완료 후 호출됨
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { tossPaymentsService } from '@/lib/services/toss-payments.service';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    // 인증 체크
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 요청자 정보 조회
    const { data: requester, error: requesterError } = await adminClient
      .from('users')
      .select('id, role, company_id')
      .eq('auth_id', user.id)
      .single();

    if (requesterError || !requester) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 권한 체크 - 결제 승인은 super_admin, company_admin만 가능
    if (!['super_admin', 'company_admin'].includes(requester.role)) {
      return NextResponse.json({ error: '결제 승인 권한이 없습니다.' }, { status: 403 });
    }

    const { paymentKey, orderId, amount } = await request.json();

    if (!paymentKey || !orderId || !amount) {
      return NextResponse.json(
        { error: '필수 파라미터가 누락되었습니다.' },
        { status: 400 }
      );
    }

    // 구독 결제인 경우 본인 회사 구독만 결제 가능
    if (orderId.startsWith('subscription_')) {
      const subscriptionId = orderId.replace('subscription_', '').split('_')[0];

      // 구독 정보 조회
      const { data: subscription } = await adminClient
        .from('company_subscriptions')
        .select('company_id')
        .eq('id', subscriptionId)
        .single();

      // super_admin이 아니면 본인 회사 구독만 결제 가능
      if (requester.role !== 'super_admin' && subscription?.company_id !== requester.company_id) {
        return NextResponse.json({ error: '자신의 회사 구독만 결제할 수 있습니다.' }, { status: 403 });
      }
    }

    // 토스페이먼츠 결제 승인
    const payment = await tossPaymentsService.confirmPayment({
      paymentKey,
      orderId,
      amount,
    });

    // 결제 정보 저장
    const { error: insertError } = await adminClient.from('payment_history').insert({
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
      company_id: requester.company_id, // 결제한 회사 기록
      created_by: requester.id, // 결제 승인자 기록
    });

    if (insertError) {
      console.error('Failed to save payment:', insertError);
    }

    // 구독 결제인 경우 구독 상태 업데이트
    if (orderId.startsWith('subscription_')) {
      const subscriptionId = orderId.replace('subscription_', '').split('_')[0];

      await adminClient
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
