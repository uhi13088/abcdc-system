/**
 * 식품의약품안전처 식품영양성분DB 정보 API 연동
 * https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo02
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

// data.go.kr API 응답 형식
interface DataGoKrResponse {
  header: {
    resultCode: string;
    resultMsg: string;
  };
  body: {
    pageNo: number;
    totalCount: number;
    numOfRows: number;
    items: Array<{
      FOOD_CD?: string;       // 식품코드
      FOOD_NM_KR?: string;    // 식품명(한글)
      DB_GRP_NM?: string;     // DB그룹명
      FOOD_OR_NM?: string;    // 식품기원명
      SERVING_SIZE?: string;  // 1회제공량
      AMT_NUM1?: string;      // 열량(kcal)
      AMT_NUM2?: string;      // 탄수화물(g)
      AMT_NUM3?: string;      // 단백질(g)
      AMT_NUM4?: string;      // 지방(g)
      AMT_NUM5?: string;      // 총당류(g)
      AMT_NUM6?: string;      // 나트륨(mg)
      AMT_NUM7?: string;      // 콜레스테롤(mg)
      AMT_NUM8?: string;      // 포화지방산(g)
      AMT_NUM9?: string;      // 트랜스지방산(g)
    }>;
  };
}

const API_BASE_URL = 'https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo02';

/**
 * 식품명으로 영양성분 검색
 * data.go.kr API 사용
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

    // data.go.kr API 형식
    const params = new URLSearchParams({
      serviceKey: apiKey,
      pageNo: '1',
      numOfRows: String(limit),
      type: 'json',
      FOOD_NM_KR: foodName,
    });

    const url = `${API_BASE_URL}/getFoodNtrItdntList?${params.toString()}`;

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 3600 }, // 1시간 캐시
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data: DataGoKrResponse = await response.json();

    // 결과 코드 확인 (00: 정상, 03: 데이터 없음)
    if (data.header?.resultCode !== '00') {
      if (data.header?.resultCode === '03') {
        // 데이터 없음 - 정상적인 상황
        return [];
      }
      console.error('API error:', data.header?.resultCode, data.header?.resultMsg);
      return getMockNutritionData(foodName);
    }

    return (data.body?.items || []).map(item => ({
      food_name: item.FOOD_NM_KR || '',
      food_code: item.FOOD_CD,
      manufacturer: item.FOOD_OR_NM,
      serving_size: parseFloat(item.SERVING_SIZE || '100') || 100,
      calories: parseFloat(item.AMT_NUM1 || '0') || 0,
      carbohydrate: parseFloat(item.AMT_NUM2 || '0') || 0,
      protein: parseFloat(item.AMT_NUM3 || '0') || 0,
      fat: parseFloat(item.AMT_NUM4 || '0') || 0,
      sugar: parseFloat(item.AMT_NUM5 || '0') || 0,
      sodium: parseFloat(item.AMT_NUM6 || '0') || 0,
      cholesterol: parseFloat(item.AMT_NUM7 || '0') || 0,
      saturated_fat: parseFloat(item.AMT_NUM8 || '0') || 0,
      trans_fat: parseFloat(item.AMT_NUM9 || '0') || 0,
      source: 'data.go.kr',
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
