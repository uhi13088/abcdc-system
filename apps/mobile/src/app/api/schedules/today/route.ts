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

    const today = new Date().toISOString().split('T')[0];

    // Fetch today's schedule using adminClient to bypass RLS
    const { data: scheduleData, error } = await adminClient
      .from('schedules')
      .select('id, start_time, end_time, work_date')
      .eq('staff_id', userData.id)
      .eq('work_date', today)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    if (scheduleData) {
      const startTime = scheduleData.start_time
        ? new Date(scheduleData.start_time).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
        : '-';
      const endTime = scheduleData.end_time
        ? new Date(scheduleData.end_time).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
        : '-';

      return NextResponse.json({
        id: scheduleData.id,
        start: startTime,
        end: endTime,
        work_date: scheduleData.work_date,
      });
    }

    return NextResponse.json(null);
  } catch (error) {
    console.error('Error fetching today schedule:', error);
    return NextResponse.json({ error: 'Failed to fetch schedule' }, { status: 500 });
  }
}
