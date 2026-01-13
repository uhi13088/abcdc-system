import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * 토스 POS 연결 테스트 / 동기화
 * POST /api/integrations/toss-pos/test
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json(
        { success: false, message: '회사 정보가 없습니다.' },
        { status: 400 }
      );
    }

    // 연동 정보 조회
    const { data: integration } = await supabase
      .from('integrations')
      .select('*')
      .eq('company_id', userData.company_id)
      .eq('provider', 'toss_pos')
      .single();

    if (!integration?.connected) {
      return NextResponse.json(
        { success: false, message: '토스 POS가 연결되지 않았습니다.' },
        { status: 400 }
      );
    }

    // 데모 모드인 경우
    if (integration.settings?.demo_mode) {
      return NextResponse.json({
        success: true,
        message: '연결 테스트 성공 (데모 모드)',
        data: {
          connected: true,
          lastSync: new Date().toISOString(),
          demoMode: true,
        },
      });
    }

    // 실제 토스 API 호출 (토큰이 있는 경우)
    if (integration.access_token) {
      // 토큰 만료 체크
      if (new Date(integration.token_expires_at) < new Date()) {
        // 토큰 갱신 필요
        // TODO: refresh_token으로 새 access_token 발급
        return NextResponse.json(
          { success: false, message: '토큰이 만료되었습니다. 다시 연결해주세요.' },
          { status: 401 }
        );
      }

      // 토스 POS API로 매장 정보 조회 테스트
      const testResponse = await fetch('https://api.tosspayments.com/v1/stores', {
        headers: {
          'Authorization': `Bearer ${integration.access_token}`,
        },
      });

      if (testResponse.ok) {
        const stores = await testResponse.json();

        // 마지막 동기화 시간 업데이트
        await supabase
          .from('integrations')
          .update({ last_sync_at: new Date().toISOString() })
          .eq('id', integration.id);

        return NextResponse.json({
          success: true,
          message: '연결 테스트 성공',
          data: {
            connected: true,
            lastSync: new Date().toISOString(),
            stores: stores.length || 0,
          },
        });
      } else {
        return NextResponse.json(
          { success: false, message: '토스 API 연결 실패' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: '연결 상태 확인됨',
      data: { connected: true },
    });
  } catch (error) {
    console.error('Toss POS test error:', error);
    return NextResponse.json(
      { success: false, message: '연결 테스트 실패' },
      { status: 500 }
    );
  }
}
