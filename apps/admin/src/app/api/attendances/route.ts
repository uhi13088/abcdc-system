import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/attendances - 출퇴근 목록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const searchParams = request.nextUrl.searchParams;
    const storeId = searchParams.get('storeId');
    const staffId = searchParams.get('staffId');
    const date = searchParams.get('date');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

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
      return NextResponse.json({
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });
    }

    // If user has no company_id and is not super_admin, return empty array
    if (!userData.company_id && userData.role !== 'super_admin') {
      return NextResponse.json({
        data: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      });
    }

    let query = supabase
      .from('attendances')
      .select(`
        *,
        staff:users!attendances_staff_id_fkey(id, name, email, position),
        stores(id, name)
      `, { count: 'exact' })
      .order('work_date', { ascending: false })
      .order('actual_check_in', { ascending: false });

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
    if (date) query = query.eq('work_date', date);
    if (startDate) query = query.gte('work_date', startDate);
    if (endDate) query = query.lte('work_date', endDate);
    if (status) query = query.eq('status', status);

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('Attendances API error:', error);
      return NextResponse.json({
        data: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      });
    }

    return NextResponse.json({
      data: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Attendances API catch error:', error);
    return NextResponse.json({
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
  }
}

// POST /api/attendances - 출근 기록 (체크인)
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('id, company_id, brand_id, store_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { storeId, latitude, longitude, qrCode } = body;

    const targetStoreId = storeId || userData.store_id;

    // Check if already checked in today
    const today = new Date().toISOString().split('T')[0];
    const { data: existingAttendance } = await supabase
      .from('attendances')
      .select('id')
      .eq('staff_id', userData.id)
      .eq('work_date', today)
      .single();

    if (existingAttendance) {
      return NextResponse.json(
        { error: '오늘 이미 출근 처리되었습니다.' },
        { status: 400 }
      );
    }

    // Get scheduled check-in time for determining status
    const { data: schedule } = await supabase
      .from('schedules')
      .select('start_time')
      .eq('staff_id', userData.id)
      .eq('work_date', today)
      .single();

    const now = new Date();
    let status = 'NORMAL';

    if (schedule?.start_time) {
      const scheduledTime = new Date(schedule.start_time);
      if (now > scheduledTime) {
        status = 'LATE';
      }
    }

    const { data, error } = await supabase
      .from('attendances')
      .insert({
        staff_id: userData.id,
        company_id: userData.company_id,
        brand_id: userData.brand_id,
        store_id: targetStoreId,
        work_date: today,
        actual_check_in: now.toISOString(),
        scheduled_check_in: schedule?.start_time,
        check_in_lat: latitude,
        check_in_lng: longitude,
        check_in_method: qrCode ? 'QR' : latitude ? 'GEOFENCE' : 'MANUAL',
        status,
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
