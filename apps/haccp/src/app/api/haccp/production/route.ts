import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/haccp/production
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const status = searchParams.get('status');
    const qualityStatus = searchParams.get('quality_status');

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
      .from('production_records')
      .select(`
        *,
        products:product_id (id, name, code, category),
        supervisor:supervisor_id (id, name),
        quality_checker:quality_checked_by (name),
        approver:approved_by (name)
      `)
      .eq('company_id', userProfile.company_id)
      .eq('production_date', date);

    if (status) {
      query = query.eq('status', status);
    }

    if (qualityStatus) {
      query = query.eq('quality_check_status', qualityStatus);
    }

    const { data, error } = await query.order('start_time', { ascending: true });

    if (error) {
      console.error('Error fetching production records:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (data || []).map((r: any) => ({
      ...r,
      product_name: r.products?.name,
      product_code: r.products?.code,
      product_category: r.products?.category,
      supervisor_name: r.supervisor_name || r.supervisor?.name,
      quality_checked_by_name: r.quality_checked_by_name || r.quality_checker?.name,
      approved_by_name: r.approved_by_name || r.approver?.name,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/haccp/production
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

    // 생산조건 저장 (JSONB로도 저장 - 호환성)
    const productionConditions = {
      temperature: body.temperature,
      humidity: body.humidity,
      ...(body.production_conditions || {}),
    };

    const insertData = {
      company_id: userProfile.company_id,
      supervisor_id: userProfile.id,
      supervisor_name: userProfile.name,
      status: body.status || 'IN_PROGRESS',
      quality_check_status: 'PENDING',
      approval_status: 'PENDING',
      production_conditions: productionConditions,
      ...body,
    };

    const { data, error } = await supabase
      .from('production_records')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Error creating production record:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/haccp/production
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const body = await request.json();
    const { id, action, ...updateData } = body;

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

    // 특수 액션 처리
    if (action === 'quality_check') {
      // 품질검사 수행
      const qualityChecks = [
        updateData.appearance_check,
        updateData.weight_check,
        updateData.packaging_check,
        updateData.label_check,
        updateData.metal_detection_check,
        updateData.taste_check,
        updateData.smell_check,
        updateData.color_check,
      ].filter(v => v !== undefined);

      const passCount = qualityChecks.filter(Boolean).length;
      const totalChecks = qualityChecks.length;

      let qualityStatus = 'PASS';
      if (totalChecks > 0) {
        if (passCount === totalChecks) {
          qualityStatus = 'PASS';
        } else if (passCount >= totalChecks * 0.7) {
          qualityStatus = 'CONDITIONAL';
        } else {
          qualityStatus = 'FAIL';
        }
      }

      updateData.quality_check_status = qualityStatus;
      updateData.quality_checked_by = userProfile.id;
      updateData.quality_checked_by_name = userProfile.name;
      updateData.quality_checked_at = new Date().toISOString();
    }

    if (action === 'approve') {
      updateData.approval_status = 'APPROVED';
      updateData.approved_by = userProfile.id;
      updateData.approved_by_name = userProfile.name;
      updateData.approved_at = new Date().toISOString();
    }

    if (action === 'reject') {
      updateData.approval_status = 'REJECTED';
      updateData.approved_by = userProfile.id;
      updateData.approved_by_name = userProfile.name;
      updateData.approved_at = new Date().toISOString();
    }

    if (action === 'hold') {
      updateData.approval_status = 'HOLD';
    }

    if (action === 'complete') {
      updateData.status = 'COMPLETED';
    }

    // 생산조건 업데이트
    if (updateData.temperature !== undefined || updateData.humidity !== undefined) {
      const { data: existing } = await supabase
        .from('production_records')
        .select('production_conditions')
        .eq('id', id)
        .single();

      updateData.production_conditions = {
        ...(existing?.production_conditions || {}),
        temperature: updateData.temperature,
        humidity: updateData.humidity,
      };
    }

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('production_records')
      .update(updateData)
      .eq('id', id)
      .eq('company_id', userProfile.company_id)
      .select()
      .single();

    if (error) {
      console.error('Error updating production record:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
