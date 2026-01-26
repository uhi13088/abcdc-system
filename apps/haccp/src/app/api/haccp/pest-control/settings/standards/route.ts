import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface Standard {
  id?: string;
  season: '동절기' | '하절기';
  zone_grade: '청결구역' | '일반구역';
  pest_category: '비래해충' | '보행해충' | '설치류';
  level: 1 | 2;
  upper_limit: number;
  lower_limit?: number;
  description?: string;
}

// POST /api/haccp/pest-control/settings/standards - 관리 기준 추가
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const body: Standard = await request.json();

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
      .from('pest_control_standards')
      .insert({
        company_id: userProfile.company_id,
        season: body.season,
        zone_grade: body.zone_grade,
        pest_category: body.pest_category,
        level: body.level,
        upper_limit: body.upper_limit,
        lower_limit: body.lower_limit || 0,
        description: body.description,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating standard:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/haccp/pest-control/settings/standards - 관리 기준 수정 (bulk)
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const body: { standards: Standard[] } = await request.json();

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

    // 각 기준 업데이트
    for (const standard of body.standards) {
      if (standard.id) {
        await supabase
          .from('pest_control_standards')
          .update({
            upper_limit: standard.upper_limit,
            lower_limit: standard.lower_limit,
            description: standard.description,
            updated_at: new Date().toISOString(),
          })
          .eq('id', standard.id)
          .eq('company_id', userProfile.company_id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/haccp/pest-control/settings/standards
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 });
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
      .from('pest_control_standards')
      .delete()
      .eq('id', id)
      .eq('company_id', userProfile.company_id);

    if (error) {
      console.error('Error deleting standard:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
