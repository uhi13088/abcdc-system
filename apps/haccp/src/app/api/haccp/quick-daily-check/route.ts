/**
 * Quick Daily Check API
 * 원클릭 일일점검 완료 - 모든 일일 점검을 정상값으로 한번에 생성
 *
 * 생성되는 기록:
 * 1. 위생점검 (작업전, 작업중, 작업후)
 * 2. 저장소 온도 점검
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient, createAdminClient } from '@/lib/supabase/server';

interface DailyCheckResult {
  hygiene: {
    pre_work: boolean;
    during_work: boolean;
    post_work: boolean;
  };
  storage_inspections: number;
  errors: string[];
}

// 위생점검 기본 데이터 (모두 정상)
const HYGIENE_PRE_WORK_CHECKS = {
  work_clothes_clean: true,
  hand_wash_sanitize: true,
  entrance_sanitize: true,
  equipment_hygiene: true,
  floor_drain_clean: true,
  cross_contamination: true,
  ingredients_check: true,
};

const HYGIENE_DURING_WORK_CHECKS = {
  thaw_water_temp: true,
  foreign_matter_sort: true,
  environment_temp_humidity: true,
};

const HYGIENE_POST_WORK_CHECKS = {
  facility_equipment_clean: true,
  cooking_tools_sanitize: true,
  floor_drain_disinfect: true,
  waste_disposal: true,
  window_close: true,
};

// 저장소 점검 기본 데이터
const STORAGE_AREAS = [
  { area: '냉동창고', type: 'FREEZER', temp_min: -25, temp_max: -18, default_temp: -20 },
  { area: '배합실 냉장고', type: 'REFRIGERATOR', temp_min: 0, temp_max: 10, default_temp: 5 },
  { area: '내포장실 냉장고', type: 'REFRIGERATOR', temp_min: 0, temp_max: 10, default_temp: 5 },
];

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: userProfile } = await adminClient
      .from('users')
      .select('id, name, company_id, store_id, current_store_id, current_haccp_store_id')
      .eq('auth_id', user.id)
      .single();

    if (!userProfile || !userProfile.company_id) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // 현재 선택된 매장
    const currentStoreId = userProfile.current_haccp_store_id || userProfile.current_store_id || userProfile.store_id;

    const body = await request.json();
    const checkDate = body.check_date || new Date().toISOString().split('T')[0];
    const skipExisting = body.skip_existing !== false; // 기본값: 기존 기록 있으면 스킵

    const result: DailyCheckResult = {
      hygiene: {
        pre_work: false,
        during_work: false,
        post_work: false,
      },
      storage_inspections: 0,
      errors: [],
    };

    // ========================================
    // 1. 위생점검 생성 (작업전, 작업중, 작업후)
    // ========================================
    const hygieneChecks = [
      { period: '작업전', checks: { pre_work_checks: HYGIENE_PRE_WORK_CHECKS, during_work_checks: {}, post_work_checks: {} } },
      { period: '작업중', checks: { pre_work_checks: {}, during_work_checks: HYGIENE_DURING_WORK_CHECKS, post_work_checks: {} } },
      { period: '작업후', checks: { pre_work_checks: {}, during_work_checks: {}, post_work_checks: HYGIENE_POST_WORK_CHECKS } },
    ];

    for (const check of hygieneChecks) {
      try {
        // 기존 기록 확인
        if (skipExisting) {
          let existingQuery = adminClient
            .from('hygiene_checks')
            .select('id')
            .eq('company_id', userProfile.company_id)
            .eq('check_date', checkDate)
            .eq('check_period', check.period);

          if (currentStoreId) {
            existingQuery = existingQuery.eq('store_id', currentStoreId);
          }

          const { data: existing } = await existingQuery.limit(1);

          if (existing && existing.length > 0) {
            result.hygiene[check.period === '작업전' ? 'pre_work' : check.period === '작업중' ? 'during_work' : 'post_work'] = true;
            continue;
          }
        }

        // 새 기록 생성
        const { error } = await adminClient
          .from('hygiene_checks')
          .insert({
            company_id: userProfile.company_id,
            store_id: currentStoreId || null,
            check_date: checkDate,
            check_period: check.period,
            checked_by: userProfile.id,
            checked_by_name: userProfile.name,
            ...check.checks,
            temperature_records: {},
            overall_status: 'PASS',
            created_at: new Date().toISOString(),
          });

        if (error) {
          result.errors.push(`위생점검(${check.period}): ${error.message}`);
        } else {
          result.hygiene[check.period === '작업전' ? 'pre_work' : check.period === '작업중' ? 'during_work' : 'post_work'] = true;
        }
      } catch (e) {
        result.errors.push(`위생점검(${check.period}): ${String(e)}`);
      }
    }

    // ========================================
    // 2. 저장소 점검 생성
    // ========================================
    const currentTime = new Date().toTimeString().split(' ')[0].slice(0, 5);

    for (const area of STORAGE_AREAS) {
      try {
        // 기존 기록 확인
        if (skipExisting) {
          let existingQuery = adminClient
            .from('storage_inspections')
            .select('id')
            .eq('company_id', userProfile.company_id)
            .eq('inspection_date', checkDate)
            .eq('storage_area', area.area);

          if (currentStoreId) {
            existingQuery = existingQuery.eq('store_id', currentStoreId);
          }

          const { data: existing } = await existingQuery.limit(1);

          if (existing && existing.length > 0) {
            result.storage_inspections++;
            continue;
          }
        }

        // 새 기록 생성
        const { error } = await adminClient
          .from('storage_inspections')
          .insert({
            company_id: userProfile.company_id,
            store_id: currentStoreId || null,
            inspection_date: checkDate,
            inspection_time: currentTime,
            storage_area: area.area,
            storage_type: area.type,
            temperature: area.default_temp,
            temperature_unit: '°C',
            temperature_min: area.temp_min,
            temperature_max: area.temp_max,
            temperature_result: 'PASS',
            cleanliness_check: true,
            organization_check: true,
            pest_check: false,
            damage_check: false,
            labeling_check: true,
            fifo_check: true,
            overall_result: 'PASS',
            inspected_by: userProfile.id,
            inspected_by_name: userProfile.name,
            created_at: new Date().toISOString(),
          });

        if (error) {
          result.errors.push(`저장소점검(${area.area}): ${error.message}`);
        } else {
          result.storage_inspections++;
        }
      } catch (e) {
        result.errors.push(`저장소점검(${area.area}): ${String(e)}`);
      }
    }

    // 결과 반환
    const allSuccess = result.errors.length === 0;
    const summary = {
      success: allSuccess,
      check_date: checkDate,
      created_by: userProfile.name,
      result,
      message: allSuccess
        ? '모든 일일점검이 완료되었습니다.'
        : `일부 점검에서 오류가 발생했습니다. (${result.errors.length}건)`,
    };

    return NextResponse.json(summary, { status: allSuccess ? 200 : 207 });
  } catch (error) {
    console.error('Quick daily check error:', error);
    return NextResponse.json(
      { error: 'Failed to create daily checks', details: String(error) },
      { status: 500 }
    );
  }
}

// 오늘의 일일점검 현황 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: userProfile } = await adminClient
      .from('users')
      .select('id, company_id, store_id, current_store_id, current_haccp_store_id')
      .eq('auth_id', user.id)
      .single();

    if (!userProfile || !userProfile.company_id) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // 현재 선택된 매장
    const currentStoreId = userProfile.current_haccp_store_id || userProfile.current_store_id || userProfile.store_id;

    const { searchParams } = new URL(request.url);
    const checkDate = searchParams.get('date') || new Date().toISOString().split('T')[0];

    // 위생점검 현황
    let hygieneQuery = adminClient
      .from('hygiene_checks')
      .select('check_period, overall_status')
      .eq('company_id', userProfile.company_id)
      .eq('check_date', checkDate);

    if (currentStoreId) {
      hygieneQuery = hygieneQuery.eq('store_id', currentStoreId);
    }

    const { data: hygieneChecks } = await hygieneQuery;

    // 저장소 점검 현황
    let storageQuery = adminClient
      .from('storage_inspections')
      .select('storage_area, overall_result')
      .eq('company_id', userProfile.company_id)
      .eq('inspection_date', checkDate);

    if (currentStoreId) {
      storageQuery = storageQuery.eq('store_id', currentStoreId);
    }

    const { data: storageChecks } = await storageQuery;

    const hygienePeriods = ['작업전', '작업중', '작업후'];
    const hygieneStatus = hygienePeriods.map(period => ({
      period,
      completed: hygieneChecks?.some(h => h.check_period === period) || false,
      passed: hygieneChecks?.find(h => h.check_period === period)?.overall_status === 'PASS',
    }));

    const storageStatus = STORAGE_AREAS.map(area => ({
      area: area.area,
      completed: storageChecks?.some(s => s.storage_area === area.area) || false,
      passed: storageChecks?.find(s => s.storage_area === area.area)?.overall_result === 'PASS',
    }));

    const allHygieneComplete = hygieneStatus.every(h => h.completed);
    const allStorageComplete = storageStatus.every(s => s.completed);
    const allComplete = allHygieneComplete && allStorageComplete;

    return NextResponse.json({
      check_date: checkDate,
      all_complete: allComplete,
      hygiene: {
        complete: allHygieneComplete,
        items: hygieneStatus,
      },
      storage: {
        complete: allStorageComplete,
        items: storageStatus,
      },
    });
  } catch (error) {
    console.error('Failed to get daily check status:', error);
    return NextResponse.json(
      { error: 'Failed to get daily check status' },
      { status: 500 }
    );
  }
}
