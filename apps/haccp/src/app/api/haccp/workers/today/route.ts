import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/haccp/workers/today - 오늘 출근한 근무자 목록
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 일반 클라이언트로 먼저 시도, 실패하면 admin 클라이언트 사용
    let dbClient = supabase;
    let { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('id, company_id')
      .eq('auth_id', userData.user.id)
      .single();

    // RLS 문제로 실패하면 admin 클라이언트 시도
    if (profileError && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      dbClient = createAdminClient();
      const result = await dbClient
        .from('users')
        .select('id, company_id')
        .eq('auth_id', userData.user.id)
        .single();
      userProfile = result.data;
    }

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 오늘 출근 기록이 있는 직원 조회
    const { data: attendances, error: attendanceError } = await dbClient
      .from('attendances')
      .select(`
        id,
        check_in,
        check_out,
        status,
        user_id
      `)
      .eq('company_id', userProfile.company_id)
      .gte('check_in', `${date}T00:00:00`)
      .lt('check_in', `${date}T23:59:59`)
      .order('check_in');

    if (attendanceError) {
      // 테이블이 없으면 빈 배열 반환
      if (attendanceError.code === '42P01') {
        // attendances 테이블 없으면 users에서 직접 조회
        const { data: users } = await dbClient
          .from('users')
          .select('id, name, email, role, phone, status')
          .eq('company_id', userProfile.company_id)
          .eq('status', 'ACTIVE')
          .order('name');

        return NextResponse.json({
          date,
          workers: (users || []).map(user => ({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            phone: user.phone,
            check_in: null,
            check_out: null,
            attendance_status: 'NOT_CHECKED_IN',
          })),
          total_workers: users?.length || 0,
          checked_in: 0,
        });
      }
      console.error('Error fetching attendances:', attendanceError);
      return NextResponse.json({ error: attendanceError.message }, { status: 500 });
    }

    // 모든 활성 직원 조회
    const { data: allUsers } = await dbClient
      .from('users')
      .select('id, name, email, role, phone')
      .eq('company_id', userProfile.company_id)
      .eq('status', 'ACTIVE');

    // 사용자 맵 생성
    const userMap = new Map((allUsers || []).map(u => [u.id, u]));

    // 출근한 직원 목록 정리
    const workers = (attendances || []).map(attendance => {
      const user = userMap.get(attendance.user_id);
      return {
        id: user?.id || attendance.user_id,
        name: user?.name || 'Unknown',
        email: user?.email || '',
        role: user?.role || '',
        phone: user?.phone || '',
        check_in: attendance.check_in,
        check_out: attendance.check_out,
        attendance_status: attendance.status,
        attendance_id: attendance.id,
      };
    });

    const checkedInIds = new Set(workers.map(w => w.id));
    const notCheckedIn = (allUsers || [])
      .filter(user => !checkedInIds.has(user.id))
      .map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        check_in: null,
        check_out: null,
        attendance_status: 'NOT_CHECKED_IN',
      }));

    return NextResponse.json({
      date,
      workers: [...workers, ...notCheckedIn],
      checked_in_workers: workers,
      not_checked_in_workers: notCheckedIn,
      total_workers: (allUsers || []).length,
      checked_in: workers.length,
    });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
