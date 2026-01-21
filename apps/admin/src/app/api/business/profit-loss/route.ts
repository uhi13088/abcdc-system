import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient, createAdminClient } from '@/lib/supabase/server';

// GET /api/business/profit-loss
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));
    const periodType = searchParams.get('type') || 'MONTHLY';
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

    // super_admin can query any company
    if (userProfile.role === 'super_admin') {
      if (companyIdParam) {
        targetCompanyId = companyIdParam;
      } else if (!targetCompanyId) {
        // super_admin without company_id and no filter - return empty array
        return NextResponse.json([]);
      }
    } else if (!targetCompanyId) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const { data, error } = await adminClient
      .from('profit_loss_statements')
      .select('*')
      .eq('company_id', targetCompanyId)
      .eq('period_year', year)
      .eq('period_type', periodType)
      .order('period_month', { ascending: false });

    if (error) {
      console.error('Error fetching profit loss statements:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
