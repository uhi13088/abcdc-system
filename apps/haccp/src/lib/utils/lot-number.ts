/**
 * Lot Number Generator
 * HACCP 워크플로우 자동화 - 로트번호 자동 생성
 *
 * 형식: [유형]-[날짜]-[코드]-[순번]
 * 예시:
 *   - 입고: MAT-20260126-CHK-001
 *   - 생산: PRD-20260126-P001-001
 *   - 반제품: SEM-20260126-S001-001
 *   - 출하: SHP-20260126-001
 */

import { SupabaseClient } from '@supabase/supabase-js';

export type LotType = 'MAT' | 'PRD' | 'SEM' | 'SHP' | 'CCP';

interface LotNumberOptions {
  type: LotType;
  date?: Date;
  code?: string;  // 제품코드 또는 원료코드 (선택)
  companyId: string;
}

/**
 * 오늘 날짜 문자열 생성 (YYYYMMDD)
 */
function getDateString(date?: Date): string {
  const d = date || new Date();
  return d.toISOString().split('T')[0].replace(/-/g, '');
}

/**
 * 로트번호의 일일 순번 조회
 * 테이블에서 오늘 날짜에 해당하는 마지막 순번을 찾아 +1
 */
async function getNextSequence(
  supabase: SupabaseClient,
  type: LotType,
  dateStr: string,
  companyId: string
): Promise<number> {
  // 각 타입별 테이블 및 컬럼
  const tableConfig: Record<LotType, { table: string; column: string }> = {
    MAT: { table: 'material_inspections', column: 'lot_number' },
    PRD: { table: 'production_records', column: 'lot_number' },
    SEM: { table: 'semi_products', column: 'lot_number' },
    SHP: { table: 'shipment_records', column: 'shipment_number' },
    CCP: { table: 'ccp_records', column: 'lot_number' },
  };

  const config = tableConfig[type];
  const prefix = `${type}-${dateStr}`;

  try {
    const { data, error } = await supabase
      .from(config.table)
      .select(config.column)
      .eq('company_id', companyId)
      .like(config.column, `${prefix}%`)
      .order(config.column, { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) {
      return 1;
    }

    // 마지막 순번 추출
    const record = data[0] as unknown as Record<string, unknown>;
    const lastLot = record[config.column] as string;
    const parts = lastLot.split('-');
    const lastSeq = parseInt(parts[parts.length - 1], 10);

    return isNaN(lastSeq) ? 1 : lastSeq + 1;
  } catch {
    return 1;
  }
}

/**
 * 로트번호 생성 (동기 - 순번 없이 랜덤)
 * DB 조회 없이 빠르게 생성할 때 사용
 */
export function generateLotNumberSync(options: Omit<LotNumberOptions, 'companyId'>): string {
  const { type, date, code } = options;
  const dateStr = getDateString(date);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');

  if (code) {
    // 코드가 있으면 코드 포함
    const shortCode = code.substring(0, 4).toUpperCase();
    return `${type}-${dateStr}-${shortCode}-${random}`;
  }

  return `${type}-${dateStr}-${random}`;
}

/**
 * 로트번호 생성 (비동기 - 순차 번호)
 * DB에서 마지막 순번을 조회하여 순차적 번호 생성
 */
export async function generateLotNumber(
  supabase: SupabaseClient,
  options: LotNumberOptions
): Promise<string> {
  const { type, date, code, companyId } = options;
  const dateStr = getDateString(date);
  const seq = await getNextSequence(supabase, type, dateStr, companyId);
  const seqStr = seq.toString().padStart(3, '0');

  if (code) {
    // 코드가 있으면 코드 포함
    const shortCode = code.substring(0, 4).toUpperCase();
    return `${type}-${dateStr}-${shortCode}-${seqStr}`;
  }

  return `${type}-${dateStr}-${seqStr}`;
}

/**
 * 입고검사 로트번호 생성
 */
export async function generateMaterialLotNumber(
  supabase: SupabaseClient,
  companyId: string,
  materialCode?: string
): Promise<string> {
  return generateLotNumber(supabase, {
    type: 'MAT',
    companyId,
    code: materialCode,
  });
}

/**
 * 생산 로트번호 생성
 */
export async function generateProductionLotNumber(
  supabase: SupabaseClient,
  companyId: string,
  productCode?: string
): Promise<string> {
  return generateLotNumber(supabase, {
    type: 'PRD',
    companyId,
    code: productCode,
  });
}

/**
 * 반제품 로트번호 생성
 */
export async function generateSemiProductLotNumber(
  supabase: SupabaseClient,
  companyId: string,
  productCode?: string
): Promise<string> {
  return generateLotNumber(supabase, {
    type: 'SEM',
    companyId,
    code: productCode,
  });
}

/**
 * 출하번호 생성
 */
export async function generateShipmentNumber(
  supabase: SupabaseClient,
  companyId: string
): Promise<string> {
  return generateLotNumber(supabase, {
    type: 'SHP',
    companyId,
  });
}

/**
 * CCP 기록 로트번호 생성
 */
export async function generateCCPLotNumber(
  supabase: SupabaseClient,
  companyId: string,
  ccpNumber?: string
): Promise<string> {
  return generateLotNumber(supabase, {
    type: 'CCP',
    companyId,
    code: ccpNumber,
  });
}
