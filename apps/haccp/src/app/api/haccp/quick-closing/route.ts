/**
 * Quick Closing Check API
 * 원클릭 마감 - 퇴근 전 필요한 모든 점검을 한 번에 생성
 *
 * 생성되는 기록:
 * 1. 위생점검 (작업후)
 * 2. 마감 저장소 온도 점검
 * 3. 마감 CCP 기록
 * 4. 마감 장비 온도 기록
 * 5. 일일 완료 체크 상태 업데이트
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient, createAdminClient } from '@/lib/supabase/server';

interface ClosingCheckResult {
  hygiene_post_work: boolean;
  storage_inspections: number;
  ccp_records: number;
  equipment_temps: number;
  daily_status_updated: boolean;
  errors: string[];
}

// 위생점검 기본 데이터 (작업후 - 모두 정상)
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

// 장비 온도 측정 위치
const EQUIPMENT_LOCATIONS = [
  { location: '냉동창고', default_temp: -20, target_temp: -18 },
  { location: '배합실 냉장고', default_temp: 5, target_temp: 10 },
  { location: '내포장실 냉장고', default_temp: 5, target_temp: 10 },
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
    const skipExisting = body.skip_existing !== false;

    const result: ClosingCheckResult = {
      hygiene_post_work: false,
      storage_inspections: 0,
      ccp_records: 0,
      equipment_temps: 0,
      daily_status_updated: false,
      errors: [],
    };

    const currentTime = new Date().toTimeString().split(' ')[0].slice(0, 5);

    // ========================================
    // 1. 위생점검 (작업후) 생성
    // ========================================
    try {
      if (skipExisting) {
        let existingQuery = adminClient
          .from('hygiene_checks')
          .select('id')
          .eq('company_id', userProfile.company_id)
          .eq('check_date', checkDate)
          .eq('check_period', '작업후');

        if (currentStoreId) {
          existingQuery = existingQuery.eq('store_id', currentStoreId);
        }

        const { data: existing } = await existingQuery.limit(1);

        if (existing && existing.length > 0) {
          result.hygiene_post_work = true;
        } else {
          const { error } = await adminClient
            .from('hygiene_checks')
            .insert({
              company_id: userProfile.company_id,
              store_id: currentStoreId || null,
              check_date: checkDate,
              check_period: '작업후',
              checked_by: userProfile.id,
              checked_by_name: userProfile.name,
              pre_work_checks: {},
              during_work_checks: {},
              post_work_checks: HYGIENE_POST_WORK_CHECKS,
              temperature_records: {},
              overall_status: 'PASS',
              created_at: new Date().toISOString(),
            });

          if (error) {
            result.errors.push(`위생점검(작업후): ${error.message}`);
          } else {
            result.hygiene_post_work = true;
          }
        }
      }
    } catch (e) {
      result.errors.push(`위생점검(작업후): ${String(e)}`);
    }

    // ========================================
    // 2. 마감 저장소 온도 점검 (2차 점검)
    // ========================================
    for (const area of STORAGE_AREAS) {
      try {
        // 마감 시간대 점검은 별도로 생성 (inspection_time으로 구분)
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
            notes: '마감 점검',
            created_at: new Date().toISOString(),
          });

        if (error) {
          // 중복 에러는 무시 (이미 마감 점검이 있을 수 있음)
          if (!error.message.includes('duplicate')) {
            result.errors.push(`마감 저장소점검(${area.area}): ${error.message}`);
          }
        } else {
          result.storage_inspections++;
        }
      } catch (e) {
        result.errors.push(`마감 저장소점검(${area.area}): ${String(e)}`);
      }
    }

    // ========================================
    // 3. 마감 CCP 기록 생성
    // ========================================
    try {
      let ccpQuery = adminClient
        .from('ccp_definitions')
        .select('id, ccp_number, process, critical_limit')
        .eq('company_id', userProfile.company_id)
        .eq('status', 'ACTIVE');

      if (currentStoreId) {
        ccpQuery = ccpQuery.eq('store_id', currentStoreId);
      }

      const { data: ccpDefinitions } = await ccpQuery;

      if (ccpDefinitions && ccpDefinitions.length > 0) {
        for (const ccp of ccpDefinitions) {
          try {
            // 정상값 (critical_limit의 중간값)
            const criticalLimit = ccp.critical_limit || {};
            const minVal = criticalLimit.min;
            const maxVal = criticalLimit.max;
            const normalValue = (minVal !== undefined && maxVal !== undefined)
              ? (minVal + maxVal) / 2
              : (minVal || maxVal || null);

            const { error } = await adminClient
              .from('ccp_records')
              .insert({
                company_id: userProfile.company_id,
                store_id: currentStoreId || null,
                ccp_id: ccp.id,
                record_date: checkDate,
                record_time: currentTime,
                measured_value: normalValue,
                is_within_limit: true,
                recorded_by: userProfile.id,
                recorded_by_name: userProfile.name,
                status: 'NORMAL',
                notes: '마감 점검',
                created_at: new Date().toISOString(),
              });

            if (error) {
              if (!error.message.includes('duplicate')) {
                result.errors.push(`마감 CCP기록(${ccp.ccp_number}): ${error.message}`);
              }
            } else {
              result.ccp_records++;
            }
          } catch (e) {
            result.errors.push(`마감 CCP기록(${ccp.ccp_number}): ${String(e)}`);
          }
        }
      }
    } catch (e) {
      result.errors.push(`마감 CCP 기록 생성 중 오류: ${String(e)}`);
    }

    // ========================================
    // 4. 마감 장비 온도 기록 생성
    // ========================================
    for (const equip of EQUIPMENT_LOCATIONS) {
      try {
        const isWithinLimit = equip.location.includes('냉동')
          ? equip.default_temp <= equip.target_temp + 3
          : equip.default_temp <= equip.target_temp + 5 && equip.default_temp >= 0;

        const { error } = await adminClient
          .from('equipment_temperature_records')
          .insert({
            company_id: userProfile.company_id,
            store_id: currentStoreId || null,
            record_date: checkDate,
            record_time: currentTime,
            equipment_location: equip.location,
            temperature: equip.default_temp,
            target_temperature: equip.target_temp,
            input_type: 'manual',
            is_within_limit: isWithinLimit,
            recorded_by: userProfile.id,
            notes: '마감 점검',
            created_at: new Date().toISOString(),
          });

        if (error) {
          if (!error.message.includes('duplicate')) {
            result.errors.push(`마감 장비온도(${equip.location}): ${error.message}`);
          }
        } else {
          result.equipment_temps++;
        }
      } catch (e) {
        result.errors.push(`마감 장비온도(${equip.location}): ${String(e)}`);
      }
    }

    // ========================================
    // 5. 일일 완료 상태 업데이트
    // ========================================
    try {
      // 오늘의 모든 점검 완료 여부 확인
      let hygieneCheckQuery = adminClient
        .from('hygiene_checks')
        .select('check_period')
        .eq('company_id', userProfile.company_id)
        .eq('check_date', checkDate);

      if (currentStoreId) {
        hygieneCheckQuery = hygieneCheckQuery.eq('store_id', currentStoreId);
      }

      const { data: hygieneChecks } = await hygieneCheckQuery;

      const allHygieneComplete = ['작업전', '작업중', '작업후'].every(
        period => hygieneChecks?.some(h => h.check_period === period)
      );

      let storageCheckQuery = adminClient
        .from('storage_inspections')
        .select('storage_area')
        .eq('company_id', userProfile.company_id)
        .eq('inspection_date', checkDate);

      if (currentStoreId) {
        storageCheckQuery = storageCheckQuery.eq('store_id', currentStoreId);
      }

      const { data: storageChecks } = await storageCheckQuery;

      const uniqueStorageAreas = new Set(storageChecks?.map(s => s.storage_area) || []);
      const allStorageComplete = STORAGE_AREAS.every(area => uniqueStorageAreas.has(area.area));

      if (allHygieneComplete && allStorageComplete) {
        // haccp_check_status 업데이트
        await adminClient
          .from('haccp_check_status')
          .upsert({
            company_id: userProfile.company_id,
            store_id: currentStoreId || null,
            check_date: checkDate,
            check_type: 'DAILY_COMPLETE',
            is_completed: true,
            completed_at: new Date().toISOString(),
            completed_by: userProfile.id,
            notes: '원클릭 마감으로 완료',
          }, { onConflict: 'company_id,check_date,check_type' });

        result.daily_status_updated = true;
      }
    } catch (e) {
      // 일일 상태 업데이트 실패는 치명적이지 않음
      console.error('Failed to update daily status:', e);
    }

    // 결과 반환
    const allSuccess = result.errors.length === 0;
    const totalCreated = (result.hygiene_post_work ? 1 : 0) +
      result.storage_inspections +
      result.ccp_records +
      result.equipment_temps;

    const summary = {
      success: allSuccess,
      check_date: checkDate,
      check_time: currentTime,
      created_by: userProfile.name,
      total_created: totalCreated,
      daily_complete: result.daily_status_updated,
      result,
      message: allSuccess
        ? `마감 점검이 완료되었습니다. (${totalCreated}건 생성)${result.daily_status_updated ? ' 오늘의 모든 점검이 완료되었습니다!' : ''}`
        : `일부 점검에서 오류가 발생했습니다. (${result.errors.length}건 오류)`,
    };

    return NextResponse.json(summary, { status: allSuccess ? 200 : 207 });
  } catch (error) {
    console.error('Quick closing check error:', error);
    return NextResponse.json(
      { error: 'Failed to create closing checks', details: String(error) },
      { status: 500 }
    );
  }
}

// 오늘의 마감 점검 현황 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    // 위생점검 (작업후) 현황
    let hygieneQuery = adminClient
      .from('hygiene_checks')
      .select('id, overall_status, checked_by_name')
      .eq('company_id', userProfile.company_id)
      .eq('check_date', checkDate)
      .eq('check_period', '작업후');

    if (currentStoreId) {
      hygieneQuery = hygieneQuery.eq('store_id', currentStoreId);
    }

    const { data: hygieneCheck } = await hygieneQuery.single();

    // 전체 위생점검 현황
    let allHygieneQuery = adminClient
      .from('hygiene_checks')
      .select('check_period, overall_status')
      .eq('company_id', userProfile.company_id)
      .eq('check_date', checkDate);

    if (currentStoreId) {
      allHygieneQuery = allHygieneQuery.eq('store_id', currentStoreId);
    }

    const { data: allHygieneChecks } = await allHygieneQuery;

    const hygieneStatus = {
      pre_work: allHygieneChecks?.some(h => h.check_period === '작업전'),
      during_work: allHygieneChecks?.some(h => h.check_period === '작업중'),
      post_work: allHygieneChecks?.some(h => h.check_period === '작업후'),
    };

    // 일일 완료 상태
    let dailyStatusQuery = adminClient
      .from('haccp_check_status')
      .select('is_completed, completed_at')
      .eq('company_id', userProfile.company_id)
      .eq('check_date', checkDate)
      .eq('check_type', 'DAILY_COMPLETE');

    if (currentStoreId) {
      dailyStatusQuery = dailyStatusQuery.eq('store_id', currentStoreId);
    }

    const { data: dailyStatus } = await dailyStatusQuery.single();

    const allComplete = hygieneStatus.pre_work && hygieneStatus.during_work && hygieneStatus.post_work;

    return NextResponse.json({
      check_date: checkDate,
      closing_complete: !!hygieneCheck,
      all_hygiene_complete: allComplete,
      hygiene_status: hygieneStatus,
      daily_complete: dailyStatus?.is_completed || false,
      daily_completed_at: dailyStatus?.completed_at,
      can_close: hygieneStatus.pre_work && hygieneStatus.during_work, // 작업전/중이 완료되어야 마감 가능
    });
  } catch (error) {
    console.error('Failed to get closing check status:', error);
    return NextResponse.json(
      { error: 'Failed to get closing check status' },
      { status: 500 }
    );
  }
}
