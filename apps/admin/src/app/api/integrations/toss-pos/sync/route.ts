import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

// POST /api/integrations/toss-pos/sync - Toss POS 매출 데이터 동기화
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const body = await request.json();
    const { startDate, endDate } = body;

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await supabase
      .from('users')
      .select('company_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Get active Toss POS integration
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('*')
      .eq('company_id', userProfile.company_id)
      .eq('provider', 'toss_pos')
      .eq('connected', true)
      .single();

    if (integrationError || !integration) {
      return NextResponse.json({ error: 'Toss POS가 연결되어 있지 않습니다.' }, { status: 404 });
    }

    // Check token expiration
    if (integration.token_expires_at && new Date(integration.token_expires_at) < new Date()) {
      return NextResponse.json({
        error: '토큰이 만료되었습니다. 재연결이 필요합니다.',
        requiresReauth: true,
      }, { status: 401 });
    }

    // Fetch sales data from Toss POS API
    const syncStartDate = startDate || new Date().toISOString().split('T')[0];
    const syncEndDate = endDate || syncStartDate;

    const tossSalesData = await fetchTossSales(
      integration.access_token,
      integration.settings?.store_id,
      syncStartDate,
      syncEndDate
    );

    if (!tossSalesData.success) {
      return NextResponse.json({
        error: tossSalesData.error || '매출 데이터 동기화에 실패했습니다.',
      }, { status: 500 });
    }

    // Save synced data to daily_sales
    let syncedCount = 0;
    for (const sale of tossSalesData.data || []) {
      const { error: upsertError } = await supabase
        .from('daily_sales')
        .upsert({
          company_id: userProfile.company_id,
          store_id: integration.settings?.store_id,
          sale_date: sale.date,
          total_amount: sale.total_sales,
          transaction_count: sale.transaction_count,
          cash_sales: sale.payment_methods?.cash || 0,
          card_sales: sale.payment_methods?.card || 0,
          other_sales: sale.payment_methods?.mobile || 0,
          is_auto_synced: true,
          synced_from: 'TOSS_POS',
          synced_at: new Date().toISOString(),
        }, { onConflict: 'company_id,store_id,sale_date' });

      if (!upsertError) syncedCount++;
    }

    // Update last sync time
    await supabase
      .from('integrations')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', integration.id);

    return NextResponse.json({
      success: true,
      message: `${syncedCount}일의 매출 데이터가 동기화되었습니다.`,
      synced_count: syncedCount,
      date_range: { start: syncStartDate, end: syncEndDate },
    });
  } catch (error) {
    console.error('Toss POS sync error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Fetch sales data from Toss POS API
async function fetchTossSales(accessToken: string, storeId: string, startDate: string, endDate: string) {
  try {
    // Check if Toss POS API credentials are configured
    if (!process.env.TOSS_POS_CLIENT_ID) {
      // Return mock data for development/testing
      return {
        success: true,
        data: generateMockSalesData(startDate, endDate),
      };
    }

    const response = await fetch(
      `https://api.tosspayments.com/v1/pos/stores/${storeId}/sales?startDate=${startDate}&endDate=${endDate}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      return { success: false, error: errorData.message || 'API request failed' };
    }

    const data = await response.json();
    return { success: true, data: data.sales || [] };
  } catch (error) {
    console.error('Toss API fetch error:', error);
    return { success: false, error: 'Failed to fetch from Toss POS API' };
  }
}

// Generate mock sales data for testing
function generateMockSalesData(startDate: string, endDate: string) {
  const data = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    const baseSales = 2000000 + Math.random() * 1000000;

    data.push({
      date: dateStr,
      total_sales: Math.round(baseSales),
      transaction_count: Math.round(100 + Math.random() * 100),
      payment_methods: {
        cash: Math.round(baseSales * 0.2),
        card: Math.round(baseSales * 0.7),
        mobile: Math.round(baseSales * 0.1),
      },
    });
  }

  return data;
}

export const dynamic = 'force-dynamic';
