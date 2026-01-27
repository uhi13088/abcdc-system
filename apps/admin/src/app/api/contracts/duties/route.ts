/**
 * GET /api/contracts/duties - 이전에 사용한 업무내용 목록 조회
 * 회사 내 계약서에서 사용된 업무내용들을 중복 없이 반환
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    // 인증 확인
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 사용자 정보 확인
    const { data: userData } = await adminClient
      .from('users')
      .select('id, role, company_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 관리자 역할 체크
    if (!['super_admin', 'company_admin', 'manager', 'store_manager'].includes(userData.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 회사 내 계약서에서 duties 필드 조회
    let query = adminClient
      .from('contracts')
      .select('duties');

    // super_admin이 아니면 자기 회사의 계약서만 조회
    if (userData.role !== 'super_admin') {
      query = query.eq('company_id', userData.company_id);
    }

    const { data: contracts, error } = await query;

    if (error) {
      console.error('[GET /api/contracts/duties] Query error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 중복 없이 업무내용 수집
    const dutiesSet = new Set<string>();

    contracts?.forEach((contract) => {
      if (contract.duties && Array.isArray(contract.duties)) {
        contract.duties.forEach((duty: string) => {
          if (duty && duty.trim()) {
            dutiesSet.add(duty.trim());
          }
        });
      }
    });

    // 배열로 변환하고 정렬
    const uniqueDuties = Array.from(dutiesSet).sort((a, b) => a.localeCompare(b, 'ko'));

    return NextResponse.json({
      duties: uniqueDuties,
      total: uniqueDuties.length,
    });
  } catch (error) {
    console.error('[GET /api/contracts/duties] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
