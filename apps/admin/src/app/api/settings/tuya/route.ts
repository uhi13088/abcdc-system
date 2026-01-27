import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// Tuya API 설정 타입
interface TuyaSettings {
  client_id: string;
  client_secret: string;
  region: 'cn' | 'us' | 'eu' | 'in';
  enabled: boolean;
  webhook_secret?: string; // Tuya Message Service 검증용
}

// GET /api/settings/tuya - Tuya API 설정 조회 (super_admin only)
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
      .select('company_id, role')
      .eq('auth_id', user.id)
      .single();

    // super_admin만 Tuya API 설정 조회 가능
    if (userData?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 플랫폼 레벨 Tuya 설정 조회
    const { data: settings } = await adminClient
      .from('platform_kv_settings')
      .select('value')
      .eq('key', 'tuya_api')
      .single();

    if (!settings) {
      return NextResponse.json({
        client_id: '',
        client_secret: '',
        region: 'us',
        enabled: false,
      });
    }

    // 민감 정보는 마스킹
    const tuyaSettings = settings.value as TuyaSettings;

    // Webhook URL 생성 (실시간 알림용)
    const baseUrl = process.env.NEXT_PUBLIC_HACCP_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3002';
    const webhookUrl = `${baseUrl}/api/tuya/webhook`;

    return NextResponse.json({
      client_id: tuyaSettings.client_id ? '****' + tuyaSettings.client_id.slice(-4) : '',
      client_secret: tuyaSettings.client_secret ? '********' : '',
      webhook_secret: tuyaSettings.webhook_secret ? '********' : '',
      region: tuyaSettings.region || 'us',
      enabled: tuyaSettings.enabled || false,
      configured: !!(tuyaSettings.client_id && tuyaSettings.client_secret),
      webhook_url: webhookUrl,
      webhook_configured: !!tuyaSettings.webhook_secret,
    });
  } catch (error) {
    console.error('[GET /api/settings/tuya] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/settings/tuya - Tuya API 설정 저장 (super_admin only)
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
      .select('role')
      .eq('auth_id', user.id)
      .single();

    if (userData?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { client_id, client_secret, webhook_secret, region, enabled } = body;

    if (!client_id || !client_secret) {
      return NextResponse.json({ error: 'Client ID와 Secret은 필수입니다.' }, { status: 400 });
    }

    // 기존 설정 가져오기
    const { data: existingSettings } = await adminClient
      .from('platform_kv_settings')
      .select('value')
      .eq('key', 'tuya_api')
      .single();

    const existingValue = existingSettings?.value as TuyaSettings | undefined;

    const newSettings: TuyaSettings = {
      client_id: client_id.startsWith('****')
        ? existingValue?.client_id || ''
        : client_id,
      client_secret: client_secret === '********'
        ? existingValue?.client_secret || ''
        : client_secret,
      webhook_secret: webhook_secret === '********'
        ? existingValue?.webhook_secret || ''
        : webhook_secret || undefined,
      region: region || 'us',
      enabled: enabled ?? true,
    };

    // Upsert 설정
    const { error } = await adminClient
      .from('platform_kv_settings')
      .upsert({
        key: 'tuya_api',
        value: newSettings,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });

    if (error) {
      console.error('[POST /api/settings/tuya] Save error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Tuya API 설정이 저장되었습니다.',
      configured: true,
    });
  } catch (error) {
    console.error('[POST /api/settings/tuya] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/settings/tuya - Tuya API 설정 삭제 (super_admin only)
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
      .select('role')
      .eq('auth_id', user.id)
      .single();

    if (userData?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await adminClient
      .from('platform_kv_settings')
      .delete()
      .eq('key', 'tuya_api');

    return NextResponse.json({ message: 'Tuya API 설정이 삭제되었습니다.' });
  } catch (error) {
    console.error('[DELETE /api/settings/tuya] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
