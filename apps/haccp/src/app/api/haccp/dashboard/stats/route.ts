import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient, createAdminClient } from '@/lib/supabase/server';
import { format, startOfWeek } from 'date-fns';

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
export async function GET(_request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await adminClient
      .from('users')
      .select('company_id, store_id, current_store_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const companyId = userProfile.company_id;
    const currentStoreId = userProfile.current_store_id || userProfile.store_id;
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    const weekStart = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');

    // 쿼리 빌더 헬퍼 - store_id 조건 추가
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const addStoreFilter = (query: any) => {
      if (currentStoreId) {
        return query.eq('store_id', currentStoreId);
      }
      return query;
    };

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
      addStoreFilter(
        adminClient
          .from('daily_hygiene_checks')
          .select('id, shift')
          .eq('company_id', companyId)
          .eq('check_date', todayStr)
      ),

      // 2. 오늘 CCP 기록 수
      addStoreFilter(
        adminClient
          .from('ccp_records')
          .select('id', { count: 'exact' })
          .eq('company_id', companyId)
          .eq('record_date', todayStr)
      ),

      // 3. CCP 이탈 (오늘 중 한계기준 이탈)
      addStoreFilter(
        adminClient
          .from('ccp_records')
          .select('id', { count: 'exact' })
          .eq('company_id', companyId)
          .eq('record_date', todayStr)
          .eq('is_within_limit', false)
      ),

      // 4. 재고 부족 원료 (재고가 0 이하인 것)
      addStoreFilter(
        adminClient
          .from('material_stocks')
          .select('id, quantity')
          .eq('company_id', companyId)
          .eq('status', 'AVAILABLE')
      ),

      // 5. 입고검사 대기 (CONDITIONAL 상태)
      addStoreFilter(
        adminClient
          .from('material_inspections')
          .select('id', { count: 'exact' })
          .eq('company_id', companyId)
          .eq('overall_result', 'CONDITIONAL')
      ),

      // 6. 오늘 생산 기록
      addStoreFilter(
        adminClient
          .from('production_records')
          .select('id', { count: 'exact' })
          .eq('company_id', companyId)
          .eq('production_date', todayStr)
      ),

      // 7. 금주 방충방서 점검
      addStoreFilter(
        adminClient
          .from('pest_control_checks')
          .select('id, check_date')
          .eq('company_id', companyId)
          .gte('check_date', weekStart)
      ).order('check_date', { ascending: false }).limit(1),

      // 8. 이번달 CCP 검증 현황
      Promise.all([
        addStoreFilter(
          adminClient
            .from('ccp_definitions')
            .select('id', { count: 'exact' })
            .eq('company_id', companyId)
            .eq('status', 'ACTIVE')
        ),
        addStoreFilter(
          adminClient
            .from('ccp_verifications')
            .select('id', { count: 'exact' })
            .eq('company_id', companyId)
            .eq('verification_year', today.getFullYear())
            .eq('verification_month', today.getMonth() + 1)
        ),
      ]),

      // 9. IoT 센서 현황
      addStoreFilter(
        adminClient
          .from('iot_sensors')
          .select('id, status')
          .eq('company_id', companyId)
          .eq('is_active', true)
      ),

      // 10. 최근 알림 (24시간 내 중요 알림)
      adminClient
        .from('notifications')
        .select('id, title, body, priority, created_at, category')
        .eq('category', 'HACCP')
        .in('priority', ['HIGH', 'CRITICAL'])
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    // 위생점검 완료 수 계산 (3교대 기준)
    const completedShifts = new Set(hygieneResult.data?.map((h: { shift: string }) => h.shift) || []);
    const totalShifts = 3; // 오전, 오후, 야간

    // CCP 정의 수와 검증 수
    const [ccpDefsResult, ccpVerificationsResult] = verificationResult;
    const totalCcpDefs = ccpDefsResult.count || 0;
    const completedVerifications = ccpVerificationsResult.count || 0;

    // 센서 상태 계산
    const sensors = sensorResult.data || [];
    const onlineSensors = sensors.filter((s: { status: string }) => s.status === 'ONLINE').length;
    const offlineSensors = sensors.filter((s: { status: string }) => s.status === 'OFFLINE').length;

    // 최근 알림 포맷팅
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recentAlerts = (alertsResult.data || []).map((alert: any) => ({
      id: alert.id,
      type: alert.category,
      message: alert.title,
      severity: alert.priority as 'HIGH' | 'MEDIUM' | 'LOW',
      createdAt: alert.created_at,
    }));

    // 재고 부족 계산 (quantity <= 0)
    const lowStockCount = (lowStockResult.data || []).filter(
      (s: { quantity: number }) => s.quantity <= 0
    ).length;

    const stats: DashboardStats = {
      todayHygieneChecks: {
        completed: completedShifts.size,
        total: totalShifts,
      },
      pendingCcpRecords: Math.max(0, totalCcpDefs * 3 - (ccpRecordsResult.count || 0)), // 예상 필요 기록 수
      lowStockMaterials: lowStockCount,
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
