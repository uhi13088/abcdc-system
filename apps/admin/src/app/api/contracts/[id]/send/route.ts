import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/contracts/[id]/send - 계약서 발송
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const contractId = params.id;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('auth_id', user.id)
      .single();

    if (!['platform_admin', 'company_admin', 'manager', 'store_manager'].includes(userData?.role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get contract
    const { data: contract } = await supabase
      .from('contracts')
      .select(`
        *,
        staff:users!contracts_staff_id_fkey(id, name, email)
      `)
      .eq('id', contractId)
      .single();

    if (!contract) {
      return NextResponse.json({ error: '계약서를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (contract.status !== 'DRAFT') {
      return NextResponse.json(
        { error: '초안 상태의 계약서만 발송할 수 있습니다.' },
        { status: 400 }
      );
    }

    // Update contract status to SENT
    const { data, error } = await supabase
      .from('contracts')
      .update({ status: 'SENT' })
      .eq('id', contractId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Create notification for the staff member
    await supabase.from('notifications').insert({
      user_id: contract.staff.id,
      category: 'CONTRACT',
      priority: 'HIGH',
      title: '새로운 근로계약서가 도착했습니다',
      body: '서명이 필요한 근로계약서가 있습니다. 확인 후 서명해주세요.',
      deep_link: `/contracts/${contractId}`,
    });

    return NextResponse.json({
      success: true,
      message: '계약서가 발송되었습니다.',
      data,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
