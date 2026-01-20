/**
 * GET /api/attendances/[id] - 출퇴근 기록 상세 조회
 * PATCH /api/attendances/[id] - 출퇴근 기록 수정 (관리자)
 */

import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_MINIMUM_WAGE } from '@abc/shared';

// 출퇴근 기록 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const attendanceId = params.id;

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
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const attendanceId = params.id;

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
    let workHours = attendance.work_hours;
    let basePay = attendance.base_pay;
    let overtimePay = attendance.overtime_pay;
    let nightPay = attendance.night_pay;

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

      const breakHours = rawHours >= 8 ? 1 : rawHours >= 4 ? 0.5 : 0;
      workHours = Math.max(0, rawHours - breakHours);

      const overtimeHours = Math.max(0, workHours - 8);
      const hourlyRate = DEFAULT_MINIMUM_WAGE;

      basePay = Math.min(workHours, 8) * hourlyRate;
      overtimePay = overtimeHours * hourlyRate * 1.5;

      const checkOutHour = checkOut.getHours();
      let nightHours = 0;
      if (checkOutHour >= 22 || checkOutHour < 6) {
        nightHours = Math.min(overtimeHours, 2);
      }
      nightPay = nightHours * hourlyRate * 0.5;
    }

    // Build update object
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
      updateData.work_hours = workHours;
      updateData.base_pay = basePay;
      updateData.overtime_pay = overtimePay;
      updateData.night_pay = nightPay;
      updateData.daily_total = basePay + overtimePay + nightPay;
    }
    if (status) {
      updateData.status = status;
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
