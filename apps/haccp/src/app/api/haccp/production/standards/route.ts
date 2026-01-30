import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// 생산 기준 조회 (제품별)
export async function GET(request: NextRequest) {
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

    const productId = request.nextUrl.searchParams.get('product_id');

    let query = supabase
      .from('production_standards')
      .select(`
        *,
        products:product_id (name, code)
      `)
      .eq('company_id', userData.company_id);

    if (productId) {
      query = query.eq('product_id', productId);
    }

    const { data: standards, error } = await query.order('created_at', { ascending: false });

    if (error) {
      // 테이블이 없으면 빈 배열 반환
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json([]);
      }
      console.error('Failed to fetch production standards:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 제품명 추가
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (standards || []).map((s: any) => ({
      ...s,
      product_name: s.products?.name,
      product_code: s.products?.code,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to fetch production standards:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// 생산 기준 생성/수정
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
    const {
      product_id,
      temp_min,
      temp_max,
      humidity_min,
      humidity_max,
      quality_checks,
      pass_threshold,
      conditional_threshold,
    } = body;

    if (!product_id) {
      return NextResponse.json({ error: 'product_id is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('production_standards')
      .upsert({
        company_id: userData.company_id,
        product_id,
        temp_min: temp_min ?? 15,
        temp_max: temp_max ?? 25,
        humidity_min: humidity_min ?? 40,
        humidity_max: humidity_max ?? 70,
        quality_checks: quality_checks ?? {
          appearance_check: true,
          weight_check: true,
          packaging_check: true,
          label_check: true,
          metal_detection_check: true,
          taste_check: false,
          smell_check: false,
          color_check: false,
        },
        pass_threshold: pass_threshold ?? 5,
        conditional_threshold: conditional_threshold ?? 4,
        is_active: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'company_id,product_id' })
      .select()
      .single();

    if (error) {
      console.error('Failed to save production standard:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to save production standard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// 생산 기준 수정
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
      .from('production_standards')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('company_id', userData.company_id)
      .select()
      .single();

    if (error) {
      console.error('Failed to update production standard:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to update production standard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// 생산 기준 삭제
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
      .from('production_standards')
      .delete()
      .eq('id', id)
      .eq('company_id', userData.company_id);

    if (error) {
      console.error('Failed to delete production standard:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete production standard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
