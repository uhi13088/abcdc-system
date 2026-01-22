/**
 * 계약서 서명 처리 API (직원용)
 * POST /api/contracts/[id]/sign
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const contractId = params.id;
    const body = await request.json();
    const { signature, signerType: _signerType = 'EMPLOYEE' } = body;

    if (!signature) {
      return NextResponse.json(
        { error: '서명 데이터가 필요합니다.' },
        { status: 400 }
      );
    }

    // 사용자 정보 조회
    const { data: userData } = await adminClient
      .from('users')
      .select('id, role')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 계약서 정보 조회
    const { data: contract, error: contractError } = await adminClient
      .from('contracts')
      .select('*, staff:users!staff_id(id, name)')
      .eq('id', contractId)
      .single();

    if (contractError || !contract) {
      return NextResponse.json(
        { error: '계약서를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 직원 본인 확인
    if (contract.staff_id !== userData.id) {
      return NextResponse.json(
        { error: '본인의 계약서만 서명할 수 있습니다.' },
        { status: 403 }
      );
    }

    // 이미 서명 완료 확인
    if (contract.employee_signed_at) {
      return NextResponse.json(
        { error: '이미 서명이 완료된 계약서입니다.' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // 서명 저장 (signatures 테이블)
    const { data: signatureRecord } = await adminClient
      .from('signatures')
      .insert({
        user_id: userData.id,
        signature_data: signature,
        signature_type: 'DRAWN',
      })
      .select()
      .single();

    // 서명 이벤트 기록
    await adminClient.from('contract_signature_events').insert({
      contract_id: contractId,
      event_type: 'EMPLOYEE_SIGNED',
      actor_type: 'EMPLOYEE',
      actor_id: userData.id,
      actor_name: contract.staff?.name,
      signature_id: signatureRecord?.id,
      signature_data: signature,
    });

    // 계약서 업데이트
    let newStatus = contract.status;

    // 고용주가 이미 서명했으면 SIGNED로 변경
    if (contract.employer_signature) {
      newStatus = 'SIGNED';
    }

    await adminClient
      .from('contracts')
      .update({
        employee_signature: signature,
        employee_signed_at: now,
        status: newStatus,
      })
      .eq('id', contractId);

    // 양쪽 모두 서명 완료 시 ACTIVE로
    if (newStatus === 'SIGNED') {
      await adminClient
        .from('contracts')
        .update({ status: 'ACTIVE' })
        .eq('id', contractId);

      // 최종 서명 완료 이벤트
      await adminClient.from('contract_signature_events').insert({
        contract_id: contractId,
        event_type: 'CONTRACT_COMPLETED',
        actor_type: 'SYSTEM',
        notes: '양측 서명 완료, 계약 체결',
      });
    }

    // 관리자에게 알림 전송
    if (contract.created_by) {
      await adminClient.from('notifications').insert({
        user_id: contract.created_by,
        category: 'CONTRACT',
        priority: 'NORMAL',
        title: '계약서 서명 완료',
        body: `${contract.staff?.name}님이 근로계약서에 서명했습니다.`,
        deep_link: `/contracts/${contractId}`,
        sent: true,
        sent_at: now,
      });
    }

    return NextResponse.json({
      success: true,
      status: newStatus === 'SIGNED' ? 'ACTIVE' : newStatus,
      message: '서명이 완료되었습니다.',
    });
  } catch (error) {
    console.error('Contract sign error:', error);
    return NextResponse.json(
      { error: '계약서 서명 처리에 실패했습니다.' },
      { status: 500 }
    );
  }
}
