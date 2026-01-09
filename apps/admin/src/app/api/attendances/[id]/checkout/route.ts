import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/attendances/[id]/checkout - 퇴근 기록
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const attendanceId = params.id;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { latitude, longitude } = body;

    // Get the attendance record
    const { data: attendance } = await supabase
      .from('attendances')
      .select('*, staff:users!attendances_staff_id_fkey(id, auth_id)')
      .eq('id', attendanceId)
      .single();

    if (!attendance) {
      return NextResponse.json({ error: '출근 기록을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (attendance.actual_check_out) {
      return NextResponse.json({ error: '이미 퇴근 처리되었습니다.' }, { status: 400 });
    }

    const now = new Date();
    const checkInTime = new Date(attendance.actual_check_in);

    // Calculate work hours
    const diffMs = now.getTime() - checkInTime.getTime();
    const workHours = diffMs / (1000 * 60 * 60);

    // Get store info for break calculation
    const { data: store } = await supabase
      .from('stores')
      .select('default_hourly_rate')
      .eq('id', attendance.store_id)
      .single();

    // Calculate overtime (over 8 hours)
    const breakHours = workHours >= 8 ? 1 : workHours >= 4 ? 0.5 : 0;
    const actualWorkHours = Math.max(0, workHours - breakHours);
    const overtimeHours = Math.max(0, actualWorkHours - 8);

    // Calculate night hours (10pm - 6am)
    let nightHours = 0;
    const checkOutHour = now.getHours();
    if (checkOutHour >= 22 || checkOutHour < 6) {
      nightHours = Math.min(overtimeHours, 2); // Simplified calculation
    }

    // Calculate pay (simplified)
    const hourlyRate = store?.default_hourly_rate || 9860; // 2024 minimum wage
    const basePay = Math.min(actualWorkHours, 8) * hourlyRate;
    const overtimePay = overtimeHours * hourlyRate * 1.5;
    const nightPay = nightHours * hourlyRate * 0.5;

    // Check if early leave
    let status = attendance.status;
    if (attendance.scheduled_check_out) {
      const scheduledOut = new Date(attendance.scheduled_check_out);
      if (now < scheduledOut) {
        status = 'EARLY_LEAVE';
      }
    }

    const { data, error } = await supabase
      .from('attendances')
      .update({
        actual_check_out: now.toISOString(),
        check_out_lat: latitude,
        check_out_lng: longitude,
        work_hours: actualWorkHours,
        break_hours: breakHours,
        overtime_hours: overtimeHours,
        night_hours: nightHours,
        base_pay: basePay,
        overtime_pay: overtimePay,
        night_pay: nightPay,
        daily_total: basePay + overtimePay + nightPay,
        status,
      })
      .eq('id', attendanceId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
