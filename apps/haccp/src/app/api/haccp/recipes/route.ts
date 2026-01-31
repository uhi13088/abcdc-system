import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// 레시피 조회
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

    const productId = request.nextUrl.searchParams.get('product_id');
    const semiProductId = request.nextUrl.searchParams.get('semi_product_id');
    const id = request.nextUrl.searchParams.get('id');

    // 단일 레시피 조회
    if (id) {
      const { data, error } = await adminClient
        .from('product_recipes')
        .select('*')
        .eq('id', id)
        .eq('company_id', userData.company_id)
        .single();

      if (error) {
        // 테이블이 없으면 null 반환
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          return NextResponse.json(null);
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json(data);
    }

    // 제품별 레시피 조회
    let query = adminClient
      .from('product_recipes')
      .select('*')
      .eq('company_id', userData.company_id)
      .order('product_name')
      .order('component_name')
      .order('material_name');

    if (productId) {
      query = query.eq('product_id', productId);
    }

    if (semiProductId) {
      query = query.eq('semi_product_id', semiProductId);
    }

    const { data, error } = await query;

    if (error) {
      // 테이블이 없으면 빈 결과 반환
      // PostgreSQL error codes: 42P01 = undefined_table, 42703 = undefined_column
      if (
        error.code === '42P01' ||
        error.code === 'PGRST116' ||
        error.message?.includes('does not exist') ||
        error.message?.includes('relation') ||
        error.message?.includes('product_recipes')
      ) {
        console.log('product_recipes table not found, returning empty result');
        return NextResponse.json({ recipes: [], grouped: [] });
      }
      console.error('Failed to fetch recipes:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 제품별로 그룹핑
    const grouped = (data || []).reduce((acc, recipe) => {
      const key = recipe.product_id || recipe.semi_product_id || 'unknown';
      if (!acc[key]) {
        acc[key] = {
          product_id: recipe.product_id,
          semi_product_id: recipe.semi_product_id,
          product_name: recipe.product_name,
          batch_size: recipe.batch_size,
          production_qty: recipe.production_qty,
          ingredients: [],
        };
      }
      acc[key].ingredients.push({
        id: recipe.id,
        component_name: recipe.component_name,
        material_code: recipe.material_code,
        material_name: recipe.material_name,
        amount: recipe.amount,
        unit: recipe.unit,
        amount_per_unit: recipe.amount_per_unit,
      });
      return acc;
    }, {} as Record<string, {
      product_id: string | null;
      semi_product_id: string | null;
      product_name: string;
      batch_size: number;
      production_qty: number;
      ingredients: Array<{
        id: string;
        component_name: string;
        material_code: string;
        material_name: string;
        amount: number;
        unit: string;
        amount_per_unit: number;
      }>;
    }>);

    return NextResponse.json({
      recipes: data || [],
      grouped: Object.values(grouped),
    });
  } catch (error) {
    console.error('Failed to fetch recipes:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// 레시피 생성
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
      product_id,
      semi_product_id,
      product_name,
      batch_size,
      production_qty,
      ingredients // Array of { component_name, material_code, material_name, amount, unit }
    } = body;

    if (!product_name) {
      return NextResponse.json({ error: 'product_name is required' }, { status: 400 });
    }

    if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
      return NextResponse.json({ error: 'ingredients array is required' }, { status: 400 });
    }

    // 기존 레시피 삭제 (제품별로 전체 교체)
    if (product_id) {
      await adminClient
        .from('product_recipes')
        .delete()
        .eq('company_id', userData.company_id)
        .eq('product_id', product_id);
    } else if (semi_product_id) {
      await adminClient
        .from('product_recipes')
        .delete()
        .eq('company_id', userData.company_id)
        .eq('semi_product_id', semi_product_id);
    }

    // 새 레시피 생성
    const recipesToInsert = ingredients.map((ing: {
      component_name?: string;
      material_code?: string;
      material_name: string;
      amount: number;
      unit?: string;
    }) => {
      const amountPerUnit = production_qty && production_qty > 0
        ? ing.amount / production_qty
        : null;

      return {
        company_id: userData.company_id,
        product_id: product_id || null,
        semi_product_id: semi_product_id || null,
        product_name,
        component_name: ing.component_name || null,
        material_code: ing.material_code || null,
        material_name: ing.material_name,
        batch_size: batch_size || 1,
        amount: ing.amount,
        unit: ing.unit || 'g',
        production_qty: production_qty || null,
        amount_per_unit: amountPerUnit,
      };
    });

    const { data, error } = await adminClient
      .from('product_recipes')
      .insert(recipesToInsert)
      .select();

    if (error) {
      // 테이블이 없으면 빈 배열 반환
      if (
        error.code === '42P01' ||
        error.code === 'PGRST116' ||
        error.message?.includes('does not exist') ||
        error.message?.includes('relation') ||
        error.message?.includes('product_recipes')
      ) {
        console.log('product_recipes table not found, returning empty result');
        return NextResponse.json([]);
      }
      console.error('Failed to create recipes:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to create recipes:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// 레시피 수정 (단일 원료 항목)
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
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    // amount_per_unit 재계산
    if (updateData.amount && updateData.production_qty) {
      updateData.amount_per_unit = updateData.amount / updateData.production_qty;
    }

    const { data, error } = await adminClient
      .from('product_recipes')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('company_id', userData.company_id)
      .select()
      .single();

    if (error) {
      console.error('Failed to update recipe:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to update recipe:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// 레시피 삭제
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
    const productId = request.nextUrl.searchParams.get('product_id');
    const semiProductId = request.nextUrl.searchParams.get('semi_product_id');

    // 단일 원료 항목 삭제
    if (id) {
      const { error } = await adminClient
        .from('product_recipes')
        .delete()
        .eq('id', id)
        .eq('company_id', userData.company_id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    // 제품 전체 레시피 삭제
    if (productId) {
      const { error } = await adminClient
        .from('product_recipes')
        .delete()
        .eq('product_id', productId)
        .eq('company_id', userData.company_id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    if (semiProductId) {
      const { error } = await adminClient
        .from('product_recipes')
        .delete()
        .eq('semi_product_id', semiProductId)
        .eq('company_id', userData.company_id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'id, product_id, or semi_product_id is required' }, { status: 400 });
  } catch (error) {
    console.error('Failed to delete recipe:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
