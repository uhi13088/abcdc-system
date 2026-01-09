import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/contracts/[id]/sign - 계약서 서명
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
      .select('id, role')
      .eq('auth_id', user.id)
      .single();

    const body = await request.json();
    const { signature, signerType } = body;

    if (!signature) {
      return NextResponse.json(
        { error: '서명이 필요합니다.' },
        { status: 400 }
      );
    }

    // Get contract
    const { data: contract } = await supabase
      .from('contracts')
      .select('*')
      .eq('id', contractId)
      .single();

    if (!contract) {
      return NextResponse.json({ error: '계약서를 찾을 수 없습니다.' }, { status: 404 });
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {};
    const now = new Date().toISOString();

    if (signerType === 'employee') {
      // Employee signing
      if (contract.staff_id !== userData?.id && userData?.role !== 'platform_admin') {
        return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
      }
      updateData.employee_signature = signature;
      updateData.employee_signed_at = now;
    } else if (signerType === 'employer') {
      // Employer signing
      if (!['platform_admin', 'company_admin', 'manager', 'store_manager'].includes(userData?.role || '')) {
        return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
      }
      updateData.employer_signature = signature;
      updateData.employer_signed_at = now;
    } else {
      return NextResponse.json(
        { error: '유효하지 않은 서명 타입입니다.' },
        { status: 400 }
      );
    }

    // Check if both signatures exist after this update
    const willHaveBothSignatures =
      (contract.employee_signature || signerType === 'employee') &&
      (contract.employer_signature || signerType === 'employer');

    if (willHaveBothSignatures) {
      updateData.status = 'SIGNED';
    } else if (!contract.employee_signature && !contract.employer_signature) {
      updateData.status = 'SENT';
    }

    const { data, error } = await supabase
      .from('contracts')
      .update(updateData)
      .eq('id', contractId)
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
