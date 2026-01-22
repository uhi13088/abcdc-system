/**
 * QR 코드 서비스
 * 매장 출퇴근용 QR 코드 생성 및 검증
 */

import * as jwt from 'jsonwebtoken';
import QRCode from 'qrcode';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _supabaseClient: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!_supabaseClient) {
    _supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
  }
  return _supabaseClient;
}

const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (getSupabase() as any)[prop];
  }
});

function getQRSecret(): string {
  return process.env.QR_SECRET || 'abc-staff-qr-secret-key';
}

function getAppScheme(): string {
  return process.env.APP_SCHEME || 'abcstaff';
}

export interface QRPayload {
  type: 'STORE_CHECKIN';
  storeId: string;
  timestamp: number;
  nonce?: string;
}

export interface QRVerifyResult {
  valid: boolean;
  storeId: string;
  error?: string;
  expired?: boolean;
}

export class QRCodeService {
  /**
   * 매장 QR 코드 생성
   */
  async generateStoreQR(
    storeId: string,
    options: {
      expiresIn?: string;
      singleUse?: boolean;
      maxUses?: number;
    } = {}
  ): Promise<{
    qrDataUrl: string;
    token: string;
    expiresAt: Date;
  }> {
    const { expiresIn = '24h', singleUse = false, maxUses } = options;

    // 매장 존재 확인
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id, name, company_id')
      .eq('id', storeId)
      .single();

    if (storeError || !store) {
      throw new Error('Store not found');
    }

    // 고유 nonce 생성
    const nonce = Math.random().toString(36).substring(2, 15);

    // JWT 토큰 생성
    const payload: QRPayload = {
      type: 'STORE_CHECKIN',
      storeId,
      timestamp: Date.now(),
      nonce,
    };

    const token = jwt.sign(payload, getQRSecret(), { expiresIn } as jwt.SignOptions);

    // QR 코드 데이터 URL 생성
    const qrContent = `${getAppScheme()}://checkin/${token}`;
    const qrDataUrl = await QRCode.toDataURL(qrContent, {
      width: 300,
      margin: 2,
      errorCorrectionLevel: 'M',
    });

    // 만료 시간 계산
    const decoded = jwt.decode(token) as { exp: number };
    const expiresAt = new Date(decoded.exp * 1000);

    // store_qr_codes 테이블에 저장
    await supabase.from('store_qr_codes').insert({
      store_id: storeId,
      qr_token: token,
      qr_data_url: qrDataUrl,
      valid_until: expiresAt.toISOString(),
      single_use: singleUse,
      max_uses: maxUses,
      is_active: true,
    });

    // stores 테이블 업데이트 (현재 활성 QR)
    await supabase
      .from('stores')
      .update({
        qr_code: qrDataUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', storeId);

    return { qrDataUrl, token, expiresAt };
  }

  /**
   * QR 코드 검증
   */
  async verifyQR(token: string): Promise<QRVerifyResult> {
    try {
      // JWT 검증
      const decoded = jwt.verify(token, getQRSecret()) as QRPayload;

      if (decoded.type !== 'STORE_CHECKIN') {
        return { valid: false, storeId: '', error: 'Invalid QR type' };
      }

      // store_qr_codes에서 추가 검증
      const { data: qrRecord } = await supabase
        .from('store_qr_codes')
        .select('*')
        .eq('qr_token', token)
        .eq('is_active', true)
        .single();

      if (qrRecord) {
        // 일회용 QR 체크
        if (qrRecord.single_use && qrRecord.current_uses > 0) {
          return { valid: false, storeId: '', error: 'QR code already used' };
        }

        // 최대 사용 횟수 체크
        if (qrRecord.max_uses && qrRecord.current_uses >= qrRecord.max_uses) {
          return { valid: false, storeId: '', error: 'QR code usage limit exceeded' };
        }

        // 사용 횟수 증가
        await supabase
          .from('store_qr_codes')
          .update({
            current_uses: (qrRecord.current_uses || 0) + 1,
          })
          .eq('id', qrRecord.id);
      }

      return { valid: true, storeId: decoded.storeId };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return { valid: false, storeId: '', error: 'QR code expired', expired: true };
      }
      if (error instanceof jwt.JsonWebTokenError) {
        return { valid: false, storeId: '', error: 'Invalid QR code' };
      }
      return { valid: false, storeId: '', error: 'Verification failed' };
    }
  }

  /**
   * 매장의 활성 QR 코드 갱신
   */
  async refreshStoreQR(storeId: string): Promise<{
    qrDataUrl: string;
    token: string;
    expiresAt: Date;
  }> {
    // 기존 QR 비활성화
    await supabase
      .from('store_qr_codes')
      .update({ is_active: false })
      .eq('store_id', storeId);

    // 새 QR 생성
    return this.generateStoreQR(storeId);
  }

  /**
   * 일회용 QR 코드 생성 (관리자용)
   */
  async generateOneTimeQR(
    storeId: string,
    validMinutes: number = 30
  ): Promise<{
    qrDataUrl: string;
    token: string;
    expiresAt: Date;
  }> {
    return this.generateStoreQR(storeId, {
      expiresIn: `${validMinutes}m`,
      singleUse: true,
    });
  }

  /**
   * QR 코드 비활성화
   */
  async deactivateQR(qrId: string): Promise<void> {
    await supabase
      .from('store_qr_codes')
      .update({ is_active: false })
      .eq('id', qrId);
  }

  /**
   * 매장의 QR 코드 목록 조회
   */
  async getStoreQRCodes(
    storeId: string,
    activeOnly: boolean = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any[]> {
    let query = supabase
      .from('store_qr_codes')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return data || [];
  }
}

export const qrCodeService = new QRCodeService();

export default QRCodeService;
