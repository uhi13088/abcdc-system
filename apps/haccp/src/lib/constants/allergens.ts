/**
 * 식품 알레르기 유발물질 22종 (식품 등의 표시·광고에 관한 법률)
 * https://www.foodsafetykorea.go.kr
 */

export const ALLERGENS = [
  { id: 'egg', name: '난류(가금류)', category: '동물성' },
  { id: 'milk', name: '우유', category: '동물성' },
  { id: 'buckwheat', name: '메밀', category: '곡류' },
  { id: 'peanut', name: '땅콩', category: '견과류' },
  { id: 'soybean', name: '대두', category: '두류' },
  { id: 'wheat', name: '밀', category: '곡류' },
  { id: 'mackerel', name: '고등어', category: '어류' },
  { id: 'crab', name: '게', category: '갑각류' },
  { id: 'shrimp', name: '새우', category: '갑각류' },
  { id: 'pork', name: '돼지고기', category: '육류' },
  { id: 'peach', name: '복숭아', category: '과일류' },
  { id: 'tomato', name: '토마토', category: '채소류' },
  { id: 'sulfite', name: '아황산류', category: '첨가물' },
  { id: 'walnut', name: '호두', category: '견과류' },
  { id: 'chicken', name: '닭고기', category: '육류' },
  { id: 'beef', name: '쇠고기', category: '육류' },
  { id: 'squid', name: '오징어', category: '연체류' },
  { id: 'shellfish', name: '조개류(굴, 전복, 홍합 포함)', category: '패류' },
  { id: 'pine_nut', name: '잣', category: '견과류' },
] as const;

export type AllergenId = typeof ALLERGENS[number]['id'];

export const ALLERGEN_MAP = Object.fromEntries(
  ALLERGENS.map(a => [a.id, a])
) as Record<AllergenId, typeof ALLERGENS[number]>;

/**
 * 알레르기 ID 배열을 한글 문자열로 변환
 */
export function formatAllergens(allergenIds: string[]): string {
  if (!allergenIds || allergenIds.length === 0) return '';

  return allergenIds
    .map(id => ALLERGEN_MAP[id as AllergenId]?.name)
    .filter(Boolean)
    .join(', ');
}

/**
 * 영양성분 항목 정의
 */
export const NUTRITION_FIELDS = [
  { id: 'calories', name: '열량', unit: 'kcal', required: true },
  { id: 'carbohydrate', name: '탄수화물', unit: 'g', required: true },
  { id: 'sugar', name: '당류', unit: 'g', required: true },
  { id: 'protein', name: '단백질', unit: 'g', required: true },
  { id: 'fat', name: '지방', unit: 'g', required: true },
  { id: 'saturated_fat', name: '포화지방', unit: 'g', required: true },
  { id: 'trans_fat', name: '트랜스지방', unit: 'g', required: true },
  { id: 'cholesterol', name: '콜레스테롤', unit: 'mg', required: true },
  { id: 'sodium', name: '나트륨', unit: 'mg', required: true },
] as const;

export type NutritionFieldId = typeof NUTRITION_FIELDS[number]['id'];

export interface NutritionFacts {
  serving_size: number;      // 1회 제공량 (g)
  servings_per_container: number;  // 총 제공량
  calories: number;
  carbohydrate: number;
  sugar: number;
  protein: number;
  fat: number;
  saturated_fat: number;
  trans_fat: number;
  cholesterol: number;
  sodium: number;
  [key: string]: number;     // 추가 영양성분
}

/**
 * 식품유형 목록
 */
export const FOOD_TYPES = [
  '과자류',
  '빵류',
  '떡류',
  '초콜릿류',
  '캔디류',
  '빙과류',
  '유가공품',
  '음료류',
  '커피',
  '주류',
  '조미식품',
  '소스류',
  '면류',
  '즉석식품',
  '레토르트식품',
  '냉동식품',
  '건강기능식품',
  '기타가공품',
] as const;

/**
 * 보관방법 옵션
 */
export const STORAGE_INSTRUCTIONS = [
  '냉장보관(0~10°C)',
  '냉동보관(-18°C 이하)',
  '실온보관',
  '직사광선을 피하여 서늘한 곳에 보관',
  '개봉 후 냉장보관',
  '개봉 후 즉시 섭취',
] as const;
