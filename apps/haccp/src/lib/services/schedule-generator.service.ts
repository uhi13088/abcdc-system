/**
 * 스케줄 자동 생성 서비스
 * 계약서 기반 스케줄 생성 및 관리
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { format, addDays, parseISO } from 'date-fns';

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

export interface WorkSchedule {
  daysOfWeek: number[]; // 0-6 (일-토)
  startTime: string;    // "09:00"
  endTime: string;      // "18:00"
  breakMinutes: number;
  effectiveFrom?: string;
}

export interface GeneratedSchedule {
  staff_id: string;
  company_id: string;
  brand_id: string;
  store_id: string;
  work_date: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  status: string;
  generated_by: 'CONTRACT' | 'MANUAL' | 'AI';
  position?: string;
  notes?: string;
}

export interface GenerationResult {
  success: boolean;
  schedulesCreated: number;
  schedulesUpdated: number;
  schedulesSkipped: number;
  errors: Array<{ date: string; error: string }>;
}

export class ScheduleGeneratorService {
  /**
   * 계약서 기반 스케줄 생성
   */
  async generateFromContract(
    contractId: string,
    startDate: Date,
    endDate: Date,
    options: {
      skipExisting?: boolean;
      skipHolidays?: boolean;
      includeNotes?: boolean;
    } = {}
  ): Promise<GenerationResult> {
    const { skipExisting = true, skipHolidays = true } = options;

    // 계약서 조회
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select('*')
      .eq('id', contractId)
      .single();

    if (contractError || !contract) {
      throw new Error('Contract not found');
    }

    if (contract.status !== 'ACTIVE') {
      throw new Error('Contract is not active');
    }

    const workSchedules: WorkSchedule[] = contract.work_schedules || [];

    if (workSchedules.length === 0) {
      throw new Error('No work schedules defined in contract');
    }

    const result: GenerationResult = {
      success: true,
      schedulesCreated: 0,
      schedulesUpdated: 0,
      schedulesSkipped: 0,
      errors: [],
    };

    const schedulesToInsert: GeneratedSchedule[] = [];
    let currentDate = new Date(startDate);

    // 공휴일 목록 조회 (한국 공휴일)
    const holidays = skipHolidays ? await this.getHolidays(startDate, endDate) : [];

    while (currentDate <= endDate) {
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      const dayOfWeek = currentDate.getDay();

      // 공휴일 체크
      if (skipHolidays && holidays.includes(dateStr)) {
        result.schedulesSkipped++;
        currentDate = addDays(currentDate, 1);
        continue;
      }

      // 해당 요일의 근무 스케줄 찾기
      for (const ws of workSchedules) {
        if (ws.daysOfWeek.includes(dayOfWeek)) {
          // effectiveFrom 체크
          if (ws.effectiveFrom && parseISO(ws.effectiveFrom) > currentDate) {
            continue;
          }

          // 기존 스케줄 체크
          if (skipExisting) {
            const { data: existing } = await supabase
              .from('schedules')
              .select('id')
              .eq('staff_id', contract.staff_id)
              .eq('work_date', dateStr)
              .maybeSingle();

            if (existing) {
              result.schedulesSkipped++;
              continue;
            }
          }

          schedulesToInsert.push({
            staff_id: contract.staff_id,
            company_id: contract.company_id,
            brand_id: contract.brand_id,
            store_id: contract.store_id,
            work_date: dateStr,
            start_time: `${dateStr}T${ws.startTime}:00`,
            end_time: `${dateStr}T${ws.endTime}:00`,
            break_minutes: ws.breakMinutes,
            status: 'SCHEDULED',
            generated_by: 'CONTRACT',
            position: contract.position,
          });
        }
      }

      currentDate = addDays(currentDate, 1);
    }

    // 일괄 삽입
    if (schedulesToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('schedules')
        .insert(schedulesToInsert);

      if (insertError) {
        result.success = false;
        result.errors.push({ date: 'bulk', error: insertError.message });
      } else {
        result.schedulesCreated = schedulesToInsert.length;
      }
    }

    // 생성 로그 저장
    await supabase.from('schedule_generation_logs').insert({
      company_id: contract.company_id,
      start_date: format(startDate, 'yyyy-MM-dd'),
      end_date: format(endDate, 'yyyy-MM-dd'),
      generation_source: 'CONTRACT',
      contract_id: contractId,
      schedules_created: result.schedulesCreated,
      schedules_updated: result.schedulesUpdated,
      schedules_deleted: 0,
      status: result.success ? 'SUCCESS' : 'PARTIAL',
      error_message: result.errors.length > 0 ? JSON.stringify(result.errors) : null,
    });

    return result;
  }

  /**
   * 회사 전체 스케줄 일괄 생성
   */
  async generateBulkSchedules(
    companyId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    total: number;
    success: number;
    failed: number;
    results: Array<{ staffId: string; result: GenerationResult }>;
  }> {
    // 활성 계약 목록 조회
    const { data: contracts, error } = await supabase
      .from('contracts')
      .select('id, staff_id')
      .eq('company_id', companyId)
      .eq('status', 'ACTIVE');

    if (error || !contracts) {
      throw new Error('Failed to fetch contracts');
    }

    const results: Array<{ staffId: string; result: GenerationResult }> = [];

    for (const contract of contracts) {
      try {
        const result = await this.generateFromContract(
          contract.id,
          startDate,
          endDate
        );
        results.push({ staffId: contract.staff_id, result });
      } catch (err) {
        results.push({
          staffId: contract.staff_id,
          result: {
            success: false,
            schedulesCreated: 0,
            schedulesUpdated: 0,
            schedulesSkipped: 0,
            errors: [{ date: 'all', error: (err as Error).message }],
          },
        });
      }
    }

    return {
      total: contracts.length,
      success: results.filter((r) => r.result.success).length,
      failed: results.filter((r) => !r.result.success).length,
      results,
    };
  }

  /**
   * 공휴일 목록 조회 (간단한 구현)
   * 실제로는 외부 API 또는 데이터베이스에서 조회
   */
  private async getHolidays(startDate: Date, endDate: Date): Promise<string[]> {
    const year = startDate.getFullYear();

    // 한국 공휴일 (고정)
    const fixedHolidays = [
      `${year}-01-01`, // 신정
      `${year}-03-01`, // 삼일절
      `${year}-05-05`, // 어린이날
      `${year}-06-06`, // 현충일
      `${year}-08-15`, // 광복절
      `${year}-10-03`, // 개천절
      `${year}-10-09`, // 한글날
      `${year}-12-25`, // 크리스마스
    ];

    // TODO: 음력 공휴일 (설날, 추석 등) 및 대체공휴일 처리
    // 실제 구현 시 공휴일 API 또는 데이터베이스 사용

    return fixedHolidays.filter((h) => {
      const date = parseISO(h);
      return date >= startDate && date <= endDate;
    });
  }

  /**
   * 스케줄 삭제 (기간 내)
   */
  async deleteSchedules(
    staffId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const { data, error } = await supabase
      .from('schedules')
      .delete()
      .eq('staff_id', staffId)
      .gte('work_date', format(startDate, 'yyyy-MM-dd'))
      .lte('work_date', format(endDate, 'yyyy-MM-dd'))
      .eq('status', 'SCHEDULED')
      .select('id');

    if (error) {
      throw error;
    }

    return data?.length || 0;
  }

  /**
   * 특정 날짜 스케줄 복사
   */
  async copySchedule(
    sourceDate: Date,
    targetDate: Date,
    storeId: string
  ): Promise<number> {
    const { data: sourceSchedules, error: fetchError } = await supabase
      .from('schedules')
      .select('*')
      .eq('store_id', storeId)
      .eq('work_date', format(sourceDate, 'yyyy-MM-dd'));

    if (fetchError || !sourceSchedules) {
      throw new Error('Failed to fetch source schedules');
    }

    const targetDateStr = format(targetDate, 'yyyy-MM-dd');
    const newSchedules = sourceSchedules.map((s) => ({
      staff_id: s.staff_id,
      company_id: s.company_id,
      brand_id: s.brand_id,
      store_id: s.store_id,
      work_date: targetDateStr,
      start_time: s.start_time.replace(format(sourceDate, 'yyyy-MM-dd'), targetDateStr),
      end_time: s.end_time.replace(format(sourceDate, 'yyyy-MM-dd'), targetDateStr),
      break_minutes: s.break_minutes,
      status: 'SCHEDULED',
      generated_by: 'MANUAL',
      position: s.position,
    }));

    if (newSchedules.length > 0) {
      const { error: insertError } = await supabase
        .from('schedules')
        .insert(newSchedules);

      if (insertError) {
        throw insertError;
      }
    }

    return newSchedules.length;
  }
}

export const scheduleGeneratorService = new ScheduleGeneratorService();

export default ScheduleGeneratorService;
