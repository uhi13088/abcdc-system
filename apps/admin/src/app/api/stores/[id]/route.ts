import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/stores/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('stores')
      .select(`
        *,
        brands(id, name),
        companies(id, name)
      `)
      .eq('id', params.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: '매장을 찾을 수 없습니다.' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// PUT /api/stores/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const updateData: Record<string, unknown> = {};
    if (body.name) updateData.name = body.name;
    if (body.address !== undefined) updateData.address = body.address || null;
    if (body.phone !== undefined) updateData.phone = body.phone || null;
    if (body.latitude !== undefined) updateData.latitude = body.latitude || null;
    if (body.longitude !== undefined) updateData.longitude = body.longitude || null;
    if (body.allowedRadius !== undefined) updateData.allowed_radius = body.allowedRadius;
    if (body.defaultHourlyRate !== undefined) updateData.default_hourly_rate = body.defaultHourlyRate || null;

    // 출퇴근 허용시간 설정
    if (body.earlyCheckinMinutes !== undefined) updateData.early_checkin_minutes = body.earlyCheckinMinutes;
    if (body.earlyCheckoutMinutes !== undefined) updateData.early_checkout_minutes = body.earlyCheckoutMinutes;

    // Use admin client to bypass RLS
    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from('stores')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// DELETE /api/stores/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if there are employees in this store
    const { count: employeeCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', params.id);

    if (employeeCount && employeeCount > 0) {
      return NextResponse.json(
        { error: '해당 매장에 소속된 직원이 있어 삭제할 수 없습니다.' },
        { status: 400 }
      );
    }

    // Use admin client to bypass RLS
    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from('stores')
      .delete()
      .eq('id', params.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
