import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { addMonths, format } from 'date-fns';

function getAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
}

// POST /api/contracts/[id]/generate-schedules - 기존 계약서에서 스케줄 생성
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const adminClient = getAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 권한 확인
    const { data: userData } = await supabase
      .from('users')
      .select('role, company_id')
      .eq('auth_id', user.id)
      .single();

    if (!['super_admin', 'company_admin', 'manager', 'store_manager'].includes(userData?.role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 계약서 조회
    const { data: contract, error: contractError } = await adminClient
      .from('contracts')
      .select('*')
      .eq('id', id)
      .single();

    if (contractError || !contract) {
      return NextResponse.json({ error: '계약서를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 회사 권한 확인
    if (userData?.role !== 'super_admin' && contract.company_id !== userData?.company_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const workSchedules = contract.work_schedules || [];

    if (workSchedules.length === 0) {
      return NextResponse.json({ error: '계약서에 근무 일정이 없습니다.' }, { status: 400 });
    }

    const startDate = new Date(contract.start_date);
    const endDate = contract.end_date
      ? new Date(contract.end_date)
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

    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      const dayOfWeek = currentDate.getDay();

      for (const ws of workSchedules) {
        if (ws.daysOfWeek && ws.daysOfWeek.includes(dayOfWeek)) {
          schedulesToInsert.push({
            staff_id: contract.staff_id,
            company_id: contract.company_id,
            brand_id: contract.brand_id,
            store_id: contract.store_id,
            work_date: dateStr,
            start_time: `${dateStr}T${ws.startTime}:00`,
            end_time: `${dateStr}T${ws.endTime}:00`,
            break_minutes: ws.breakMinutes || 60,
            status: 'SCHEDULED',
            generated_by: 'CONTRACT',
            position: contract.position,
          });
        }
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    if (schedulesToInsert.length === 0) {
      return NextResponse.json({
        message: '생성할 스케줄이 없습니다.',
        generated: 0
      });
    }

    // upsert로 기존 스케줄 업데이트 또는 새로 생성
    const { data: insertedSchedules, error: scheduleError } = await adminClient
      .from('schedules')
      .upsert(schedulesToInsert, {
        onConflict: 'staff_id,work_date',
        ignoreDuplicates: false,
      })
      .select('id');

    if (scheduleError) {
      console.error('Schedule generation error:', scheduleError);

      // upsert 실패 시 개별 삽입 시도
      let successCount = 0;
      for (const schedule of schedulesToInsert) {
        const { error: singleError } = await adminClient
          .from('schedules')
          .upsert(schedule, {
            onConflict: 'staff_id,work_date',
          });
        if (!singleError) {
          successCount++;
        }
      }

      return NextResponse.json({
        message: `스케줄 ${successCount}개 생성됨 (일부 실패)`,
        generated: successCount,
        total: schedulesToInsert.length,
      });
    }

    return NextResponse.json({
      message: `스케줄 ${insertedSchedules?.length || 0}개 생성됨`,
      generated: insertedSchedules?.length || 0,
      total: schedulesToInsert.length,
    });

  } catch (error) {
    console.error('Generate schedules error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
