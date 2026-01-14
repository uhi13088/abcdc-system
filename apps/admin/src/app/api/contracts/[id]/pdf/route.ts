/**
 * GET /api/contracts/[id]/pdf - 계약서 PDF 생성 및 다운로드
 * POST /api/contracts/[id]/pdf - 계약서 PDF 생성 및 저장
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

    // 계약서 데이터 조회
    const { data: contract, error } = await adminClient
      .from('contracts')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error || !contract) {
      return NextResponse.json({ error: '계약서를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 권한 확인
    const isOwner = userData.id === contract.staff_id;
    const isAdmin = ['super_admin', 'company_admin', 'manager'].includes(userData.role);
    const isSameCompany = userData.company_id === contract.company_id;

    if (!isOwner && !(isAdmin && isSameCompany)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // PDF 타입 확인 (draft or signed)
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'signed';

    let pdfBuffer: Buffer;

    if (type === 'draft') {
      pdfBuffer = await contractPDFService.generateDraft(params.id);
    } else if (contract.status === 'SIGNED') {
      pdfBuffer = await contractPDFService.generateSigned(params.id);
    } else {
      pdfBuffer = await contractPDFService.generate(params.id);
    }

    // 파일명 생성
    const fileName = `근로계약서_${contract.contract_number}_${type === 'draft' ? '초안' : '최종'}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('[GET /api/contracts/[id]/pdf] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    if (!userData || !['super_admin', 'company_admin', 'manager'].includes(userData.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 계약서 데이터 조회
    const { data: contract } = await adminClient
      .from('contracts')
      .select('company_id, status')
      .eq('id', params.id)
      .single();

    if (!contract || contract.company_id !== userData.company_id) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }

    // PDF 생성 및 저장
    const type = contract.status === 'SIGNED' ? 'signed' : 'draft';

    let pdfBuffer: Buffer;
    if (type === 'signed') {
      pdfBuffer = await contractPDFService.generateSigned(params.id);
    } else {
      pdfBuffer = await contractPDFService.generateDraft(params.id);
    }

    // Storage에 저장
    const url = await contractPDFService.saveToStorage(params.id, pdfBuffer, type);

    return NextResponse.json({
      message: 'PDF 생성 및 저장 완료',
      url,
      type,
    });
  } catch (error) {
    console.error('[POST /api/contracts/[id]/pdf] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
