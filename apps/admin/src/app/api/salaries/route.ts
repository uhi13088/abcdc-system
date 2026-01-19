import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/salaries - 급여 목록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
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
      .from('salaries')
      .select(`
        *,
        staff:users!salaries_staff_id_fkey(id, name, email, position)
      `, { count: 'exact' })
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    // Role-based filtering
    if (userData.role === 'super_admin') {
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
      console.error('Salaries API error:', error);
      return NextResponse.json({
        data: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
        summary: { totalGross: 0, totalDeductions: 0, totalNet: 0 },
      });
    }

    // Fetch summary totals for ALL salaries matching the filter (not just current page)
    let summaryQuery = supabase
      .from('salaries')
      .select('total_gross_pay, total_deductions, net_pay');

    if (userData.role === 'super_admin') {
      // Can see all
    } else if (['company_admin', 'manager'].includes(userData.role)) {
      summaryQuery = summaryQuery.eq('company_id', userData.company_id);
    } else {
      summaryQuery = summaryQuery.eq('staff_id', user.id);
    }

    if (staffId) summaryQuery = summaryQuery.eq('staff_id', staffId);
    if (year) summaryQuery = summaryQuery.eq('year', parseInt(year));
    if (month) summaryQuery = summaryQuery.eq('month', parseInt(month));
    if (status) summaryQuery = summaryQuery.eq('status', status);

    const { data: allSalaries } = await summaryQuery;

    const summary = (allSalaries || []).reduce(
      (acc, s) => ({
        totalGross: acc.totalGross + (s.total_gross_pay || 0),
        totalDeductions: acc.totalDeductions + (s.total_deductions || 0),
        totalNet: acc.totalNet + (s.net_pay || 0),
      }),
      { totalGross: 0, totalDeductions: 0, totalNet: 0 }
    );

    return NextResponse.json({
      data: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
      summary,
    });
  } catch (error) {
    console.error('Salaries API catch error:', error);
    return NextResponse.json({
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
  }
}

// POST /api/salaries/calculate - 급여 계산 (월별)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('id, role, company_id, name')
      .eq('auth_id', user.id)
      .single();

    if (!['super_admin', 'company_admin', 'manager'].includes(userData?.role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let companyId = userData?.company_id;

    // Auto-create company if user doesn't have one
    if (!companyId && userData?.role !== 'super_admin') {
      const adminClient = createAdminClient();

      const { data: newCompany, error: companyError } = await adminClient
        .from('companies')
        .insert({
          name: userData?.name ? `${userData.name}의 회사` : '내 회사',
          status: 'ACTIVE',
        })
        .select()
        .single();

      if (companyError) {
        return NextResponse.json({
          error: `회사 생성에 실패했습니다: ${companyError.message}`
        }, { status: 500 });
      }

      // Link company to user
      await adminClient
        .from('users')
        .update({ company_id: newCompany.id })
        .eq('id', userData?.id);

      companyId = newCompany.id;
    }

    // If still no company, return error
    if (!companyId && userData?.role !== 'super_admin') {
      return NextResponse.json(
        { error: '회사 정보가 필요합니다. 먼저 브랜드/매장을 생성해주세요.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { year, month, staffId } = body;

    if (!year || !month) {
      return NextResponse.json(
        { error: '연도와 월을 입력해주세요.' },
        { status: 400 }
      );
    }

    // Get attendance data for the month
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    let attendanceQuery = supabase
      .from('attendances')
      .select('*')
      .eq('company_id', companyId)
      .gte('work_date', startDate)
      .lte('work_date', endDate);

    if (staffId) {
      attendanceQuery = attendanceQuery.eq('staff_id', staffId);
    }

    const { data: attendances } = await attendanceQuery;

    if (!attendances || attendances.length === 0) {
      return NextResponse.json(
        { error: '해당 월의 출퇴근 기록이 없습니다. 먼저 출퇴근 기록을 등록해주세요.' },
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

    // Get contracts for hourly rate lookup
    const staffIds = Object.keys(staffAttendances);
    const { data: contracts } = await supabase
      .from('contracts')
      .select('staff_id, salary_config, standard_hours_per_day')
      .in('staff_id', staffIds)
      .in('status', ['ACTIVE', 'SIGNED', 'DRAFT']);

    const contractMap = (contracts || []).reduce((acc, c) => {
      acc[c.staff_id] = c;
      return acc;
    }, {} as Record<string, any>);

    for (const [staffId, records] of Object.entries(staffAttendances) as [string, typeof attendances][]) {
      // Get hourly rate from contract
      const contract = contractMap[staffId];
      const salaryConfig = contract?.salary_config || {};
      let hourlyRate = 9860; // 2024 minimum wage default

      if (salaryConfig.baseSalaryType === 'HOURLY') {
        hourlyRate = salaryConfig.baseSalaryAmount || hourlyRate;
      } else if (salaryConfig.baseSalaryType === 'MONTHLY') {
        // Monthly salary → hourly (월급 / 209시간)
        hourlyRate = Math.round((salaryConfig.baseSalaryAmount || 0) / 209);
      }

      const standardHoursPerDay = contract?.standard_hours_per_day || 8;

      // Calculate totals (include records without checkout using scheduled time)
      const totals = records.reduce(
        (sum, r) => {
          let workHours = r.work_hours || 0;
          let basePay = r.base_pay || 0;
          let overtimePay = r.overtime_pay || 0;
          let nightPay = r.night_pay || 0;

          // 퇴근 기록이 없는 경우, 예정 시간 기준으로 계산
          if (!r.actual_check_out && r.actual_check_in) {
            const checkIn = new Date(r.actual_check_in);
            let checkOut: Date;

            if (r.scheduled_check_out) {
              checkOut = new Date(r.scheduled_check_out);
            } else {
              // 예정 퇴근 시간도 없으면 기본 근무시간 사용
              checkOut = new Date(checkIn.getTime() + standardHoursPerDay * 60 * 60 * 1000);
            }

            const diffMs = checkOut.getTime() - checkIn.getTime();
            workHours = Math.max(0, diffMs / (1000 * 60 * 60));
            const breakHours = workHours >= 8 ? 1 : workHours >= 4 ? 0.5 : 0;
            const actualWorkHours = Math.max(0, workHours - breakHours);
            const overtimeHours = Math.max(0, actualWorkHours - 8);

            basePay = Math.min(actualWorkHours, 8) * hourlyRate;
            overtimePay = overtimeHours * hourlyRate * 1.5;
            workHours = actualWorkHours;
          }

          return {
            workDays: sum.workDays + 1,
            totalHours: sum.totalHours + workHours,
            basePay: sum.basePay + basePay,
            overtimePay: sum.overtimePay + overtimePay,
            nightPay: sum.nightPay + nightPay,
          };
        },
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
        company_id: companyId,
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
