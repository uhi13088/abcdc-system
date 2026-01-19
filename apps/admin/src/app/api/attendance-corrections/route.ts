/**
 * GET /api/attendance-corrections - 수정 요청 목록 조회 (관리자용)
 */

import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

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

    // 관리자만 조회 가능
    if (!['super_admin', 'company_admin', 'manager'].includes(userData.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status'); // PENDING, APPROVED, REJECTED
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    let query = adminClient
      .from('attendance_correction_requests')
      .select(`
        *,
        requester:users!attendance_correction_requests_requested_by_fkey(id, name, email, position),
        attendance:attendances(id, work_date, status)
      `, { count: 'exact' });

    // 회사 필터
    if (userData.role !== 'super_admin') {
      query = query.eq('company_id', userData.company_id);
    }

    // 상태 필터
    if (status) {
      query = query.eq('status', status);
    }

    // 정렬 및 페이지네이션
    query = query.order('created_at', { ascending: false });

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching correction requests:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 대기 중인 요청 수 조회
    let pendingCountQuery = adminClient
      .from('attendance_correction_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'PENDING');

    if (userData.role !== 'super_admin') {
      pendingCountQuery = pendingCountQuery.eq('company_id', userData.company_id);
    }

    const { count: pendingCount } = await pendingCountQuery;

    return NextResponse.json({
      data: data || [],
      pendingCount: pendingCount || 0,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching correction requests:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
