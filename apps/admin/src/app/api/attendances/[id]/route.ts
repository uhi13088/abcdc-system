/**
 * GET /api/attendances/[id] - 출퇴근 기록 상세 조회
 * PATCH /api/attendances/[id] - 출퇴근 기록 수정 (관리자)
 */

import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_MINIMUM_WAGE, ALLOWANCE_RATES, DAILY_WORK_HOURS } from '@abc/shared';

// 출퇴근 기록 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const attendanceId = id;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('id, role, company_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get attendance with staff info
    let query = supabase
      .from('attendances')
      .select(`
        *,
        staff:users!attendances_staff_id_fkey(id, name, email, position),
        stores(id, name)
      `)
      .eq('id', attendanceId);

    // Role-based access
    if (['company_admin', 'manager'].includes(userData.role)) {
      query = query.eq('company_id', userData.company_id);
    } else if (userData.role !== 'super_admin') {
      query = query.eq('staff_id', userData.id);
    }

    const { data, error } = await query.single();

    if (error || !data) {
      return NextResponse.json({ error: '출퇴근 기록을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Attendance detail error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// 출퇴근 기록 수정 (관리자용)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const attendanceId = id;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('id, role, company_id, name')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Only admins can modify attendance
    if (!['super_admin', 'company_admin', 'manager'].includes(userData.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get existing attendance record
    const { data: attendance, error: attendanceError } = await adminClient
      .from('attendances')
      .select('*, staff:users!attendances_staff_id_fkey(id, name)')
      .eq('id', attendanceId)
      .single();

    if (attendanceError || !attendance) {
      return NextResponse.json({ error: '출퇴근 기록을 찾을 수 없습니다.' }, { status: 404 });
    }

    // Check company access
    if (userData.role !== 'super_admin' && attendance.company_id !== userData.company_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      actual_check_in,
      actual_check_out,
      status,
      correction_reason,
    } = body;

    // Calculate work hours if times changed
    let workHours = attendance.work_hours || 0;
    let breakHours = attendance.break_hours || 0;
    let overtimeHours = attendance.overtime_hours || 0;
    let basePay = attendance.base_pay || 0;
    let overtimePay = attendance.overtime_pay || 0;
    let nightPay = attendance.night_pay || 0;

    const checkIn = actual_check_in
      ? new Date(actual_check_in)
      : attendance.actual_check_in
        ? new Date(attendance.actual_check_in)
        : null;

    const checkOut = actual_check_out
      ? new Date(actual_check_out)
      : attendance.actual_check_out
        ? new Date(attendance.actual_check_out)
        : null;

    if (checkIn && checkOut) {
      const diffMs = checkOut.getTime() - checkIn.getTime();
      const rawHours = diffMs / (1000 * 60 * 60);

      // 휴게시간: 4시간 이상 30분, 8시간 이상 1시간
      breakHours = rawHours >= DAILY_WORK_HOURS ? 1 : rawHours >= 4 ? 0.5 : 0;
      workHours = Math.max(0, rawHours - breakHours);

      overtimeHours = Math.max(0, workHours - DAILY_WORK_HOURS);
      const hourlyRate = DEFAULT_MINIMUM_WAGE;

      basePay = Math.min(workHours, DAILY_WORK_HOURS) * hourlyRate;
      overtimePay = overtimeHours * hourlyRate * ALLOWANCE_RATES.overtime;

      // 야간근무 시간 계산 (22:00 ~ 06:00)
      const checkOutHour = checkOut.getHours();
      let nightHours = 0;
      if (checkOutHour >= 22 || checkOutHour < 6) {
        nightHours = Math.min(overtimeHours, 2);
      }
      nightPay = nightHours * hourlyRate * ALLOWANCE_RATES.night;
    }

    // Build update object
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {
      admin_corrected_at: new Date().toISOString(),
      admin_corrected_by: userData.id,
      admin_correction_reason: correction_reason || null,
    };

    if (actual_check_in !== undefined) {
      updateData.actual_check_in = actual_check_in;
    }
    if (actual_check_out !== undefined) {
      updateData.actual_check_out = actual_check_out;
    }
    if (status) {
      updateData.status = status;
    }

    // 출퇴근 시간이 둘 다 있으면 work_hours 계산 (변경 여부 상관없이)
    if (checkIn && checkOut) {
      updateData.work_hours = Math.round(workHours * 100) / 100;
      updateData.break_hours = breakHours;
      updateData.overtime_hours = Math.round(overtimeHours * 100) / 100;
      updateData.base_pay = Math.round(basePay);
      updateData.overtime_pay = Math.round(overtimePay);
      updateData.night_pay = Math.round(nightPay);
      updateData.daily_total = Math.round(basePay + overtimePay + nightPay);
    }

    // Update attendance record
    const { data, error } = await adminClient
      .from('attendances')
      .update(updateData)
      .eq('id', attendanceId)
      .select()
      .single();

    if (error) {
      console.error('Attendance update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Send notification to the staff member
    try {
      await adminClient.from('notifications').insert({
        user_id: attendance.staff_id,
        category: 'ATTENDANCE',
        priority: 'HIGH',
        title: '출퇴근 기록 수정 알림',
        body: `${attendance.work_date} 출퇴근 기록이 관리자(${userData.name})에 의해 수정되었습니다.${correction_reason ? ` 사유: ${correction_reason}` : ''}`,
        deep_link: `/attendance/${attendanceId}`,
        reference_type: 'ATTENDANCE',
        reference_id: attendanceId,
        data: {
          attendance_id: attendanceId,
          work_date: attendance.work_date,
          corrected_by: userData.name,
          correction_reason: correction_reason || null,
        },
      });
    } catch (notifyError) {
      console.error('Failed to send notification:', notifyError);
      // Don't fail the request if notification fails
    }

    return NextResponse.json({
      success: true,
      message: '출퇴근 기록이 수정되었습니다. 직원에게 알림이 전송되었습니다.',
      data,
    });
  } catch (error) {
    console.error('Attendance update error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
