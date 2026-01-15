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
        effective_date: body.effective_date,
        minimum_wage: body.minimum_wage,
        national_pension_rate: body.national_pension_rate,
        health_insurance_rate: body.health_insurance_rate,
        employment_insurance_rate: body.employment_insurance_rate,
        industrial_accident_rate: body.industrial_accident_rate,
        long_term_care_rate: body.long_term_care_rate,
        notes: body.notes,
        status: 'ACTIVE',
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
