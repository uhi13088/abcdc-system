import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// 검사 기준 조회 (재료 유형별)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 사용자의 회사 조회
    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const materialType = request.nextUrl.searchParams.get('material_type');

    // 회사별 검사 기준 조회
    let query = supabase
      .from('material_inspection_standards')
      .select('*')
      .eq('company_id', userData.company_id);

    if (materialType) {
      query = query.eq('material_type', materialType);
    }

    const { data: standards, error } = await query.order('material_type');

    if (error) {
      // 테이블이 없거나 데이터가 없으면 템플릿에서 복사
      const { data: templateData } = await supabase
        .from('material_inspection_standards_template')
        .select('*')
        .order('material_type');

      if (templateData && templateData.length > 0) {
        // 템플릿에서 회사 데이터로 복사
        const insertData = templateData.map(t => ({
          company_id: userData.company_id,
          material_type: t.material_type,
          required_checks: t.required_checks,
          default_temp_min: t.default_temp_min,
          default_temp_max: t.default_temp_max,
          pass_threshold: t.pass_threshold,
          conditional_threshold: t.conditional_threshold,
          is_active: true,
        }));

        const { data: newStandards, error: insertError } = await supabase
          .from('material_inspection_standards')
          .upsert(insertData, { onConflict: 'company_id,material_type' })
          .select();

        if (insertError) {
          console.error('Failed to initialize standards:', insertError);
          return NextResponse.json([]);
        }

        return NextResponse.json(newStandards);
      }

      return NextResponse.json([]);
    }

    // 데이터가 없으면 템플릿에서 초기화
    if (!standards || standards.length === 0) {
      const { data: templateData } = await supabase
        .from('material_inspection_standards_template')
        .select('*')
        .order('material_type');

      if (templateData && templateData.length > 0) {
        const insertData = templateData.map(t => ({
          company_id: userData.company_id,
          material_type: t.material_type,
          required_checks: t.required_checks,
          default_temp_min: t.default_temp_min,
          default_temp_max: t.default_temp_max,
          pass_threshold: t.pass_threshold,
          conditional_threshold: t.conditional_threshold,
          is_active: true,
        }));

        const { data: newStandards } = await supabase
          .from('material_inspection_standards')
          .upsert(insertData, { onConflict: 'company_id,material_type' })
          .select();

        return NextResponse.json(newStandards || []);
      }
    }

    return NextResponse.json(standards);
  } catch (error) {
    console.error('Failed to fetch inspection standards:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// 검사 기준 수정
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
    const { material_type, required_checks, default_temp_min, default_temp_max, pass_threshold, conditional_threshold } = body;

    if (!material_type) {
      return NextResponse.json({ error: 'material_type is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('material_inspection_standards')
      .upsert({
        company_id: userData.company_id,
        material_type,
        required_checks,
        default_temp_min,
        default_temp_max,
        pass_threshold,
        conditional_threshold,
        is_active: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'company_id,material_type' })
      .select()
      .single();

    if (error) {
      console.error('Failed to update inspection standards:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to update inspection standards:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
