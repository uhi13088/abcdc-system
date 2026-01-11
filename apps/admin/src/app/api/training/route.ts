import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET - List training programs
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const mandatory = searchParams.get('mandatory');

    let query = supabase
      .from('trainings')
      .select('*')
      .order('created_at', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }

    if (mandatory !== null) {
      query = query.eq('is_mandatory', mandatory === 'true');
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching trainings:', error);
      return NextResponse.json({ trainings: [] });
    }

    return NextResponse.json({ trainings: data || [] });
  } catch (error) {
    console.error('Training API error:', error);
    return NextResponse.json({ trainings: [] });
  }
}

// POST - Create new training program
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: userData } = await supabase
      .from('users')
      .select('role, company_id')
      .eq('id', user.id)
      .single();

    if (!userData || !['super_admin', 'company_admin', 'manager'].includes(userData.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { title, description, category, duration_hours, is_mandatory, valid_months, content_url } = body;

    if (!title || !category) {
      return NextResponse.json({ error: 'Title and category are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('trainings')
      .insert({
        company_id: userData.company_id,
        title,
        description,
        category,
        duration_hours: duration_hours || 0,
        is_mandatory: is_mandatory || false,
        valid_months,
        content_url,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating training:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ training: data });
  } catch (error) {
    console.error('Training API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
