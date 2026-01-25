import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/haccp/inspections
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const materialType = searchParams.get('material_type');
    const result = searchParams.get('result');

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
      .from('material_inspections')
      .select(`
        *,
        materials:material_id (id, name, code, type, storage_temp, shelf_life),
        suppliers:supplier_id (id, name),
        inspected_by_user:inspected_by (name),
        verified_by_user:verified_by (name)
      `)
      .eq('company_id', userProfile.company_id)
      .eq('inspection_date', date);

    if (materialType) {
      query = query.eq('material_type', materialType);
    }

    if (result) {
      query = query.eq('overall_result', result);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching inspections:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resultData = (data || []).map((i: any) => ({
      ...i,
      material_name: i.materials?.name,
      material_code: i.materials?.code,
      material_type: i.material_type || i.materials?.type,
      material_storage_temp: i.materials?.storage_temp,
      supplier_name: i.suppliers?.name,
      inspected_by_name: i.inspected_by_name || i.inspected_by_user?.name,
      verified_by_name: i.verified_by_name || i.verified_by_user?.name,
    }));

    return NextResponse.json(resultData);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/haccp/inspections
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
      .select('id, name, company_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 원부재료 정보 조회 (material_type 자동 설정)
    let materialType = body.material_type;
    if (body.material_id && !materialType) {
      const { data: material } = await supabase
        .from('materials')
        .select('type')
        .eq('id', body.material_id)
        .single();
      materialType = material?.type;
    }

    // 검사 기준 조회하여 결과 자동 계산
    let overallResult = body.overall_result;
    if (!overallResult && materialType) {
      const { data: standard } = await supabase
        .from('material_inspection_standards')
        .select('required_checks, pass_threshold, conditional_threshold')
        .eq('company_id', userProfile.company_id)
        .eq('material_type', materialType)
        .single();

      if (standard) {
        const requiredChecks = standard.required_checks as Record<string, boolean>;
        let passCount = 0;
        let totalRequired = 0;

        // 필수 항목 체크
        const checkFields = [
          'appearance_check', 'packaging_check', 'label_check', 'expiry_check',
          'document_check', 'foreign_matter_check', 'odor_check', 'weight_check',
          'sensory_check', 'freshness_check', 'color_check', 'texture_check',
          'packaging_integrity_check', 'printing_check', 'specification_check',
          'test_report_check', 'certificate_check'
        ];

        for (const field of checkFields) {
          if (requiredChecks[field]) {
            totalRequired++;
            if (body[field] === true) {
              passCount++;
            }
          }
        }

        // temp_check 처리 (객체 형태)
        if (requiredChecks.temp_check) {
          totalRequired++;
          if (body.temp_check?.passed) {
            passCount++;
          }
        }

        const passThreshold = standard.pass_threshold || 9;
        const conditionalThreshold = standard.conditional_threshold || 7;

        if (passCount >= passThreshold || passCount === totalRequired) {
          overallResult = 'PASS';
        } else if (passCount >= conditionalThreshold) {
          overallResult = 'CONDITIONAL';
        } else {
          overallResult = 'FAIL';
        }
      }
    }

    const insertData = {
      company_id: userProfile.company_id,
      inspected_by: userProfile.id,
      inspected_by_name: userProfile.name,
      material_type: materialType,
      overall_result: overallResult || body.overall_result,
      ...body,
      supplier_id: body.supplier_id || null,
    };

    const { data, error } = await supabase
      .from('material_inspections')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Error creating inspection:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/haccp/inspections (검증/확인)
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await supabase
      .from('users')
      .select('id, name, company_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 검증 처리
    if (updateData.verify) {
      updateData.verified_by = userProfile.id;
      updateData.verified_by_name = userProfile.name;
      updateData.verified_at = new Date().toISOString();
      delete updateData.verify;
    }

    const { data, error } = await supabase
      .from('material_inspections')
      .update(updateData)
      .eq('id', id)
      .eq('company_id', userProfile.company_id)
      .select()
      .single();

    if (error) {
      console.error('Error updating inspection:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
