import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// GET /api/labor-law - Get active labor law version
export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get active labor law version
    const { data: activeLaw, error: activeError } = await supabase
      .from('labor_law_versions')
      .select('*')
      .eq('status', 'ACTIVE')
      .order('effective_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeError) {
      console.error('Error fetching active labor law:', activeError);
    }

    // Get previous version for comparison
    const { data: previousLaw, error: prevError } = await supabase
      .from('labor_law_versions')
      .select('*')
      .eq('status', 'ARCHIVED')
      .order('effective_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (prevError) {
      console.error('Error fetching previous labor law:', prevError);
    }

    // Default values for 2026 if no data found (using actual DB column names)
    const defaultActiveLaw = {
      id: 'default',
      version: '2026.01',
      effective_date: '2026-01-01',
      minimum_wage_hourly: 10030,
      overtime_rate: 1.5,
      night_rate: 0.5,
      holiday_rate: 1.5,
      national_pension_rate: 4.5,
      health_insurance_rate: 3.545,
      long_term_care_rate: 12.81,
      employment_insurance_rate: 0.9,
      standard_weekly_hours: 40,
      standard_daily_hours: 8,
      status: 'ACTIVE',
    };

    const defaultPreviousLaw = {
      version: '2025.01',
      effective_date: '2025-01-01',
      minimum_wage_hourly: 9860,
      health_insurance_rate: 3.495,
      long_term_care_rate: 12.27,
      standard_weekly_hours: 40,
      standard_daily_hours: 8,
    };

    return NextResponse.json({
      active: activeLaw || defaultActiveLaw,
      previous: previousLaw || defaultPreviousLaw,
    });
  } catch (error) {
    console.error('Error fetching labor law:', error);
    return NextResponse.json(
      { error: 'Failed to fetch labor law' },
      { status: 500 }
    );
  }
}
