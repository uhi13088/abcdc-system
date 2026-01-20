import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { CreateContractSchema, logger } from '@abc/shared';
import { addMonths, format } from 'date-fns';

function getAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
}

// GET /api/contracts - 계약서 목록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    const storeId = searchParams.get('storeId');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('role, company_id, brand_id, store_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });
    }

    // If user has no company_id and is not super_admin, return empty data
    if (!userData.company_id && userData.role !== 'super_admin') {
      return NextResponse.json({
        data: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      });
    }

    let query = supabase
      .from('contracts')
      .select(`
        *,
        staff:users!contracts_staff_id_fkey(id, name, email, phone, position),
        stores(id, name),
        brands(id, name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    // Role-based filtering
    if (userData.role === 'super_admin') {
      // Can see all
    } else if (['company_admin', 'manager'].includes(userData.role)) {
      query = query.eq('company_id', userData.company_id);
    } else if (userData.role === 'store_manager') {
      query = query.eq('store_id', userData.store_id);
    } else {
      query = query.eq('staff_id', user.id);
    }

    // Additional filters
    if (storeId) query = query.eq('store_id', storeId);
    if (status) query = query.eq('status', status);

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('Contracts API error:', error);
      return NextResponse.json({
        data: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      });
    }

    return NextResponse.json({
      data: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Contracts API catch error:', error);
    return NextResponse.json({
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
  }
}

// POST /api/contracts - 계약서 생성
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('id, role, company_id, store_id')
      .eq('auth_id', user.id)
      .single();

    if (!['super_admin', 'company_admin', 'manager', 'store_manager'].includes(userData?.role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();

    const validation = CreateContractSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    // Role-based permission check for contract creation
    // super_admin: can create contracts for any company
    // company_admin, manager: can only create contracts for their own company
    // store_manager: can only create contracts for their own store
    if (userData?.role !== 'super_admin') {
      if (userData?.role === 'store_manager') {
        // store_manager can only create contracts for their own store
        if (validation.data.storeId !== userData.store_id) {
          return NextResponse.json(
            { error: '자신이 관리하는 매장의 계약서만 생성할 수 있습니다.' },
            { status: 403 }
          );
        }
      } else {
        // company_admin, manager can only create contracts for their own company
        if (validation.data.companyId !== userData?.company_id) {
          return NextResponse.json(
            { error: '자신의 회사 계약서만 생성할 수 있습니다.' },
            { status: 403 }
          );
        }
      }
    }

    // Generate contract number
    const year = new Date().getFullYear();
    const { count } = await supabase
      .from('contracts')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${year}-01-01`);

    const contractNumber = `CT${year}${String((count || 0) + 1).padStart(6, '0')}`;

    // Prepare contract data
    const contractData = {
      contract_number: contractNumber,
      staff_id: validation.data.staffId,
      company_id: validation.data.companyId,
      brand_id: validation.data.brandId,
      store_id: validation.data.storeId,
      contract_type: validation.data.contractType,
      start_date: validation.data.startDate,
      end_date: validation.data.endDate,
      probation_months: validation.data.probationMonths,
      work_schedules: validation.data.workSchedules,
      position: validation.data.position,
      department: validation.data.department,
      duties: validation.data.duties,
      salary_config: validation.data.salaryConfig,
      deduction_config: validation.data.deductionConfig,
      standard_hours_per_week: validation.data.standardHoursPerWeek,
      standard_hours_per_day: validation.data.standardHoursPerDay,
      break_minutes: validation.data.breakMinutes,
      annual_leave_days: validation.data.annualLeaveDays,
      paid_leave_days: validation.data.paidLeaveDays,
      sick_leave_days: validation.data.sickLeaveDays,
      terms: validation.data.specialTerms ? { specialTerms: validation.data.specialTerms } : null,
      status: 'DRAFT',
      created_by: userData?.id,
    };

    // Use regular client - RLS policies enforce role-based access control
    const { data, error } = await supabase
      .from('contracts')
      .insert(contractData)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 계약서 생성 시 바로 스케줄 생성 (서명 여부 관계없이)
    let scheduleResult: {
      success: boolean;
      attempted: number;
      created: number;
      error?: string;
      debug?: Record<string, unknown>;
    } = { success: false, attempted: 0, created: 0 };

    try {
      const adminClient = getAdminClient();
      const workSchedules = validation.data.workSchedules || [];

      // 디버그 정보 수집
      scheduleResult.debug = {
        workSchedulesCount: workSchedules.length,
        workSchedules: workSchedules,
        startDate: validation.data.startDate,
        endDate: validation.data.endDate,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      };

      logger.log(`Contract ${data.id} created. workSchedules count: ${workSchedules.length}`);
      logger.log('workSchedules data:', JSON.stringify(workSchedules, null, 2));

      if (workSchedules.length > 0) {
        const startDate = new Date(validation.data.startDate);
        const endDate = validation.data.endDate
          ? new Date(validation.data.endDate)
          : addMonths(startDate, 3);

        const schedulesToInsert: Array<{
          staff_id: string;
          company_id: string;
          brand_id: string;
          store_id: string;
          work_date: string;
          start_time: string;
          end_time: string;
          break_minutes: number;
          status: string;
          generated_by: string;
          position?: string;
        }> = [];

        let currentDate = new Date(startDate);

        while (currentDate <= endDate) {
          const dateStr = format(currentDate, 'yyyy-MM-dd');
          const dayOfWeek = currentDate.getDay();

          for (const ws of workSchedules) {
            if (ws.daysOfWeek && ws.daysOfWeek.includes(dayOfWeek)) {
              schedulesToInsert.push({
                staff_id: validation.data.staffId,
                company_id: validation.data.companyId,
                brand_id: validation.data.brandId,
                store_id: validation.data.storeId,
                work_date: dateStr,
                start_time: `${dateStr}T${ws.startTime}:00+09:00`,  // KST timezone 추가
                end_time: `${dateStr}T${ws.endTime}:00+09:00`,      // KST timezone 추가
                break_minutes: ws.breakMinutes || 60,
                status: 'SCHEDULED',
                generated_by: 'CONTRACT',
                position: validation.data.position,
              });
            }
          }

          currentDate.setDate(currentDate.getDate() + 1);
        }

        scheduleResult.attempted = schedulesToInsert.length;
        scheduleResult.debug = {
          ...scheduleResult.debug,
          schedulesToInsertCount: schedulesToInsert.length,
          sampleSchedule: schedulesToInsert[0],
          dateRange: { start: startDate.toISOString(), end: endDate.toISOString() },
        };

        if (schedulesToInsert.length > 0) {
          logger.log(`Attempting to insert ${schedulesToInsert.length} schedules for contract ${data.id}`);
          logger.log('Sample schedule:', JSON.stringify(schedulesToInsert[0], null, 2));

          // 기존 스케줄 중복 확인 및 upsert
          const { data: insertedSchedules, error: scheduleInsertError } = await adminClient
            .from('schedules')
            .upsert(schedulesToInsert, {
              onConflict: 'staff_id,work_date',
              ignoreDuplicates: false, // 기존 스케줄 업데이트
            })
            .select('id');

          if (scheduleInsertError) {
            console.error('Schedule insert/upsert error:', scheduleInsertError);
            console.error('Failed insert data:', JSON.stringify(schedulesToInsert.slice(0, 3), null, 2));
            scheduleResult.error = `Upsert failed: ${scheduleInsertError.message}`;

            // upsert 실패 시 개별 삽입 시도 (기존 스케줄 건너뛰기)
            let successCount = 0;
            const failedSchedules: Array<{ schedule: typeof schedulesToInsert[0]; error: string }> = [];

            for (const schedule of schedulesToInsert) {
              const { error: singleError } = await adminClient
                .from('schedules')
                .insert(schedule);
              if (!singleError) {
                successCount++;
              } else {
                failedSchedules.push({ schedule, error: singleError.message });
              }
            }

            scheduleResult.created = successCount;
            scheduleResult.success = successCount > 0;
            logger.log(`Fallback: inserted ${successCount}/${schedulesToInsert.length} schedules`);

            if (failedSchedules.length > 0) {
              console.error(`Failed to insert ${failedSchedules.length} schedules:`,
                JSON.stringify(failedSchedules.slice(0, 5), null, 2));
              scheduleResult.debug = {
                ...scheduleResult.debug,
                failedSamples: failedSchedules.slice(0, 3),
              };
            }
          } else {
            scheduleResult.created = insertedSchedules?.length || schedulesToInsert.length;
            scheduleResult.success = true;
            logger.log(`Successfully generated ${insertedSchedules?.length || 0} schedules for contract ${data.id}`);
          }
        } else {
          scheduleResult.error = 'No matching schedules for date range and daysOfWeek';
          logger.log('No schedules to insert - workSchedules:', JSON.stringify(workSchedules, null, 2));
        }
      } else {
        scheduleResult.error = 'No workSchedules provided';
        logger.log('No workSchedules provided in contract data');
      }
    } catch (scheduleError) {
      const err = scheduleError as Error;
      scheduleResult.error = `Exception: ${err.message}`;
      console.error('Schedule generation error:', scheduleError);
      console.error('Error details:', JSON.stringify(scheduleError, Object.getOwnPropertyNames(scheduleError), 2));
      // 스케줄 생성 실패해도 계약서 생성은 완료 처리
    }

    // 응답에 스케줄 생성 결과 포함
    return NextResponse.json({ ...data, _scheduleResult: scheduleResult }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
