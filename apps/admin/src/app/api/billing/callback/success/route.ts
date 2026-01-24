import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import {
  issueBillingKey,
  generateCustomerKey,
  getCardIssuerName,
} from '@abc/shared/server';

const TOSS_SECRET_KEY = process.env.TOSS_PAYMENTS_SECRET_KEY || '';

/**
 * GET /api/billing/callback/success
 * 토스페이먼츠 빌링키 발급 성공 콜백
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const authKey = searchParams.get('authKey');
  const customerKey = searchParams.get('customerKey');

  // Redirect with error if missing params
  if (!authKey || !customerKey) {
    return NextResponse.redirect(
      new URL('/settings?tab=subscription&billing=error&message=필수 파라미터가 누락되었습니다', request.url)
    );
  }

  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(
        new URL('/auth/login', request.url)
      );
    }

    // Get user's company
    const { data: userData } = await supabase
      .from('users')
      .select('company_id, role')
      .eq('auth_id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.redirect(
        new URL('/settings?tab=subscription&billing=error&message=회사 정보를 찾을 수 없습니다', request.url)
      );
    }

    // Generate proper customer key based on company ID
    const properCustomerKey = generateCustomerKey(userData.company_id);

    // Issue billing key from TossPayments
    const { data: billingData, error: billingError } = await issueBillingKey(
      { secretKey: TOSS_SECRET_KEY },
      authKey,
      properCustomerKey
    );

    if (billingError || !billingData) {
      console.error('TossPayments billing key error:', billingError);
      return NextResponse.redirect(
        new URL(`/settings?tab=subscription&billing=error&message=${encodeURIComponent(billingError?.message || '빌링키 발급에 실패했습니다')}`, request.url)
      );
    }

    // Deactivate existing payment methods
    await adminSupabase
      .from('payment_methods')
      .update({ is_active: false, is_default: false })
      .eq('company_id', userData.company_id);

    // Save new payment method
    await adminSupabase
      .from('payment_methods')
      .insert({
        company_id: userData.company_id,
        type: 'card',
        card_brand: getCardIssuerName(billingData.card.issuerCode),
        card_last4: billingData.card.number.slice(-4),
        toss_billing_key: billingData.billingKey,
        toss_customer_key: properCustomerKey,
        is_default: true,
        is_active: true,
      });

    // Update company_subscriptions with customer key
    await adminSupabase
      .from('company_subscriptions')
      .update({ toss_customer_key: properCustomerKey })
      .eq('company_id', userData.company_id);

    // Redirect to settings with success message
    return NextResponse.redirect(
      new URL('/settings?tab=subscription&billing=success', request.url)
    );
  } catch (error) {
    console.error('Billing callback error:', error);
    return NextResponse.redirect(
      new URL('/settings?tab=subscription&billing=error&message=결제 수단 등록에 실패했습니다', request.url)
    );
  }
}
