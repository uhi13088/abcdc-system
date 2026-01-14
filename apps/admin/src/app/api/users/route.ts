import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { CreateUserSchema } from '@abc/shared';

// GET /api/users - 직원 목록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const searchParams = request.nextUrl.searchParams;
    const role = searchParams.get('role');
    const status = searchParams.get('status');
    const storeId = searchParams.get('storeId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use adminClient to bypass RLS when checking current user
    const { data: userData } = await adminClient
      .from('users')
      .select('role, company_id, brand_id, store_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      // User not found, return empty data
      return NextResponse.json({
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });
    }

    // If user has no company_id and is not super_admin, return empty data
    if (!userData.company_id && userData.role !== 'super_admin') {
      return NextResponse.json({
        data: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      });
    }

    // Use adminClient to bypass RLS for fetching employee list
    let query = adminClient
      .from('users')
      .select(`
        *,
        stores(id, name),
        brands(id, name),
        companies(id, name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    // Role-based filtering
    if (userData.role === 'super_admin') {
      // Can see all users
    } else if (['company_admin', 'manager'].includes(userData.role)) {
      query = query.eq('company_id', userData.company_id);
    } else if (userData.role === 'store_manager') {
      query = query.eq('store_id', userData.store_id);
    } else {
      // Regular staff can only see themselves
      query = query.eq('auth_id', user.id);
    }

    // Exclude company_admin and super_admin from employee list (they are admins, not employees)
    // Only include them if specifically filtering by role
    if (!role) {
      query = query.not('role', 'in', '(company_admin,super_admin)');
    }

    // Additional filters
    if (role) query = query.eq('role', role);
    if (status) query = query.eq('status', status);
    if (storeId) query = query.eq('store_id', storeId);

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('Users API error:', error);
      return NextResponse.json({
        data: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      });
    }

    return NextResponse.json({
      data: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Users API catch error:', error);
    return NextResponse.json({
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
  }
}

// POST /api/users - 직원 생성
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use adminClient to bypass RLS for user role check
    const { data: currentUser } = await adminClient
      .from('users')
      .select('role, company_id')
      .eq('auth_id', user.id)
      .single();

    if (!['super_admin', 'company_admin', 'manager', 'store_manager'].includes(currentUser?.role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();

    const validation = CreateUserSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    // Create auth user first (requires admin client with service role)
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: validation.data.email,
      password: validation.data.password,
      email_confirm: true,
    });

    if (authError) {
      if (authError.message.includes('already registered')) {
        return NextResponse.json(
          { error: '이미 등록된 이메일입니다.' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }

    // Create user profile
    const { data, error } = await adminClient
      .from('users')
      .insert({
        auth_id: authData.user.id,
        email: validation.data.email,
        name: validation.data.name,
        role: validation.data.role,
        company_id: validation.data.companyId || currentUser?.company_id,
        brand_id: validation.data.brandId,
        store_id: validation.data.storeId,
        team_id: validation.data.teamId,
        phone: validation.data.phone,
        address: validation.data.address,
        birth_date: validation.data.birthDate,
        position: validation.data.position,
        status: 'ACTIVE',
      })
      .select()
      .single();

    if (error) {
      // Cleanup: delete auth user if profile creation fails
      await adminClient.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('User creation error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
