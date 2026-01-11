import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { CreateStoreSchema } from '@abc/shared';

// GET /api/stores - 매장 목록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const searchParams = request.nextUrl.searchParams;
    const companyId = searchParams.get('companyId');
    const brandId = searchParams.get('brandId');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's company
    const { data: userData } = await supabase
      .from('users')
      .select('role, company_id, brand_id, store_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      // User not found in users table, return empty array
      return NextResponse.json([]);
    }

    // If user has no company_id, return empty array
    if (!userData.company_id && userData.role !== 'super_admin') {
      return NextResponse.json([]);
    }

    let query = supabase
      .from('stores')
      .select('*, brands(name), companies(name)')
      .order('created_at', { ascending: false });

    // Filter based on user role
    if (userData.role === 'super_admin') {
      if (companyId) query = query.eq('company_id', companyId);
      if (brandId) query = query.eq('brand_id', brandId);
    } else if (['company_admin', 'manager'].includes(userData.role)) {
      query = query.eq('company_id', userData.company_id);
      if (brandId) query = query.eq('brand_id', brandId);
    } else if (userData.role === 'store_manager') {
      query = query.eq('id', userData.store_id);
    } else {
      query = query.eq('id', userData.store_id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Stores API error:', error);
      // Return empty array instead of error for missing tables etc.
      return NextResponse.json([]);
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Stores API catch error:', error);
    return NextResponse.json([]);
  }
}

// POST /api/stores - 매장 생성
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check user permissions
    const { data: userData } = await supabase
      .from('users')
      .select('role, company_id')
      .eq('auth_id', user.id)
      .single();

    if (!['super_admin', 'company_admin', 'manager'].includes(userData?.role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();

    // Validate input
    const validation = CreateStoreSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    // Verify brand belongs to the company
    const { data: brand } = await supabase
      .from('brands')
      .select('company_id')
      .eq('id', validation.data.brandId)
      .single();

    if (!brand) {
      return NextResponse.json(
        { error: '브랜드가 존재하지 않습니다.' },
        { status: 404 }
      );
    }

    if (brand.company_id !== validation.data.companyId) {
      return NextResponse.json(
        { error: '브랜드가 해당 회사에 속하지 않습니다.' },
        { status: 400 }
      );
    }

    // Non-platform admins can only create stores in their company
    if (userData?.role !== 'super_admin') {
      if (validation.data.companyId !== userData?.company_id) {
        return NextResponse.json(
          { error: '자신의 회사에만 매장을 생성할 수 있습니다.' },
          { status: 403 }
        );
      }
    }

    const { data, error } = await supabase
      .from('stores')
      .insert(validation.data)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: '동일한 이름의 매장이 해당 브랜드에 이미 존재합니다.' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
