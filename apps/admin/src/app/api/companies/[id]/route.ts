import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/companies/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 사용자 정보 조회
    const { data: userData } = await supabase
      .from('users')
      .select('role, company_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 회사 격리 체크 - super_admin이 아니면 본인 회사만 조회 가능
    if (userData.role !== 'super_admin' && userData.company_id !== id) {
      return NextResponse.json({ error: '자신의 회사만 조회할 수 있습니다.' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: '회사를 찾을 수 없습니다.' }, { status: 404 });
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

// PUT /api/companies/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('role, company_id')
      .eq('auth_id', user.id)
      .single();

    // 역할 권한 체크
    if (!['super_admin', 'company_admin'].includes(userData?.role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 회사 격리 체크 - super_admin이 아니면 본인 회사만 수정 가능
    if (userData?.role !== 'super_admin' && userData?.company_id !== id) {
      return NextResponse.json({ error: '자신의 회사만 수정할 수 있습니다.' }, { status: 403 });
    }

    const body = await request.json();

    const updateData: Record<string, unknown> = {};
    if (body.name) updateData.name = body.name;
    if (body.businessNumber !== undefined) updateData.business_number = body.businessNumber;
    if (body.ceoName !== undefined) updateData.ceo_name = body.ceoName;
    if (body.address !== undefined) updateData.address = body.address;
    if (body.phone !== undefined) updateData.phone = body.phone;

    const { data, error } = await supabase
      .from('companies')
      .update(updateData)
      .eq('id', id)
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
