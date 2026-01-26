import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface SeasonConfig {
  동절기: { start_month: number; end_month: number };
  하절기: { start_month: number; end_month: number };
}

const DEFAULT_SEASON_CONFIG: SeasonConfig = {
  동절기: { start_month: 11, end_month: 3 },
  하절기: { start_month: 4, end_month: 10 },
};

// 현재 시즌 계산
function getCurrentSeason(config: SeasonConfig): '동절기' | '하절기' {
  const currentMonth = new Date().getMonth() + 1; // 1-12

  const winterStart = config.동절기.start_month;
  const winterEnd = config.동절기.end_month;

  // 동절기가 연말-연초를 걸치는 경우 (11~3)
  if (winterStart > winterEnd) {
    if (currentMonth >= winterStart || currentMonth <= winterEnd) {
      return '동절기';
    }
  } else {
    if (currentMonth >= winterStart && currentMonth <= winterEnd) {
      return '동절기';
    }
  }

  return '하절기';
}

// GET /api/haccp/settings/seasons - 시즌 설정 조회
export async function GET() {
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
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 시즌 설정 조회
    const { data: settings } = await supabase
      .from('haccp_app_settings')
      .select('setting_value')
      .eq('company_id', userProfile.company_id)
      .eq('setting_key', 'season_config')
      .single();

    const config = (settings?.setting_value as SeasonConfig) || DEFAULT_SEASON_CONFIG;
    const currentSeason = getCurrentSeason(config);

    return NextResponse.json({
      config,
      currentSeason,
      currentMonth: new Date().getMonth() + 1,
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/haccp/settings/seasons - 시즌 설정 수정
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const body: { config: SeasonConfig } = await request.json();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await supabase
      .from('users')
      .select('company_id, role')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    if (!['super_admin', 'company_admin', 'manager'].includes(userProfile.role)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    // Upsert 설정
    const { error } = await supabase
      .from('haccp_app_settings')
      .upsert(
        {
          company_id: userProfile.company_id,
          setting_key: 'season_config',
          setting_value: body.config,
          description: '시즌 설정 (동절기/하절기 월 범위)',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'company_id,setting_key' }
      );

    if (error) {
      console.error('Error updating season config:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const currentSeason = getCurrentSeason(body.config);

    return NextResponse.json({
      success: true,
      config: body.config,
      currentSeason,
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
