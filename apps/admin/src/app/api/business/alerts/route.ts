import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

// GET /api/business/alerts - 비즈니스 알림 조회
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
      return NextResponse.json([]);
    }

    // Fetch cost alerts from database
    const { data: alerts, error } = await supabase
      .from('cost_alerts')
      .select('*')
      .eq('company_id', userProfile.company_id)
      .eq('is_resolved', false)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      // Table might not exist, generate alerts from data
      const generatedAlerts = await generateAlerts(supabase, userProfile.company_id);
      return NextResponse.json(generatedAlerts);
    }

    return NextResponse.json(alerts || []);
  } catch (error) {
    console.error('Business alerts error:', error);
    return NextResponse.json([]);
  }
}

// Generate alerts from data analysis
async function generateAlerts(supabase: any, companyId: string) {
  const alerts: any[] = [];
  const today = new Date();
  const monthStart = today.toISOString().slice(0, 7) + '-01';

  // Check budget vs actual
  const { data: budgetData } = await supabase
    .from('budget_plans')
    .select('category, planned_amount, actual_amount')
    .eq('company_id', companyId)
    .eq('budget_year', today.getFullYear())
    .eq('budget_month', today.getMonth() + 1);

  if (budgetData) {
    for (const budget of budgetData) {
      const usageRate = budget.actual_amount / budget.planned_amount;

      if (usageRate > 1.0) {
        alerts.push({
          id: `budget-exceeded-${budget.category}`,
          alert_type: 'BUDGET_EXCEEDED',
          category: budget.category,
          message: `${budget.category} 예산 초과: ${(usageRate * 100).toFixed(0)}% 사용`,
          severity: usageRate > 1.2 ? 'CRITICAL' : 'HIGH',
          threshold_value: budget.planned_amount,
          current_value: budget.actual_amount,
          is_read: false,
          is_resolved: false,
          created_at: new Date().toISOString(),
        });
      } else if (usageRate > 0.9) {
        alerts.push({
          id: `budget-warning-${budget.category}`,
          alert_type: 'BUDGET_WARNING',
          category: budget.category,
          message: `${budget.category} 예산 90% 이상 사용: ${(usageRate * 100).toFixed(0)}%`,
          severity: 'MEDIUM',
          threshold_value: budget.planned_amount,
          current_value: budget.actual_amount,
          is_read: false,
          is_resolved: false,
          created_at: new Date().toISOString(),
        });
      }
    }
  }

  // Check for unusual expenses
  const { data: recentExpenses } = await supabase
    .from('expense_transactions')
    .select('*')
    .eq('company_id', companyId)
    .gte('transaction_date', monthStart)
    .order('amount', { ascending: false })
    .limit(5);

  if (recentExpenses && recentExpenses.length > 0) {
    // Get average expense for comparison
    const { data: avgData } = await supabase
      .from('expense_transactions')
      .select('amount')
      .eq('company_id', companyId);

    if (avgData && avgData.length > 10) {
      const avgAmount = avgData.reduce((sum: number, e: any) => sum + e.amount, 0) / avgData.length;
      const stdDev = Math.sqrt(
        avgData.reduce((sum: number, e: any) => sum + Math.pow(e.amount - avgAmount, 2), 0) / avgData.length
      );

      for (const expense of recentExpenses) {
        if (expense.amount > avgAmount + 2 * stdDev) {
          alerts.push({
            id: `unusual-expense-${expense.id}`,
            alert_type: 'UNUSUAL_EXPENSE',
            category: expense.category,
            message: `비정상적으로 큰 지출: ${expense.amount.toLocaleString()}원 (${expense.description})`,
            severity: expense.amount > avgAmount + 3 * stdDev ? 'HIGH' : 'MEDIUM',
            threshold_value: Math.round(avgAmount + 2 * stdDev),
            current_value: expense.amount,
            is_read: false,
            is_resolved: false,
            created_at: expense.transaction_date,
          });
        }
      }
    }
  }

  return alerts;
}

// PATCH /api/business/alerts - 알림 상태 업데이트
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const body = await request.json();
    const { alertId, isRead, isResolved } = body;

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const updateData: any = {};
    if (isRead !== undefined) updateData.is_read = isRead;
    if (isResolved !== undefined) updateData.is_resolved = isResolved;

    const { data, error } = await supabase
      .from('cost_alerts')
      .update(updateData)
      .eq('id', alertId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Update alert error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
