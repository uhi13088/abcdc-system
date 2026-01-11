import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

// GET /api/business/dashboard - 경영 대시보드 통계
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();

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
      // Return default empty data instead of error
      return NextResponse.json({
        todaySales: 0,
        monthSales: 0,
        monthExpenses: 0,
        netProfit: 0,
        profitMargin: 0,
        salesChange: 0,
        expenseChange: 0,
        profitChange: 0,
      });
    }

    const today = new Date().toISOString().split('T')[0];
    const monthStart = today.slice(0, 7) + '-01';

    // Today's sales
    const { data: todaySales } = await supabase
      .from('daily_sales')
      .select('total_amount')
      .eq('company_id', userProfile.company_id)
      .eq('sale_date', today);

    // Month's sales
    const { data: monthSales } = await supabase
      .from('daily_sales')
      .select('total_amount')
      .eq('company_id', userProfile.company_id)
      .gte('sale_date', monthStart);

    // Month's expenses
    const { data: monthExpenses } = await supabase
      .from('expense_transactions')
      .select('amount')
      .eq('company_id', userProfile.company_id)
      .gte('transaction_date', monthStart);

    const todayTotal = (todaySales || []).reduce((sum: number, s: any) => sum + (s.total_amount || 0), 0);
    const monthTotal = (monthSales || []).reduce((sum: number, s: any) => sum + (s.total_amount || 0), 0);
    const expenseTotal = (monthExpenses || []).reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
    const netProfit = monthTotal - expenseTotal;
    const profitMargin = monthTotal > 0 ? (netProfit / monthTotal) * 100 : 0;

    return NextResponse.json({
      todaySales: todayTotal,
      monthSales: monthTotal,
      monthExpenses: expenseTotal,
      netProfit,
      profitMargin,
      salesChange: 8.5, // TODO: Calculate from previous period
      expenseChange: 3.2,
      profitChange: 12.3,
    });
  } catch (error) {
    console.error('Business dashboard error:', error);
    return NextResponse.json({
      todaySales: 0,
      monthSales: 0,
      monthExpenses: 0,
      netProfit: 0,
      profitMargin: 0,
      salesChange: 0,
      expenseChange: 0,
      profitChange: 0,
    });
  }
}
