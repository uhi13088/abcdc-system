/**
 * 계약서 PDF 다운로드 API (직원용)
 * GET /api/contracts/[id]/pdf
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { contractPDFService } from '@/lib/services/contract-pdf.service';

export const dynamic = 'force-dynamic';

export async function GET(
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

    // 사용자 정보 조회
    const { data: userData } = await adminClient
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 계약서 정보 조회
    const { data: contract, error: contractError } = await adminClient
      .from('contracts')
      .select('id, staff_id, contract_number, status')
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
        { error: '본인의 계약서만 다운로드할 수 있습니다.' },
        { status: 403 }
      );
    }

    // PDF 실시간 생성
    const pdfBuffer = await contractPDFService.generate(contractId);

    // 파일명 생성
    const fileName = `근로계약서_${contract.contract_number}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Contract PDF error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '계약서 다운로드에 실패했습니다.' },
      { status: 500 }
    );
  }
}
