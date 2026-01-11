/**
 * 계약서 서명 처리 API
 * POST /api/contracts/[id]/sign
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { pushNotificationService } from '@abc/shared/server';
import { ContractPDFService } from '@/lib/services/contract-pdf.service';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const contractId = params.id;
    const body = await request.json();
    const { signature, signerId, signerType = 'EMPLOYEE', deviceInfo, ipAddress } = body;

    if (!signature) {
      return NextResponse.json(
        { error: '서명 데이터가 필요합니다.' },
        { status: 400 }
      );
    }

    // 계약서 정보 조회
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select(`
        *,
        staff:users!staff_id (
          id,
          name,
          email
        ),
        company:companies!company_id (
          id,
          name
        ),
        creator:users!created_by (
          id,
          name
        )
      `)
      .eq('id', contractId)
      .single();

    if (contractError || !contract) {
      return NextResponse.json(
        { error: '계약서를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 이미 완료된 계약서인지 확인
    if (contract.status === 'SIGNED' || contract.status === 'ACTIVE') {
      return NextResponse.json(
        { error: '이미 서명이 완료된 계약서입니다.' },
        { status: 400 }
      );
    }

    // 만료 체크
    if (contract.expires_at && new Date(contract.expires_at) < new Date()) {
      return NextResponse.json(
        { error: '서명 기간이 만료되었습니다. 새로운 계약서를 요청해주세요.' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // 서명 저장 (signatures 테이블)
    const { data: signatureRecord, error: signatureError } = await supabase
      .from('signatures')
      .insert({
        user_id: signerId || contract.staff.id,
        signature_data: signature,
        signature_type: 'DRAWN',
        device_info: deviceInfo,
        ip_address: ipAddress,
      })
      .select()
      .single();

    if (signatureError) {
      console.error('Signature save error:', signatureError);
    }

    // 서명 이벤트 기록
    await supabase.from('contract_signature_events').insert({
      contract_id: contractId,
      event_type: signerType === 'EMPLOYER' ? 'EMPLOYER_SIGNED' : 'EMPLOYEE_SIGNED',
      actor_type: signerType,
      actor_id: signerId || (signerType === 'EMPLOYEE' ? contract.staff.id : contract.created_by),
      actor_name: signerType === 'EMPLOYEE' ? contract.staff?.name : contract.creator?.name,
      signature_id: signatureRecord?.id,
      signature_data: signature,
      device_info: deviceInfo,
      ip_address: ipAddress,
    });

    // 계약서 업데이트
    let updateData: Record<string, any>;
    let newStatus = contract.status;

    if (signerType === 'EMPLOYEE') {
      updateData = {
        employee_signature: signature,
        employee_signed_at: now,
      };

      // 사용자가 서명하면 양쪽 서명 체크
      if (contract.employer_signature) {
        newStatus = 'SIGNED';
      }
    } else {
      updateData = {
        employer_signature: signature,
        employer_signed_at: now,
      };

      // 고용주가 서명하면 양쪽 서명 체크
      if (contract.employee_signature) {
        newStatus = 'SIGNED';
      }
    }

    updateData.status = newStatus;

    await supabase
      .from('contracts')
      .update(updateData)
      .eq('id', contractId);

    // 양쪽 모두 서명 완료 시
    if (newStatus === 'SIGNED') {
      // 서명된 PDF 생성
      const pdfService = new ContractPDFService();

      try {
        // 최신 계약서 정보로 PDF 생성
        const signedPdf = await pdfService.generateSigned(contractId);
        const pdfUrl = await pdfService.saveToStorage(contractId, signedPdf, 'signed');

        // 계약서 활성화
        await supabase
          .from('contracts')
          .update({
            status: 'ACTIVE',
            pdf_signed_url: pdfUrl,
          })
          .eq('id', contractId);

        // 버전 기록
        await supabase.from('contract_versions').insert({
          contract_id: contractId,
          version_number: 1,
          contract_data: contract,
          change_description: '최초 계약 체결',
          created_by: contract.created_by,
        });

        // 최종 서명 완료 이벤트
        await supabase.from('contract_signature_events').insert({
          contract_id: contractId,
          event_type: 'CONTRACT_COMPLETED',
          actor_type: 'SYSTEM',
          notes: '양측 서명 완료, 계약 체결',
        });

        // 관리자에게 알림
        const { data: adminFcmTokens } = await supabase
          .from('user_fcm_tokens')
          .select('fcm_token')
          .eq('user_id', contract.created_by)
          .eq('is_active', true);

        if (adminFcmTokens && adminFcmTokens.length > 0) {
          for (const tokenRecord of adminFcmTokens) {
            await pushNotificationService.send(tokenRecord.fcm_token, {
              title: '계약서 서명 완료',
              body: `${contract.staff?.name}님이 계약서에 서명했습니다.`,
              category: 'CONTRACT',
              deepLink: `/contracts/${contractId}`,
            });
          }
        }

        // 알림 저장 (관리자)
        await supabase.from('notifications').insert({
          user_id: contract.created_by,
          category: 'CONTRACT',
          priority: 'NORMAL',
          title: '계약서 서명 완료',
          body: `${contract.staff?.name}님이 근로계약서에 서명했습니다. 계약이 체결되었습니다.`,
          deep_link: `/contracts/${contractId}`,
          sent: true,
          sent_at: now,
        });

        return NextResponse.json({
          success: true,
          status: 'ACTIVE',
          message: '계약서 서명이 완료되었습니다.',
          pdfUrl,
        });
      } catch (pdfError) {
        console.error('Signed PDF generation error:', pdfError);
        // PDF 생성 실패해도 서명은 완료 처리
      }
    }

    // 한쪽만 서명한 경우
    const notifyUserId = signerType === 'EMPLOYEE' ? contract.created_by : contract.staff.id;
    const notifyName = signerType === 'EMPLOYEE' ? contract.staff?.name : '관리자';

    await supabase.from('notifications').insert({
      user_id: notifyUserId,
      category: 'CONTRACT',
      priority: 'HIGH',
      title: '계약서 서명 완료',
      body: `${notifyName}님이 계약서에 서명했습니다. ${signerType === 'EMPLOYEE' ? '귀하의 서명이 필요합니다.' : '직원의 서명을 기다리는 중입니다.'}`,
      deep_link: `/contracts/${contractId}`,
      sent: true,
      sent_at: now,
    });

    return NextResponse.json({
      success: true,
      status: newStatus,
      message: '서명이 저장되었습니다.',
      awaitingSignature: signerType === 'EMPLOYEE' ? 'EMPLOYER' : 'EMPLOYEE',
    });
  } catch (error) {
    console.error('Contract sign error:', error);
    return NextResponse.json(
      { error: '계약서 서명 처리에 실패했습니다.' },
      { status: 500 }
    );
  }
}

// 계약서 상세 조회 (서명 화면용)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const contractId = params.id;

    const { data: contract, error } = await supabase
      .from('contracts')
      .select(`
        *,
        staff:users!staff_id (
          id,
          name,
          email,
          phone
        ),
        company:companies!company_id (
          id,
          name,
          business_number,
          ceo_name,
          address
        )
      `)
      .eq('id', contractId)
      .single();

    if (error || !contract) {
      return NextResponse.json(
        { error: '계약서를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 만료 체크
    const isExpired =
      contract.expires_at && new Date(contract.expires_at) < new Date();

    // 서명 가능 여부
    const canSign =
      contract.status === 'SENT' ||
      (contract.status === 'DRAFT' && !contract.employee_signature);

    return NextResponse.json({
      contract: {
        ...contract,
        isExpired,
        canSign,
      },
    });
  } catch (error) {
    console.error('Contract fetch error:', error);
    return NextResponse.json(
      { error: '계약서 조회에 실패했습니다.' },
      { status: 500 }
    );
  }
}
