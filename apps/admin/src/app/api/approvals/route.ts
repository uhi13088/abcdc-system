import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/approvals - 승인 요청 목록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('id, role, company_id, store_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
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

    let query = supabase
      .from('approval_requests')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    // Role-based filtering
    if (userData.role === 'super_admin') {
      // Can see all
    } else if (['company_admin', 'manager'].includes(userData.role)) {
      query = query.eq('company_id', userData.company_id);
    } else if (userData.role === 'store_manager') {
      query = query.or(`store_id.eq.${userData.store_id},requester_id.eq.${userData.id}`);
    } else {
      query = query.eq('requester_id', userData.id);
    }

    // Additional filters
    if (type) query = query.eq('type', type);
    if (status) query = query.eq('final_status', status);

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('Approvals API error:', error);
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
    console.error('Approvals API catch error:', error);
    return NextResponse.json({
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
  }
}

// POST /api/approvals - 승인 요청 생성
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('id, name, role, company_id, brand_id, store_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { type, details } = body;

    // Get approvers based on type and user's position
    const { data: approvers } = await supabase
      .from('users')
      .select('id, name, role')
      .eq('company_id', userData.company_id)
      .in('role', ['store_manager', 'manager', 'company_admin'])
      .neq('id', userData.id)
      .order('role');

    const approvalLine = approvers?.map((approver, index) => ({
      order: index + 1,
      approverId: approver.id,
      approverName: approver.name,
      approverRole: approver.role,
      status: 'PENDING',
    })) || [];

    const { data, error } = await supabase
      .from('approval_requests')
      .insert({
        type,
        requester_id: userData.id,
        requester_name: userData.name,
        requester_role: userData.role,
        company_id: userData.company_id,
        brand_id: userData.brand_id,
        store_id: userData.store_id,
        approval_line: approvalLine,
        current_step: 1,
        final_status: 'PENDING',
        details,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
