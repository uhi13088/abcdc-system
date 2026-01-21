import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

// POST /api/business/expenses/[id]/confirm
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: user } = await supabase
      .from('users')
      .select('role, company_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 지출 내역 조회 (company_id 확인용)
    const { data: expense } = await supabase
      .from('expense_transactions')
      .select('company_id')
      .eq('id', id)
      .single();

    if (!expense) {
      return NextResponse.json({ error: '지출 내역을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 회사 격리 체크
    if (user.role !== 'super_admin' && expense.company_id !== user.company_id) {
      return NextResponse.json({ error: '자신의 회사 데이터만 확인할 수 있습니다.' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('expense_transactions')
      .update({
        user_confirmed: true,
        confirmed_at: new Date().toISOString(),
        confirmed_by: userData.user.id,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error confirming expense:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
