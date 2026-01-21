import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient, createAdminClient } from '@/lib/supabase/server';

// GET /api/business/sales - 매출 목록
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month') || new Date().toISOString().slice(0, 7);
    const companyIdParam = searchParams.get('company_id');

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use admin client to get user profile (bypasses RLS)
    const { data: userProfile } = await adminClient
      .from('users')
      .select('company_id, role')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Determine which company_id to use
    let targetCompanyId = userProfile.company_id;

    // super_admin can query any company or all companies
    if (userProfile.role === 'super_admin') {
      if (companyIdParam) {
        targetCompanyId = companyIdParam;
      } else if (!targetCompanyId) {
        // super_admin without company_id and no filter - return empty array
        // They need to select a specific company
        return NextResponse.json([]);
      }
    } else if (!targetCompanyId) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const startDate = month + '-01';
    // Calculate the actual last day of the month
    const [year, monthNum] = month.split('-').map(Number);
    const lastDayOfMonth = new Date(year, monthNum, 0).getDate();
    const endDate = month + '-' + String(lastDayOfMonth).padStart(2, '0');

    // Use admin client for the query to bypass RLS issues
    const { data, error } = await adminClient
      .from('daily_sales')
      .select('*')
      .eq('company_id', targetCompanyId)
      .gte('sale_date', startDate)
      .lte('sale_date', endDate)
      .order('sale_date', { ascending: false });

    if (error) {
      console.error('Error fetching sales:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/business/sales - 매출 생성
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();
    const body = await request.json();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use admin client to get user profile
    const { data: userProfile } = await adminClient
      .from('users')
      .select('company_id, role')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Determine company_id - allow super_admin to specify in body
    let targetCompanyId = userProfile.company_id;
    if (userProfile.role === 'super_admin' && body.company_id) {
      targetCompanyId = body.company_id;
    }

    if (!targetCompanyId) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 });
    }

    const { data, error } = await adminClient
      .from('daily_sales')
      .insert({
        ...body,
        company_id: targetCompanyId,
        is_auto_synced: false,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating sale:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
