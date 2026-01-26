/**
 * Product Label API
 * 제품 한글표시사항 자동 생성
 *
 * GET: 제품 라벨 정보 조회 (자동 생성)
 * POST: 라벨 정보 저장/수정
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { formatAllergens, ALLERGEN_MAP } from '@/lib/constants/allergens';
import { calculateNutritionFromRecipe } from '@/lib/services/nutrition-api';

interface LabelData {
  // 자동 생성 필드
  product_name: string;
  product_code: string;
  food_type: string;
  net_content: string;
  ingredients_list: string;
  allergens: string[];
  allergen_text: string;
  nutrition_facts: {
    serving_size: number;
    calories: number;
    carbohydrate: number;
    sugar: number;
    protein: number;
    fat: number;
    saturated_fat: number;
    trans_fat: number;
    cholesterol: number;
    sodium: number;
  } | null;
  expiry_info: string;
  storage_instructions: string;
  manufacturer_name: string;
  manufacturer_address: string;
  cautions: string[];
  // 메타데이터
  generated_at: string;
  recipe_based: boolean;
  ingredients_count: number;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await params;
    const supabase = await createClient();

    // 인증 확인
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

    // 1. 제품 정보 조회
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .eq('company_id', userProfile.company_id)
      .single();

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // 2. 회사 정보 조회 (제조원)
    const { data: company } = await supabase
      .from('companies')
      .select('name, address')
      .eq('id', userProfile.company_id)
      .single();

    // 3. 레시피 조회
    const { data: recipeIngredients } = await supabase
      .from('product_recipes')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: true });

    // 4. 원재료 정보 조회 (알레르기 정보 포함)
    const materialNames = (recipeIngredients || []).map(r => r.material_name);
    const { data: materials } = await supabase
      .from('materials')
      .select('name, allergens')
      .eq('company_id', userProfile.company_id)
      .in('name', materialNames);

    // 5. 알레르기 정보 추출
    const allergenSet = new Set<string>();
    for (const material of materials || []) {
      if (material.allergens && Array.isArray(material.allergens)) {
        for (const allergen of material.allergens) {
          if (ALLERGEN_MAP[allergen as keyof typeof ALLERGEN_MAP]) {
            allergenSet.add(allergen);
          }
        }
      }
    }
    const allergens = Array.from(allergenSet);

    // 6. 원재료명 목록 생성 (배합비율 순)
    const sortedIngredients = [...(recipeIngredients || [])].sort(
      (a, b) => (b.amount || 0) - (a.amount || 0)
    );
    const ingredientsList = sortedIngredients
      .map(ing => ing.material_name)
      .filter(Boolean)
      .join(', ');

    // 7. 영양성분 계산 (레시피 기반)
    let nutritionFacts = null;
    if (recipeIngredients && recipeIngredients.length > 0) {
      try {
        const nutrition = await calculateNutritionFromRecipe(
          recipeIngredients.map(r => ({
            name: r.material_name,
            amount: r.amount || 0,
            unit: r.unit || 'g',
          }))
        );
        if (nutrition) {
          nutritionFacts = {
            serving_size: nutrition.serving_size,
            calories: nutrition.calories,
            carbohydrate: nutrition.carbohydrate,
            sugar: nutrition.sugar,
            protein: nutrition.protein,
            fat: nutrition.fat,
            saturated_fat: nutrition.saturated_fat,
            trans_fat: nutrition.trans_fat,
            cholesterol: nutrition.cholesterol,
            sodium: nutrition.sodium,
          };
        }
      } catch (e) {
        console.error('Nutrition calculation error:', e);
      }
    }

    // 8. 라벨 데이터 구성
    const labelData: LabelData = {
      product_name: product.name,
      product_code: product.code,
      food_type: product.category || '',
      net_content: product.specification || '',
      ingredients_list: ingredientsList,
      allergens,
      allergen_text: formatAllergens(allergens),
      nutrition_facts: nutritionFacts,
      expiry_info: product.shelf_life
        ? `제조일로부터 ${product.shelf_life}일`
        : '',
      storage_instructions: product.storage_condition || '',
      manufacturer_name: company?.name || '',
      manufacturer_address: company?.address || '',
      cautions: [],
      generated_at: new Date().toISOString(),
      recipe_based: (recipeIngredients?.length || 0) > 0,
      ingredients_count: recipeIngredients?.length || 0,
    };

    // 자동 주의사항 추가
    if (allergens.length > 0) {
      labelData.cautions.push(
        `이 제품은 ${formatAllergens(allergens)}을(를) 사용한 제품과 같은 제조시설에서 제조하고 있습니다.`
      );
    }

    return NextResponse.json(labelData);
  } catch (error) {
    console.error('Label generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate label' },
      { status: 500 }
    );
  }
}

// 라벨 정보 수동 수정/저장
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await params;
    const supabase = await createClient();
    const body = await request.json();

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

    // 제품에 라벨 정보 저장 (products 테이블의 JSONB 필드 활용 또는 별도 테이블)
    const { error: updateError } = await supabase
      .from('products')
      .update({
        label_data: body,
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId)
      .eq('company_id', userProfile.company_id);

    if (updateError) {
      console.error('Label save error:', updateError);
      return NextResponse.json(
        { error: 'Failed to save label' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Label save error:', error);
    return NextResponse.json(
      { error: 'Failed to save label' },
      { status: 500 }
    );
  }
}
