import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/salaries - 급여 목록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const searchParams = request.nextUrl.searchParams;
    const staffId = searchParams.get('staffId');
    const year = searchParams.get('year');
    const month = searchParams.get('month');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('role, company_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let query = supabase
      .from('salaries')
      .select(`
        *,
        staff:users!salaries_staff_id_fkey(id, name, email, position)
      `, { count: 'exact' })
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    // Role-based filtering
    if (userData.role === 'platform_admin') {
      // Can see all
    } else if (['company_admin', 'manager'].includes(userData.role)) {
      query = query.eq('company_id', userData.company_id);
    } else {
      query = query.eq('staff_id', user.id);
    }

    // Additional filters
    if (staffId) query = query.eq('staff_id', staffId);
    if (year) query = query.eq('year', parseInt(year));
    if (month) query = query.eq('month', parseInt(month));
    if (status) query = query.eq('status', status);

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// POST /api/salaries/calculate - 급여 계산 (월별)
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('role, company_id')
      .eq('auth_id', user.id)
      .single();

    if (!['platform_admin', 'company_admin', 'manager'].includes(userData?.role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { year, month, staffId } = body;

    // Get attendance data for the month
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    let attendanceQuery = supabase
      .from('attendances')
      .select('*')
      .eq('company_id', userData?.company_id)
      .gte('work_date', startDate)
      .lte('work_date', endDate);

    if (staffId) {
      attendanceQuery = attendanceQuery.eq('staff_id', staffId);
    }

    const { data: attendances } = await attendanceQuery;

    if (!attendances || attendances.length === 0) {
      return NextResponse.json(
        { error: '해당 월의 출퇴근 기록이 없습니다.' },
        { status: 400 }
      );
    }

    // Group by staff
    const staffAttendances = attendances.reduce((acc, att) => {
      if (!acc[att.staff_id]) {
        acc[att.staff_id] = [];
      }
      acc[att.staff_id].push(att);
      return acc;
    }, {} as Record<string, typeof attendances>);

    const results = [];

    for (const [staffId, records] of Object.entries(staffAttendances)) {
      // Calculate totals
      const totals = records.reduce(
        (sum, r) => ({
          workDays: sum.workDays + 1,
          totalHours: sum.totalHours + (r.work_hours || 0),
          basePay: sum.basePay + (r.base_pay || 0),
          overtimePay: sum.overtimePay + (r.overtime_pay || 0),
          nightPay: sum.nightPay + (r.night_pay || 0),
        }),
        { workDays: 0, totalHours: 0, basePay: 0, overtimePay: 0, nightPay: 0 }
      );

      // Calculate deductions (simplified)
      const grossPay = totals.basePay + totals.overtimePay + totals.nightPay;
      const nationalPension = Math.round(grossPay * 0.045);
      const healthInsurance = Math.round(grossPay * 0.03545);
      const longTermCare = Math.round(healthInsurance * 0.1281);
      const employmentInsurance = Math.round(grossPay * 0.009);
      const incomeTax = Math.round(grossPay * 0.03); // Simplified
      const localIncomeTax = Math.round(incomeTax * 0.1);

      const totalDeductions =
        nationalPension + healthInsurance + longTermCare + employmentInsurance + incomeTax + localIncomeTax;
      const netPay = grossPay - totalDeductions;

      // Check if salary record already exists
      const { data: existingSalary } = await supabase
        .from('salaries')
        .select('id')
        .eq('staff_id', staffId)
        .eq('year', year)
        .eq('month', month)
        .single();

      const salaryData = {
        staff_id: staffId,
        company_id: userData?.company_id,
        year,
        month,
        base_salary: totals.basePay,
        overtime_pay: totals.overtimePay,
        night_pay: totals.nightPay,
        holiday_pay: 0,
        weekly_holiday_pay: 0,
        meal_allowance: 0,
        transport_allowance: 0,
        position_allowance: 0,
        total_gross_pay: grossPay,
        national_pension: nationalPension,
        health_insurance: healthInsurance,
        long_term_care: longTermCare,
        employment_insurance: employmentInsurance,
        income_tax: incomeTax,
        local_income_tax: localIncomeTax,
        total_deductions: totalDeductions,
        net_pay: netPay,
        work_days: totals.workDays,
        total_hours: totals.totalHours,
        status: 'PENDING',
      };

      if (existingSalary) {
        const { data, error } = await supabase
          .from('salaries')
          .update(salaryData)
          .eq('id', existingSalary.id)
          .select()
          .single();

        if (!error) results.push(data);
      } else {
        const { data, error } = await supabase
          .from('salaries')
          .insert(salaryData)
          .select()
          .single();

        if (!error) results.push(data);
      }
    }

    return NextResponse.json({
      success: true,
      message: `${results.length}명의 급여가 계산되었습니다.`,
      data: results,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
