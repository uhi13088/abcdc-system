/**
 * 식품의약품안전처 식품영양성분 API 연동
 * https://www.data.go.kr/data/15127578/openapi.do
 *
 * 환경변수: NUTRITION_API_KEY
 */

export interface NutritionApiResult {
  food_name: string;
  food_code?: string;
  manufacturer?: string;
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
  source?: string;
}

interface ApiResponse {
  header: {
    resultCode: string;
    resultMsg: string;
  };
  body: {
    totalCount: number;
    items: Array<{
      FOOD_CD?: string;
      FOOD_NM_KR?: string;
      FOOD_NM?: string;
      DB_GRP_NM?: string;
      MAKER_NM?: string;
      SERVING_SIZE?: string;
      NUTR_CONT1?: string;  // 열량
      NUTR_CONT2?: string;  // 탄수화물
      NUTR_CONT3?: string;  // 단백질
      NUTR_CONT4?: string;  // 지방
      NUTR_CONT5?: string;  // 당류
      NUTR_CONT6?: string;  // 나트륨
      NUTR_CONT7?: string;  // 콜레스테롤
      NUTR_CONT8?: string;  // 포화지방산
      NUTR_CONT9?: string;  // 트랜스지방
    }>;
  };
}

const API_BASE_URL = 'https://openapi.foodsafetykorea.go.kr/api';

/**
 * 식품명으로 영양성분 검색
 */
export async function searchNutrition(
  foodName: string,
  options?: { limit?: number }
): Promise<NutritionApiResult[]> {
  const apiKey = process.env.NUTRITION_API_KEY;

  if (!apiKey) {
    console.warn('NUTRITION_API_KEY not configured, returning mock data');
    return getMockNutritionData(foodName);
  }

  try {
    const limit = options?.limit || 10;
    const url = `${API_BASE_URL}/${apiKey}/I2790/json/1/${limit}/FOOD_NM_KR=${encodeURIComponent(foodName)}`;

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 3600 }, // 1시간 캐시
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data: ApiResponse = await response.json();

    if (data.header?.resultCode !== '00' && data.header?.resultCode !== 'INFO-000') {
      console.error('API error:', data.header?.resultMsg);
      return [];
    }

    return (data.body?.items || []).map(item => ({
      food_name: item.FOOD_NM_KR || item.FOOD_NM || '',
      food_code: item.FOOD_CD,
      manufacturer: item.MAKER_NM,
      serving_size: parseFloat(item.SERVING_SIZE || '100') || 100,
      calories: parseFloat(item.NUTR_CONT1 || '0') || 0,
      carbohydrate: parseFloat(item.NUTR_CONT2 || '0') || 0,
      protein: parseFloat(item.NUTR_CONT3 || '0') || 0,
      fat: parseFloat(item.NUTR_CONT4 || '0') || 0,
      sugar: parseFloat(item.NUTR_CONT5 || '0') || 0,
      sodium: parseFloat(item.NUTR_CONT6 || '0') || 0,
      cholesterol: parseFloat(item.NUTR_CONT7 || '0') || 0,
      saturated_fat: parseFloat(item.NUTR_CONT8 || '0') || 0,
      trans_fat: parseFloat(item.NUTR_CONT9 || '0') || 0,
      source: 'foodsafetykorea',
    }));
  } catch (error) {
    console.error('Nutrition API error:', error);
    return getMockNutritionData(foodName);
  }
}

/**
 * 레시피 기반 영양성분 계산
 * 각 원료의 영양성분을 배합비율에 따라 합산
 */
export async function calculateNutritionFromRecipe(
  ingredients: Array<{
    name: string;
    amount: number;  // g
    unit: string;
  }>
): Promise<NutritionApiResult | null> {
  // 각 원료별 영양성분 조회
  const nutritionPromises = ingredients.map(async (ing) => {
    const results = await searchNutrition(ing.name, { limit: 1 });
    if (results.length === 0) return null;

    const nutrition = results[0];
    // 100g 기준 → 실제 사용량으로 환산
    const ratio = ing.amount / 100;

    return {
      name: ing.name,
      amount: ing.amount,
      calories: nutrition.calories * ratio,
      carbohydrate: nutrition.carbohydrate * ratio,
      sugar: nutrition.sugar * ratio,
      protein: nutrition.protein * ratio,
      fat: nutrition.fat * ratio,
      saturated_fat: nutrition.saturated_fat * ratio,
      trans_fat: nutrition.trans_fat * ratio,
      cholesterol: nutrition.cholesterol * ratio,
      sodium: nutrition.sodium * ratio,
    };
  });

  const nutritionResults = await Promise.all(nutritionPromises);
  const validResults = nutritionResults.filter(Boolean);

  if (validResults.length === 0) return null;

  // 합산
  const totalAmount = ingredients.reduce((sum, ing) => sum + ing.amount, 0);

  const combined: NutritionApiResult = {
    food_name: '계산된 영양성분',
    serving_size: totalAmount,
    calories: 0,
    carbohydrate: 0,
    sugar: 0,
    protein: 0,
    fat: 0,
    saturated_fat: 0,
    trans_fat: 0,
    cholesterol: 0,
    sodium: 0,
    source: 'calculated',
  };

  for (const result of validResults) {
    if (result) {
      combined.calories += result.calories;
      combined.carbohydrate += result.carbohydrate;
      combined.sugar += result.sugar;
      combined.protein += result.protein;
      combined.fat += result.fat;
      combined.saturated_fat += result.saturated_fat;
      combined.trans_fat += result.trans_fat;
      combined.cholesterol += result.cholesterol;
      combined.sodium += result.sodium;
    }
  }

  // 100g 기준으로 환산
  const factor = 100 / totalAmount;
  combined.serving_size = 100;
  combined.calories = Math.round(combined.calories * factor);
  combined.carbohydrate = Math.round(combined.carbohydrate * factor * 10) / 10;
  combined.sugar = Math.round(combined.sugar * factor * 10) / 10;
  combined.protein = Math.round(combined.protein * factor * 10) / 10;
  combined.fat = Math.round(combined.fat * factor * 10) / 10;
  combined.saturated_fat = Math.round(combined.saturated_fat * factor * 10) / 10;
  combined.trans_fat = Math.round(combined.trans_fat * factor * 10) / 10;
  combined.cholesterol = Math.round(combined.cholesterol * factor);
  combined.sodium = Math.round(combined.sodium * factor);

  return combined;
}

/**
 * Mock data for development/fallback
 */
function getMockNutritionData(foodName: string): NutritionApiResult[] {
  // 일반적인 식재료 영양성분 (100g 기준)
  const mockData: Record<string, Partial<NutritionApiResult>> = {
    '밀가루': { calories: 364, carbohydrate: 76.3, protein: 10.3, fat: 1.0, sugar: 0.3, sodium: 2 },
    '설탕': { calories: 387, carbohydrate: 99.8, protein: 0, fat: 0, sugar: 99.8, sodium: 0 },
    '버터': { calories: 717, carbohydrate: 0.1, protein: 0.9, fat: 81.1, saturated_fat: 51.4, cholesterol: 215, sodium: 11 },
    '계란': { calories: 147, carbohydrate: 0.8, protein: 12.6, fat: 10.0, cholesterol: 423, sodium: 140 },
    '우유': { calories: 61, carbohydrate: 4.7, protein: 3.2, fat: 3.3, sugar: 5.0, sodium: 43 },
    '생크림': { calories: 337, carbohydrate: 2.8, protein: 2.1, fat: 35.0, saturated_fat: 21.8, cholesterol: 116, sodium: 34 },
    '초콜릿': { calories: 546, carbohydrate: 59.4, protein: 4.9, fat: 31.3, sugar: 47.9, sodium: 79 },
    '아몬드': { calories: 576, carbohydrate: 21.7, protein: 21.2, fat: 49.4, sodium: 1 },
    '바닐라': { calories: 288, carbohydrate: 12.7, protein: 0.1, fat: 0.1, sodium: 9 },
  };

  // 부분 일치 검색
  const matches = Object.entries(mockData)
    .filter(([name]) => name.includes(foodName) || foodName.includes(name))
    .map(([name, data]) => ({
      food_name: name,
      serving_size: 100,
      calories: data.calories || 0,
      carbohydrate: data.carbohydrate || 0,
      sugar: data.sugar || 0,
      protein: data.protein || 0,
      fat: data.fat || 0,
      saturated_fat: data.saturated_fat || 0,
      trans_fat: data.trans_fat || 0,
      cholesterol: data.cholesterol || 0,
      sodium: data.sodium || 0,
      source: 'mock',
    }));

  return matches;
}
