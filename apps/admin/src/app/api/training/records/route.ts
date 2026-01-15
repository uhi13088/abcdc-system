import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET - List training records
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const trainingId = searchParams.get('trainingId');
    const status = searchParams.get('status');
    const category = searchParams.get('category');

    let query = adminClient
      .from('training_records')
      .select(`
        *,
        users:user_id (id, name, email),
        trainings:training_id (id, title, category, duration_hours, is_mandatory, valid_months)
      `)
      .order('created_at', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    if (trainingId) {
      query = query.eq('training_id', trainingId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching training records:', error);
      return NextResponse.json({ records: [] });
    }

    // Transform data for frontend
    const records = (data || []).map(record => ({
      id: record.id,
      staff_id: record.user_id,
      staff_name: record.users?.name || 'Unknown',
      training_id: record.training_id,
      training_title: record.trainings?.title || 'Unknown',
      training_category: record.trainings?.category || 'SKILL',
      completed_at: record.completed_at,
      expires_at: record.expires_at,
      score: record.score,
      certificate_url: record.certificate_url,
      status: record.status,
    })).filter(r => !category || r.training_category === category);

    return NextResponse.json({ records });
  } catch (error) {
    console.error('Training records API error:', error);
    return NextResponse.json({ records: [] });
  }
}

// POST - Create new training record
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin using auth_id
    const { data: userData } = await adminClient
      .from('users')
      .select('role')
      .eq('auth_id', user.id)
      .single();

    if (!userData || !['super_admin', 'company_admin', 'manager', 'store_manager'].includes(userData.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { user_id, training_id, completed_at, score, certificate_url, notes } = body;

    if (!user_id || !training_id) {
      return NextResponse.json({ error: 'User ID and training ID are required' }, { status: 400 });
    }

    // Get training info for expiry calculation
    const { data: training } = await adminClient
      .from('trainings')
      .select('valid_months')
      .eq('id', training_id)
      .single();

    let expires_at = null;
    if (training?.valid_months && completed_at) {
      const expiryDate = new Date(completed_at);
      expiryDate.setMonth(expiryDate.getMonth() + training.valid_months);
      expires_at = expiryDate.toISOString().split('T')[0];
    }

    const { data, error } = await adminClient
      .from('training_records')
      .insert({
        user_id,
        training_id,
        completed_at,
        expires_at,
        score: score || null,
        certificate_url,
        notes,
        status: completed_at ? 'COMPLETED' : 'IN_PROGRESS',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating training record:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ record: data });
  } catch (error) {
    console.error('Training records API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
