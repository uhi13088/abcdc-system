import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

// GET /api/integrations/toss-pos/status - Toss POS 연결 상태 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await supabase
      .from('users')
      .select('company_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({
        connected: false,
        status: 'NOT_CONFIGURED',
        message: '회사 정보를 찾을 수 없습니다.',
      });
    }

    // Check for existing Toss POS integration
    const { data: integration, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('company_id', userProfile.company_id)
      .eq('integration_type', 'TOSS_POS')
      .single();

    if (error || !integration) {
      return NextResponse.json({
        connected: false,
        status: 'NOT_CONFIGURED',
        message: 'Toss POS가 연결되어 있지 않습니다.',
      });
    }

    // Check if token is still valid
    const isExpired = integration.token_expires_at
      ? new Date(integration.token_expires_at) < new Date()
      : true;

    return NextResponse.json({
      connected: integration.is_active && !isExpired,
      status: isExpired ? 'TOKEN_EXPIRED' : (integration.is_active ? 'CONNECTED' : 'DISCONNECTED'),
      store_id: integration.external_id,
      store_name: integration.store_name,
      last_sync: integration.last_synced_at,
      sync_enabled: integration.sync_enabled,
      message: isExpired
        ? '토큰이 만료되었습니다. 재연결이 필요합니다.'
        : (integration.is_active ? '정상 연결됨' : '연결 해제됨'),
    });
  } catch (error) {
    console.error('Toss POS status error:', error);
    return NextResponse.json({
      connected: false,
      status: 'ERROR',
      message: '상태 확인 중 오류가 발생했습니다.',
    });
  }
}

export const dynamic = 'force-dynamic';
