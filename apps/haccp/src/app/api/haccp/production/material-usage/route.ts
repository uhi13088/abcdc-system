import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface RecipeIngredient {
  id: string;
  material_code: string | null;
  material_name: string;
  amount: number;
  unit: string;
  amount_per_unit: number | null;
}

interface MaterialStock {
  id: string;
  material_id: string;
  lot_number: string;
  quantity: number;
  unit: string;
  expiry_date: string | null;
  received_date: string | null;
}

// 생산 기록에 대한 원료 사용량 조회
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
      .select('company_id, store_id, current_store_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const currentStoreId = userData.current_store_id || userData.store_id;
    const productionRecordId = request.nextUrl.searchParams.get('production_record_id');

    if (productionRecordId) {
      // 특정 생산 기록의 원료 사용 내역 조회
      let query = adminClient
        .from('material_transactions')
        .select(`
          *,
          materials:material_id (name, code)
        `)
        .eq('company_id', userData.company_id)
        .eq('production_lot', productionRecordId)
        .eq('transaction_type', 'OUT');

      if (currentStoreId) {
        query = query.eq('store_id', currentStoreId);
      }

      const { data: transactions, error } = await query;

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(transactions || []);
    }

    return NextResponse.json({ error: 'production_record_id is required' }, { status: 400 });
  } catch (error) {
    console.error('Error fetching material usage:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// 생산 완료 시 레시피 기반 원료 자동 출고
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
      .select('id, company_id, store_id, current_store_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const currentStoreId = userData.current_store_id || userData.store_id;

    const body = await request.json();
    const {
      production_record_id,
      product_id,
      semi_product_id,
      quantity_produced,
      lot_number,
      production_date,
    } = body;

    if (!production_record_id || (!product_id && !semi_product_id) || !quantity_produced) {
      return NextResponse.json({
        error: 'production_record_id, product_id/semi_product_id, and quantity_produced are required'
      }, { status: 400 });
    }

    // 1. 레시피 조회
    let recipeQuery = adminClient
      .from('product_recipes')
      .select('*')
      .eq('company_id', userData.company_id);

    if (product_id) {
      recipeQuery = recipeQuery.eq('product_id', product_id);
    } else if (semi_product_id) {
      recipeQuery = recipeQuery.eq('semi_product_id', semi_product_id);
    }

    const { data: recipes, error: recipeError } = await recipeQuery;

    if (recipeError) {
      console.error('Error fetching recipe:', recipeError);
      return NextResponse.json({ error: 'Failed to fetch recipe' }, { status: 500 });
    }

    if (!recipes || recipes.length === 0) {
      return NextResponse.json({
        error: 'Recipe not found for this product',
        code: 'RECIPE_NOT_FOUND'
      }, { status: 404 });
    }

    // 2. 각 원료에 대해 필요량 계산 및 출고 처리
    const results: Array<{
      material_name: string;
      required_amount: number;
      actual_amount: number;
      unit: string;
      transactions: Array<{
        lot_number: string;
        quantity: number;
      }>;
      shortage: number;
    }> = [];

    const errors: string[] = [];

    for (const recipe of recipes as RecipeIngredient[]) {
      // 필요량 계산
      let requiredAmount: number;
      if (recipe.amount_per_unit && recipe.amount_per_unit > 0) {
        // 개당 소요량이 있으면 사용
        requiredAmount = recipe.amount_per_unit * quantity_produced;
      } else if (recipes[0] && (recipes[0] as { production_qty?: number }).production_qty && (recipes[0] as { production_qty: number }).production_qty > 0) {
        // 배치 기준 생산수량으로 비율 계산
        const batchProductionQty = (recipes[0] as { production_qty: number }).production_qty;
        requiredAmount = (recipe.amount / batchProductionQty) * quantity_produced;
      } else {
        // 기본: 배치 기준량 그대로 사용 (단일 배치)
        requiredAmount = recipe.amount;
      }

      // 원료 ID 찾기 (material_code로 매칭)
      let materialId: string | null = null;
      if (recipe.material_code) {
        const { data: material } = await adminClient
          .from('materials')
          .select('id')
          .eq('company_id', userData.company_id)
          .eq('code', recipe.material_code)
          .single();

        materialId = material?.id || null;
      }

      // material_name으로도 시도
      if (!materialId) {
        const { data: material } = await adminClient
          .from('materials')
          .select('id')
          .eq('company_id', userData.company_id)
          .ilike('name', recipe.material_name)
          .single();

        materialId = material?.id || null;
      }

      const resultItem = {
        material_name: recipe.material_name,
        material_code: recipe.material_code,
        required_amount: requiredAmount,
        actual_amount: 0,
        unit: recipe.unit,
        transactions: [] as Array<{ lot_number: string; quantity: number }>,
        shortage: 0,
      };

      if (!materialId) {
        // 원료가 등록되어 있지 않음 - 레시피만 있고 원료 마스터가 없는 경우
        errors.push(`원료 "${recipe.material_name}"가 원료 마스터에 등록되어 있지 않습니다.`);
        resultItem.shortage = requiredAmount;
        results.push(resultItem);
        continue;
      }

      // 3. FIFO로 재고에서 출고 (유통기한 빠른 순)
      let stocksQuery = adminClient
        .from('material_stocks')
        .select('*')
        .eq('company_id', userData.company_id)
        .eq('material_id', materialId)
        .eq('status', 'AVAILABLE')
        .gt('quantity', 0);

      if (currentStoreId) {
        stocksQuery = stocksQuery.eq('store_id', currentStoreId);
      }

      const { data: stocks } = await stocksQuery
        .order('expiry_date', { ascending: true, nullsFirst: false })
        .order('received_date', { ascending: true });

      let remainingAmount = requiredAmount;

      for (const stock of (stocks || []) as MaterialStock[]) {
        if (remainingAmount <= 0) break;

        const deductAmount = Math.min(stock.quantity, remainingAmount);

        // 출고 트랜잭션 생성
        const { error: txError } = await adminClient
          .from('material_transactions')
          .insert({
            company_id: userData.company_id,
            store_id: currentStoreId || null,
            transaction_date: production_date || new Date().toISOString().split('T')[0],
            transaction_type: 'OUT',
            material_id: materialId,
            lot_number: stock.lot_number,
            quantity: deductAmount,
            unit: recipe.unit,
            production_lot: lot_number || production_record_id,
            notes: `생산 자동출고 - ${recipe.material_name}`,
            recorded_by: userData.id,
          });

        if (txError) {
          console.error('Error creating transaction:', txError);
          errors.push(`출고 기록 생성 실패: ${recipe.material_name}`);
          continue;
        }

        // 재고 업데이트
        const newQuantity = stock.quantity - deductAmount;
        const updateData: { quantity: number; status?: string; updated_at: string } = {
          quantity: newQuantity,
          updated_at: new Date().toISOString(),
        };

        if (newQuantity <= 0) {
          updateData.status = 'DISPOSED';
        }

        await adminClient
          .from('material_stocks')
          .update(updateData)
          .eq('id', stock.id);

        resultItem.transactions.push({
          lot_number: stock.lot_number,
          quantity: deductAmount,
        });

        resultItem.actual_amount += deductAmount;
        remainingAmount -= deductAmount;
      }

      // 부족량 기록
      if (remainingAmount > 0) {
        resultItem.shortage = remainingAmount;
        errors.push(`원료 "${recipe.material_name}" 재고 부족: ${remainingAmount.toFixed(2)} ${recipe.unit}`);
      }

      results.push(resultItem);
    }

    // 4. 생산 기록에 원료 사용 정보 업데이트 (선택적)
    const totalMaterialsUsed = results.reduce((sum, r) => sum + r.actual_amount, 0);

    await adminClient
      .from('production_records')
      .update({
        material_usage_processed: true,
        material_usage_summary: results,
        updated_at: new Date().toISOString(),
      })
      .eq('id', production_record_id);

    return NextResponse.json({
      success: errors.length === 0,
      production_record_id,
      quantity_produced,
      materials_used: results,
      total_materials_used: totalMaterialsUsed,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Error processing material usage:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// 원료 사용 취소 (생산 취소 시)
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
      .select('id, company_id, store_id, current_store_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const currentStoreId = userData.current_store_id || userData.store_id;
    const productionRecordId = request.nextUrl.searchParams.get('production_record_id');

    if (!productionRecordId) {
      return NextResponse.json({ error: 'production_record_id is required' }, { status: 400 });
    }

    // 해당 생산 기록의 출고 트랜잭션 조회
    let txQuery = adminClient
      .from('material_transactions')
      .select('*')
      .eq('company_id', userData.company_id)
      .eq('production_lot', productionRecordId)
      .eq('transaction_type', 'OUT');

    if (currentStoreId) {
      txQuery = txQuery.eq('store_id', currentStoreId);
    }

    const { data: transactions } = await txQuery;

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({ message: 'No material transactions to reverse' });
    }

    // 각 트랜잭션 복원
    for (const tx of transactions) {
      // 재고 복원
      let stockQuery = adminClient
        .from('material_stocks')
        .select('id, quantity, status')
        .eq('company_id', userData.company_id)
        .eq('material_id', tx.material_id)
        .eq('lot_number', tx.lot_number);

      if (currentStoreId) {
        stockQuery = stockQuery.eq('store_id', currentStoreId);
      }

      const { data: stock } = await stockQuery.single();

      if (stock) {
        await adminClient
          .from('material_stocks')
          .update({
            quantity: stock.quantity + tx.quantity,
            status: 'AVAILABLE',
            updated_at: new Date().toISOString(),
          })
          .eq('id', stock.id);
      }

      // 트랜잭션 삭제 또는 ADJUST로 변경
      await adminClient
        .from('material_transactions')
        .delete()
        .eq('id', tx.id)
        .eq('company_id', userData.company_id);
    }

    // 생산 기록 업데이트
    await adminClient
      .from('production_records')
      .update({
        material_usage_processed: false,
        material_usage_summary: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', productionRecordId)
      .eq('company_id', userData.company_id);

    return NextResponse.json({
      success: true,
      reversed_transactions: transactions.length,
    });
  } catch (error) {
    console.error('Error reversing material usage:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
