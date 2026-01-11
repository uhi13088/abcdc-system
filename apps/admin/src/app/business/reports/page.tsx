'use client';

import { useState, useEffect } from 'react';
import { BarChart3, Lightbulb, TrendingUp, TrendingDown, DollarSign, Users, X, CheckCircle } from 'lucide-react';

interface AIInsight {
  id: string;
  insight_type: string;
  title: string;
  description: string;
  recommendation: string;
  estimated_savings: number;
  confidence_score: number;
  is_dismissed: boolean;
  created_at: string;
}

interface CostAlert {
  id: string;
  alert_type: string;
  category: string;
  message: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  threshold_value: number;
  current_value: number;
  is_read: boolean;
  is_resolved: boolean;
  created_at: string;
}

export default function ReportsPage() {
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [alerts, setAlerts] = useState<CostAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'insights' | 'alerts'>('insights');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Demo data for now
      setInsights([
        {
          id: '1',
          insight_type: 'LABOR_EFFICIENCY',
          title: '인건비 최적화 기회',
          description: '화요일과 수요일 점심시간대 인력이 평균 대비 30% 과다 배치되어 있습니다.',
          recommendation: '해당 시간대 인력을 1명 줄이면 월 약 50만원 절감이 가능합니다.',
          estimated_savings: 500000,
          confidence_score: 0.87,
          is_dismissed: false,
          created_at: new Date().toISOString(),
        },
        {
          id: '2',
          insight_type: 'COST_OPTIMIZATION',
          title: '재료비 절감 기회',
          description: '최근 3개월간 재료비가 매출 대비 28%로, 업종 평균(25%)보다 높습니다.',
          recommendation: '주요 식재료 발주량 최적화 및 폐기량 관리를 권장합니다.',
          estimated_savings: 350000,
          confidence_score: 0.92,
          is_dismissed: false,
          created_at: new Date().toISOString(),
        },
        {
          id: '3',
          insight_type: 'REVENUE_TREND',
          title: '매출 성장 트렌드',
          description: '지난 6개월간 월평균 매출이 8.5% 성장하고 있습니다.',
          recommendation: '현재 운영 전략을 유지하며, 피크 타임 확대를 검토하세요.',
          estimated_savings: 0,
          confidence_score: 0.95,
          is_dismissed: false,
          created_at: new Date().toISOString(),
        },
      ]);

      setAlerts([
        {
          id: '1',
          alert_type: 'LABOR_COST_HIGH',
          category: '인건비',
          message: '이번달 인건비 비율이 36%로 기준(35%)을 초과했습니다.',
          severity: 'MEDIUM',
          threshold_value: 35,
          current_value: 36,
          is_read: false,
          is_resolved: false,
          created_at: new Date().toISOString(),
        },
        {
          id: '2',
          alert_type: 'UNUSUAL_EXPENSE',
          category: '관리비',
          message: '관리비가 전월 대비 45% 증가했습니다.',
          severity: 'HIGH',
          threshold_value: 2000000,
          current_value: 2900000,
          is_read: true,
          is_resolved: false,
          created_at: new Date().toISOString(),
        },
      ]);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const dismissInsight = async (id: string) => {
    setInsights(insights.map(i => i.id === id ? { ...i, is_dismissed: true } : i));
  };

  const resolveAlert = async (id: string) => {
    setAlerts(alerts.map(a => a.id === id ? { ...a, is_resolved: true } : a));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount) + '원';
  };

  const insightIcons = {
    'LABOR_EFFICIENCY': Users,
    'COST_OPTIMIZATION': DollarSign,
    'REVENUE_TREND': TrendingUp,
    'BENCHMARK': BarChart3,
  };

  const severityColors = {
    'LOW': 'bg-blue-100 text-blue-700 border-blue-200',
    'MEDIUM': 'bg-yellow-100 text-yellow-700 border-yellow-200',
    'HIGH': 'bg-orange-100 text-orange-700 border-orange-200',
    'CRITICAL': 'bg-red-100 text-red-700 border-red-200',
  };

  const activeInsights = insights.filter(i => !i.is_dismissed);
  const activeAlerts = alerts.filter(a => !a.is_resolved);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">분석 리포트</h1>
        <p className="mt-1 text-sm text-gray-500">AI 기반 인사이트와 비용 알림을 확인합니다</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b">
        <button
          onClick={() => setActiveTab('insights')}
          className={`pb-3 px-1 border-b-2 flex items-center gap-2 ${
            activeTab === 'insights' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'
          }`}
        >
          <Lightbulb className="w-4 h-4" />
          AI 인사이트
          {activeInsights.length > 0 && (
            <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
              {activeInsights.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('alerts')}
          className={`pb-3 px-1 border-b-2 flex items-center gap-2 ${
            activeTab === 'alerts' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'
          }`}
        >
          <TrendingDown className="w-4 h-4" />
          비용 알림
          {activeAlerts.length > 0 && (
            <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">
              {activeAlerts.length}
            </span>
          )}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : activeTab === 'insights' ? (
        /* AI Insights */
        activeInsights.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
            <Lightbulb className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">새로운 인사이트가 없습니다</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeInsights.map((insight) => {
              const Icon = insightIcons[insight.insight_type as keyof typeof insightIcons] || Lightbulb;
              return (
                <div key={insight.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Icon className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{insight.title}</h3>
                          <p className="text-xs text-gray-500">
                            신뢰도: {(insight.confidence_score * 100).toFixed(0)}%
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => dismissInsight(insight.id)}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        <X className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>

                    <p className="text-gray-700 mb-4">{insight.description}</p>

                    <div className="bg-blue-50 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <Lightbulb className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-blue-800">추천 조치</p>
                          <p className="text-sm text-blue-700">{insight.recommendation}</p>
                          {insight.estimated_savings > 0 && (
                            <p className="text-sm font-medium text-blue-800 mt-2">
                              예상 절감액: {formatCurrency(insight.estimated_savings)}/월
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* Cost Alerts */
        activeAlerts.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
            <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-300" />
            <p className="text-gray-500">모든 알림이 해결되었습니다</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`bg-white rounded-xl shadow-sm border overflow-hidden ${
                  !alert.is_read ? 'border-l-4 border-l-red-500' : ''
                }`}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 text-sm rounded-full border ${severityColors[alert.severity]}`}>
                        {alert.severity === 'LOW' ? '낮음' :
                         alert.severity === 'MEDIUM' ? '보통' :
                         alert.severity === 'HIGH' ? '높음' : '심각'}
                      </span>
                      <span className="text-sm text-gray-500">{alert.category}</span>
                    </div>
                    <button
                      onClick={() => resolveAlert(alert.id)}
                      className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
                    >
                      해결됨
                    </button>
                  </div>

                  <p className="text-gray-900 mb-3">{alert.message}</p>

                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>기준: {alert.threshold_value}%</span>
                    <span className="text-red-600">현재: {alert.current_value}%</span>
                    <span>
                      {new Date(alert.created_at).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
