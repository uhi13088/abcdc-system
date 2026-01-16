import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

// GET /api/business/insights - AI 비즈니스 인사이트 조회
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

    // Fetch AI insights from database
    const { data: insights, error } = await supabase
      .from('ai_business_insights')
      .select('*')
      .eq('company_id', userProfile.company_id)
      .eq('is_dismissed', false)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      // Table might not exist yet, return generated insights
      const generatedInsights = await generateBasicInsights(supabase, userProfile.company_id);
      return NextResponse.json(generatedInsights);
    }

    return NextResponse.json(insights || []);
  } catch (error) {
    console.error('Business insights error:', error);
    return NextResponse.json([]);
  }
}

// Generate basic insights from data analysis
async function generateBasicInsights(supabase: any, companyId: string) {
  const insights: any[] = [];
  const today = new Date();
  const monthStart = today.toISOString().slice(0, 7) + '-01';

  // Analyze sales trends
  const { data: salesData } = await supabase
    .from('daily_sales')
    .select('sale_date, total_amount')
    .eq('company_id', companyId)
    .gte('sale_date', monthStart)
    .order('sale_date');

  if (salesData && salesData.length > 7) {
    const lastWeek = salesData.slice(-7);
    const prevWeek = salesData.slice(-14, -7);

    if (prevWeek.length > 0) {
      const lastWeekTotal = lastWeek.reduce((sum: number, s: any) => sum + (s.total_amount || 0), 0);
      const prevWeekTotal = prevWeek.reduce((sum: number, s: any) => sum + (s.total_amount || 0), 0);
      const change = ((lastWeekTotal - prevWeekTotal) / prevWeekTotal) * 100;

      if (change < -10) {
        insights.push({
          id: 'sales-decline',
          insight_type: 'WARNING',
          title: '매출 감소 추세',
          description: `지난 주 대비 매출이 ${Math.abs(change).toFixed(1)}% 감소했습니다.`,
          recommendation: '프로모션이나 마케팅 활동을 고려해보세요.',
          estimated_savings: 0,
          confidence_score: 0.85,
          is_dismissed: false,
          created_at: new Date().toISOString(),
        });
      } else if (change > 20) {
        insights.push({
          id: 'sales-growth',
          insight_type: 'SUCCESS',
          title: '매출 성장',
          description: `지난 주 대비 매출이 ${change.toFixed(1)}% 증가했습니다!`,
          recommendation: '현재 전략을 유지하고 성장 모멘텀을 활용하세요.',
          estimated_savings: 0,
          confidence_score: 0.9,
          is_dismissed: false,
          created_at: new Date().toISOString(),
        });
      }
    }
  }

  // Analyze expenses
  const { data: expenseData } = await supabase
    .from('expense_transactions')
    .select('category, amount')
    .eq('company_id', companyId)
    .gte('transaction_date', monthStart);

  if (expenseData && expenseData.length > 0) {
    const categoryTotals: Record<string, number> = {};
    expenseData.forEach((e: any) => {
      categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
    });

    const sortedCategories = Object.entries(categoryTotals).sort(([,a], [,b]) => b - a);
    if (sortedCategories.length > 0) {
      const [topCategory, topAmount] = sortedCategories[0];
      const total = Object.values(categoryTotals).reduce((a, b) => a + b, 0);
      const percentage = (topAmount / total) * 100;

      if (percentage > 40) {
        insights.push({
          id: 'expense-concentration',
          insight_type: 'INFO',
          title: `${topCategory} 비용 집중`,
          description: `${topCategory} 비용이 전체의 ${percentage.toFixed(1)}%를 차지합니다.`,
          recommendation: '해당 카테고리의 비용 절감 방안을 검토해보세요.',
          estimated_savings: Math.round(topAmount * 0.1),
          confidence_score: 0.75,
          is_dismissed: false,
          created_at: new Date().toISOString(),
        });
      }
    }
  }

  return insights;
}

export const dynamic = 'force-dynamic';
