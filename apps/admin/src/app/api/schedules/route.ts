import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/schedules - 스케줄 목록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    const storeId = searchParams.get('storeId');
    const staffId = searchParams.get('staffId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const status = searchParams.get('status');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('role, company_id, store_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json([]);
    }

    // If user has no company_id and is not super_admin, return empty array
    if (!userData.company_id && userData.role !== 'super_admin') {
      return NextResponse.json([]);
    }

    let query = supabase
      .from('schedules')
      .select(`
        *,
        staff:users!schedules_staff_id_fkey(id, name, position),
        stores(id, name)
      `)
      .order('work_date', { ascending: true })
      .order('start_time', { ascending: true });

    // Role-based filtering
    if (userData.role === 'super_admin') {
      // Can see all
    } else if (['company_admin', 'manager'].includes(userData.role)) {
      query = query.eq('company_id', userData.company_id);
    } else if (userData.role === 'store_manager') {
      query = query.eq('store_id', userData.store_id);
    } else {
      query = query.eq('staff_id', user.id);
    }

    // Additional filters
    if (storeId) query = query.eq('store_id', storeId);
    if (staffId) query = query.eq('staff_id', staffId);
    if (startDate) query = query.gte('work_date', startDate);
    if (endDate) query = query.lte('work_date', endDate);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;

    if (error) {
      console.error('Schedules API error:', error);
      return NextResponse.json([]);
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Schedules API catch error:', error);
    return NextResponse.json([]);
  }
}

// POST /api/schedules - 스케줄 생성
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('role, company_id')
      .eq('auth_id', user.id)
      .single();

    if (!['super_admin', 'company_admin', 'manager', 'store_manager'].includes(userData?.role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { staffId, storeId, brandId, workDate, startTime, endTime, breakMinutes } = body;

    // Get staff info
    const { data: staffData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', staffId)
      .single();

    if (!staffData) {
      return NextResponse.json({ error: '직원을 찾을 수 없습니다.' }, { status: 404 });
    }

    // start_time과 end_time을 풀 타임스탬프로 변환
    const fullStartTime = `${workDate}T${startTime}:00`;
    const fullEndTime = `${workDate}T${endTime}:00`;

    const { data, error } = await supabase
      .from('schedules')
      .insert({
        staff_id: staffId,
        company_id: staffData.company_id,
        brand_id: brandId,
        store_id: storeId,
        work_date: workDate,
        start_time: fullStartTime,
        end_time: fullEndTime,
        break_minutes: breakMinutes || 60,
        status: 'SCHEDULED',
        generated_by: 'MANUAL',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
