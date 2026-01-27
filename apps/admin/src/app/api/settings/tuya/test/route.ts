import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

interface TuyaSettings {
  client_id: string;
  client_secret: string;
  region: 'cn' | 'us' | 'eu' | 'in';
  enabled: boolean;
}

const TUYA_REGIONS: Record<string, string> = {
  cn: 'https://openapi.tuyacn.com',
  us: 'https://openapi.tuyaus.com',
  eu: 'https://openapi.tuyaeu.com',
  in: 'https://openapi.tuyain.com',
};

// Tuya API 서명 생성
function generateTuyaSign(
  clientId: string,
  secret: string,
  t: string,
  accessToken: string = ''
): string {
  const str = clientId + t + accessToken;
  return crypto
    .createHmac('sha256', secret)
    .update(str)
    .digest('hex')
    .toUpperCase();
}

// POST /api/settings/tuya/test - Tuya API 연결 테스트
export async function POST() {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await adminClient
      .from('users')
      .select('role')
      .eq('auth_id', user.id)
      .single();

    if (userData?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Tuya 설정 가져오기
    const { data: settings } = await adminClient
      .from('platform_kv_settings')
      .select('value')
      .eq('key', 'tuya_api')
      .single();

    if (!settings) {
      return NextResponse.json({
        success: false,
        message: 'Tuya API 설정이 없습니다. 먼저 설정을 저장해주세요.'
      }, { status: 400 });
    }

    const tuyaSettings = settings.value as TuyaSettings;

    if (!tuyaSettings.client_id || !tuyaSettings.client_secret) {
      return NextResponse.json({
        success: false,
        message: 'Client ID 또는 Secret이 설정되지 않았습니다.'
      }, { status: 400 });
    }

    const baseUrl = TUYA_REGIONS[tuyaSettings.region] || TUYA_REGIONS.us;
    const t = Date.now().toString();
    const sign = generateTuyaSign(tuyaSettings.client_id, tuyaSettings.client_secret, t);

    // 토큰 발급 테스트
    const response = await fetch(`${baseUrl}/v1.0/token?grant_type=1`, {
      method: 'GET',
      headers: {
        'client_id': tuyaSettings.client_id,
        'sign': sign,
        't': t,
        'sign_method': 'HMAC-SHA256',
      },
    });

    const result = await response.json();

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Tuya API 연결 성공!',
        data: {
          expire_time: result.result?.expire_time,
          region: tuyaSettings.region,
        }
      });
    } else {
      return NextResponse.json({
        success: false,
        message: `연결 실패: ${result.msg || 'Unknown error'}`,
        code: result.code,
      });
    }
  } catch (error) {
    console.error('[POST /api/settings/tuya/test] Error:', error);
    return NextResponse.json({
      success: false,
      message: '연결 테스트 중 오류가 발생했습니다.'
    }, { status: 500 });
  }
}
