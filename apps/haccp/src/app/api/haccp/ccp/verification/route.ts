import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const { searchParams } = new URL(request.url);
  const year = searchParams.get('year');
  const month = searchParams.get('month');

  try {
    let query = supabase
      .from('ccp_verifications')
      .select(`
        *,
        ccp_definitions (id, ccp_number, process, critical_limit),
        verifier:users!ccp_verifications_verified_by_fkey (name),
        approver:users!ccp_verifications_approved_by_fkey (name)
      `)
      .order('verification_year', { ascending: false })
      .order('verification_month', { ascending: false });

    if (year) {
      query = query.eq('verification_year', parseInt(year));
    }

    if (month) {
      query = query.eq('verification_month', parseInt(month));
    }

    const { data, error } = await query.limit(100);

    if (error) {
      console.error('Error fetching CCP verifications:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error in GET /api/haccp/ccp/verification:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();

  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's company_id
    const { data: profile } = await supabase
      .from('users')
      .select('id, company_id')
      .eq('auth_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('ccp_verifications')
      .insert({
        company_id: profile.company_id,
        ccp_id: body.ccp_id,
        verification_year: body.verification_year,
        verification_month: body.verification_month,
        records_reviewed: body.records_reviewed || 0,
        deviations_found: body.deviations_found || 0,
        corrective_actions_taken: body.corrective_actions_taken || 0,
        effectiveness_rating: body.effectiveness_rating || 'GOOD',
        findings: body.findings || null,
        recommendations: body.recommendations || null,
        verified_by: profile.id,
        verified_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating CCP verification:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in POST /api/haccp/ccp/verification:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
