/**
 * HACCP AI 이상 감지 서비스
 * CCP 트렌드 분석 및 불량률 예측
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { subDays, format } from 'date-fns';

let _supabaseClient: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!_supabaseClient) {
    _supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
  }
  return _supabaseClient;
}

const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (getSupabase() as any)[prop];
  }
});

export interface TrendAnalysis {
  status: 'NORMAL' | 'ATTENTION' | 'WARNING' | 'CRITICAL';
  message: string;
  recommendation?: string;
  data?: {
    mean: number;
    std: number;
    latestValue: number;
    zScore: number;
    trend: 'RISING' | 'FALLING' | 'STABLE';
  };
}

export interface DefectPrediction {
  predicted: number;
  alert: boolean;
  message?: string;
  historicalRates: number[];
}

export interface AnomalyReport {
  ccpId: string;
  ccpName: string;
  analysis: TrendAnalysis;
  period: {
    start: string;
    end: string;
  };
  readings: {
    date: string;
    value: number;
    isWithinLimit: boolean;
  }[];
}

export class HACCPAnomalyDetectionService {
  /**
   * CCP 트렌드 분석
   */
  async analyzeCCPTrend(
    ccpId: string,
    days: number = 7
  ): Promise<TrendAnalysis> {
    const startDate = format(subDays(new Date(), days), 'yyyy-MM-dd');

    // CCP 기록 조회
    const { data: records, error } = await supabase
      .from('ccp_records')
      .select('measurement, record_date, record_time')
      .eq('ccp_id', ccpId)
      .gte('record_date', startDate)
      .order('record_date', { ascending: true })
      .order('record_time', { ascending: true });

    if (error || !records || records.length < 3) {
      return {
        status: 'NORMAL',
        message: '분석할 데이터가 충분하지 않습니다.',
      };
    }

    const values = records.map(r => r.measurement?.value).filter(v => v !== undefined && v !== null);

    if (values.length < 3) {
      return {
        status: 'NORMAL',
        message: '분석할 데이터가 충분하지 않습니다.',
      };
    }

    // 통계 계산
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const std = Math.sqrt(variance);

    const latestValue = values[values.length - 1];
    const zScore = std > 0 ? (latestValue - mean) / std : 0;

    // 트렌드 감지 (최근 3개 값)
    const recentValues = values.slice(-3);
    const trend = this.detectTrend(recentValues);

    // 상태 판단
    let status: TrendAnalysis['status'] = 'NORMAL';
    let message = '';
    let recommendation = '';

    if (Math.abs(zScore) > 3) {
      status = 'CRITICAL';
      message = `측정값이 평균에서 ${zScore.toFixed(1)}σ 벗어났습니다. 즉각적인 조치가 필요합니다.`;
      recommendation = '해당 CCP를 즉시 점검하고 필요시 개선조치를 시작하세요.';
    } else if (Math.abs(zScore) > 2) {
      status = 'WARNING';
      message = `측정값이 평균에서 ${zScore.toFixed(1)}σ 벗어났습니다. 주의가 필요합니다.`;
      recommendation = '해당 CCP를 면밀히 모니터링하세요.';
    } else if (trend !== 'STABLE' && values.length >= 5) {
      const trendWord = trend === 'RISING' ? '상승' : '하락';
      status = 'ATTENTION';
      message = `측정값이 연속적으로 ${trendWord} 중입니다.`;
      recommendation = '추이를 주시하며 원인을 파악하세요.';
    } else {
      message = '정상 범위 내에서 안정적입니다.';
    }

    return {
      status,
      message,
      recommendation: recommendation || undefined,
      data: {
        mean,
        std,
        latestValue,
        zScore,
        trend,
      },
    };
  }

  /**
   * 트렌드 감지 (연속 상승/하락)
   */
  private detectTrend(values: number[]): 'RISING' | 'FALLING' | 'STABLE' {
    if (values.length < 3) return 'STABLE';

    let risingCount = 0;
    let fallingCount = 0;

    for (let i = 1; i < values.length; i++) {
      if (values[i] > values[i - 1]) risingCount++;
      if (values[i] < values[i - 1]) fallingCount++;
    }

    // 모든 변화가 같은 방향일 때
    if (risingCount === values.length - 1) return 'RISING';
    if (fallingCount === values.length - 1) return 'FALLING';

    return 'STABLE';
  }

  /**
   * 불량률 예측
   */
  async predictDefectRate(
    companyId: string,
    days: number = 30
  ): Promise<DefectPrediction> {
    const startDate = format(subDays(new Date(), days), 'yyyy-MM-dd');

    // 생산 기록 조회
    const { data: records, error } = await supabase
      .from('production_records')
      .select('quality')
      .eq('company_id', companyId)
      .gte('production_date', startDate)
      .order('production_date', { ascending: true });

    if (error || !records || records.length === 0) {
      return {
        predicted: 0,
        alert: false,
        message: '예측할 데이터가 없습니다.',
        historicalRates: [],
      };
    }

    const defectRates = records
      .map(r => r.quality?.defect_rate)
      .filter(r => r !== undefined && r !== null);

    if (defectRates.length === 0) {
      return {
        predicted: 0,
        alert: false,
        message: '불량률 데이터가 없습니다.',
        historicalRates: [],
      };
    }

    // 7일 이동평균 계산
    const movingAvg = this.calculate7DayMovingAverage(defectRates);

    let alert = false;
    let message = '';

    if (movingAvg > 2) {
      alert = true;
      message = `7일 평균 불량률이 ${movingAvg.toFixed(2)}%로 기준(2%)을 초과했습니다.`;
    } else if (movingAvg > 1.5) {
      message = `7일 평균 불량률이 ${movingAvg.toFixed(2)}%입니다. 주의가 필요합니다.`;
    }

    return {
      predicted: movingAvg,
      alert,
      message: message || undefined,
      historicalRates: defectRates,
    };
  }

  /**
   * 7일 이동평균 계산
   */
  private calculate7DayMovingAverage(values: number[]): number {
    if (values.length === 0) return 0;

    const recentValues = values.slice(-7);
    return recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
  }

  /**
   * 전체 CCP 이상 리포트
   */
  async generateAnomalyReport(companyId: string): Promise<AnomalyReport[]> {
    // 회사의 CCP 정의 조회
    const { data: ccps, error } = await supabase
      .from('ccp_definitions')
      .select('id, process')
      .eq('company_id', companyId)
      .eq('is_active', true);

    if (error || !ccps) return [];

    const reports: AnomalyReport[] = [];
    const endDate = new Date();
    const startDate = subDays(endDate, 7);

    for (const ccp of ccps) {
      const analysis = await this.analyzeCCPTrend(ccp.id, 7);

      // 기록 데이터 조회
      const { data: records } = await supabase
        .from('ccp_records')
        .select('record_date, measurement')
        .eq('ccp_id', ccp.id)
        .gte('record_date', format(startDate, 'yyyy-MM-dd'))
        .order('record_date', { ascending: true });

      reports.push({
        ccpId: ccp.id,
        ccpName: ccp.process,
        analysis,
        period: {
          start: format(startDate, 'yyyy-MM-dd'),
          end: format(endDate, 'yyyy-MM-dd'),
        },
        readings: (records || []).map(r => ({
          date: r.record_date,
          value: r.measurement?.value || 0,
          isWithinLimit: r.measurement?.result === 'PASS',
        })),
      });
    }

    // 이상 있는 항목 우선 정렬
    return reports.sort((a, b) => {
      const priority = { CRITICAL: 0, WARNING: 1, ATTENTION: 2, NORMAL: 3 };
      return priority[a.analysis.status] - priority[b.analysis.status];
    });
  }

  /**
   * 이상 감지 요약
   */
  async getAnomalySummary(companyId: string): Promise<{
    critical: number;
    warning: number;
    attention: number;
    normal: number;
    defectAlert: boolean;
    defectRate: number;
  }> {
    const reports = await this.generateAnomalyReport(companyId);
    const defect = await this.predictDefectRate(companyId);

    return {
      critical: reports.filter(r => r.analysis.status === 'CRITICAL').length,
      warning: reports.filter(r => r.analysis.status === 'WARNING').length,
      attention: reports.filter(r => r.analysis.status === 'ATTENTION').length,
      normal: reports.filter(r => r.analysis.status === 'NORMAL').length,
      defectAlert: defect.alert,
      defectRate: defect.predicted,
    };
  }
}

export const haccpAnomalyDetectionService = new HACCPAnomalyDetectionService();

export default HACCPAnomalyDetectionService;
