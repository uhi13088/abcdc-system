import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
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
    const now = new Date().toISOString();

    // Get today's attendance record
    const { data: existingAttendance } = await adminClient
      .from('attendances')
      .select('id, actual_check_in, actual_check_out')
      .eq('staff_id', userData.id)
      .eq('work_date', today)
      .single();

    if (!existingAttendance?.actual_check_in) {
      return NextResponse.json({ error: 'Not checked in yet' }, { status: 400 });
    }

    if (existingAttendance?.actual_check_out) {
      return NextResponse.json({ error: 'Already checked out' }, { status: 400 });
    }

    // Update attendance record with check-out time using adminClient
    const { data, error } = await adminClient
      .from('attendances')
      .update({
        actual_check_out: now,
      })
      .eq('id', existingAttendance.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error checking out:', error);
    return NextResponse.json({ error: 'Failed to check out' }, { status: 500 });
  }
}
