import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { CreateBrandSchema } from '@abc/shared';

// GET /api/brands - 브랜드 목록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const searchParams = request.nextUrl.searchParams;
    const companyId = searchParams.get('companyId');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's company
    const { data: userData } = await supabase
      .from('users')
      .select('role, company_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json([]);
    }

    // If user has no company_id and is not super_admin, return empty array
    if (!userData.company_id && userData.role !== 'super_admin') {
      return NextResponse.json([]);
    }

    let query = supabase
      .from('brands')
      .select('*, companies(name)')
      .order('created_at', { ascending: false });

    // Filter by company
    if (userData.role === 'super_admin' && companyId) {
      query = query.eq('company_id', companyId);
    } else if (userData.role !== 'super_admin') {
      query = query.eq('company_id', userData.company_id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Brands API error:', error);
      return NextResponse.json([]);
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Brands API catch error:', error);
    return NextResponse.json([]);
  }
}

// POST /api/brands - 브랜드 생성
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

    if (!['super_admin', 'company_admin'].includes(userData?.role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    let companyId = userData?.company_id;

    // Auto-create company if user doesn't have one
    if (!companyId && userData?.role !== 'super_admin') {
      // Get user info for company name
      const { data: userInfo } = await supabase
        .from('users')
        .select('id, name, email')
        .eq('auth_id', user.id)
        .single();

      // Use admin client to bypass RLS for company creation
      const adminClient = createAdminClient();

      // Create a new company using service role to bypass RLS
      const { data: newCompany, error: companyError } = await adminClient
        .from('companies')
        .insert({
          name: userInfo?.name ? `${userInfo.name}의 회사` : '내 회사',
          status: 'ACTIVE',
        })
        .select()
        .single();

      if (companyError) {
        console.error('Failed to create company:', companyError);
        return NextResponse.json({
          error: `회사 생성에 실패했습니다: ${companyError.message}`
        }, { status: 500 });
      }

      // Link company to user using admin client
      const { error: updateError } = await adminClient
        .from('users')
        .update({ company_id: newCompany.id })
        .eq('id', userInfo?.id);

      if (updateError) {
        console.error('Failed to link company to user:', updateError);
      }

      companyId = newCompany.id;
    }

    // Auto-fill companyId from user's company for non-super_admin
    const brandData = {
      ...body,
      companyId: userData?.role === 'super_admin' ? body.companyId : companyId,
    };

    // Validate input
    const validation = CreateBrandSchema.safeParse(brandData);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    // Non-platform admins can only create brands in their company
    if (userData?.role !== 'super_admin') {
      // Use companyId variable which is updated after auto-creation
      if (validation.data.companyId !== companyId) {
        return NextResponse.json(
          { error: '자신의 회사에만 브랜드를 생성할 수 있습니다.' },
          { status: 403 }
        );
      }
    }

    // Use admin client to bypass RLS for brand creation
    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from('brands')
      .insert({
        company_id: validation.data.companyId,
        name: validation.data.name,
        logo_url: validation.data.logoUrl || null,
        description: validation.data.description || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: '동일한 이름의 브랜드가 이미 존재합니다.' },
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
