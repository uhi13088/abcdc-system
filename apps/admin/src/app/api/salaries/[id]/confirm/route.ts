import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/salaries/[id]/confirm - 급여 확정
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const salaryId = id;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('id, role, company_id, store_id')
      .eq('auth_id', user.id)
      .single();

    // 역할 권한 체크
    if (!['super_admin', 'company_admin', 'manager'].includes(userData?.role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 급여 정보 조회 (company_id 확인용)
    const { data: salary, error: salaryError } = await supabase
      .from('salaries')
      .select('id, company_id, store_id')
      .eq('id', salaryId)
      .single();

    if (salaryError || !salary) {
      return NextResponse.json({ error: '급여 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 회사 격리 체크 - super_admin이 아니면 본인 회사 급여만 확정 가능
    if (userData?.role !== 'super_admin' && salary.company_id !== userData?.company_id) {
      return NextResponse.json({ error: '자신의 회사 급여만 확정할 수 있습니다.' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('salaries')
      .update({
        status: 'CONFIRMED',
        confirmed_at: new Date().toISOString(),
        confirmed_by: userData?.id,
      })
      .eq('id', salaryId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
