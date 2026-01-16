import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

// GET /api/business/dashboard - 경영 대시보드 통계
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();

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

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const monthStart = todayStr.slice(0, 7) + '-01';

    // Calculate previous month dates
    const prevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const prevMonthStart = prevMonth.toISOString().split('T')[0].slice(0, 7) + '-01';
    const prevMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().split('T')[0];

    // Today's sales
    const { data: todaySales } = await supabase
      .from('daily_sales')
      .select('total_amount')
      .eq('company_id', userProfile.company_id)
      .eq('sale_date', todayStr);

    // Month's sales
    const { data: monthSales } = await supabase
      .from('daily_sales')
      .select('total_amount')
      .eq('company_id', userProfile.company_id)
      .gte('sale_date', monthStart);

    // Previous month's sales
    const { data: prevMonthSales } = await supabase
      .from('daily_sales')
      .select('total_amount')
      .eq('company_id', userProfile.company_id)
      .gte('sale_date', prevMonthStart)
      .lte('sale_date', prevMonthEnd);

    // Month's expenses
    const { data: monthExpenses } = await supabase
      .from('expense_transactions')
      .select('amount')
      .eq('company_id', userProfile.company_id)
      .gte('transaction_date', monthStart);

    // Previous month's expenses
    const { data: prevMonthExpenses } = await supabase
      .from('expense_transactions')
      .select('amount')
      .eq('company_id', userProfile.company_id)
      .gte('transaction_date', prevMonthStart)
      .lte('transaction_date', prevMonthEnd);

    const todayTotal = (todaySales || []).reduce((sum: number, s: any) => sum + (s.total_amount || 0), 0);
    const monthTotal = (monthSales || []).reduce((sum: number, s: any) => sum + (s.total_amount || 0), 0);
    const prevMonthTotal = (prevMonthSales || []).reduce((sum: number, s: any) => sum + (s.total_amount || 0), 0);
    const expenseTotal = (monthExpenses || []).reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
    const prevExpenseTotal = (prevMonthExpenses || []).reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
    const netProfit = monthTotal - expenseTotal;
    const prevNetProfit = prevMonthTotal - prevExpenseTotal;
    const profitMargin = monthTotal > 0 ? (netProfit / monthTotal) * 100 : 0;

    // Calculate change percentages (compared to previous month)
    const salesChange = prevMonthTotal > 0
      ? ((monthTotal - prevMonthTotal) / prevMonthTotal) * 100
      : 0;
    const expenseChange = prevExpenseTotal > 0
      ? ((expenseTotal - prevExpenseTotal) / prevExpenseTotal) * 100
      : 0;
    const profitChange = prevNetProfit !== 0
      ? ((netProfit - prevNetProfit) / Math.abs(prevNetProfit)) * 100
      : 0;

    return NextResponse.json({
      todaySales: todayTotal,
      monthSales: monthTotal,
      monthExpenses: expenseTotal,
      netProfit,
      profitMargin,
      salesChange: Math.round(salesChange * 10) / 10,
      expenseChange: Math.round(expenseChange * 10) / 10,
      profitChange: Math.round(profitChange * 10) / 10,
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
