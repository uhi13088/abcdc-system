import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { format, startOfDay, endOfDay, startOfWeek, startOfMonth } from 'date-fns';

export const dynamic = 'force-dynamic';

interface DashboardStats {
  todayHygieneChecks: {
    completed: number;
    total: number;
  };
  pendingCcpRecords: number;
  lowStockMaterials: number;
  pendingInspections: number;
  todayProduction: number;
  ccpDeviations: number;
  todayCcpRecords: number;
  weeklyPestControl: {
    completed: boolean;
    lastCheck: string | null;
  };
  monthlyVerification: {
    completed: number;
    total: number;
  };
  sensorStatus: {
    total: number;
    online: number;
    offline: number;
  };
  recentAlerts: Array<{
    id: string;
    type: string;
    message: string;
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    createdAt: string;
  }>;
}

// GET /api/haccp/dashboard/stats - 대시보드 통계
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
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const companyId = userProfile.company_id;
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    const weekStart = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const monthStart = format(startOfMonth(today), 'yyyy-MM-dd');

    // 병렬로 모든 통계 조회
    const [
      hygieneResult,
      ccpRecordsResult,
      ccpDeviationsResult,
      lowStockResult,
      pendingInspectionsResult,
      productionResult,
      pestControlResult,
      verificationResult,
      sensorResult,
      alertsResult,
    ] = await Promise.all([
      // 1. 오늘 위생점검 현황
      supabase
        .from('daily_hygiene_checks')
        .select('id, shift')
        .eq('company_id', companyId)
        .eq('check_date', todayStr),

      // 2. 오늘 CCP 기록 수
      supabase
        .from('ccp_records')
        .select('id', { count: 'exact' })
        .eq('company_id', companyId)
        .eq('record_date', todayStr),

      // 3. CCP 이탈 (오늘 중 부적합 판정)
      supabase
        .from('ccp_records')
        .select('id', { count: 'exact' })
        .eq('company_id', companyId)
        .eq('record_date', todayStr)
        .eq('result', 'FAIL'),

      // 4. 재고 부족 원료 (안전재고 이하)
      supabase
        .from('material_stocks')
        .select('id', { count: 'exact' })
        .eq('company_id', companyId)
        .filter('current_balance', 'lte', 'safety_stock'),

      // 5. 입고검사 대기
      supabase
        .from('material_inspections')
        .select('id', { count: 'exact' })
        .eq('company_id', companyId)
        .eq('result', 'HOLD'),

      // 6. 오늘 생산 기록
      supabase
        .from('production_records')
        .select('id', { count: 'exact' })
        .eq('company_id', companyId)
        .eq('production_date', todayStr),

      // 7. 금주 방충방서 점검
      supabase
        .from('pest_control_checks')
        .select('id, check_date')
        .eq('company_id', companyId)
        .gte('check_date', weekStart)
        .order('check_date', { ascending: false })
        .limit(1),

      // 8. 이번달 CCP 검증 현황
      Promise.all([
        supabase
          .from('ccp_definitions')
          .select('id', { count: 'exact' })
          .eq('company_id', companyId)
          .eq('is_active', true),
        supabase
          .from('ccp_verifications')
          .select('id', { count: 'exact' })
          .eq('company_id', companyId)
          .gte('verification_date', monthStart),
      ]),

      // 9. IoT 센서 현황
      supabase
        .from('iot_sensors')
        .select('id, status')
        .eq('company_id', companyId)
        .eq('is_active', true),

      // 10. 최근 알림 (24시간 내 중요 알림)
      supabase
        .from('notifications')
        .select('id, title, body, priority, created_at, category')
        .eq('category', 'HACCP')
        .in('priority', ['HIGH', 'CRITICAL'])
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    // 위생점검 완료 수 계산 (3교대 기준)
    const completedShifts = new Set(hygieneResult.data?.map(h => h.shift) || []);
    const totalShifts = 3; // 오전, 오후, 야간

    // CCP 정의 수와 검증 수
    const [ccpDefsResult, ccpVerificationsResult] = verificationResult;
    const totalCcpDefs = ccpDefsResult.count || 0;
    const completedVerifications = ccpVerificationsResult.count || 0;

    // 센서 상태 계산
    const sensors = sensorResult.data || [];
    const onlineSensors = sensors.filter(s => s.status === 'ONLINE').length;
    const offlineSensors = sensors.filter(s => s.status === 'OFFLINE').length;

    // 최근 알림 포맷팅
    const recentAlerts = (alertsResult.data || []).map(alert => ({
      id: alert.id,
      type: alert.category,
      message: alert.title,
      severity: alert.priority as 'HIGH' | 'MEDIUM' | 'LOW',
      createdAt: alert.created_at,
    }));

    const stats: DashboardStats = {
      todayHygieneChecks: {
        completed: completedShifts.size,
        total: totalShifts,
      },
      pendingCcpRecords: Math.max(0, totalCcpDefs * 3 - (ccpRecordsResult.count || 0)), // 예상 필요 기록 수
      lowStockMaterials: lowStockResult.count || 0,
      pendingInspections: pendingInspectionsResult.count || 0,
      todayProduction: productionResult.count || 0,
      ccpDeviations: ccpDeviationsResult.count || 0,
      todayCcpRecords: ccpRecordsResult.count || 0,
      weeklyPestControl: {
        completed: (pestControlResult.data?.length || 0) > 0,
        lastCheck: pestControlResult.data?.[0]?.check_date || null,
      },
      monthlyVerification: {
        completed: completedVerifications,
        total: totalCcpDefs,
      },
      sensorStatus: {
        total: sensors.length,
        online: onlineSensors,
        offline: offlineSensors,
      },
      recentAlerts,
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
