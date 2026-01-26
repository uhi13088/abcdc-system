import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// CCP 공정 유형 조회
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 회사의 공정 유형이 없으면 템플릿에서 초기화
    const { data: existingTypes } = await supabase
      .from('ccp_process_types')
      .select('id')
      .eq('company_id', userData.company_id)
      .limit(1);

    if (!existingTypes || existingTypes.length === 0) {
      // 초기화 함수 호출
      await supabase.rpc('initialize_ccp_verification_templates', {
        p_company_id: userData.company_id
      });
    }

    // 공정 유형 조회
    const { data: processTypes, error } = await supabase
      .from('ccp_process_types')
      .select(`
        *,
        questions:ccp_verification_questions(count)
      `)
      .eq('company_id', userData.company_id)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Failed to fetch process types:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(processTypes || []);
  } catch (error) {
    console.error('Failed to fetch process types:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// CCP 공정 유형 생성
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const body = await request.json();
    const { code, name, description, parameters, sort_order } = body;

    if (!code || !name) {
      return NextResponse.json({ error: 'code and name are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('ccp_process_types')
      .insert({
        company_id: userData.company_id,
        code,
        name,
        description,
        parameters: parameters || [],
        sort_order: sort_order || 0,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create process type:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to create process type:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// CCP 공정 유형 수정
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('ccp_process_types')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('company_id', userData.company_id)
      .select()
      .single();

    if (error) {
      console.error('Failed to update process type:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to update process type:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// CCP 공정 유형 삭제
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const id = request.nextUrl.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('ccp_process_types')
      .delete()
      .eq('id', id)
      .eq('company_id', userData.company_id);

    if (error) {
      console.error('Failed to delete process type:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete process type:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
