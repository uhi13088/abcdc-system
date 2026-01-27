import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Open Banking Integration API
 * PRO Feature: Bank account and transaction data synchronization
 *
 * Endpoints:
 * - GET: Fetch bank accounts and transactions
 * - POST: Register bank account connection
 */

interface BankAccount {
  id: string;
  bank_code: string;
  bank_name: string;
  account_number: string;
  account_holder: string;
  account_type: 'CHECKING' | 'SAVINGS' | 'CORPORATE';
  balance: number;
  last_synced: string;
}

interface BankTransaction {
  id: string;
  transaction_date: string;
  transaction_time: string;
  type: 'DEPOSIT' | 'WITHDRAWAL';
  amount: number;
  balance_after: number;
  description: string;
  counterparty?: string;
  category?: string;
}

// Korean bank codes
const BANK_CODES: Record<string, string> = {
  '004': 'KB국민은행',
  '088': '신한은행',
  '020': '우리은행',
  '081': '하나은행',
  '011': 'NH농협은행',
  '003': 'IBK기업은행',
  '023': 'SC제일은행',
  '039': '경남은행',
  '034': '광주은행',
  '031': '대구은행',
  '032': '부산은행',
  '045': '새마을금고',
  '007': '수협은행',
  '048': '신협',
  '027': '한국씨티은행',
  '035': '제주은행',
  '037': '전북은행',
  '090': '카카오뱅크',
  '092': '토스뱅크',
  '089': '케이뱅크',
};

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get('account_id');
  const _startDate = searchParams.get('start_date');
  const _endDate = searchParams.get('end_date');

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
        { error: 'Open Banking integration requires PRO or ENTERPRISE subscription' },
        { status: 403 }
      );
    }

    // TODO: Implement actual Open Banking API integration
    // This is a stub that returns mock data

    if (accountId) {
      // Return transactions for specific account
      const mockTransactions: BankTransaction[] = [
        {
          id: 't1',
          transaction_date: '2024-01-10',
          transaction_time: '14:32:15',
          type: 'DEPOSIT',
          amount: 1250000,
          balance_after: 15680000,
          description: '카드매출입금',
          counterparty: '토스페이먼츠',
          category: 'SALES',
        },
        {
          id: 't2',
          transaction_date: '2024-01-10',
          transaction_time: '11:20:00',
          type: 'WITHDRAWAL',
          amount: 850000,
          balance_after: 14430000,
          description: '식자재대금',
          counterparty: '농협유통',
          category: 'EXPENSE',
        },
        {
          id: 't3',
          transaction_date: '2024-01-09',
          transaction_time: '18:45:30',
          type: 'DEPOSIT',
          amount: 980000,
          balance_after: 15280000,
          description: '현금매출입금',
          category: 'SALES',
        },
      ];

      return NextResponse.json({
        success: true,
        data: { transactions: mockTransactions },
        message: 'Transactions retrieved successfully (mock)',
      });
    }

    // Return list of connected bank accounts
    const mockAccounts: BankAccount[] = [
      {
        id: 'acc1',
        bank_code: '088',
        bank_name: '신한은행',
        account_number: '***-***-123456',
        account_holder: '(주)ABC푸드',
        account_type: 'CORPORATE',
        balance: 15680000,
        last_synced: new Date().toISOString(),
      },
      {
        id: 'acc2',
        bank_code: '004',
        bank_name: 'KB국민은행',
        account_number: '***-**-987654',
        account_holder: '(주)ABC푸드',
        account_type: 'SAVINGS',
        balance: 45000000,
        last_synced: new Date().toISOString(),
      },
    ];

    return NextResponse.json({
      success: true,
      data: { accounts: mockAccounts },
      message: 'Bank accounts retrieved successfully (mock)',
    });
  } catch (error) {
    console.error('Error fetching Open Banking data:', error);
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
        { error: 'Open Banking integration requires PRO or ENTERPRISE subscription' },
        { status: 403 }
      );
    }

    const { bank_code, account_number, authorization_code: _authorization_code } = body;

    // TODO: Implement actual Open Banking account connection
    // Steps:
    // 1. Redirect user to bank's authentication page
    // 2. Receive authorization code
    // 3. Exchange for access token
    // 4. Verify account ownership
    // 5. Store encrypted credentials

    // Validate bank code
    if (!BANK_CODES[bank_code]) {
      return NextResponse.json(
        { error: 'Invalid bank code' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Bank account connected successfully (stub)',
      data: {
        bank_code,
        bank_name: BANK_CODES[bank_code],
        account_number: account_number.replace(/(\d{3})(\d{2,3})(\d+)/, '***-**-$3'),
        connected_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error connecting bank account:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Sync endpoint to trigger manual refresh
export async function PUT(request: NextRequest) {
  const supabase = await createClient();

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { account_id } = body;

    // TODO: Implement actual sync logic
    // - Fetch latest transactions from Open Banking API
    // - Update bank_accounts table with new balance
    // - Insert new transactions into expense_transactions table
    // - Auto-categorize transactions using AI

    return NextResponse.json({
      success: true,
      message: 'Bank account synced successfully (stub)',
      data: {
        account_id,
        synced_at: new Date().toISOString(),
        new_transactions: 5,
      },
    });
  } catch (error) {
    console.error('Error syncing bank account:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
