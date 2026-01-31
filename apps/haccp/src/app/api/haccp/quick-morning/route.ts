/**
 * Quick Morning Check API
 * 원클릭 하루 시작 - 출근 후 필요한 모든 점검을 한 번에 생성
 *
 * 생성되는 기록:
 * 1. 위생점검 (작업전)
 * 2. 저장소 온도 점검 (냉동창고, 냉장고 등)
 * 3. CCP 초기 점검 (각 CCP 포인트)
 * 4. 장비 온도 기록
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient, createAdminClient } from '@/lib/supabase/server';

interface MorningCheckResult {
  hygiene_pre_work: boolean;
  storage_inspections: number;
  ccp_records: number;
  equipment_temps: number;
  errors: string[];
}

// 위생점검 기본 데이터 (작업전 - 모두 정상)
const HYGIENE_PRE_WORK_CHECKS = {
  work_clothes_clean: true,
  hand_wash_sanitize: true,
  entrance_sanitize: true,
  equipment_hygiene: true,
  floor_drain_clean: true,
  cross_contamination: true,
  ingredients_check: true,
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
      .select('id, name, company_id, store_id, current_store_id')
      .eq('auth_id', user.id)
      .single();

    if (!userProfile || !userProfile.company_id) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // 현재 선택된 매장
    const currentStoreId = userProfile.current_store_id || userProfile.store_id;

    const body = await request.json();
    const checkDate = body.check_date || new Date().toISOString().split('T')[0];
    const skipExisting = body.skip_existing !== false;

    const result: MorningCheckResult = {
      hygiene_pre_work: false,
      storage_inspections: 0,
      ccp_records: 0,
      equipment_temps: 0,
      errors: [],
    };

    const currentTime = new Date().toTimeString().split(' ')[0].slice(0, 5);

    // ========================================
    // 1. 위생점검 (작업전) 생성
    // ========================================
    try {
      if (skipExisting) {
        let existingQuery = adminClient
          .from('hygiene_checks')
          .select('id')
          .eq('company_id', userProfile.company_id)
          .eq('check_date', checkDate)
          .eq('check_period', '작업전');

        if (currentStoreId) {
          existingQuery = existingQuery.eq('store_id', currentStoreId);
        }

        const { data: existing } = await existingQuery.limit(1);

        if (existing && existing.length > 0) {
          result.hygiene_pre_work = true;
        } else {
          const { error } = await adminClient
            .from('hygiene_checks')
            .insert({
              company_id: userProfile.company_id,
              store_id: currentStoreId || null,
              check_date: checkDate,
              check_period: '작업전',
              checked_by: userProfile.id,
              checked_by_name: userProfile.name,
              pre_work_checks: HYGIENE_PRE_WORK_CHECKS,
              during_work_checks: {},
              post_work_checks: {},
              temperature_records: {},
              overall_status: 'PASS',
              created_at: new Date().toISOString(),
            });

          if (error) {
            result.errors.push(`위생점검(작업전): ${error.message}`);
          } else {
            result.hygiene_pre_work = true;
          }
        }
      }
    } catch (e) {
      result.errors.push(`위생점검(작업전): ${String(e)}`);
    }

    // ========================================
    // 2. 저장소 점검 생성
    // ========================================
    for (const area of STORAGE_AREAS) {
      try {
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

    // ========================================
    // 3. CCP 기록 생성 (회사의 CCP 정의 기반)
    // ========================================
    try {
      // 회사의 활성 CCP 정의 조회
      let ccpDefQuery = adminClient
        .from('ccp_definitions')
        .select('id, ccp_number, process, critical_limit_min, critical_limit_max, target_value')
        .eq('company_id', userProfile.company_id)
        .eq('is_active', true);

      if (currentStoreId) {
        ccpDefQuery = ccpDefQuery.eq('store_id', currentStoreId);
      }

      const { data: ccpDefinitions } = await ccpDefQuery;

      if (ccpDefinitions && ccpDefinitions.length > 0) {
        for (const ccp of ccpDefinitions) {
          try {
            if (skipExisting) {
              let existingQuery = adminClient
                .from('ccp_records')
                .select('id')
                .eq('company_id', userProfile.company_id)
                .eq('ccp_id', ccp.id)
                .eq('record_date', checkDate);

              if (currentStoreId) {
                existingQuery = existingQuery.eq('store_id', currentStoreId);
              }

              const { data: existing } = await existingQuery.limit(1);

              if (existing && existing.length > 0) {
                result.ccp_records++;
                continue;
              }
            }

            // 정상값 (target_value 또는 중간값)
            const normalValue = ccp.target_value ||
              (ccp.critical_limit_min && ccp.critical_limit_max
                ? (ccp.critical_limit_min + ccp.critical_limit_max) / 2
                : null);

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
                created_at: new Date().toISOString(),
              });

            if (error) {
              result.errors.push(`CCP기록(${ccp.ccp_number}): ${error.message}`);
            } else {
              result.ccp_records++;
            }
          } catch (e) {
            result.errors.push(`CCP기록(${ccp.ccp_number}): ${String(e)}`);
          }
        }
      }
    } catch (e) {
      result.errors.push(`CCP 기록 생성 중 오류: ${String(e)}`);
    }

    // ========================================
    // 4. 장비 온도 기록 생성
    // ========================================
    for (const equip of EQUIPMENT_LOCATIONS) {
      try {
        if (skipExisting) {
          let existingQuery = adminClient
            .from('equipment_temperature_records')
            .select('id')
            .eq('company_id', userProfile.company_id)
            .eq('record_date', checkDate)
            .eq('equipment_location', equip.location);

          if (currentStoreId) {
            existingQuery = existingQuery.eq('store_id', currentStoreId);
          }

          const { data: existing } = await existingQuery.limit(1);

          if (existing && existing.length > 0) {
            result.equipment_temps++;
            continue;
          }
        }

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
            created_at: new Date().toISOString(),
          });

        if (error) {
          result.errors.push(`장비온도(${equip.location}): ${error.message}`);
        } else {
          result.equipment_temps++;
        }
      } catch (e) {
        result.errors.push(`장비온도(${equip.location}): ${String(e)}`);
      }
    }

    // 결과 반환
    const allSuccess = result.errors.length === 0;
    const totalCreated = (result.hygiene_pre_work ? 1 : 0) +
      result.storage_inspections +
      result.ccp_records +
      result.equipment_temps;

    const summary = {
      success: allSuccess,
      check_date: checkDate,
      check_time: currentTime,
      created_by: userProfile.name,
      total_created: totalCreated,
      result,
      message: allSuccess
        ? `하루 시작 점검이 완료되었습니다. (${totalCreated}건 생성)`
        : `일부 점검에서 오류가 발생했습니다. (${result.errors.length}건 오류)`,
    };

    return NextResponse.json(summary, { status: allSuccess ? 200 : 207 });
  } catch (error) {
    console.error('Quick morning check error:', error);
    return NextResponse.json(
      { error: 'Failed to create morning checks', details: String(error) },
      { status: 500 }
    );
  }
}

// 오늘의 아침 점검 현황 조회
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
      .select('id, company_id, store_id, current_store_id')
      .eq('auth_id', user.id)
      .single();

    if (!userProfile || !userProfile.company_id) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // 현재 선택된 매장
    const currentStoreId = userProfile.current_store_id || userProfile.store_id;

    const { searchParams } = new URL(request.url);
    const checkDate = searchParams.get('date') || new Date().toISOString().split('T')[0];

    // 위생점검 (작업전) 현황
    let hygieneQuery = adminClient
      .from('hygiene_checks')
      .select('id, overall_status, checked_by_name')
      .eq('company_id', userProfile.company_id)
      .eq('check_date', checkDate)
      .eq('check_period', '작업전');

    if (currentStoreId) {
      hygieneQuery = hygieneQuery.eq('store_id', currentStoreId);
    }

    const { data: hygieneCheck } = await hygieneQuery.single();

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

    // CCP 기록 현황
    let ccpRecordsQuery = adminClient
      .from('ccp_records')
      .select('ccp_id, is_within_limit')
      .eq('company_id', userProfile.company_id)
      .eq('record_date', checkDate);

    if (currentStoreId) {
      ccpRecordsQuery = ccpRecordsQuery.eq('store_id', currentStoreId);
    }

    const { data: ccpRecords } = await ccpRecordsQuery;

    // CCP 정의 수
    let ccpCountQuery = adminClient
      .from('ccp_definitions')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', userProfile.company_id)
      .eq('is_active', true);

    if (currentStoreId) {
      ccpCountQuery = ccpCountQuery.eq('store_id', currentStoreId);
    }

    const { count: ccpCount } = await ccpCountQuery;

    // 장비 온도 기록 현황
    let equipQuery = adminClient
      .from('equipment_temperature_records')
      .select('equipment_location, is_within_limit')
      .eq('company_id', userProfile.company_id)
      .eq('record_date', checkDate);

    if (currentStoreId) {
      equipQuery = equipQuery.eq('store_id', currentStoreId);
    }

    const { data: equipTemps } = await equipQuery;

    const storageStatus = STORAGE_AREAS.map(area => ({
      area: area.area,
      completed: storageChecks?.some(s => s.storage_area === area.area) || false,
      passed: storageChecks?.find(s => s.storage_area === area.area)?.overall_result === 'PASS',
    }));

    const allStorageComplete = storageStatus.every(s => s.completed);
    const allCcpComplete = ccpRecords ? ccpRecords.length >= (ccpCount || 0) : false;
    const allEquipComplete = equipTemps ? equipTemps.length >= EQUIPMENT_LOCATIONS.length : false;
    const allComplete = !!hygieneCheck && allStorageComplete && allCcpComplete && allEquipComplete;

    return NextResponse.json({
      check_date: checkDate,
      all_complete: allComplete,
      hygiene_pre_work: {
        complete: !!hygieneCheck,
        passed: hygieneCheck?.overall_status === 'PASS',
        checked_by: hygieneCheck?.checked_by_name,
      },
      storage: {
        complete: allStorageComplete,
        items: storageStatus,
      },
      ccp: {
        complete: allCcpComplete,
        total: ccpCount || 0,
        recorded: ccpRecords?.length || 0,
        all_normal: ccpRecords?.every(r => r.is_within_limit) || false,
      },
      equipment_temps: {
        complete: allEquipComplete,
        total: EQUIPMENT_LOCATIONS.length,
        recorded: equipTemps?.length || 0,
      },
    });
  } catch (error) {
    console.error('Failed to get morning check status:', error);
    return NextResponse.json(
      { error: 'Failed to get morning check status' },
      { status: 500 }
    );
  }
}
