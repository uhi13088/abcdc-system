import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// CCP 검증 질문 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await adminClient
      .from('users')
      .select('company_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const processTypeId = request.nextUrl.searchParams.get('process_type_id');
    const includeCommon = request.nextUrl.searchParams.get('include_common') === 'true';

    // 공정별 질문 조회
    let query = adminClient
      .from('ccp_verification_questions')
      .select(`
        *,
        process_type:process_type_id(id, code, name)
      `)
      .eq('company_id', userData.company_id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (processTypeId) {
      query = query.eq('process_type_id', processTypeId);
    }

    const { data: questions, error } = await query;

    if (error) {
      console.error('Failed to fetch verification questions:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const result = { questions: questions || [], commonQuestions: [] as typeof questions };

    // 공통 질문 포함 옵션
    if (includeCommon) {
      const { data: commonQuestions, error: commonError } = await adminClient
        .from('ccp_common_verification_questions')
        .select('*')
        .eq('company_id', userData.company_id)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (commonError) {
        console.error('Failed to fetch common questions:', commonError);
      } else {
        result.commonQuestions = commonQuestions || [];
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to fetch verification questions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// CCP 검증 질문 생성
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await adminClient
      .from('users')
      .select('company_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      process_type_id,
      question_code,
      question_text,
      question_category,
      help_text,
      sort_order,
      is_required,
      is_common, // true면 공통 질문으로 생성
    } = body;

    if (!question_text) {
      return NextResponse.json({ error: 'question_text is required' }, { status: 400 });
    }

    if (is_common) {
      // 공통 질문 생성
      const { data, error } = await adminClient
        .from('ccp_common_verification_questions')
        .insert({
          company_id: userData.company_id,
          question_code: question_code || `CUSTOM_${Date.now()}`,
          question_text,
          question_category: question_category || 'CUSTOM',
          help_text,
          sort_order: sort_order || 0,
          is_required: is_required ?? true,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to create common question:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data);
    } else {
      // 공정별 질문 생성
      if (!process_type_id) {
        return NextResponse.json({ error: 'process_type_id is required for non-common questions' }, { status: 400 });
      }

      const { data, error } = await adminClient
        .from('ccp_verification_questions')
        .insert({
          company_id: userData.company_id,
          process_type_id,
          question_code: question_code || `CUSTOM_${Date.now()}`,
          question_text,
          question_category: question_category || 'CUSTOM',
          help_text,
          sort_order: sort_order || 0,
          is_required: is_required ?? true,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to create verification question:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data);
    }
  } catch (error) {
    console.error('Failed to create verification question:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// CCP 검증 질문 수정
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await adminClient
      .from('users')
      .select('company_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const body = await request.json();
    const { id, is_common, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const table = is_common ? 'ccp_common_verification_questions' : 'ccp_verification_questions';

    const { data, error } = await adminClient
      .from(table)
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('company_id', userData.company_id)
      .select()
      .single();

    if (error) {
      console.error('Failed to update question:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to update question:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// CCP 검증 질문 삭제
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await adminClient
      .from('users')
      .select('company_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const id = request.nextUrl.searchParams.get('id');
    const isCommon = request.nextUrl.searchParams.get('is_common') === 'true';

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const table = isCommon ? 'ccp_common_verification_questions' : 'ccp_verification_questions';

    const { error } = await adminClient
      .from(table)
      .delete()
      .eq('id', id)
      .eq('company_id', userData.company_id);

    if (error) {
      console.error('Failed to delete question:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete question:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
