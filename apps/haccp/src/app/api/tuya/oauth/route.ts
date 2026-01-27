import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
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

async function getTuyaToken(settings: TuyaSettings): Promise<{ access_token: string; uid: string } | null> {
  const baseUrl = TUYA_REGIONS[settings.region] || TUYA_REGIONS.us;
  const t = Date.now().toString();
  const sign = generateTuyaSign(settings.client_id, settings.client_secret, t);

  const response = await fetch(`${baseUrl}/v1.0/token?grant_type=1`, {
    method: 'GET',
    headers: {
      'client_id': settings.client_id,
      'sign': sign,
      't': t,
      'sign_method': 'HMAC-SHA256',
    },
  });

  const result = await response.json();
  if (result.success && result.result) {
    return {
      access_token: result.result.access_token,
      uid: result.result.uid,
    };
  }
  return null;
}

// GET /api/tuya/oauth - Tuya OAuth 상태 확인
export async function GET() {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await adminClient
      .from('users')
      .select('id, company_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Tuya 플랫폼 설정 확인
    const { data: platformSettings } = await adminClient
      .from('platform_kv_settings')
      .select('value')
      .eq('key', 'tuya_api')
      .single();

    if (!platformSettings) {
      return NextResponse.json({
        available: false,
        message: 'Smart Life 연동이 아직 설정되지 않았습니다. 관리자에게 문의하세요.'
      });
    }

    const tuyaSettings = platformSettings.value as TuyaSettings;
    if (!tuyaSettings.enabled) {
      return NextResponse.json({
        available: false,
        message: 'Smart Life 연동이 비활성화 되어있습니다.'
      });
    }

    // 사용자의 Tuya 연결 상태 확인
    const { data: userTuya } = await adminClient
      .from('user_tuya_connections')
      .select('*')
      .eq('user_id', userData.id)
      .single();

    return NextResponse.json({
      available: true,
      connected: !!userTuya,
      tuya_uid: userTuya?.tuya_uid || null,
      connected_at: userTuya?.connected_at || null,
      device_count: userTuya?.device_count || 0,
    });
  } catch (error) {
    console.error('[GET /api/tuya/oauth] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/tuya/oauth - Smart Life 계정 연결 (username/password 방식)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await adminClient
      .from('users')
      .select('id, company_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { country_code, username, password, schema } = body;

    if (!username || !password) {
      return NextResponse.json({ error: '아이디와 비밀번호를 입력해주세요.' }, { status: 400 });
    }

    // Tuya 플랫폼 설정 가져오기
    const { data: platformSettings } = await adminClient
      .from('platform_kv_settings')
      .select('value')
      .eq('key', 'tuya_api')
      .single();

    if (!platformSettings) {
      return NextResponse.json({ error: 'Tuya API가 설정되지 않았습니다.' }, { status: 400 });
    }

    const tuyaSettings = platformSettings.value as TuyaSettings;
    if (!tuyaSettings.enabled) {
      return NextResponse.json({ error: 'Smart Life 연동이 비활성화 되어있습니다.' }, { status: 400 });
    }

    // Tuya API 토큰 받기
    const tokenResult = await getTuyaToken(tuyaSettings);
    if (!tokenResult) {
      return NextResponse.json({ error: 'Tuya API 인증 실패' }, { status: 500 });
    }

    const baseUrl = TUYA_REGIONS[tuyaSettings.region] || TUYA_REGIONS.us;
    const t = Date.now().toString();
    const sign = generateTuyaSign(
      tuyaSettings.client_id,
      tuyaSettings.client_secret,
      t,
      tokenResult.access_token
    );

    // Smart Life 사용자 등록/로그인
    // 비밀번호 MD5 해시
    const passwordHash = crypto.createHash('md5').update(password).digest('hex');

    const userResponse = await fetch(`${baseUrl}/v1.0/iot-03/users/login`, {
      method: 'POST',
      headers: {
        'client_id': tuyaSettings.client_id,
        'sign': sign,
        't': t,
        'sign_method': 'HMAC-SHA256',
        'access_token': tokenResult.access_token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        country_code: country_code || '82', // 한국 기본값
        username,
        password: passwordHash,
        schema: schema || 'smartlife', // Smart Life 앱
      }),
    });

    const userResult = await userResponse.json();

    if (!userResult.success) {
      // 에러 코드별 메시지 처리
      const errorMessages: Record<number, string> = {
        2002: '아이디 또는 비밀번호가 올바르지 않습니다.',
        2006: '계정을 찾을 수 없습니다.',
        2010: '너무 많은 로그인 시도가 있었습니다. 잠시 후 다시 시도해주세요.',
      };
      return NextResponse.json({
        error: errorMessages[userResult.code] || userResult.msg || '로그인 실패'
      }, { status: 400 });
    }

    const tuyaUser = userResult.result;

    // 사용자 Tuya 연결 정보 저장
    const { error: saveError } = await adminClient
      .from('user_tuya_connections')
      .upsert({
        user_id: userData.id,
        company_id: userData.company_id,
        tuya_uid: tuyaUser.uid,
        tuya_username: username,
        access_token: tuyaUser.access_token,
        refresh_token: tuyaUser.refresh_token,
        expire_time: tuyaUser.expire_time,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (saveError) {
      console.error('[POST /api/tuya/oauth] Save error:', saveError);
      return NextResponse.json({ error: '연결 정보 저장 실패' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Smart Life 계정이 연결되었습니다!',
      tuya_uid: tuyaUser.uid,
    });
  } catch (error) {
    console.error('[POST /api/tuya/oauth] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/tuya/oauth - Smart Life 연결 해제
export async function DELETE() {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await adminClient
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 연결 정보 삭제
    await adminClient
      .from('user_tuya_connections')
      .delete()
      .eq('user_id', userData.id);

    // 연결된 기기 삭제
    await adminClient
      .from('tuya_devices')
      .delete()
      .eq('user_id', userData.id);

    return NextResponse.json({
      success: true,
      message: 'Smart Life 연결이 해제되었습니다.'
    });
  } catch (error) {
    console.error('[DELETE /api/tuya/oauth] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
