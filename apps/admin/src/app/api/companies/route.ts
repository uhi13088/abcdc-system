import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { CreateCompanySchema } from '@abc/shared';

// GET /api/companies - 회사 목록 조회
export async function GET() {
  try {
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's role
    const { data: userData } = await supabase
      .from('users')
      .select('role, company_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Platform admin can see all companies
    // Others can only see their own company
    let query = supabase.from('companies').select('*');

    if (userData.role !== 'platform_admin') {
      query = query.eq('id', userData.company_id);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// POST /api/companies - 회사 생성 (platform_admin only)
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is platform admin
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('auth_id', user.id)
      .single();

    if (userData?.role !== 'platform_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();

    // Validate input
    const validation = CreateCompanySchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('companies')
      .insert(validation.data)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
