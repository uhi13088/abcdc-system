import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { CreateBrandSchema } from '@abc/shared';

// GET /api/brands - 브랜드 목록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const adminClient = createAdminClient();
    const searchParams = request.nextUrl.searchParams;
    const companyId = searchParams.get('companyId');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use adminClient to bypass RLS for user lookup
    const { data: userData, error: userError } = await adminClient
      .from('users')
      .select('role, company_id')
      .eq('auth_id', user.id)
      .single();

    if (userError) {
      console.error('[GET /api/brands] User lookup error:', userError);
    }

    if (!userData) {
      console.log('[GET /api/brands] No user data found for auth_id:', user.id);
      return NextResponse.json([]);
    }

    // If user has no company_id and is not super_admin, return empty array
    if (!userData.company_id && userData.role !== 'super_admin') {
      console.log('[GET /api/brands] User has no company_id:', user.id);
      return NextResponse.json([]);
    }

    let query = adminClient
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
      console.error('[GET /api/brands] Query error:', error);
      return NextResponse.json([]);
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('[GET /api/brands] Catch error:', error);
    return NextResponse.json([]);
  }
}

// POST /api/brands - 브랜드 생성
export async function POST(request: NextRequest) {
  const adminClient = createAdminClient();

  try {
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('[POST /api/brands] Unauthorized - no user');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use adminClient to bypass RLS for user lookup
    const { data: userData, error: userLookupError } = await adminClient
      .from('users')
      .select('id, role, company_id, name, email')
      .eq('auth_id', user.id)
      .single();

    if (userLookupError) {
      console.error('[POST /api/brands] User lookup error:', userLookupError);
      return NextResponse.json({
        error: `사용자 정보를 찾을 수 없습니다: ${userLookupError.message}`
      }, { status: 500 });
    }

    if (!userData) {
      console.error('[POST /api/brands] User not found for auth_id:', user.id);
      return NextResponse.json({ error: '사용자 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    console.log('[POST /api/brands] User data:', {
      id: userData.id,
      role: userData.role,
      company_id: userData.company_id,
      name: userData.name
    });

    // Check user permissions
    if (!['super_admin', 'company_admin'].includes(userData.role || '')) {
      console.log('[POST /api/brands] Forbidden - role:', userData.role);
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    console.log('[POST /api/brands] Request body:', body);

    let companyId = userData.company_id;

    // Auto-create company if user doesn't have one (for non-super_admin)
    if (!companyId && userData.role !== 'super_admin') {
      console.log('[POST /api/brands] Auto-creating company for user:', userData.id);

      // Create a new company
      const { data: newCompany, error: companyError } = await adminClient
        .from('companies')
        .insert({
          name: userData.name ? `${userData.name}의 회사` : '내 회사',
          status: 'ACTIVE',
        })
        .select()
        .single();

      if (companyError) {
        console.error('[POST /api/brands] Company creation failed:', companyError);
        return NextResponse.json({
          error: `회사 생성에 실패했습니다: ${companyError.message}`
        }, { status: 500 });
      }

      console.log('[POST /api/brands] Company created:', newCompany.id);

      // Link company to user
      const { error: updateError } = await adminClient
        .from('users')
        .update({ company_id: newCompany.id })
        .eq('id', userData.id);

      if (updateError) {
        console.error('[POST /api/brands] Failed to link company to user:', updateError);
        // Rollback - delete the created company
        await adminClient.from('companies').delete().eq('id', newCompany.id);
        return NextResponse.json({
          error: `회사 연결에 실패했습니다: ${updateError.message}`
        }, { status: 500 });
      }

      console.log('[POST /api/brands] Company linked to user successfully');
      companyId = newCompany.id;
    }

    // Final check - companyId must exist now
    if (!companyId && userData.role !== 'super_admin') {
      console.error('[POST /api/brands] companyId is still null after auto-creation attempt');
      return NextResponse.json({
        error: '회사 정보가 없습니다. 설정에서 회사 정보를 먼저 등록해주세요.'
      }, { status: 400 });
    }

    // For super_admin without company, use the one from request body
    if (userData.role === 'super_admin' && !companyId) {
      companyId = body.companyId;
    }

    // Build brand data with companyId
    const brandData = {
      name: body.name,
      description: body.description,
      logoUrl: body.logoUrl,
      companyId: companyId,
    };

    console.log('[POST /api/brands] Brand data for validation:', brandData);

    // Validate input
    const validation = CreateBrandSchema.safeParse(brandData);
    if (!validation.success) {
      console.error('[POST /api/brands] Validation failed:', validation.error.errors);
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    // Non-platform admins can only create brands in their company
    if (userData.role !== 'super_admin') {
      if (validation.data.companyId !== companyId) {
        console.log('[POST /api/brands] Company ID mismatch:', {
          validation: validation.data.companyId,
          user: companyId
        });
        return NextResponse.json(
          { error: '자신의 회사에만 브랜드를 생성할 수 있습니다.' },
          { status: 403 }
        );
      }
    }

    // Create brand using adminClient to bypass RLS
    console.log('[POST /api/brands] Creating brand with company_id:', validation.data.companyId);

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
      console.error('[POST /api/brands] Brand creation error:', error);
      if (error.code === '23505') {
        return NextResponse.json(
          { error: '동일한 이름의 브랜드가 이미 존재합니다.' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('[POST /api/brands] Brand created successfully:', data.id);
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('[POST /api/brands] Catch error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
