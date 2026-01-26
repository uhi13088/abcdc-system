/**
 * 센서 데이터 → CCP 기록 자동 변환 Cron Job
 * IoT 센서 읽기값을 CCP 모니터링 기록으로 자동 변환
 *
 * 실행 주기: 매시간 (정시)
 */

import { NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { format, subHours } from 'date-fns';
import { logger } from '@abc/shared';

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

export const dynamic = 'force-dynamic';

interface SensorReading {
  id: string;
  sensor_id: string;
  reading_value: number;
  reading_unit: string;
  is_within_limit: boolean;
  recorded_at: string;
}

interface SensorWithCcp {
  id: string;
  sensor_name: string;
  company_id: string;
  ccp_definition_id: string;
  calibration_offset: number;
  ccp_definitions: {
    id: string;
    ccp_number: string;
    process: string;
    critical_limit: {
      min?: number;
      max?: number;
      unit?: string;
    };
  };
}

export async function GET() {
  try {
    const now = new Date();
    const oneHourAgo = subHours(now, 1);

    logger.log(`[Sensor to CCP] Running at ${format(now, 'yyyy-MM-dd HH:mm:ss')}`);

    const results: { company_id: string; records_created: number; deviations: number }[] = [];

    // CCP에 연결된 활성 센서 조회
    const { data: sensors } = await getSupabase()
      .from('iot_sensors')
      .select(`
        id,
        sensor_name,
        company_id,
        ccp_definition_id,
        calibration_offset,
        ccp_definitions!inner(
          id,
          ccp_number,
          process,
          critical_limit
        )
      `)
      .eq('is_active', true)
      .not('ccp_definition_id', 'is', null) as { data: SensorWithCcp[] | null };

    if (!sensors || sensors.length === 0) {
      logger.log('[Sensor to CCP] No sensors linked to CCP definitions');
      return NextResponse.json({
        success: true,
        timestamp: now.toISOString(),
        message: 'No sensors linked to CCP',
        results: [],
      });
    }

    // 센서별로 최근 1시간 데이터 처리
    for (const sensor of sensors) {
      const result = await processSensorReadings(sensor, oneHourAgo, now);
      if (result.records_created > 0) {
        results.push({
          company_id: sensor.company_id,
          records_created: result.records_created,
          deviations: result.deviations,
        });
      }
    }

    logger.log(`[Sensor to CCP] Completed:`, results);

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      results,
    });
  } catch (error) {
    console.error('[Sensor to CCP] Error:', error);
    return NextResponse.json(
      { error: 'Sensor to CCP conversion failed' },
      { status: 500 }
    );
  }
}

/**
 * 센서 읽기값을 CCP 기록으로 변환
 */
async function processSensorReadings(
  sensor: SensorWithCcp,
  fromTime: Date,
  toTime: Date
): Promise<{ records_created: number; deviations: number }> {
  const supabase = getSupabase();

  // 센서의 최근 1시간 데이터 조회
  const { data: readings } = await supabase
    .from('sensor_readings')
    .select('id, sensor_id, reading_value, reading_unit, is_within_limit, recorded_at')
    .eq('sensor_id', sensor.id)
    .gte('recorded_at', fromTime.toISOString())
    .lt('recorded_at', toTime.toISOString())
    .order('recorded_at', { ascending: true }) as { data: SensorReading[] | null };

  if (!readings || readings.length === 0) {
    return { records_created: 0, deviations: 0 };
  }

  // 대표값 계산 (1시간 평균 또는 마지막 값)
  const avgValue = readings.reduce((sum, r) => sum + r.reading_value, 0) / readings.length;
  const lastReading = readings[readings.length - 1];
  const calibratedValue = avgValue + (sensor.calibration_offset || 0);

  // 한계기준 판정
  const criticalLimit = sensor.ccp_definitions.critical_limit || {};
  let isWithinLimit = true;

  if (criticalLimit.min !== undefined && calibratedValue < criticalLimit.min) {
    isWithinLimit = false;
  }
  if (criticalLimit.max !== undefined && calibratedValue > criticalLimit.max) {
    isWithinLimit = false;
  }

  // 이미 같은 시간대에 기록이 있는지 확인
  const recordDate = format(toTime, 'yyyy-MM-dd');
  const recordTime = format(toTime, 'HH:00:00'); // 정시로 기록

  const { data: existingRecord } = await supabase
    .from('ccp_records')
    .select('id')
    .eq('company_id', sensor.company_id)
    .eq('ccp_id', sensor.ccp_definition_id)
    .eq('record_date', recordDate)
    .eq('record_time', recordTime)
    .maybeSingle();

  if (existingRecord) {
    // 이미 해당 시간대 기록 존재
    return { records_created: 0, deviations: 0 };
  }

  // CCP 기록 생성
  const measurement = {
    value: Math.round(calibratedValue * 10) / 10,
    unit: lastReading.reading_unit || criticalLimit.unit || '°C',
    source: 'IOT_SENSOR',
    sensor_id: sensor.id,
    sensor_name: sensor.sensor_name,
    readings_count: readings.length,
    avg_value: Math.round(avgValue * 10) / 10,
  };

  const { data: ccpRecord, error } = await supabase
    .from('ccp_records')
    .insert({
      company_id: sensor.company_id,
      ccp_id: sensor.ccp_definition_id,
      record_date: recordDate,
      record_time: recordTime,
      measurement,
      is_within_limit: isWithinLimit,
      deviation_action: isWithinLimit ? null : '센서 자동 감지 - 확인 필요',
    })
    .select()
    .single();

  if (error) {
    console.error(`[Sensor to CCP] Failed to create CCP record for sensor ${sensor.id}:`, error);
    return { records_created: 0, deviations: 0 };
  }

  let deviations = 0;

  // 이탈 발생 시 개선조치 자동 생성
  if (!isWithinLimit) {
    deviations = 1;

    const problemDesc = `[${sensor.ccp_definitions.ccp_number}] ${sensor.ccp_definitions.process} 한계기준 이탈 (센서 자동 감지)\n` +
      `센서: ${sensor.sensor_name}\n` +
      `측정값: ${measurement.value}${measurement.unit}\n` +
      `한계기준: ${criticalLimit.min !== undefined ? criticalLimit.min : ''} ~ ${criticalLimit.max !== undefined ? criticalLimit.max : ''} ${criticalLimit.unit || ''}`;

    // 개선조치 생성
    const actionNumber = `CA-${format(toTime, 'yyyyMMdd')}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

    const { data: correctiveAction } = await supabase
      .from('corrective_actions')
      .insert({
        company_id: sensor.company_id,
        action_number: actionNumber,
        action_date: recordDate,
        source_type: 'CCP',
        source_id: ccpRecord.id,
        problem_description: problemDesc,
        immediate_action: '센서 자동 감지 - 현장 확인 필요',
        corrective_action: '',
        due_date: format(new Date(toTime.getTime() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
        status: 'OPEN',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (correctiveAction) {
      // CCP 기록에 개선조치 연결
      await supabase
        .from('ccp_records')
        .update({ corrective_action_id: correctiveAction.id })
        .eq('id', ccpRecord.id);

      // 관리자에게 긴급 알림
      const { data: managers } = await supabase
        .from('users')
        .select('id')
        .eq('company_id', sensor.company_id)
        .in('role', ['HACCP_MANAGER', 'COMPANY_ADMIN', 'STORE_MANAGER']);

      for (const manager of managers || []) {
        await supabase.from('notifications').insert({
          user_id: manager.id,
          category: 'HACCP',
          priority: 'CRITICAL',
          title: `CCP 이탈 감지 (${sensor.ccp_definitions.ccp_number})`,
          body: `${sensor.sensor_name}: ${measurement.value}${measurement.unit} (기준 초과)`,
          deep_link: `/ccp/records?ccp_id=${sensor.ccp_definition_id}`,
        });
      }
    }

    logger.log(`[Sensor to CCP] Deviation detected - Sensor: ${sensor.sensor_name}, Value: ${measurement.value}`);
  }

  return { records_created: 1, deviations };
}
