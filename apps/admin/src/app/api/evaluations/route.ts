import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET - List evaluations
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const period = searchParams.get('period');
    const status = searchParams.get('status');

    let query = supabase
      .from('employee_evaluations')
      .select(`
        *,
        users:user_id (id, name, email),
        evaluators:evaluator_id (id, name, email)
      `)
      .order('created_at', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching evaluations:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform data for frontend
    const evaluations = (data || []).map(record => {
      const periodStart = new Date(record.evaluation_period_start);
      const quarter = Math.ceil((periodStart.getMonth() + 1) / 3);
      const year = periodStart.getFullYear();
      const evaluationPeriod = `${year}년 ${quarter}분기`;

      return {
        id: record.id,
        staff_id: record.user_id,
        staff_name: record.users?.name || 'Unknown',
        evaluator_name: record.evaluators?.name || 'Unknown',
        evaluation_period: evaluationPeriod,
        evaluation_date: record.created_at?.split('T')[0],
        overall_score: parseFloat(record.overall_score) || 0,
        categories: {
          attendance: parseFloat(record.attendance_score) || 3,
          performance: parseFloat(record.performance_score) || 3,
          teamwork: parseFloat(record.teamwork_score) || 3,
          initiative: parseFloat(record.skill_score) || 3, // Using skill as initiative
          skill: parseFloat(record.skill_score) || 3,
        },
        strengths: record.strengths || '',
        improvements: record.improvements || '',
        goals: record.goals || '',
        status: record.status,
      };
    }).filter(e => !period || e.evaluation_period === period);

    return NextResponse.json({ evaluations });
  } catch (error) {
    console.error('Evaluations API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new evaluation
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current user info
    const { data: userData } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', user.id)
      .single();

    if (!userData || !['super_admin', 'company_admin', 'manager', 'store_manager'].includes(userData.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { user_id, evaluation_period, categories, strengths, improvements, goals, status: evalStatus } = body;

    if (!user_id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Parse evaluation period to get start/end dates
    const periodMatch = evaluation_period?.match(/(\d{4})년\s*(\d)분기/);
    let periodStart: Date, periodEnd: Date;

    if (periodMatch) {
      const year = parseInt(periodMatch[1]);
      const quarter = parseInt(periodMatch[2]);
      periodStart = new Date(year, (quarter - 1) * 3, 1);
      periodEnd = new Date(year, quarter * 3, 0);
    } else {
      // Default to current quarter
      const now = new Date();
      const quarter = Math.ceil((now.getMonth() + 1) / 3);
      periodStart = new Date(now.getFullYear(), (quarter - 1) * 3, 1);
      periodEnd = new Date(now.getFullYear(), quarter * 3, 0);
    }

    // Calculate overall score
    const scores = categories ? Object.values(categories) as number[] : [3, 3, 3, 3, 3];
    const overallScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;

    const { data, error } = await supabase
      .from('employee_evaluations')
      .insert({
        user_id,
        evaluator_id: userData.id,
        evaluation_period_start: periodStart.toISOString().split('T')[0],
        evaluation_period_end: periodEnd.toISOString().split('T')[0],
        overall_score: overallScore.toFixed(1),
        attendance_score: categories?.attendance || 3,
        performance_score: categories?.performance || 3,
        teamwork_score: categories?.teamwork || 3,
        skill_score: categories?.skill || categories?.initiative || 3,
        strengths,
        improvements,
        goals,
        status: evalStatus || 'SUBMITTED',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating evaluation:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ evaluation: data });
  } catch (error) {
    console.error('Evaluations API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
