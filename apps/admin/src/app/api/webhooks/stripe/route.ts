/**
 * Stripe Webhook 핸들러
 * 결제 이벤트 처리
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  console.log(`[Stripe Webhook] Event: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutComplete(event.data.object as Stripe.Checkout.Session);
        break;

      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionCancelled(event.data.object as Stripe.Subscription);
        break;

      case 'customer.created':
        await handleCustomerCreated(event.data.object as Stripe.Customer);
        break;

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Stripe Webhook] Error processing event:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  const companyId = session.metadata?.companyId;
  if (!companyId) {
    console.error('No companyId in checkout session metadata');
    return;
  }

  // Stripe 고객 ID 저장
  if (session.customer) {
    await supabase
      .from('companies')
      .update({ stripe_customer_id: session.customer as string })
      .eq('id', companyId);
  }

  // 구독 정보 가져오기
  if (session.subscription) {
    const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
    await saveSubscription(companyId, subscription);
  }

  console.log(`[Stripe Webhook] Checkout completed for company: ${companyId}`);
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const subscriptionId = invoice.subscription as string;
  if (!subscriptionId) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const companyId = subscription.metadata?.companyId;

  if (!companyId) return;

  // 결제 이력 저장
  await supabase.from('payment_history').insert({
    company_id: companyId,
    stripe_invoice_id: invoice.id,
    stripe_subscription_id: subscriptionId,
    amount: invoice.amount_paid,
    currency: invoice.currency,
    status: 'SUCCEEDED',
    paid_at: new Date(invoice.status_transitions?.paid_at! * 1000).toISOString(),
    invoice_pdf: invoice.invoice_pdf,
  });

  // 구독 상태 업데이트
  await supabase
    .from('company_subscriptions')
    .update({
      status: 'ACTIVE',
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString().split('T')[0],
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString().split('T')[0],
    })
    .eq('stripe_subscription_id', subscriptionId);

  console.log(`[Stripe Webhook] Invoice paid: ${invoice.id}`);
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = invoice.subscription as string;
  if (!subscriptionId) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const companyId = subscription.metadata?.companyId;

  if (!companyId) return;

  // 결제 실패 이력 저장
  await supabase.from('payment_history').insert({
    company_id: companyId,
    stripe_invoice_id: invoice.id,
    stripe_subscription_id: subscriptionId,
    amount: invoice.amount_due,
    currency: invoice.currency,
    status: 'FAILED',
    error_message: invoice.last_finalization_error?.message,
  });

  // 구독 상태 업데이트
  await supabase
    .from('company_subscriptions')
    .update({ status: 'PAST_DUE' })
    .eq('stripe_subscription_id', subscriptionId);

  // 관리자에게 알림
  const { data: admins } = await supabase
    .from('users')
    .select('id')
    .eq('company_id', companyId)
    .eq('role', 'COMPANY_ADMIN');

  for (const admin of admins || []) {
    await supabase.from('notifications').insert({
      user_id: admin.id,
      category: 'SYSTEM',
      priority: 'HIGH',
      title: '결제 실패',
      body: '구독 결제가 실패했습니다. 결제 수단을 확인해주세요.',
      deep_link: '/settings/subscription',
    });
  }

  console.log(`[Stripe Webhook] Payment failed: ${invoice.id}`);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const companyId = subscription.metadata?.companyId;
  if (!companyId) return;

  const priceId = subscription.items.data[0]?.price.id;

  // 플랜 ID 조회
  const { data: plan } = await supabase
    .from('subscription_plans')
    .select('id')
    .or(`stripe_price_id_monthly.eq.${priceId},stripe_price_id_yearly.eq.${priceId}`)
    .maybeSingle();

  await supabase
    .from('company_subscriptions')
    .update({
      plan_id: plan?.id,
      status: subscription.status === 'active' ? 'ACTIVE' : subscription.status.toUpperCase(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString().split('T')[0],
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString().split('T')[0],
    })
    .eq('stripe_subscription_id', subscription.id);

  console.log(`[Stripe Webhook] Subscription updated: ${subscription.id}`);
}

async function handleSubscriptionCancelled(subscription: Stripe.Subscription) {
  await supabase
    .from('company_subscriptions')
    .update({ status: 'CANCELED' })
    .eq('stripe_subscription_id', subscription.id);

  const companyId = subscription.metadata?.companyId;
  if (companyId) {
    // 무료 플랜으로 다운그레이드
    const { data: freePlan } = await supabase
      .from('subscription_plans')
      .select('id')
      .eq('name', 'FREE')
      .single();

    if (freePlan) {
      await supabase.from('company_subscriptions').insert({
        company_id: companyId,
        plan_id: freePlan.id,
        status: 'ACTIVE',
        billing_cycle: 'MONTHLY',
        current_period_start: new Date().toISOString().split('T')[0],
        current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      });
    }
  }

  console.log(`[Stripe Webhook] Subscription cancelled: ${subscription.id}`);
}

async function handleCustomerCreated(customer: Stripe.Customer) {
  const companyId = customer.metadata?.companyId;
  if (!companyId) return;

  await supabase
    .from('companies')
    .update({ stripe_customer_id: customer.id })
    .eq('id', companyId);

  console.log(`[Stripe Webhook] Customer created: ${customer.id}`);
}

async function saveSubscription(companyId: string, subscription: Stripe.Subscription) {
  const priceId = subscription.items.data[0]?.price.id;
  const interval = subscription.items.data[0]?.price.recurring?.interval;

  // 플랜 ID 조회
  const { data: plan } = await supabase
    .from('subscription_plans')
    .select('id')
    .or(`stripe_price_id_monthly.eq.${priceId},stripe_price_id_yearly.eq.${priceId}`)
    .maybeSingle();

  await supabase.from('company_subscriptions').upsert(
    {
      company_id: companyId,
      plan_id: plan?.id,
      status: subscription.status === 'active' ? 'ACTIVE' : subscription.status.toUpperCase(),
      billing_cycle: interval === 'year' ? 'YEARLY' : 'MONTHLY',
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString().split('T')[0],
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString().split('T')[0],
      stripe_subscription_id: subscription.id,
      cancel_at_period_end: subscription.cancel_at_period_end,
    },
    { onConflict: 'company_id' }
  );
}
