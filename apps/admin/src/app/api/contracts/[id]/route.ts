import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// Helper: 권한 및 접근 체크
async function checkContractAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  contractId: string,
  requiredRoles?: string[]
) {
  // 1. 사용자 정보 조회
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('id, role, company_id, store_id')
    .eq('auth_id', userId)
    .single();

  if (userError || !userData) {
    return { error: 'User not found', status: 404 };
  }

  // 2. 역할 권한 체크
  if (requiredRoles && !requiredRoles.includes(userData.role)) {
    return { error: '접근 권한이 없습니다.', status: 403 };
  }

  // 3. 계약서 정보 조회 (company_id, store_id 포함)
  const { data: contract, error: contractError } = await supabase
    .from('contracts')
    .select('*, company_id, store_id, staff_id')
    .eq('id', contractId)
    .single();

  if (contractError || !contract) {
    return { error: '계약서를 찾을 수 없습니다.', status: 404 };
  }

  // 4. 회사/매장 격리 체크
  if (userData.role === 'super_admin') {
    // super_admin은 모든 접근 허용
    return { userData, contract };
  }

  if (userData.role === 'store_manager') {
    // store_manager는 자기 매장의 계약서만 접근 가능
    if (contract.store_id !== userData.store_id) {
      return { error: '자신의 매장 계약서만 접근 가능합니다.', status: 403 };
    }
  } else if (['company_admin', 'manager'].includes(userData.role)) {
    // company_admin, manager는 자기 회사의 계약서만 접근 가능
    if (contract.company_id !== userData.company_id) {
      return { error: '자신의 회사 계약서만 접근 가능합니다.', status: 403 };
    }
  } else {
    // staff는 자신의 계약서만 조회 가능
    if (contract.staff_id !== userData.id) {
      return { error: '자신의 계약서만 조회 가능합니다.', status: 403 };
    }
  }

  return { userData, contract };
}

// GET /api/contracts/[id] - 계약서 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const contractId = id;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 권한 체크 (조회는 모든 인증된 사용자 - 단, 자기 회사/매장/본인 계약서만)
    const accessCheck = await checkContractAccess(supabase, user.id, contractId);
    if ('error' in accessCheck && !('contract' in accessCheck)) {
      return NextResponse.json({ error: accessCheck.error }, { status: accessCheck.status });
    }

    // 상세 정보 조회
    const { data, error } = await supabase
      .from('contracts')
      .select(`
        *,
        staff:users!contracts_staff_id_fkey(id, name, email, phone, position, address, birth_date, ssn_encrypted, bank_name, bank_account, account_holder),
        stores(id, name, address, phone),
        brands(id, name),
        companies(id, name, business_number, ceo_name, address)
      `)
      .eq('id', contractId)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (_error) {
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// PUT /api/contracts/[id] - 계약서 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const contractId = id;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 권한 체크 (수정은 super_admin, company_admin, manager, store_manager만)
    const accessCheck = await checkContractAccess(
      supabase,
      user.id,
      contractId,
      ['super_admin', 'company_admin', 'manager', 'store_manager']
    );
    if ('error' in accessCheck && !('contract' in accessCheck)) {
      return NextResponse.json({ error: accessCheck.error }, { status: accessCheck.status });
    }

    const { contract } = accessCheck;

    // 서명된 계약서는 수정 불가
    if (contract.status === 'SIGNED') {
      return NextResponse.json(
        { error: '서명된 계약서는 수정할 수 없습니다.' },
        { status: 400 }
      );
    }

    const body = await request.json();

    // 보안: company_id, staff_id 등 핵심 필드는 수정 금지
    const { company_id: _company_id, staff_id: _staff_id, contract_number: _contract_number, created_by: _created_by, ...safeUpdateData } = body;

    const { data, error } = await supabase
      .from('contracts')
      .update(safeUpdateData)
      .eq('id', contractId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (_error) {
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// DELETE /api/contracts/[id] - 계약서 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const contractId = id;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 권한 체크 (삭제는 super_admin, company_admin만)
    const accessCheck = await checkContractAccess(
      supabase,
      user.id,
      contractId,
      ['super_admin', 'company_admin']
    );
    if ('error' in accessCheck && !('contract' in accessCheck)) {
      return NextResponse.json({ error: accessCheck.error }, { status: accessCheck.status });
    }

    const { contract } = accessCheck;

    // 서명된 계약서는 삭제 불가
    if (contract.status === 'SIGNED') {
      return NextResponse.json(
        { error: '서명된 계약서는 삭제할 수 없습니다.' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('contracts')
      .delete()
      .eq('id', contractId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (_error) {
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
