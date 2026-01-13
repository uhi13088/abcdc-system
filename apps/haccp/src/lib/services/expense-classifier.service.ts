/**
 * AI 기반 비용 자동 분류 서비스
 * OpenAI GPT를 사용하여 거래내역 카테고리 자동 분류
 */

import OpenAI from 'openai';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _supabaseClient: SupabaseClient | null = null;
let _openaiClient: OpenAI | null = null;

function getSupabase(): SupabaseClient {
  if (!_supabaseClient) {
    _supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
  }
  return _supabaseClient;
}

function getOpenAI(): OpenAI {
  if (!_openaiClient) {
    _openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return _openaiClient;
}

// Lazy-loaded clients
const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return (getSupabase() as any)[prop];
  }
});

const openai = new Proxy({} as OpenAI, {
  get(_, prop) {
    return (getOpenAI() as any)[prop];
  }
});

export interface ClassificationResult {
  category: string;
  confidence: number;
  subCategory?: string;
  reasoning?: string;
}

export interface Transaction {
  id: string;
  merchantName: string;
  amount: number;
  transactionDate: string;
}

const EXPENSE_CATEGORIES = [
  { value: 'INGREDIENTS', label: '재료비', description: '식자재, 원재료 구입비' },
  { value: 'LABOR', label: '인건비', description: '급여, 4대보험료' },
  { value: 'RENT', label: '임대료', description: '월세, 관리비' },
  { value: 'UTILITIES', label: '수도광열비', description: '전기, 가스, 수도' },
  { value: 'MARKETING', label: '마케팅비', description: '광고, 판촉, 홍보' },
  { value: 'SUPPLIES', label: '소모품비', description: '포장재, 일회용품, 사무용품' },
  { value: 'MAINTENANCE', label: '수선유지비', description: '수리, 청소, 유지보수' },
  { value: 'INSURANCE', label: '보험료', description: '화재보험, 배상책임보험' },
  { value: 'TAX', label: '세금공과', description: '부가세, 재산세, 각종 세금' },
  { value: 'FINANCE', label: '금융비용', description: '이자, 수수료' },
  { value: 'DEPRECIATION', label: '감가상각비', description: '장비, 시설 감가상각' },
  { value: 'EDUCATION', label: '교육훈련비', description: '직원 교육, 연수' },
  { value: 'DELIVERY', label: '배달비', description: '배달 수수료, 배달 대행' },
  { value: 'SUBSCRIPTION', label: '구독/서비스', description: 'POS, 소프트웨어, 구독' },
  { value: 'OTHER', label: '기타', description: '분류 불가 항목' },
];

const SYSTEM_PROMPT = `당신은 소상공인/요식업체의 비용 분류 전문가입니다.
거래처명과 금액을 보고 아래 카테고리 중 하나로 분류해주세요.

카테고리 목록:
${EXPENSE_CATEGORIES.map(c => `- ${c.value}: ${c.label} (${c.description})`).join('\n')}

응답은 반드시 다음 JSON 형식으로 해주세요:
{
  "category": "카테고리코드",
  "confidence": 0.0~1.0 사이의 확신도,
  "subCategory": "세부 분류 (선택)",
  "reasoning": "분류 이유 한 줄"
}

참고 사항:
- 농협, 하나로마트, 과일/채소/육류 관련 → INGREDIENTS
- 한국전력, 가스공사, 수도 → UTILITIES
- 네이버광고, 카카오, 배민광고 → MARKETING
- 쿠팡이츠, 배달의민족, 요기요 수수료 → DELIVERY
- 알 수 없는 경우 OTHER로 분류하고 confidence 낮게`;

export class ExpenseClassifierService {
  /**
   * 단일 거래 분류
   */
  async classifyExpense(
    merchantName: string,
    amount: number
  ): Promise<ClassificationResult> {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `거래처: ${merchantName}\n금액: ${amount.toLocaleString()}원`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 200,
      });

      const content = response.choices[0].message.content;
      if (!content) {
        return { category: 'OTHER', confidence: 0.5 };
      }

      return JSON.parse(content) as ClassificationResult;
    } catch (error) {
      console.error('AI classification error:', error);
      return { category: 'OTHER', confidence: 0.5, reasoning: 'AI 분류 실패' };
    }
  }

  /**
   * 일괄 분류
   */
  async classifyBatch(transactions: Transaction[]): Promise<Map<string, ClassificationResult>> {
    const results = new Map<string, ClassificationResult>();

    // 동시에 최대 5개까지 처리
    const batchSize = 5;
    for (let i = 0; i < transactions.length; i += batchSize) {
      const batch = transactions.slice(i, i + batchSize);
      const promises = batch.map(async tx => {
        const result = await this.classifyExpense(tx.merchantName, tx.amount);
        results.set(tx.id, result);
      });
      await Promise.all(promises);
    }

    return results;
  }

  /**
   * 미분류 거래 조회 및 분류
   */
  async classifyUnclassifiedTransactions(companyId: string): Promise<number> {
    // 미분류 거래 조회
    const { data: transactions, error } = await supabase
      .from('expense_transactions')
      .select('id, merchant_name, amount, transaction_date')
      .eq('company_id', companyId)
      .is('ai_category', null)
      .limit(50);

    if (error || !transactions || transactions.length === 0) {
      return 0;
    }

    let classifiedCount = 0;

    for (const tx of transactions) {
      try {
        const result = await this.classifyExpense(tx.merchant_name, tx.amount);

        await supabase
          .from('expense_transactions')
          .update({
            ai_category: result.category,
            ai_confidence: result.confidence,
          })
          .eq('id', tx.id);

        classifiedCount++;
      } catch (error) {
        console.error(`Classification failed for tx ${tx.id}:`, error);
      }
    }

    return classifiedCount;
  }

  /**
   * 사용자 확인으로 분류 확정
   */
  async confirmCategory(
    transactionId: string,
    category: string
  ): Promise<void> {
    await supabase
      .from('expense_transactions')
      .update({
        category,
        user_confirmed: true,
      })
      .eq('id', transactionId);
  }

  /**
   * 학습 데이터 기반 패턴 매칭 (AI 호출 전 체크)
   */
  async matchKnownPattern(merchantName: string): Promise<ClassificationResult | null> {
    // 키워드 기반 빠른 매칭
    const patterns: Array<{ keywords: string[]; category: string; confidence: number }> = [
      { keywords: ['농협', '하나로', 'NH'], category: 'INGREDIENTS', confidence: 0.95 },
      { keywords: ['한전', '한국전력', 'KEPCO'], category: 'UTILITIES', confidence: 0.98 },
      { keywords: ['가스공사', '도시가스'], category: 'UTILITIES', confidence: 0.98 },
      { keywords: ['수도사업소', '상수도'], category: 'UTILITIES', confidence: 0.98 },
      { keywords: ['배달의민족', '요기요', '쿠팡이츠'], category: 'DELIVERY', confidence: 0.95 },
      { keywords: ['카카오광고', '네이버광고', 'Google Ads'], category: 'MARKETING', confidence: 0.95 },
      { keywords: ['국민연금', '건강보험', '고용보험'], category: 'LABOR', confidence: 0.98 },
      { keywords: ['임대료', '월세', '관리비'], category: 'RENT', confidence: 0.90 },
      { keywords: ['소방공제회', '화재보험'], category: 'INSURANCE', confidence: 0.95 },
    ];

    const normalizedName = merchantName.toUpperCase();

    for (const pattern of patterns) {
      if (pattern.keywords.some(kw => normalizedName.includes(kw.toUpperCase()))) {
        return {
          category: pattern.category,
          confidence: pattern.confidence,
          reasoning: '키워드 패턴 매칭',
        };
      }
    }

    return null;
  }

  /**
   * 스마트 분류 (패턴 매칭 우선, AI 보조)
   */
  async smartClassify(
    merchantName: string,
    amount: number
  ): Promise<ClassificationResult> {
    // 1. 패턴 매칭 시도
    const patternResult = await this.matchKnownPattern(merchantName);
    if (patternResult && patternResult.confidence >= 0.9) {
      return patternResult;
    }

    // 2. AI 분류
    return this.classifyExpense(merchantName, amount);
  }

  /**
   * 카테고리 목록 조회
   */
  getCategories() {
    return EXPENSE_CATEGORIES;
  }
}

export const expenseClassifierService = new ExpenseClassifierService();

export default ExpenseClassifierService;
