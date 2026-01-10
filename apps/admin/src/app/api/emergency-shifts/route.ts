import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

// GET /api/emergency-shifts - 긴급 근무 목록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const store_id = searchParams.get('store_id');

    let query = supabase
      .from('emergency_shifts')
      .select(`
        *,
        stores (name)
      `)
      .order('work_date', { ascending: true });

    if (status) {
      query = query.eq('status', status);
    }

    if (store_id) {
      query = query.eq('store_id', store_id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching emergency shifts:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const shifts = data?.map((shift: any) => ({
      ...shift,
      store_name: shift.stores?.name,
      applicants: shift.applicants || [],
    })) || [];

    return NextResponse.json(shifts);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/emergency-shifts - 긴급 근무 생성
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const body = await request.json();

    const {
      store_id,
      work_date,
      start_time,
      end_time,
      position,
      required_count = 1,
      hourly_rate,
      bonus,
      deadline,
    } = body;

    // Get user's company_id for authorization
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get company_id from user
    const { data: userProfile } = await supabase
      .from('users')
      .select('company_id, role')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Authorization check
    const allowedRoles = ['super_admin', 'company_admin', 'manager', 'store_manager'];
    if (!allowedRoles.includes(userProfile.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('emergency_shifts')
      .insert({
        store_id,
        work_date,
        start_time,
        end_time,
        position,
        required_count,
        hourly_rate,
        bonus: bonus || 0,
        deadline,
        status: 'OPEN',
        applicants: [],
        invited_staff_ids: [],
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating emergency shift:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
