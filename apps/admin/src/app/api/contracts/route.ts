import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { CreateContractSchema } from '@abc/shared';

// GET /api/contracts - 계약서 목록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    const storeId = searchParams.get('storeId');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('role, company_id, brand_id, store_id')
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
      .from('contracts')
      .select(`
        *,
        staff:users!contracts_staff_id_fkey(id, name, email, phone, position),
        stores(id, name),
        brands(id, name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    // Role-based filtering
    if (userData.role === 'super_admin') {
      // Can see all
    } else if (['company_admin', 'manager'].includes(userData.role)) {
      query = query.eq('company_id', userData.company_id);
    } else if (userData.role === 'store_manager') {
      query = query.eq('store_id', userData.store_id);
    } else {
      query = query.eq('staff_id', user.id);
    }

    // Additional filters
    if (storeId) query = query.eq('store_id', storeId);
    if (status) query = query.eq('status', status);

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('Contracts API error:', error);
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
    console.error('Contracts API catch error:', error);
    return NextResponse.json({
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
  }
}

// POST /api/contracts - 계약서 생성
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('id, role, company_id, store_id')
      .eq('auth_id', user.id)
      .single();

    if (!['super_admin', 'company_admin', 'manager', 'store_manager'].includes(userData?.role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();

    const validation = CreateContractSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    // Role-based permission check for contract creation
    // super_admin: can create contracts for any company
    // company_admin, manager: can only create contracts for their own company
    // store_manager: can only create contracts for their own store
    if (userData?.role !== 'super_admin') {
      if (userData?.role === 'store_manager') {
        // store_manager can only create contracts for their own store
        if (validation.data.storeId !== userData.store_id) {
          return NextResponse.json(
            { error: '자신이 관리하는 매장의 계약서만 생성할 수 있습니다.' },
            { status: 403 }
          );
        }
      } else {
        // company_admin, manager can only create contracts for their own company
        if (validation.data.companyId !== userData?.company_id) {
          return NextResponse.json(
            { error: '자신의 회사 계약서만 생성할 수 있습니다.' },
            { status: 403 }
          );
        }
      }
    }

    // Generate contract number
    const year = new Date().getFullYear();
    const { count } = await supabase
      .from('contracts')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${year}-01-01`);

    const contractNumber = `CT${year}${String((count || 0) + 1).padStart(6, '0')}`;

    // Prepare contract data
    const contractData = {
      contract_number: contractNumber,
      staff_id: validation.data.staffId,
      company_id: validation.data.companyId,
      brand_id: validation.data.brandId,
      store_id: validation.data.storeId,
      contract_type: validation.data.contractType,
      start_date: validation.data.startDate,
      end_date: validation.data.endDate,
      probation_months: validation.data.probationMonths,
      work_schedules: validation.data.workSchedules,
      position: validation.data.position,
      department: validation.data.department,
      duties: validation.data.duties,
      salary_config: validation.data.salaryConfig,
      deduction_config: validation.data.deductionConfig,
      standard_hours_per_week: validation.data.standardHoursPerWeek,
      standard_hours_per_day: validation.data.standardHoursPerDay,
      break_minutes: validation.data.breakMinutes,
      annual_leave_days: validation.data.annualLeaveDays,
      paid_leave_days: validation.data.paidLeaveDays,
      sick_leave_days: validation.data.sickLeaveDays,
      status: 'DRAFT',
      created_by: userData?.id,
    };

    // Use regular client - RLS policies enforce role-based access control
    const { data, error } = await supabase
      .from('contracts')
      .insert(contractData)
      .select()
      .single();

    if (error) {
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
