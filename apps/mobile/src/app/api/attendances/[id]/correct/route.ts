/**
 * POST /api/attendances/[id]/correct - 직원 출퇴근 수정 요청
 * 직원이 자신의 출퇴근 기록을 수정할 수 있음
 */

import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(
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

    // Get user profile
    const { data: userData } = await adminClient
      .from('users')
      .select('id, name, company_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get the attendance record - verify ownership
    const { data: attendance, error: attendanceError } = await adminClient
      .from('attendances')
      .select('*, staff:users!attendances_staff_id_fkey(id, name)')
      .eq('id', attendanceId)
      .single();

    if (attendanceError || !attendance) {
      return NextResponse.json({ error: '출퇴근 기록을 찾을 수 없습니다.' }, { status: 404 });
    }

    // Only allow users to modify their own attendance
    if (attendance.staff_id !== userData.id) {
      return NextResponse.json({ error: '본인의 출퇴근 기록만 수정할 수 있습니다.' }, { status: 403 });
    }

    const body = await request.json();
    const {
      corrected_check_in,
      corrected_check_out,
      correction_reason
    } = body;

    if (!corrected_check_in && !corrected_check_out) {
      return NextResponse.json(
        { error: '수정할 출근 또는 퇴근 시간을 입력해주세요.' },
        { status: 400 }
      );
    }

    if (!correction_reason || correction_reason.trim().length < 2) {
      return NextResponse.json(
        { error: '수정 사유를 입력해주세요.' },
        { status: 400 }
      );
    }

    // Calculate work hours if checkout is being corrected
    let workHours = attendance.work_hours;
    let basePay = attendance.base_pay;
    let overtimePay = attendance.overtime_pay;
    let nightPay = attendance.night_pay;

    const checkIn = corrected_check_in
      ? new Date(corrected_check_in)
      : attendance.actual_check_in
        ? new Date(attendance.actual_check_in)
        : null;

    const checkOut = corrected_check_out
      ? new Date(corrected_check_out)
      : attendance.actual_check_out
        ? new Date(attendance.actual_check_out)
        : null;

    if (checkIn && checkOut) {
      const diffMs = checkOut.getTime() - checkIn.getTime();
      const rawHours = diffMs / (1000 * 60 * 60);

      // Calculate break hours
      const breakHours = rawHours >= 8 ? 1 : rawHours >= 4 ? 0.5 : 0;
      workHours = Math.max(0, rawHours - breakHours);

      // Recalculate pay
      const overtimeHours = Math.max(0, workHours - 8);
      const hourlyRate = 9860; // Minimum wage default

      basePay = Math.min(workHours, 8) * hourlyRate;
      overtimePay = overtimeHours * hourlyRate * 1.5;

      // Night hours calculation (10pm - 6am)
      const checkOutHour = checkOut.getHours();
      let nightHours = 0;
      if (checkOutHour >= 22 || checkOutHour < 6) {
        nightHours = Math.min(overtimeHours, 2);
      }
      nightPay = nightHours * hourlyRate * 0.5;
    }

    // Build update object
    const updateData: Record<string, any> = {
      correction_reason,
      corrected_at: new Date().toISOString(),
      corrected_by: userData.id,
    };

    if (corrected_check_in) {
      updateData.actual_check_in = corrected_check_in;
    }

    if (corrected_check_out) {
      updateData.actual_check_out = corrected_check_out;
      updateData.work_hours = workHours;
      updateData.base_pay = basePay;
      updateData.overtime_pay = overtimePay;
      updateData.night_pay = nightPay;
      updateData.daily_total = basePay + overtimePay + nightPay;
    }

    // Update attendance record
    const { data, error } = await adminClient
      .from('attendances')
      .update(updateData)
      .eq('id', attendanceId)
      .select()
      .single();

    if (error) {
      console.error('Attendance correction error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: '출퇴근 기록이 수정되었습니다.',
      data,
    });
  } catch (error) {
    console.error('Attendance correction error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
