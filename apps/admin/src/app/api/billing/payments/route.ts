import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import {
  approvePayment,
  cancelPayment,
  generateOrderId,
  getPaymentStatusText,
} from '@abc/shared/server';

const TOSS_SECRET_KEY = process.env.TOSS_PAYMENTS_SECRET_KEY || '';

interface PaymentRecord {
  id: string;
  amount: number;
  currency: string;
  status: string;
  payment_type: string;
  paid_at: string | null;
  created_at: string;
  receipt_url: string | null;
  error_message: string | null;
}

/**
 * GET /api/billing/payments
 * 결제 내역 조회
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    // Get user's company
    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: '회사 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    // Get payment history
    const { data: payments, count } = await supabase
      .from('payment_history')
      .select('*', { count: 'exact' })
      .eq('company_id', userData.company_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    return NextResponse.json({
      payments: payments?.map((p: PaymentRecord) => ({
        id: p.id,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        statusText: getPaymentStatusText(p.status),
        paymentType: p.payment_type,
        paidAt: p.paid_at,
        createdAt: p.created_at,
        receiptUrl: p.receipt_url,
        errorMessage: p.error_message,
      })) || [],
      total: count || 0,
      page,
      limit,
    });
  } catch (error) {
    console.error('Failed to get payment history:', error);
    return NextResponse.json({ error: '결제 내역 조회에 실패했습니다.' }, { status: 500 });
  }
}

/**
 * POST /api/billing/payments
 * 구독 결제 실행
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    if (!TOSS_SECRET_KEY) {
      return NextResponse.json({ error: '결제 시스템이 설정되지 않았습니다.' }, { status: 500 });
    }

    const body = await request.json();
    const { planId, billingCycle } = body;

    // Get user's company
    const { data: userData } = await supabase
      .from('users')
      .select('company_id, role')
      .eq('auth_id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: '회사 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    // Only admin or owner can manage billing
    if (!['admin', 'owner'].includes(userData.role)) {
      return NextResponse.json({ error: '결제 권한이 없습니다.' }, { status: 403 });
    }

    // Get payment method
    const { data: paymentMethod } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('company_id', userData.company_id)
      .eq('is_active', true)
      .eq('is_default', true)
      .single();

    if (!paymentMethod?.toss_billing_key || !paymentMethod?.toss_customer_key) {
      return NextResponse.json({ error: '등록된 결제 수단이 없습니다.' }, { status: 400 });
    }

    // Get plan info
    const { data: plan } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (!plan) {
      return NextResponse.json({ error: '플랜 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const amount = billingCycle === 'YEARLY' ? plan.price_yearly : plan.price_monthly;
    const orderId = generateOrderId(userData.company_id, 'subscription');
    const orderName = `${plan.display_name} 구독 (${billingCycle === 'YEARLY' ? '연간' : '월간'})`;

    // Process payment
    const { data: paymentData, error: paymentError } = await approvePayment(
      { secretKey: TOSS_SECRET_KEY },
      paymentMethod.toss_billing_key,
      paymentMethod.toss_customer_key,
      amount,
      orderId,
      orderName
    );

    // Record payment history
    const paymentRecord = {
      company_id: userData.company_id,
      amount,
      currency: 'KRW',
      status: paymentError ? 'FAILED' : 'DONE',
      payment_type: 'SUBSCRIPTION',
      toss_payment_key: paymentData?.paymentKey,
      toss_order_id: orderId,
      receipt_url: paymentData?.receipt?.url,
      error_code: paymentError?.code,
      error_message: paymentError?.message,
      paid_at: paymentData ? new Date().toISOString() : null,
    };

    await adminSupabase.from('payment_history').insert(paymentRecord);

    if (paymentError || !paymentData) {
      console.error('Payment failed:', paymentError);
      return NextResponse.json(
        { error: paymentError?.message || '결제에 실패했습니다.' },
        { status: 400 }
      );
    }

    // Calculate subscription period
    const now = new Date();
    const periodEnd = new Date(now);
    if (billingCycle === 'YEARLY') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    // Update subscription
    const { error: updateError } = await adminSupabase
      .from('company_subscriptions')
      .update({
        plan_id: planId,
        billing_cycle: billingCycle,
        status: 'ACTIVE',
        current_period_start: now.toISOString().split('T')[0],
        current_period_end: periodEnd.toISOString().split('T')[0],
        cancel_at_period_end: false,
      })
      .eq('company_id', userData.company_id);

    if (updateError) {
      console.error('Failed to update subscription:', updateError);
      // Payment succeeded but subscription update failed - log for manual fix
    }

    return NextResponse.json({
      success: true,
      payment: {
        paymentKey: paymentData.paymentKey,
        orderId: paymentData.orderId,
        amount: paymentData.totalAmount,
        status: paymentData.status,
      },
    });
  } catch (error) {
    console.error('Failed to process payment:', error);
    return NextResponse.json({ error: '결제 처리에 실패했습니다.' }, { status: 500 });
  }
}

/**
 * DELETE /api/billing/payments
 * 결제 취소 (환불)
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    if (!TOSS_SECRET_KEY) {
      return NextResponse.json({ error: '결제 시스템이 설정되지 않았습니다.' }, { status: 500 });
    }

    const body = await request.json();
    const { paymentId, cancelReason } = body;

    if (!paymentId || !cancelReason) {
      return NextResponse.json({ error: '결제 ID와 취소 사유가 필요합니다.' }, { status: 400 });
    }

    // Get user's company
    const { data: userData } = await supabase
      .from('users')
      .select('company_id, role')
      .eq('auth_id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: '회사 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    // Only admin or owner can manage billing
    if (!['admin', 'owner'].includes(userData.role)) {
      return NextResponse.json({ error: '환불 권한이 없습니다.' }, { status: 403 });
    }

    // Get payment record
    const { data: payment } = await supabase
      .from('payment_history')
      .select('*')
      .eq('id', paymentId)
      .eq('company_id', userData.company_id)
      .single();

    if (!payment) {
      return NextResponse.json({ error: '결제 내역을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (!payment.toss_payment_key) {
      return NextResponse.json({ error: '취소할 수 없는 결제입니다.' }, { status: 400 });
    }

    if (payment.status !== 'DONE') {
      return NextResponse.json({ error: '완료된 결제만 취소할 수 있습니다.' }, { status: 400 });
    }

    // Cancel payment
    const { data: cancelData, error: cancelError } = await cancelPayment(
      { secretKey: TOSS_SECRET_KEY },
      payment.toss_payment_key,
      cancelReason
    );

    if (cancelError || !cancelData) {
      console.error('Cancel failed:', cancelError);
      return NextResponse.json(
        { error: cancelError?.message || '결제 취소에 실패했습니다.' },
        { status: 400 }
      );
    }

    // Update payment status
    await adminSupabase
      .from('payment_history')
      .update({ status: 'CANCELED' })
      .eq('id', paymentId);

    return NextResponse.json({
      success: true,
      cancel: {
        paymentKey: cancelData.paymentKey,
        status: cancelData.status,
      },
    });
  } catch (error) {
    console.error('Failed to cancel payment:', error);
    return NextResponse.json({ error: '결제 취소에 실패했습니다.' }, { status: 500 });
  }
}
