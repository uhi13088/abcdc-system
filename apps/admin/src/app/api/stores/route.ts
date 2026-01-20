import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { CreateStoreSchema, logger } from '@abc/shared';

// GET /api/stores - 매장 목록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const searchParams = request.nextUrl.searchParams;
    const companyId = searchParams.get('companyId');
    const brandId = searchParams.get('brandId');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use adminClient to bypass RLS for user lookup
    const { data: userData, error: userError } = await adminClient
      .from('users')
      .select('role, company_id, brand_id, store_id')
      .eq('auth_id', user.id)
      .single();

    if (userError) {
      console.error('[GET /api/stores] User lookup error:', userError);
    }

    if (!userData) {
      logger.log('[GET /api/stores] No user data found for auth_id:', user.id);
      return NextResponse.json([]);
    }

    // If user has no company_id, return empty array
    if (!userData.company_id && userData.role !== 'super_admin') {
      return NextResponse.json([]);
    }

    let query = adminClient
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
      console.error('[GET /api/stores] Query error:', error);
      return NextResponse.json([]);
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('[GET /api/stores] Catch error:', error);
    return NextResponse.json([]);
  }
}

// POST /api/stores - 매장 생성
export async function POST(request: NextRequest) {
  const adminClient = createAdminClient();

  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use adminClient to bypass RLS for user lookup
    const { data: userData, error: userLookupError } = await adminClient
      .from('users')
      .select('id, role, company_id')
      .eq('auth_id', user.id)
      .single();

    if (userLookupError) {
      console.error('[POST /api/stores] User lookup error:', userLookupError);
      return NextResponse.json({
        error: `사용자 정보를 찾을 수 없습니다: ${userLookupError.message}`
      }, { status: 500 });
    }

    if (!userData) {
      return NextResponse.json({ error: '사용자 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    // Check user permissions
    if (!['super_admin', 'company_admin', 'manager'].includes(userData.role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();

    // Auto-fill companyId from user's company for non-super_admin
    let storeData = { ...body };
    if (userData.role !== 'super_admin' && !storeData.companyId) {
      storeData.companyId = userData.company_id;
    }

    // Validate input
    const validation = CreateStoreSchema.safeParse(storeData);
    if (!validation.success) {
      console.error('[POST /api/stores] Validation failed:', validation.error.errors);
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    // Verify brand belongs to the company
    const { data: brand, error: brandError } = await adminClient
      .from('brands')
      .select('company_id')
      .eq('id', validation.data.brandId)
      .single();

    if (brandError || !brand) {
      console.error('[POST /api/stores] Brand lookup error:', brandError);
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
    if (userData.role !== 'super_admin') {
      if (validation.data.companyId !== userData.company_id) {
        return NextResponse.json(
          { error: '자신의 회사에만 매장을 생성할 수 있습니다.' },
          { status: 403 }
        );
      }
    }

    // Create store using adminClient
    // 기본 필드만 저장 (급여설정은 019_store_settings.sql 마이그레이션 적용 후 활성화)
    const { data, error } = await adminClient
      .from('stores')
      .insert({
        company_id: validation.data.companyId,
        brand_id: validation.data.brandId,
        name: validation.data.name,
        address: validation.data.address || null,
        phone: validation.data.phone || null,
        latitude: validation.data.latitude || null,
        longitude: validation.data.longitude || null,
        allowed_radius: validation.data.allowedRadius,
        early_checkin_minutes: validation.data.earlyCheckinMinutes,
        early_checkout_minutes: validation.data.earlyCheckoutMinutes,
        default_hourly_rate: validation.data.defaultHourlyRate || null,
        haccp_enabled: body.haccpEnabled || false,
        roasting_enabled: body.roastingEnabled || false,
      })
      .select()
      .single();

    if (error) {
      console.error('[POST /api/stores] Store creation error:', error);
      if (error.code === '23505') {
        return NextResponse.json(
          { error: '동일한 이름의 매장이 해당 브랜드에 이미 존재합니다.' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    logger.log('[POST /api/stores] Store created successfully:', data.id);
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('[POST /api/stores] Catch error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
