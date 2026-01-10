/**
 * 손익계산서 자동 생성 서비스
 * 매출/비용 데이터를 기반으로 월간/분기 손익 계산
 */

import { createClient } from '@supabase/supabase-js';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export interface ProfitLossStatement {
  companyId: string;
  periodType: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  periodStart: string;
  periodEnd: string;

  // 매출
  totalRevenue: number;
  cardRevenue: number;
  cashRevenue: number;

  // 비용
  totalExpense: number;
  payrollExpense: number;
  expenseByCategory: Record<string, number>;

  // 손익
  grossProfit: number;
  grossProfitMargin: number;
  netProfit: number;
  netProfitMargin: number;

  // 전월 대비
  revenueChange: number;
  expenseChange: number;
  profitChange: number;

  // 일별 데이터
  dailyData?: {
    date: string;
    revenue: number;
    expense: number;
    profit: number;
  }[];
}

export interface AIRecommendation {
  icon: string;
  title: string;
  description: string;
  action: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

export class ProfitLossService {
  /**
   * 월간 손익계산서 생성
   */
  async generateMonthly(
    companyId: string,
    year: number,
    month: number
  ): Promise<ProfitLossStatement> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = endOfMonth(startDate);
    const startStr = format(startDate, 'yyyy-MM-dd');
    const endStr = format(endDate, 'yyyy-MM-dd');

    // 매출 집계
    const { data: salesData } = await supabase
      .from('daily_sales')
      .select('*')
      .eq('company_id', companyId)
      .gte('sales_date', startStr)
      .lte('sales_date', endStr);

    const totalRevenue = salesData?.reduce((sum, s) => sum + (s.total_amount || 0), 0) || 0;
    const cardRevenue = salesData?.reduce((sum, s) => sum + (s.card_amount || 0), 0) || 0;
    const cashRevenue = salesData?.reduce((sum, s) => sum + (s.cash_amount || 0), 0) || 0;

    // 비용 집계
    const { data: expenseData } = await supabase
      .from('expense_transactions')
      .select('*')
      .eq('company_id', companyId)
      .gte('transaction_date', startStr)
      .lte('transaction_date', endStr);

    const expenseByCategory: Record<string, number> = {};
    let totalExpense = 0;

    for (const exp of expenseData || []) {
      const category = exp.category || exp.ai_category || 'OTHER';
      expenseByCategory[category] = (expenseByCategory[category] || 0) + exp.amount;
      totalExpense += exp.amount;
    }

    // 인건비 (급여에서)
    const { data: salaryData } = await supabase
      .from('salaries')
      .select('total_gross_pay')
      .eq('company_id', companyId)
      .eq('year', year)
      .eq('month', month);

    const payrollExpense = salaryData?.reduce((sum, s) => sum + (s.total_gross_pay || 0), 0) || 0;
    expenseByCategory['LABOR'] = payrollExpense;
    totalExpense += payrollExpense;

    // 손익 계산
    const grossProfit = totalRevenue - totalExpense;
    const grossProfitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
    const netProfit = grossProfit;
    const netProfitMargin = grossProfitMargin;

    // 전월 데이터 조회
    const prevMonth = subMonths(startDate, 1);
    const { data: prevStatement } = await supabase
      .from('profit_loss_statements')
      .select('*')
      .eq('company_id', companyId)
      .eq('period_type', 'MONTHLY')
      .eq('period_start', format(startOfMonth(prevMonth), 'yyyy-MM-dd'))
      .maybeSingle();

    const revenueChange = prevStatement
      ? ((totalRevenue - prevStatement.total_revenue) / (prevStatement.total_revenue || 1)) * 100
      : 0;
    const expenseChange = prevStatement
      ? ((totalExpense - prevStatement.total_expense) / (prevStatement.total_expense || 1)) * 100
      : 0;
    const profitChange = prevStatement
      ? ((netProfit - prevStatement.net_profit) / Math.abs(prevStatement.net_profit || 1)) * 100
      : 0;

    // 일별 데이터 구성
    const dailyData: { date: string; revenue: number; expense: number; profit: number }[] = [];
    const salesByDate = new Map<string, number>();
    const expensesByDate = new Map<string, number>();

    for (const sale of salesData || []) {
      salesByDate.set(sale.sales_date, (salesByDate.get(sale.sales_date) || 0) + sale.total_amount);
    }

    for (const exp of expenseData || []) {
      expensesByDate.set(exp.transaction_date, (expensesByDate.get(exp.transaction_date) || 0) + exp.amount);
    }

    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      const dayRevenue = salesByDate.get(dateStr) || 0;
      const dayExpense = expensesByDate.get(dateStr) || 0;
      dailyData.push({
        date: dateStr,
        revenue: dayRevenue,
        expense: dayExpense,
        profit: dayRevenue - dayExpense,
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    const statement: ProfitLossStatement = {
      companyId,
      periodType: 'MONTHLY',
      periodStart: startStr,
      periodEnd: endStr,
      totalRevenue,
      cardRevenue,
      cashRevenue,
      totalExpense,
      payrollExpense,
      expenseByCategory,
      grossProfit,
      grossProfitMargin,
      netProfit,
      netProfitMargin,
      revenueChange,
      expenseChange,
      profitChange,
      dailyData,
    };

    // DB에 저장
    await supabase.from('profit_loss_statements').upsert(
      {
        company_id: companyId,
        period_type: 'MONTHLY',
        period_start: startStr,
        period_end: endStr,
        total_revenue: totalRevenue,
        total_expense: totalExpense,
        payroll_expense: payrollExpense,
        expense_by_category: expenseByCategory,
        net_profit: netProfit,
        profit_margin: netProfitMargin,
        revenue_change: revenueChange,
        expense_change: expenseChange,
        profit_change: profitChange,
      },
      { onConflict: 'company_id,period_type,period_start' }
    );

    return statement;
  }

  /**
   * 저장된 손익계산서 조회
   */
  async getStatement(
    companyId: string,
    year: number,
    month: number
  ): Promise<ProfitLossStatement | null> {
    const startDate = format(new Date(year, month - 1, 1), 'yyyy-MM-dd');

    const { data } = await supabase
      .from('profit_loss_statements')
      .select('*')
      .eq('company_id', companyId)
      .eq('period_type', 'MONTHLY')
      .eq('period_start', startDate)
      .maybeSingle();

    if (!data) return null;

    return {
      companyId: data.company_id,
      periodType: data.period_type,
      periodStart: data.period_start,
      periodEnd: data.period_end,
      totalRevenue: data.total_revenue,
      cardRevenue: 0,
      cashRevenue: 0,
      totalExpense: data.total_expense,
      payrollExpense: data.payroll_expense,
      expenseByCategory: data.expense_by_category || {},
      grossProfit: data.net_profit,
      grossProfitMargin: data.profit_margin,
      netProfit: data.net_profit,
      netProfitMargin: data.profit_margin,
      revenueChange: data.revenue_change,
      expenseChange: data.expense_change,
      profitChange: data.profit_change,
    };
  }

  /**
   * AI 개선 제안 생성
   */
  generateRecommendations(statement: ProfitLossStatement): AIRecommendation[] {
    const recommendations: AIRecommendation[] = [];

    // 인건비 비율 체크
    const payrollRatio = (statement.payrollExpense / statement.totalRevenue) * 100;
    if (payrollRatio > 35) {
      recommendations.push({
        icon: '💰',
        title: '인건비 최적화',
        description: `인건비 비율이 ${payrollRatio.toFixed(1)}%로 업계 평균(35%)보다 높습니다. 한가한 시간대 인력 조정을 검토해보세요.`,
        action: '스케줄 분석',
        priority: payrollRatio > 45 ? 'HIGH' : 'MEDIUM',
      });
    }

    // 재료비 비율 체크
    const materialCost = statement.expenseByCategory['INGREDIENTS'] || 0;
    const materialRatio = (materialCost / statement.totalRevenue) * 100;
    if (materialRatio > 40) {
      recommendations.push({
        icon: '📦',
        title: '재료비 절감',
        description: `재료비 비율이 ${materialRatio.toFixed(1)}%입니다. 업체별 단가 비교와 로스 관리를 점검해보세요.`,
        action: '업체 비교',
        priority: materialRatio > 50 ? 'HIGH' : 'MEDIUM',
      });
    }

    // 이익률 체크
    if (statement.netProfitMargin < 10) {
      recommendations.push({
        icon: '📊',
        title: '이익률 개선 필요',
        description: `이익률이 ${statement.netProfitMargin.toFixed(1)}%로 낮습니다. 매출 증대 또는 비용 절감이 필요합니다.`,
        action: '상세 분석',
        priority: statement.netProfitMargin < 5 ? 'HIGH' : 'MEDIUM',
      });
    }

    // 적자 체크
    if (statement.netProfit < 0) {
      recommendations.push({
        icon: '🚨',
        title: '적자 경고',
        description: `이번 달 ${Math.abs(statement.netProfit).toLocaleString()}원 적자입니다. 즉각적인 비용 점검이 필요합니다.`,
        action: '긴급 점검',
        priority: 'HIGH',
      });
    }

    // 배달비 체크
    const deliveryCost = statement.expenseByCategory['DELIVERY'] || 0;
    const deliveryRatio = (deliveryCost / statement.totalRevenue) * 100;
    if (deliveryRatio > 15) {
      recommendations.push({
        icon: '🛵',
        title: '배달 수수료 최적화',
        description: `배달 수수료가 매출의 ${deliveryRatio.toFixed(1)}%입니다. 자체 배달 또는 플랫폼 다각화를 검토해보세요.`,
        action: '배달 분석',
        priority: 'MEDIUM',
      });
    }

    // 성장 체크
    if (statement.revenueChange < -10) {
      recommendations.push({
        icon: '📉',
        title: '매출 하락 주의',
        description: `전월 대비 매출이 ${Math.abs(statement.revenueChange).toFixed(1)}% 감소했습니다. 원인 분석이 필요합니다.`,
        action: '원인 분석',
        priority: statement.revenueChange < -20 ? 'HIGH' : 'MEDIUM',
      });
    }

    // 성장 축하
    if (statement.revenueChange > 20 && statement.profitChange > 0) {
      recommendations.push({
        icon: '🎉',
        title: '매출 성장',
        description: `전월 대비 매출이 ${statement.revenueChange.toFixed(1)}% 증가했습니다! 성장 요인을 분석하여 유지하세요.`,
        action: '성장 분석',
        priority: 'LOW',
      });
    }

    return recommendations.sort((a, b) => {
      const priority = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      return priority[a.priority] - priority[b.priority];
    });
  }

  /**
   * 다중 기간 비교
   */
  async compareMultiplePeriods(
    companyId: string,
    periods: { year: number; month: number }[]
  ): Promise<ProfitLossStatement[]> {
    const statements: ProfitLossStatement[] = [];

    for (const period of periods) {
      let statement = await this.getStatement(companyId, period.year, period.month);
      if (!statement) {
        statement = await this.generateMonthly(companyId, period.year, period.month);
      }
      statements.push(statement);
    }

    return statements;
  }
}

export const profitLossService = new ProfitLossService();

export default ProfitLossService;
