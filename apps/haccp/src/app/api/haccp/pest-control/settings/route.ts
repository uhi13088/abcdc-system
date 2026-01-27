import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/haccp/pest-control/settings - 방충방서 설정 전체 조회
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

    // 해충 종류 조회
    let { data: pestTypes } = await supabase
      .from('pest_types')
      .select('*')
      .eq('company_id', userProfile.company_id)
      .order('pest_category')
      .order('sort_order');

    // 해충 종류가 없으면 기본 템플릿에서 복사
    if (!pestTypes || pestTypes.length === 0) {
      const { data: templates } = await supabase
        .from('pest_types_template')
        .select('pest_category, pest_name, sort_order');

      if (templates && templates.length > 0) {
        const newPestTypes = templates.map((t) => ({
          company_id: userProfile.company_id,
          pest_category: t.pest_category,
          pest_name: t.pest_name,
          sort_order: t.sort_order,
          is_active: true,
        }));

        const { data: inserted } = await supabase
          .from('pest_types')
          .insert(newPestTypes)
          .select();

        pestTypes = inserted;
      }
    }

    // 관리 기준 조회
    let { data: standards } = await supabase
      .from('pest_control_standards')
      .select('*')
      .eq('company_id', userProfile.company_id)
      .order('season')
      .order('zone_grade')
      .order('pest_category')
      .order('level');

    // 관리 기준이 없으면 기본 템플릿에서 복사
    if (!standards || standards.length === 0) {
      const { data: templates } = await supabase
        .from('pest_control_standards_template')
        .select('season, zone_grade, pest_category, level, upper_limit');

      if (templates && templates.length > 0) {
        const newStandards = templates.map((t) => ({
          company_id: userProfile.company_id,
          season: t.season,
          zone_grade: t.zone_grade,
          pest_category: t.pest_category,
          level: t.level,
          upper_limit: t.upper_limit,
          lower_limit: 0,
        }));

        const { data: inserted } = await supabase
          .from('pest_control_standards')
          .insert(newStandards)
          .select();

        standards = inserted;
      }
    }

    // 포획기 위치 조회
    const { data: trapLocations } = await supabase
      .from('trap_locations')
      .select('*, zone:haccp_zones(zone_name, zone_grade)')
      .eq('company_id', userProfile.company_id)
      .order('sort_order');

    // 구역 목록도 함께 반환
    const { data: zones } = await supabase
      .from('haccp_zones')
      .select('*')
      .eq('company_id', userProfile.company_id)
      .eq('is_active', true)
      .order('sort_order');

    return NextResponse.json({
      pestTypes: pestTypes || [],
      standards: standards || [],
      trapLocations: trapLocations || [],
      zones: zones || [],
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
