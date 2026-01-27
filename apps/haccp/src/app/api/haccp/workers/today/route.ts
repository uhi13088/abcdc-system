import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/haccp/workers/today - 오늘 출근한 직원 목록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await supabase
      .from('users')
      .select('company_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 해당 회사의 모든 근무자 조회
    const { data: allWorkers, error: workersError } = await supabase
      .from('users')
      .select('id, name, role, avatar_url')
      .eq('company_id', userProfile.company_id)
      .in('role', ['staff', 'verifier', 'manager', 'admin'])
      .eq('status', 'active');

    if (workersError) {
      console.error('Error fetching workers:', workersError);
      return NextResponse.json({ error: workersError.message }, { status: 500 });
    }

    // 오늘 출근 기록 조회
    const { data: attendances, error: attendanceError } = await supabase
      .from('attendances')
      .select('staff_id, actual_check_in, actual_check_out, status')
      .eq('company_id', userProfile.company_id)
      .eq('work_date', date);

    if (attendanceError) {
      console.error('Error fetching attendances:', attendanceError);
      return NextResponse.json({ error: attendanceError.message }, { status: 500 });
    }

    // 출근 기록을 staff_id로 매핑
    const attendanceMap = new Map(
      (attendances || []).map((a) => [a.staff_id, a])
    );

    // 근무자 목록에 출근 정보 병합
    const workersWithAttendance = (allWorkers || []).map((worker) => {
      const attendance = attendanceMap.get(worker.id);
      return {
        id: worker.id,
        name: worker.name,
        role: worker.role,
        avatar_url: worker.avatar_url,
        is_present: !!attendance?.actual_check_in,
        check_in_time: attendance?.actual_check_in || null,
        check_out_time: attendance?.actual_check_out || null,
        status: attendance?.status || 'ABSENT',
      };
    });

    // 출근한 사람 먼저, 그 다음 이름 순으로 정렬
    workersWithAttendance.sort((a, b) => {
      if (a.is_present && !b.is_present) return -1;
      if (!a.is_present && b.is_present) return 1;
      return a.name.localeCompare(b.name, 'ko');
    });

    // 통계 정보
    const stats = {
      total: workersWithAttendance.length,
      present: workersWithAttendance.filter((w) => w.is_present).length,
      absent: workersWithAttendance.filter((w) => !w.is_present).length,
    };

    return NextResponse.json({
      date,
      workers: workersWithAttendance,
      stats,
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
