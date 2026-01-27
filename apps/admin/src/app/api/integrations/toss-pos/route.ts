import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@abc/shared';

/**
 * Toss POS Integration API
 * PRO Feature: Real-time POS data synchronization
 *
 * Endpoints:
 * - GET: Fetch POS sales data
 * - POST: Register/Update POS connection
 */

interface TossPOSConfig {
  store_id: string;
  api_key: string;
  secret_key: string;
  webhook_url?: string;
}

interface TossSalesData {
  date: string;
  total_sales: number;
  transaction_count: number;
  payment_methods: {
    cash: number;
    card: number;
    mobile: number;
  };
  hourly_sales: Record<string, number>;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const { searchParams } = new URL(request.url);
  const _storeId = searchParams.get('store_id');
  const startDate = searchParams.get('start_date');
  const _endDate = searchParams.get('end_date');

  try {
    // Verify user has PRO subscription
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check subscription tier
    const { data: subscription } = await supabase
      .from('company_subscriptions')
      .select('subscription_plans(tier)')
      .eq('status', 'ACTIVE')
      .single();

    const subscriptionData = subscription as { subscription_plans: { tier: string } | null } | null;
    const tier = subscriptionData?.subscription_plans?.tier;
    if (tier !== 'PRO' && tier !== 'ENTERPRISE') {
      return NextResponse.json(
        { error: 'Toss POS integration requires PRO or ENTERPRISE subscription' },
        { status: 403 }
      );
    }

    // TODO: Implement actual Toss POS API integration
    // This is a stub that returns mock data
    const mockData: TossSalesData = {
      date: startDate || new Date().toISOString().split('T')[0],
      total_sales: 2450000,
      transaction_count: 156,
      payment_methods: {
        cash: 450000,
        card: 1850000,
        mobile: 150000,
      },
      hourly_sales: {
        '09': 120000,
        '10': 180000,
        '11': 320000,
        '12': 580000,
        '13': 420000,
        '14': 280000,
        '15': 150000,
        '16': 120000,
        '17': 180000,
        '18': 100000,
      },
    };

    return NextResponse.json({
      success: true,
      data: mockData,
      message: 'Toss POS data retrieved successfully (mock)',
    });
  } catch (error) {
    console.error('Error fetching Toss POS data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check subscription tier
    const { data: subscription } = await supabase
      .from('company_subscriptions')
      .select('subscription_plans(tier)')
      .eq('status', 'ACTIVE')
      .single();

    const subscriptionData = subscription as { subscription_plans: { tier: string } | null } | null;
    const tier = subscriptionData?.subscription_plans?.tier;
    if (tier !== 'PRO' && tier !== 'ENTERPRISE') {
      return NextResponse.json(
        { error: 'Toss POS integration requires PRO or ENTERPRISE subscription' },
        { status: 403 }
      );
    }

    const config: TossPOSConfig = {
      store_id: body.store_id,
      api_key: body.api_key,
      secret_key: body.secret_key,
      webhook_url: body.webhook_url,
    };

    // TODO: Implement actual Toss POS connection setup
    // - Validate API credentials with Toss
    // - Store encrypted credentials
    // - Set up webhook for real-time data sync

    return NextResponse.json({
      success: true,
      message: 'Toss POS connection configured successfully (stub)',
      config: {
        store_id: config.store_id,
        connected: true,
        last_sync: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error configuring Toss POS:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Webhook endpoint for Toss POS real-time data
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    // TODO: Implement webhook handler
    // - Verify webhook signature
    // - Process incoming POS data
    // - Update daily_sales table

    logger.log('Toss POS webhook received:', body);

    return NextResponse.json({
      success: true,
      message: 'Webhook processed successfully',
    });
  } catch (error) {
    console.error('Error processing Toss POS webhook:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
