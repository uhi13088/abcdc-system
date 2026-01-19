/**
 * GET /api/attendances/[id] - 출퇴근 기록 상세 조회
 */

import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(
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
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get attendance record - only allow users to view their own records
    const { data: attendance, error } = await adminClient
      .from('attendances')
      .select(`
        id,
        work_date,
        actual_check_in,
        actual_check_out,
        scheduled_check_in,
        scheduled_check_out,
        status,
        work_hours,
        break_hours,
        overtime_hours,
        night_hours,
        base_pay,
        overtime_pay,
        night_pay,
        daily_total,
        correction_reason,
        corrected_at,
        corrected_by
      `)
      .eq('id', attendanceId)
      .eq('staff_id', userData.id)
      .single();

    if (error || !attendance) {
      return NextResponse.json({ error: '출퇴근 기록을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json(attendance);
  } catch (error) {
    console.error('Error fetching attendance:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
