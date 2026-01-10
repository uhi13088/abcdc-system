/**
 * Stripe 결제 연동 서비스
 * 구독 관리 및 결제 처리
 */

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export interface SubscriptionPlan {
  id: string;
  name: string;
  displayName: string;
  priceMonthly: number;
  priceYearly: number;
  maxEmployees: number;
  maxStores: number;
  features: string[];
  stripePriceIdMonthly?: string;
  stripePriceIdYearly?: string;
}

export interface CompanySubscription {
  id: string;
  companyId: string;
  planId: string;
  planName: string;
  status: 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'TRIAL';
  billingCycle: 'MONTHLY' | 'YEARLY';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

export class StripeService {
  /**
   * Stripe 고객 생성
   */
  async createCustomer(
    email: string,
    name: string,
    companyId: string
  ): Promise<string> {
    const customer = await stripe.customers.create({
      email,
      name,
      metadata: {
        companyId,
      },
    });

    // company 테이블에 stripe_customer_id 저장
    await supabase
      .from('companies')
      .update({ stripe_customer_id: customer.id })
      .eq('id', companyId);

    return customer.id;
  }

  /**
   * 구독 생성
   */
  async createSubscription(
    customerId: string,
    priceId: string,
    companyId: string
  ): Promise<Stripe.Subscription> {
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        companyId,
      },
    });

    return subscription;
  }

  /**
   * 체크아웃 세션 생성
   */
  async createCheckoutSession(
    companyId: string,
    priceId: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<string> {
    // 회사 정보 조회
    const { data: company } = await supabase
      .from('companies')
      .select('name, stripe_customer_id')
      .eq('id', companyId)
      .single();

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        companyId,
      },
    };

    if (company?.stripe_customer_id) {
      sessionParams.customer = company.stripe_customer_id;
    } else {
      sessionParams.customer_creation = 'always';
      sessionParams.customer_email = undefined; // Will be collected
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return session.url!;
  }

  /**
   * 구독 취소
   */
  async cancelSubscription(
    subscriptionId: string,
    atPeriodEnd: boolean = true
  ): Promise<void> {
    if (atPeriodEnd) {
      await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
    } else {
      await stripe.subscriptions.cancel(subscriptionId);
    }
  }

  /**
   * 구독 재활성화
   */
  async reactivateSubscription(subscriptionId: string): Promise<void> {
    await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });
  }

  /**
   * 플랜 변경
   */
  async changePlan(
    subscriptionId: string,
    newPriceId: string
  ): Promise<Stripe.Subscription> {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
      items: [
        {
          id: subscription.items.data[0].id,
          price: newPriceId,
        },
      ],
      proration_behavior: 'create_prorations',
    });

    return updatedSubscription;
  }

  /**
   * 결제 수단 업데이트를 위한 포털 세션 생성
   */
  async createPortalSession(
    customerId: string,
    returnUrl: string
  ): Promise<string> {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return session.url;
  }

  /**
   * 결제 이력 조회
   */
  async getPaymentHistory(
    customerId: string,
    limit: number = 10
  ): Promise<Stripe.Invoice[]> {
    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit,
    });

    return invoices.data;
  }

  /**
   * 구독 상태 조회
   */
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return stripe.subscriptions.retrieve(subscriptionId);
  }

  /**
   * Webhook 이벤트 검증
   */
  constructWebhookEvent(
    body: string,
    signature: string
  ): Stripe.Event {
    return stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  }

  /**
   * 플랜 목록 조회
   */
  async getPlans(): Promise<SubscriptionPlan[]> {
    const { data: plans, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('active', true)
      .order('price_monthly');

    if (error) throw error;

    return (plans || []).map(plan => ({
      id: plan.id,
      name: plan.name,
      displayName: plan.display_name,
      priceMonthly: plan.price_monthly,
      priceYearly: plan.price_yearly,
      maxEmployees: plan.max_employees,
      maxStores: plan.max_stores,
      features: plan.features?.features || [],
      stripePriceIdMonthly: plan.stripe_price_id_monthly,
      stripePriceIdYearly: plan.stripe_price_id_yearly,
    }));
  }

  /**
   * 회사의 현재 구독 정보 조회
   */
  async getCompanySubscription(companyId: string): Promise<CompanySubscription | null> {
    const { data, error } = await supabase
      .from('company_subscriptions')
      .select('*, plan:subscription_plans(name, display_name)')
      .eq('company_id', companyId)
      .eq('status', 'ACTIVE')
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      companyId: data.company_id,
      planId: data.plan_id,
      planName: data.plan?.display_name || data.plan?.name || '',
      status: data.status,
      billingCycle: data.billing_cycle,
      currentPeriodStart: new Date(data.current_period_start),
      currentPeriodEnd: new Date(data.current_period_end),
      cancelAtPeriodEnd: data.cancel_at_period_end || false,
      stripeCustomerId: data.stripe_customer_id,
      stripeSubscriptionId: data.stripe_subscription_id,
    };
  }
}

export const stripeService = new StripeService();

export default StripeService;
