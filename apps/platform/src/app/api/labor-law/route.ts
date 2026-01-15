import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await adminClient
      .from('users')
      .select('role')
      .eq('auth_id', user.id)
      .single();

    if (profile?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get labor law versions
    const { data: versions, error } = await adminClient
      .from('labor_law_versions')
      .select('*')
      .order('effective_date', { ascending: false });

    if (error) throw error;

    return NextResponse.json(versions || []);
  } catch (error) {
    console.error('Error fetching labor law versions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch labor law versions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await adminClient
      .from('users')
      .select('role')
      .eq('auth_id', user.id)
      .single();

    if (profile?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();

    const { data, error } = await adminClient
      .from('labor_law_versions')
      .insert([{
        version: body.version,
        effective_date: body.effectiveDate,
        minimum_wage_hourly: body.minimumWageHourly,
        overtime_rate: body.overtimeRate,
        night_rate: body.nightRate,
        holiday_rate: body.holidayRate,
        national_pension_rate: body.nationalPensionRate,
        health_insurance_rate: body.healthInsuranceRate,
        long_term_care_rate: body.longTermCareRate,
        employment_insurance_rate: body.employmentInsuranceRate,
        status: 'DRAFT',
      }])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error creating labor law version:', error);
    return NextResponse.json(
      { error: 'Failed to create labor law version' },
      { status: 500 }
    );
  }
}
