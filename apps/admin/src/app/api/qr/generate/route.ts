/**
 * POST /api/qr/generate - 매장 QR 코드 생성
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { qrCodeService } from '@/lib/services/qr-code.service';
import { z } from 'zod';

const GenerateQRSchema = z.object({
  storeId: z.string().uuid('유효한 매장 ID가 필요합니다'),
  expiresIn: z.string().optional().default('24h'),
  singleUse: z.boolean().optional().default(false),
  maxUses: z.number().int().positive().optional(),
});

export async function POST(request: NextRequest) {
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

    if (!userData || !['super_admin', 'company_admin', 'manager', 'store_manager'].includes(userData.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 요청 데이터 검증
    const body = await request.json();
    const validation = GenerateQRSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { storeId, expiresIn, singleUse, maxUses } = validation.data;

    // 매장 권한 확인
    const { data: store } = await adminClient
      .from('stores')
      .select('id, name, company_id')
      .eq('id', storeId)
      .single();

    if (!store || store.company_id !== userData.company_id) {
      return NextResponse.json({ error: '매장을 찾을 수 없습니다.' }, { status: 404 });
    }

    // QR 코드 생성
    const result = await qrCodeService.generateStoreQR(storeId, {
      expiresIn,
      singleUse,
      maxUses,
    });

    return NextResponse.json({
      message: 'QR 코드가 생성되었습니다.',
      data: {
        qrDataUrl: result.qrDataUrl,
        token: result.token,
        expiresAt: result.expiresAt,
        storeName: store.name,
      },
    });
  } catch (error) {
    console.error('[POST /api/qr/generate] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
