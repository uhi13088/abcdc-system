import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Helper: 사용자 접근 권한 체크
async function checkUserAccess(
  adminClient: ReturnType<typeof createAdminClient>,
  requesterId: string,
  targetUserId: string,
  requiredRoles?: string[]
) {
  // 1. 요청자 정보 조회
  const { data: requester, error: requesterError } = await adminClient
    .from('users')
    .select('id, role, company_id, store_id')
    .eq('auth_id', requesterId)
    .single();

  if (requesterError || !requester) {
    return { error: 'Requester not found', status: 404 };
  }

  // 2. 역할 권한 체크
  if (requiredRoles && !requiredRoles.includes(requester.role)) {
    return { error: '접근 권한이 없습니다.', status: 403 };
  }

  // 3. 대상 사용자 정보 조회
  const { data: targetUser, error: targetError } = await adminClient
    .from('users')
    .select('id, role, company_id, store_id')
    .eq('id', targetUserId)
    .single();

  if (targetError || !targetUser) {
    return { error: '직원을 찾을 수 없습니다.', status: 404 };
  }

  // 4. 회사/매장 격리 체크
  if (requester.role === 'super_admin') {
    // super_admin은 모든 접근 허용
    return { requester, targetUser };
  }

  // 본인 정보는 항상 조회 가능
  if (requester.id === targetUser.id) {
    return { requester, targetUser };
  }

  if (requester.role === 'store_manager') {
    // store_manager는 자기 매장의 직원만 접근 가능
    if (targetUser.store_id !== requester.store_id) {
      return { error: '자신의 매장 직원만 접근 가능합니다.', status: 403 };
    }
  } else if (['company_admin', 'manager'].includes(requester.role)) {
    // company_admin, manager는 자기 회사의 직원만 접근 가능
    if (targetUser.company_id !== requester.company_id) {
      return { error: '자신의 회사 직원만 접근 가능합니다.', status: 403 };
    }
  } else {
    // staff는 타인 정보 접근 불가
    return { error: '접근 권한이 없습니다.', status: 403 };
  }

  return { requester, targetUser };
}

// GET /api/users/[id] - 직원 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const userId = params.id;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 권한 체크 (조회는 모든 역할 - 단, 자기 회사/매장/본인만)
    const accessCheck = await checkUserAccess(adminClient, user.id, userId);
    if ('error' in accessCheck && !('targetUser' in accessCheck)) {
      return NextResponse.json({ error: accessCheck.error }, { status: accessCheck.status });
    }

    const { data, error } = await adminClient
      .from('users')
      .select(`
        *,
        stores(id, name, address),
        brands(id, name),
        companies(id, name),
        teams(id, name)
      `)
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: '직원을 찾을 수 없습니다.' }, { status: 404 });
      }
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

// PUT /api/users/[id] - 직원 정보 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const userId = params.id;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 권한 체크 (수정은 super_admin, company_admin, manager, store_manager만)
    // 단, 본인은 제한된 필드만 수정 가능
    const accessCheck = await checkUserAccess(adminClient, user.id, userId);
    if ('error' in accessCheck && !('targetUser' in accessCheck)) {
      return NextResponse.json({ error: accessCheck.error }, { status: accessCheck.status });
    }

    const { requester, targetUser } = accessCheck;
    const isSelf = requester.id === targetUser.id;

    // 본인이 아닌 경우 관리자 역할 필요
    if (!isSelf && !['super_admin', 'company_admin', 'manager', 'store_manager'].includes(requester.role)) {
      return NextResponse.json({ error: '타인의 정보를 수정할 권한이 없습니다.' }, { status: 403 });
    }

    const body = await request.json();

    // 본인인 경우 수정 가능 필드 제한
    const selfEditableFields = ['name', 'phone', 'address', 'birth_date', 'bank_name', 'bank_account', 'account_holder'];

    // Convert camelCase to snake_case for database
    const updateData: Record<string, unknown> = {};

    if (body.name) updateData.name = body.name;
    if (body.phone) updateData.phone = body.phone;
    if (body.address) updateData.address = body.address;
    if (body.birthDate) updateData.birth_date = body.birthDate;
    if (body.bankName) updateData.bank_name = body.bankName;
    if (body.bankAccount) updateData.bank_account = body.bankAccount;
    if (body.accountHolder) updateData.account_holder = body.accountHolder;

    // 관리자 전용 필드 (본인 수정 불가)
    if (!isSelf) {
      if (body.position) updateData.position = body.position;
      if (body.storeId) updateData.store_id = body.storeId;
      if (body.brandId) updateData.brand_id = body.brandId;
      if (body.teamId) updateData.team_id = body.teamId;
      if (body.status) updateData.status = body.status;
      if (typeof body.haccpAccess === 'boolean') updateData.haccp_access = body.haccpAccess;
      if (typeof body.roastingAccess === 'boolean') updateData.roasting_access = body.roastingAccess;

      // role 변경은 super_admin, company_admin만 가능
      if (body.role && ['super_admin', 'company_admin'].includes(requester.role)) {
        // super_admin은 모든 역할로 변경 가능
        // company_admin은 super_admin으로 변경 불가
        if (requester.role === 'company_admin' && body.role === 'super_admin') {
          return NextResponse.json({ error: 'super_admin 역할은 부여할 수 없습니다.' }, { status: 403 });
        }
        updateData.role = body.role;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: '수정할 데이터가 없습니다.' }, { status: 400 });
    }

    const { data, error } = await adminClient
      .from('users')
      .update(updateData)
      .eq('id', userId)
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

// DELETE /api/users/[id] - 직원 삭제 (비활성화)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const userId = params.id;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 권한 체크 (삭제는 super_admin, company_admin만)
    const accessCheck = await checkUserAccess(
      adminClient,
      user.id,
      userId,
      ['super_admin', 'company_admin']
    );
    if ('error' in accessCheck && !('targetUser' in accessCheck)) {
      return NextResponse.json({ error: accessCheck.error }, { status: accessCheck.status });
    }

    const { requester, targetUser } = accessCheck;

    // 본인 삭제 불가
    if (requester.id === targetUser.id) {
      return NextResponse.json({ error: '본인 계정은 비활성화할 수 없습니다.' }, { status: 400 });
    }

    // super_admin은 다른 super_admin만 삭제 불가
    if (targetUser.role === 'super_admin' && requester.role !== 'super_admin') {
      return NextResponse.json({ error: 'super_admin은 삭제할 수 없습니다.' }, { status: 403 });
    }

    // Soft delete - just set status to INACTIVE
    const { data, error } = await adminClient
      .from('users')
      .update({ status: 'INACTIVE' })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
