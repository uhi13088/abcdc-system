'use client';

import React from 'react';

interface Recommendation {
  icon: string;
  title: string;
  description: string;
  action: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface ProfitLossStatement {
  totalRevenue: number;
  totalExpense: number;
  payrollExpense: number;
  expenseByCategory: Record<string, number>;
  netProfit: number;
  netProfitMargin: number;
  revenueChange: number;
  expenseChange: number;
  profitChange: number;
}

interface AIRecommendationsProps {
  statement: ProfitLossStatement;
  onActionClick?: (action: string) => void;
}

export function AIRecommendations({ statement, onActionClick }: AIRecommendationsProps) {
  const recommendations = generateRecommendations(statement);

  if (recommendations.length === 0) {
    return (
      <div className="bg-green-50 rounded-xl border border-green-200 p-6 text-center">
        <span className="text-4xl mb-4 block">🎉</span>
        <h4 className="font-semibold text-green-900">경영 상태 양호</h4>
        <p className="text-sm text-green-700 mt-1">
          현재 특별한 개선이 필요한 항목이 없습니다. 좋은 성과를 유지하세요!
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        AI 개선 제안
      </h3>
      <div className="space-y-4">
        {recommendations.map((rec, idx) => (
          <div
            key={idx}
            className={`flex items-start gap-4 p-4 rounded-lg ${
              rec.priority === 'HIGH'
                ? 'bg-red-50 border border-red-200'
                : rec.priority === 'MEDIUM'
                ? 'bg-yellow-50 border border-yellow-200'
                : 'bg-blue-50 border border-blue-200'
            }`}
          >
            <span className="text-2xl flex-shrink-0">{rec.icon}</span>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-gray-900">{rec.title}</h4>
              <p className="text-sm text-gray-600 mt-1">{rec.description}</p>
            </div>
            <button
              onClick={() => onActionClick?.(rec.action)}
              className={`flex-shrink-0 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                rec.priority === 'HIGH'
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : rec.priority === 'MEDIUM'
                  ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {rec.action}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function generateRecommendations(statement: ProfitLossStatement): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // 인건비 비율 체크 (35% 이상)
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

  // 재료비 비율 체크 (40% 이상)
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

  // 이익률 체크 (10% 미만)
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

  // 배달비 체크 (15% 이상)
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

  // 매출 하락 체크 (10% 이상 감소)
  if (statement.revenueChange < -10) {
    recommendations.push({
      icon: '📉',
      title: '매출 하락 주의',
      description: `전월 대비 매출이 ${Math.abs(statement.revenueChange).toFixed(1)}% 감소했습니다. 원인 분석이 필요합니다.`,
      action: '원인 분석',
      priority: statement.revenueChange < -20 ? 'HIGH' : 'MEDIUM',
    });
  }

  // 매출 성장 축하 (20% 이상 증가)
  if (statement.revenueChange > 20 && statement.profitChange > 0) {
    recommendations.push({
      icon: '🎉',
      title: '매출 성장',
      description: `전월 대비 매출이 ${statement.revenueChange.toFixed(1)}% 증가했습니다! 성장 요인을 분석하여 유지하세요.`,
      action: '성장 분석',
      priority: 'LOW',
    });
  }

  // 우선순위 순 정렬
  return recommendations.sort((a, b) => {
    const priority = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return priority[a.priority] - priority[b.priority];
  });
}

export default AIRecommendations;
