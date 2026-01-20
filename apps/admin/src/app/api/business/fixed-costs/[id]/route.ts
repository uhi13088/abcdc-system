import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

// PUT /api/business/fixed-costs/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerClient();
    const { id } = params;

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

    if (!['super_admin', 'company_admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: '수정 권한이 없습니다.' }, { status: 403 });
    }

    const { data: fixedCost } = await supabase
      .from('fixed_costs')
      .select('company_id')
      .eq('id', id)
      .single();

    if (!fixedCost) {
      return NextResponse.json({ error: '고정비용을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (user.role !== 'super_admin' && fixedCost.company_id !== user.company_id) {
      return NextResponse.json({ error: '자신의 회사 데이터만 수정할 수 있습니다.' }, { status: 403 });
    }

    const body = await request.json();
    const { cost_name, category, amount, frequency, payment_day, start_date, notes } = body;

    const { data, error } = await supabase
      .from('fixed_costs')
      .update({
        cost_name,
        category,
        amount,
        frequency,
        payment_day,
        start_date,
        notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating fixed cost:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/business/fixed-costs/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerClient();
    const { id } = params;

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 사용자 정보 조회
    const { data: user } = await supabase
      .from('users')
      .select('role, company_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 역할 권한 체크 - 경영 데이터는 관리자만 삭제 가능
    if (!['super_admin', 'company_admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: '삭제 권한이 없습니다.' }, { status: 403 });
    }

    // 고정비용 정보 조회 (company_id 확인용)
    const { data: fixedCost } = await supabase
      .from('fixed_costs')
      .select('company_id')
      .eq('id', id)
      .single();

    if (!fixedCost) {
      return NextResponse.json({ error: '고정비용을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 회사 격리 체크 - super_admin이 아니면 본인 회사 데이터만 삭제 가능
    if (user.role !== 'super_admin' && fixedCost.company_id !== user.company_id) {
      return NextResponse.json({ error: '자신의 회사 데이터만 삭제할 수 있습니다.' }, { status: 403 });
    }

    const { error } = await supabase
      .from('fixed_costs')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting fixed cost:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
