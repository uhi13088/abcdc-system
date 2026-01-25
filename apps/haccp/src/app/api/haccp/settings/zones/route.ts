import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface Zone {
  id?: string;
  zone_code: string;
  zone_name: string;
  zone_grade: '청결구역' | '일반구역';
  sort_order?: number;
  is_active?: boolean;
}

// GET /api/haccp/settings/zones - 구역 목록 조회
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

    const { data: zones, error } = await supabase
      .from('haccp_zones')
      .select('*')
      .eq('company_id', userProfile.company_id)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching zones:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 구역이 없으면 기본 템플릿에서 복사
    if (!zones || zones.length === 0) {
      const { data: templates } = await supabase
        .from('haccp_zones_template')
        .select('zone_code, zone_name, zone_grade, sort_order')
        .order('sort_order', { ascending: true });

      if (templates && templates.length > 0) {
        const newZones = templates.map((t) => ({
          company_id: userProfile.company_id,
          zone_code: t.zone_code,
          zone_name: t.zone_name,
          zone_grade: t.zone_grade,
          sort_order: t.sort_order,
          is_active: true,
        }));

        const { data: insertedZones, error: insertError } = await supabase
          .from('haccp_zones')
          .insert(newZones)
          .select();

        if (insertError) {
          console.error('Error inserting default zones:', insertError);
        }

        return NextResponse.json(insertedZones || []);
      }
    }

    return NextResponse.json(zones || []);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/haccp/settings/zones - 구역 추가
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const body: Zone = await request.json();

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

    const { data, error } = await supabase
      .from('haccp_zones')
      .insert({
        company_id: userProfile.company_id,
        zone_code: body.zone_code,
        zone_name: body.zone_name,
        zone_grade: body.zone_grade,
        sort_order: body.sort_order || 0,
        is_active: body.is_active ?? true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating zone:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/haccp/settings/zones - 구역 수정 (bulk update)
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const body: { zones: Zone[] } = await request.json();

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

    // 각 구역 업데이트
    for (const zone of body.zones) {
      if (zone.id) {
        await supabase
          .from('haccp_zones')
          .update({
            zone_name: zone.zone_name,
            zone_grade: zone.zone_grade,
            sort_order: zone.sort_order,
            is_active: zone.is_active,
          })
          .eq('id', zone.id)
          .eq('company_id', userProfile.company_id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/haccp/settings/zones - 구역 삭제
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Zone ID required' }, { status: 400 });
    }

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

    const { error } = await supabase
      .from('haccp_zones')
      .delete()
      .eq('id', id)
      .eq('company_id', userProfile.company_id);

    if (error) {
      console.error('Error deleting zone:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
