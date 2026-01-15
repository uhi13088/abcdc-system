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

    // Get user profile from auth_id
    const { data: userData } = await adminClient
      .from('users')
      .select('id, company_id, brand_id, store_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();

    // Check if already checked in
    const { data: existingAttendance } = await adminClient
      .from('attendances')
      .select('id, actual_check_in')
      .eq('staff_id', userData.id)
      .eq('work_date', today)
      .single();

    if (existingAttendance?.actual_check_in) {
      return NextResponse.json({ error: 'Already checked in' }, { status: 400 });
    }

    // Create or update attendance record using adminClient to bypass RLS
    const { data, error } = await adminClient
      .from('attendances')
      .upsert({
        staff_id: userData.id,
        company_id: userData.company_id,
        brand_id: userData.brand_id,
        store_id: userData.store_id,
        work_date: today,
        actual_check_in: now,
        status: 'NORMAL',
        check_in_method: 'MANUAL',
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error checking in:', error);
    return NextResponse.json({ error: 'Failed to check in' }, { status: 500 });
  }
}
