import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile ID from auth_id
    const { data: userData } = await adminClient
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Calculate week start (Sunday)
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStartStr = weekStart.toISOString().split('T')[0];

    // Fetch weekly attendance using adminClient to bypass RLS
    const { data: weekAttendance, error } = await adminClient
      .from('attendances')
      .select('actual_check_in, actual_check_out, status, work_hours')
      .eq('staff_id', userData.id)
      .gte('work_date', weekStartStr);

    if (error) throw error;

    let totalHours = 0;
    let lateCount = 0;

    if (weekAttendance) {
      weekAttendance.forEach((record: any) => {
        // Use pre-calculated work_hours if available
        if (record.work_hours) {
          totalHours += Number(record.work_hours);
        } else if (record.actual_check_in && record.actual_check_out) {
          // Fallback: calculate from timestamps
          const checkIn = new Date(record.actual_check_in);
          const checkOut = new Date(record.actual_check_out);
          totalHours += (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
        }
        if (record.status === 'LATE' || record.status === 'EARLY_LEAVE') {
          lateCount++;
        }
      });
    }

    return NextResponse.json({
      totalHours: Math.round(totalHours),
      workDays: weekAttendance?.filter((r: any) => r.actual_check_in).length || 0,
      lateCount,
    });
  } catch (error) {
    console.error('Error fetching weekly stats:', error);
    return NextResponse.json({ error: 'Failed to fetch weekly stats' }, { status: 500 });
  }
}
