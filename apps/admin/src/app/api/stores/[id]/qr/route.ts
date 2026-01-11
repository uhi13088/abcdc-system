/**
 * 매장 QR 코드 관리 API
 * GET /api/stores/[id]/qr - QR 코드 조회
 * POST /api/stores/[id]/qr - QR 코드 생성
 * DELETE /api/stores/[id]/qr - QR 코드 비활성화
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { QRCodeService } from '@/lib/services/qr-code.service';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const qrService = new QRCodeService();

// QR 코드 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const storeId = params.id;

    // 매장 정보 및 현재 QR 코드 조회
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id, name, qr_code')
      .eq('id', storeId)
      .single();

    if (storeError || !store) {
      return NextResponse.json(
        { error: '매장을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 활성 QR 코드 목록 조회
    const qrCodes = await qrService.getStoreQRCodes(storeId, true);

    return NextResponse.json({
      store: {
        id: store.id,
        name: store.name,
        currentQR: store.qr_code,
      },
      qrCodes,
    });
  } catch (error) {
    console.error('QR code fetch error:', error);
    return NextResponse.json(
      { error: 'QR 코드 조회에 실패했습니다.' },
      { status: 500 }
    );
  }
}

// QR 코드 생성
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const storeId = params.id;
    const body = await request.json();
    const {
      expiresIn = '24h',
      singleUse = false,
      maxUses,
      refreshExisting = true,
    } = body;

    // 매장 존재 확인
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id, name')
      .eq('id', storeId)
      .single();

    if (storeError || !store) {
      return NextResponse.json(
        { error: '매장을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    let result;

    if (refreshExisting) {
      // 기존 QR 비활성화 후 새로 생성
      result = await qrService.refreshStoreQR(storeId);
    } else if (singleUse) {
      // 일회용 QR 생성
      const minutes = parseInt(expiresIn.replace('m', '').replace('h', '')) *
        (expiresIn.includes('h') ? 60 : 1);
      result = await qrService.generateOneTimeQR(storeId, minutes);
    } else {
      // 일반 QR 생성
      result = await qrService.generateStoreQR(storeId, {
        expiresIn,
        singleUse,
        maxUses,
      });
    }

    return NextResponse.json({
      success: true,
      qrCode: result.qrDataUrl,
      token: result.token,
      expiresAt: result.expiresAt,
      message: 'QR 코드가 생성되었습니다.',
    });
  } catch (error) {
    console.error('QR code generation error:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'QR 코드 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}

// QR 코드 비활성화
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const storeId = params.id;
    const { searchParams } = new URL(request.url);
    const qrId = searchParams.get('qrId');

    if (qrId) {
      // 특정 QR 비활성화
      await qrService.deactivateQR(qrId);
    } else {
      // 매장의 모든 활성 QR 비활성화
      await supabase
        .from('store_qr_codes')
        .update({ is_active: false })
        .eq('store_id', storeId);
    }

    return NextResponse.json({
      success: true,
      message: 'QR 코드가 비활성화되었습니다.',
    });
  } catch (error) {
    console.error('QR code deactivation error:', error);
    return NextResponse.json(
      { error: 'QR 코드 비활성화에 실패했습니다.' },
      { status: 500 }
    );
  }
}
