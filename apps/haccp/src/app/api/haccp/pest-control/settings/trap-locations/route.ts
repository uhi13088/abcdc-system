import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface TrapLocation {
  id?: string;
  zone_id?: string;
  location_code: string;
  location_name: string;
  trap_type: string;
  target_pest_category?: '비래해충' | '보행해충' | '설치류';
  sort_order?: number;
  is_active?: boolean;
}

// GET /api/haccp/pest-control/settings/trap-locations
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

    const { data, error } = await supabase
      .from('trap_locations')
      .select('*, zone:haccp_zones(id, zone_name, zone_grade)')
      .eq('company_id', userProfile.company_id)
      .order('sort_order');

    if (error) {
      console.error('Error fetching trap locations:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/haccp/pest-control/settings/trap-locations - 포획기 위치 추가
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const body: TrapLocation = await request.json();

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
      .from('trap_locations')
      .insert({
        company_id: userProfile.company_id,
        zone_id: body.zone_id,
        location_code: body.location_code,
        location_name: body.location_name,
        trap_type: body.trap_type,
        target_pest_category: body.target_pest_category,
        sort_order: body.sort_order || 0,
        is_active: body.is_active ?? true,
      })
      .select('*, zone:haccp_zones(id, zone_name, zone_grade)')
      .single();

    if (error) {
      console.error('Error creating trap location:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/haccp/pest-control/settings/trap-locations - 포획기 위치 수정
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const body: TrapLocation = await request.json();

    if (!body.id) {
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

    const { data, error } = await supabase
      .from('trap_locations')
      .update({
        zone_id: body.zone_id,
        location_name: body.location_name,
        trap_type: body.trap_type,
        target_pest_category: body.target_pest_category,
        sort_order: body.sort_order,
        is_active: body.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.id)
      .eq('company_id', userProfile.company_id)
      .select('*, zone:haccp_zones(id, zone_name, zone_grade)')
      .single();

    if (error) {
      console.error('Error updating trap location:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/haccp/pest-control/settings/trap-locations
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
      .from('trap_locations')
      .delete()
      .eq('id', id)
      .eq('company_id', userProfile.company_id);

    if (error) {
      console.error('Error deleting trap location:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
