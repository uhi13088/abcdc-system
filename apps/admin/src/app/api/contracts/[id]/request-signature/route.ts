/**
 * 계약서 서명 요청 API
 * POST /api/contracts/[id]/request-signature
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { emailService, pushNotificationService } from '@abc/shared/server';
import { ContractPDFService } from '@/lib/services/contract-pdf.service';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = getSupabaseClient();
  try {
    const contractId = params.id;

    // 계약서 정보 조회
    const { data: contract, error: contractError } = await supabase
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

    if (!contract.staff?.email) {
      return NextResponse.json(
        { error: '직원 이메일 정보가 없습니다.' },
        { status: 400 }
      );
    }

    // 이미 서명된 계약서인지 확인
    if (contract.status === 'SIGNED' || contract.status === 'ACTIVE') {
      return NextResponse.json(
        { error: '이미 서명이 완료된 계약서입니다.' },
        { status: 400 }
      );
    }

    // 초안 PDF 생성
    const pdfService = new ContractPDFService();
    const pdf = await pdfService.generateDraft(contractId);

    // Storage에 저장
    await pdfService.saveToStorage(contractId, pdf, 'draft');

    // 만료일 계산 (7일 후)
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 7);

    // 상태 업데이트
    await supabase
      .from('contracts')
      .update({
        status: 'SENT',
        sent_at: new Date().toISOString(),
        sent_via: 'EMAIL',
        expires_at: expiryDate.toISOString(),
      })
      .eq('id', contractId);

    // 서명 이벤트 기록
    await supabase.from('contract_signature_events').insert({
      contract_id: contractId,
      event_type: 'SIGNATURE_REQUESTED',
      actor_type: 'EMPLOYER',
      actor_id: contract.created_by,
      notes: '계약서 서명 요청 발송',
    });

    // 이메일 발송
    const emailResult = await emailService.sendContractForSignature(
      contract.staff.email,
      contractId,
      {
        staffName: contract.staff.name,
        companyName: contract.company?.name || '',
        expiryDate: expiryDate.toLocaleDateString('ko-KR'),
      }
    );

    if (!emailResult.success) {
      console.error('Contract email sending failed:', emailResult.error);
      // 이메일 실패해도 계속 진행 (푸시 알림은 보냄)
    }

    // 푸시 알림 발송
    const { data: fcmTokens } = await supabase
      .from('user_fcm_tokens')
      .select('fcm_token')
      .eq('user_id', contract.staff.id)
      .eq('is_active', true);

    if (fcmTokens && fcmTokens.length > 0) {
      for (const tokenRecord of fcmTokens) {
        await pushNotificationService.sendContractSignatureRequest(
          tokenRecord.fcm_token,
          {
            contractId,
            companyName: contract.company?.name || '',
          }
        );
      }
    }

    // 알림 기록 저장
    await supabase.from('notifications').insert({
      user_id: contract.staff.id,
      category: 'CONTRACT',
      priority: 'HIGH',
      title: '계약서 서명 요청',
      body: `${contract.company?.name || '회사'}에서 근로계약서를 발송했습니다. 확인 후 서명해주세요.`,
      deep_link: `/contracts/${contractId}/sign`,
      data: {
        contractId,
        action: 'SIGN',
      },
      sent: true,
      sent_at: new Date().toISOString(),
      expires_at: expiryDate.toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: '계약서 서명 요청이 발송되었습니다.',
      expiresAt: expiryDate.toISOString(),
      emailSent: emailResult.success,
    });
  } catch (error) {
    console.error('Contract signature request error:', error);
    return NextResponse.json(
      { error: '계약서 서명 요청 발송에 실패했습니다.' },
      { status: 500 }
    );
  }
}

// 리마인더 발송
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = getSupabaseClient();
  try {
    const contractId = params.id;

    const { data: contract, error } = await supabase
      .from('contracts')
      .select(`
        *,
        staff:users!staff_id (
          id,
          name,
          email
        ),
        company:companies!company_id (
          name
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

    if (contract.status !== 'SENT') {
      return NextResponse.json(
        { error: '서명 대기 중인 계약서만 리마인더를 보낼 수 있습니다.' },
        { status: 400 }
      );
    }

    // 리마인더 횟수 체크
    if (contract.reminder_count >= 3) {
      return NextResponse.json(
        { error: '리마인더는 최대 3회까지 발송 가능합니다.' },
        { status: 400 }
      );
    }

    // 리마인더 카운트 업데이트
    await supabase
      .from('contracts')
      .update({
        reminder_count: (contract.reminder_count || 0) + 1,
        last_reminder_at: new Date().toISOString(),
      })
      .eq('id', contractId);

    // 알림 발송 (이메일 + 푸시)
    if (contract.staff?.email) {
      await emailService.sendNotification(
        contract.staff.email,
        `[리마인더] 계약서 서명을 완료해주세요`,
        `<p>${contract.staff.name}님, ${contract.company?.name || '회사'}에서 발송한 근로계약서가 아직 서명되지 않았습니다.</p>
         <p>계약서 확인 및 서명을 부탁드립니다.</p>`
      );
    }

    return NextResponse.json({
      success: true,
      reminderCount: (contract.reminder_count || 0) + 1,
    });
  } catch (error) {
    console.error('Reminder send error:', error);
    return NextResponse.json(
      { error: '리마인더 발송에 실패했습니다.' },
      { status: 500 }
    );
  }
}
