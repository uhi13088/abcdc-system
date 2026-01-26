import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface PestType {
  id?: string;
  pest_category: '비래해충' | '보행해충' | '설치류';
  pest_name: string;
  sort_order?: number;
  is_active?: boolean;
}

// POST /api/haccp/pest-control/settings/pest-types - 해충 종류 추가
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const body: PestType = await request.json();

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
      .from('pest_types')
      .insert({
        company_id: userProfile.company_id,
        pest_category: body.pest_category,
        pest_name: body.pest_name,
        sort_order: body.sort_order || 0,
        is_active: body.is_active ?? true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating pest type:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/haccp/pest-control/settings/pest-types - 해충 종류 수정
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const body: PestType = await request.json();

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
      .from('pest_types')
      .update({
        pest_name: body.pest_name,
        sort_order: body.sort_order,
        is_active: body.is_active,
      })
      .eq('id', body.id)
      .eq('company_id', userProfile.company_id)
      .select()
      .single();

    if (error) {
      console.error('Error updating pest type:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/haccp/pest-control/settings/pest-types
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
      .from('pest_types')
      .delete()
      .eq('id', id)
      .eq('company_id', userProfile.company_id);

    if (error) {
      console.error('Error deleting pest type:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
