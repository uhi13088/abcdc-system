import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import {
  issueBillingKey,
  generateCustomerKey,
  getCardIssuerName,
} from '@abc/shared/server';

const TOSS_SECRET_KEY = process.env.TOSS_PAYMENTS_SECRET_KEY || '';

/**
 * GET /api/billing
 * 현재 등록된 결제 수단 조회
 */
export async function GET() {
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

    // Get payment method
    const { data: paymentMethod } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('company_id', userData.company_id)
      .eq('is_active', true)
      .eq('is_default', true)
      .single();

    if (!paymentMethod) {
      return NextResponse.json({ paymentMethod: null });
    }

    return NextResponse.json({
      paymentMethod: {
        id: paymentMethod.id,
        cardBrand: paymentMethod.card_brand,
        cardLast4: paymentMethod.card_last4,
        cardExpMonth: paymentMethod.card_exp_month,
        cardExpYear: paymentMethod.card_exp_year,
        isDefault: paymentMethod.is_default,
      },
    });
  } catch (error) {
    console.error('Failed to get payment method:', error);
    return NextResponse.json({ error: '결제 수단 조회에 실패했습니다.' }, { status: 500 });
  }
}

/**
 * POST /api/billing
 * 결제창 인증 후 빌링키 발급
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const { authKey } = body;

    if (!authKey) {
      return NextResponse.json({ error: 'authKey가 필요합니다.' }, { status: 400 });
    }

    if (!TOSS_SECRET_KEY) {
      return NextResponse.json({ error: '결제 시스템이 설정되지 않았습니다.' }, { status: 500 });
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
      return NextResponse.json({ error: '결제 수단 관리 권한이 없습니다.' }, { status: 403 });
    }

    const customerKey = generateCustomerKey(userData.company_id);

    // Issue billing key from TossPayments
    const { data: billingData, error: billingError } = await issueBillingKey(
      { secretKey: TOSS_SECRET_KEY },
      authKey,
      customerKey
    );

    if (billingError || !billingData) {
      console.error('TossPayments billing key error:', billingError);
      return NextResponse.json(
        { error: billingError?.message || '빌링키 발급에 실패했습니다.' },
        { status: 400 }
      );
    }

    // Deactivate existing payment methods
    await adminSupabase
      .from('payment_methods')
      .update({ is_active: false, is_default: false })
      .eq('company_id', userData.company_id);

    // Save new payment method
    const { data: newPaymentMethod, error: saveError } = await adminSupabase
      .from('payment_methods')
      .insert({
        company_id: userData.company_id,
        type: 'card',
        card_brand: getCardIssuerName(billingData.card.issuerCode),
        card_last4: billingData.card.number.slice(-4),
        toss_billing_key: billingData.billingKey,
        toss_customer_key: customerKey,
        is_default: true,
        is_active: true,
      })
      .select()
      .single();

    if (saveError) {
      console.error('Failed to save payment method:', saveError);
      return NextResponse.json({ error: '결제 수단 저장에 실패했습니다.' }, { status: 500 });
    }

    // Update company_subscriptions with customer key
    await adminSupabase
      .from('company_subscriptions')
      .update({ toss_customer_key: customerKey })
      .eq('company_id', userData.company_id);

    return NextResponse.json({
      success: true,
      paymentMethod: {
        id: newPaymentMethod.id,
        cardBrand: newPaymentMethod.card_brand,
        cardLast4: newPaymentMethod.card_last4,
      },
    });
  } catch (error) {
    console.error('Failed to issue billing key:', error);
    return NextResponse.json({ error: '빌링키 발급에 실패했습니다.' }, { status: 500 });
  }
}

/**
 * DELETE /api/billing
 * 결제 수단 삭제
 */
export async function DELETE() {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
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
      return NextResponse.json({ error: '결제 수단 관리 권한이 없습니다.' }, { status: 403 });
    }

    // Check if there's an active paid subscription
    const { data: subscription } = await supabase
      .from('company_subscriptions')
      .select(`
        *,
        plan:subscription_plans(price_monthly)
      `)
      .eq('company_id', userData.company_id)
      .single();

    if (subscription?.plan?.price_monthly > 0 && subscription.status === 'ACTIVE') {
      return NextResponse.json(
        { error: '유료 구독 중에는 결제 수단을 삭제할 수 없습니다. 먼저 구독을 취소해주세요.' },
        { status: 400 }
      );
    }

    // Deactivate all payment methods for this company
    const { error: deleteError } = await adminSupabase
      .from('payment_methods')
      .update({ is_active: false, is_default: false })
      .eq('company_id', userData.company_id);

    if (deleteError) {
      console.error('Failed to delete payment method:', deleteError);
      return NextResponse.json({ error: '결제 수단 삭제에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete payment method:', error);
    return NextResponse.json({ error: '결제 수단 삭제에 실패했습니다.' }, { status: 500 });
  }
}
