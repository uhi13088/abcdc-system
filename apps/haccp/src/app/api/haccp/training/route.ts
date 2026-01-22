/**
 * HACCP 교육훈련 기록 API
 * GET /api/haccp/training - 교육 기록 조회
 * POST /api/haccp/training - 교육 기록 생성
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/haccp/training
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const trainingType = searchParams.get('type');
    const status = searchParams.get('status');

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await supabase
      .from('users')
      .select('company_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    let query = supabase
      .from('haccp_training_records')
      .select(`
        *,
        created_by_user:created_by (name),
        verified_by_user:verified_by (name)
      `)
      .eq('company_id', userProfile.company_id)
      .order('training_date', { ascending: false });

    if (startDate) {
      query = query.gte('training_date', startDate);
    }
    if (endDate) {
      query = query.lte('training_date', endDate);
    }
    if (trainingType) {
      query = query.eq('training_type', trainingType);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching training records:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const result = (data || []).map((record: any) => ({
      ...record,
      created_by_name: record.created_by_user?.name,
      verified_by_name: record.verified_by_user?.name,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/haccp/training
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const body = await request.json();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await supabase
      .from('users')
      .select('id, company_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('haccp_training_records')
      .insert({
        company_id: userProfile.company_id,
        created_by: userProfile.id,
        training_date: body.training_date,
        training_type: body.training_type,
        title: body.title,
        instructor: body.instructor,
        instructor_company: body.instructor_company,
        duration_hours: body.duration_hours || 1,
        location: body.location,
        materials: body.materials,
        content_summary: body.content_summary,
        attendees: body.attendees || [],
        notes: body.notes,
        status: body.status || 'SCHEDULED',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating training record:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/haccp/training (update by id in body)
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const body = await request.json();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await supabase
      .from('users')
      .select('id, company_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    // If marking as verified
    if (updateData.verified) {
      updateData.verified_by = userProfile.id;
      updateData.verified_at = new Date().toISOString();
      delete updateData.verified;
    }

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('haccp_training_records')
      .update(updateData)
      .eq('id', id)
      .eq('company_id', userProfile.company_id)
      .select()
      .single();

    if (error) {
      console.error('Error updating training record:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
