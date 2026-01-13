/**
 * 승인 라인 서비스
 * 승인 유형 및 조건에 따른 결재선 자동 설정
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _supabaseClient: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!_supabaseClient) {
    _supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
  }
  return _supabaseClient;
}

const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return (getSupabase() as any)[prop];
  }
});

export type ApprovalType =
  | 'LEAVE'
  | 'OVERTIME'
  | 'SCHEDULE_CHANGE'
  | 'PURCHASE'
  | 'DISPOSAL'
  | 'RESIGNATION'
  | 'ABSENCE_EXCUSE'
  | 'EXPENSE'
  | 'DOCUMENT';

export interface Approver {
  order: number;
  approverId: string;
  approverName: string;
  approverRole: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  comment?: string;
  decidedAt?: Date;
}

export interface ApprovalLineConfig {
  type: ApprovalType;
  minApprovers: number;
  maxApprovers: number;
  amountThresholds?: {
    amount: number;
    additionalApprovers: number;
  }[];
}

// 기본 승인 라인 설정
const DEFAULT_APPROVAL_LINE_CONFIG: Record<ApprovalType, ApprovalLineConfig> = {
  LEAVE: { type: 'LEAVE', minApprovers: 1, maxApprovers: 2 },
  OVERTIME: { type: 'OVERTIME', minApprovers: 1, maxApprovers: 2 },
  SCHEDULE_CHANGE: { type: 'SCHEDULE_CHANGE', minApprovers: 1, maxApprovers: 1 },
  PURCHASE: {
    type: 'PURCHASE',
    minApprovers: 1,
    maxApprovers: 3,
    amountThresholds: [
      { amount: 100000, additionalApprovers: 0 },
      { amount: 500000, additionalApprovers: 1 },
      { amount: Infinity, additionalApprovers: 2 },
    ],
  },
  DISPOSAL: { type: 'DISPOSAL', minApprovers: 2, maxApprovers: 2 },
  RESIGNATION: { type: 'RESIGNATION', minApprovers: 3, maxApprovers: 3 },
  ABSENCE_EXCUSE: { type: 'ABSENCE_EXCUSE', minApprovers: 1, maxApprovers: 2 },
  EXPENSE: {
    type: 'EXPENSE',
    minApprovers: 1,
    maxApprovers: 3,
    amountThresholds: [
      { amount: 50000, additionalApprovers: 0 },
      { amount: 200000, additionalApprovers: 1 },
      { amount: Infinity, additionalApprovers: 2 },
    ],
  },
  DOCUMENT: { type: 'DOCUMENT', minApprovers: 1, maxApprovers: 2 },
};

export class ApprovalLineService {
  /**
   * 승인 라인 자동 생성
   */
  async getApprovalLine(
    type: ApprovalType,
    details: Record<string, any>,
    storeId: string,
    companyId: string
  ): Promise<Approver[]> {
    const line: Approver[] = [];
    let order = 1;

    // 회사 맞춤 설정 조회
    const { data: customTemplate } = await supabase
      .from('approval_line_templates')
      .select('*')
      .eq('company_id', companyId)
      .eq('approval_type', type)
      .eq('is_default', true)
      .eq('is_active', true)
      .maybeSingle();

    if (customTemplate?.approval_line) {
      // 맞춤 결재선 사용
      return customTemplate.approval_line.map((item: any, idx: number) => ({
        order: idx + 1,
        approverId: item.approverId,
        approverName: item.approverName,
        approverRole: item.approverRole,
        status: 'PENDING',
      }));
    }

    // 기본 결재선 생성
    switch (type) {
      case 'PURCHASE':
      case 'EXPENSE':
        const amount = details.totalAmount || details.amount || 0;
        await this.buildAmountBasedLine(line, type, amount, storeId, companyId, order);
        break;

      case 'DISPOSAL':
        const storeManager = await this.getStoreManager(storeId);
        if (storeManager) {
          line.push({ ...storeManager, order: order++, status: 'PENDING' });
        }
        const manager = await this.getManager(storeId);
        if (manager) {
          line.push({ ...manager, order: order++, status: 'PENDING' });
        }
        break;

      case 'RESIGNATION':
        const sm1 = await this.getStoreManager(storeId);
        if (sm1) line.push({ ...sm1, order: order++, status: 'PENDING' });
        const mg1 = await this.getManager(storeId);
        if (mg1) line.push({ ...mg1, order: order++, status: 'PENDING' });
        const admin1 = await this.getCompanyAdmin(companyId);
        if (admin1) line.push({ ...admin1, order: order++, status: 'PENDING' });
        break;

      case 'LEAVE':
      case 'OVERTIME':
      case 'ABSENCE_EXCUSE':
        const sm2 = await this.getStoreManager(storeId);
        if (sm2) {
          line.push({ ...sm2, order: order++, status: 'PENDING' });
        } else {
          const mg2 = await this.getManager(storeId);
          if (mg2) line.push({ ...mg2, order: order++, status: 'PENDING' });
        }
        break;

      case 'SCHEDULE_CHANGE':
        const sm3 = await this.getStoreManager(storeId);
        if (sm3) {
          line.push({ ...sm3, order: order++, status: 'PENDING' });
        }
        break;

      case 'DOCUMENT':
      default:
        const sm4 = await this.getStoreManager(storeId);
        if (sm4) {
          line.push({ ...sm4, order: order++, status: 'PENDING' });
        }
        break;
    }

    return line;
  }

  /**
   * 금액 기반 결재선 구성
   */
  private async buildAmountBasedLine(
    line: Approver[],
    type: ApprovalType,
    amount: number,
    storeId: string,
    companyId: string,
    startOrder: number
  ): Promise<void> {
    let order = startOrder;

    if (amount < 100000) {
      // 10만원 미만: 매장관리자만
      const storeManager = await this.getStoreManager(storeId);
      if (storeManager) {
        line.push({ ...storeManager, order: order++, status: 'PENDING' });
      }
    } else if (amount < 500000) {
      // 50만원 미만: 매장관리자 → 본사관리자
      const storeManager = await this.getStoreManager(storeId);
      if (storeManager) {
        line.push({ ...storeManager, order: order++, status: 'PENDING' });
      }
      const manager = await this.getManager(storeId);
      if (manager) {
        line.push({ ...manager, order: order++, status: 'PENDING' });
      }
    } else {
      // 50만원 이상: 매장관리자 → 본사관리자 → 대표
      const storeManager = await this.getStoreManager(storeId);
      if (storeManager) {
        line.push({ ...storeManager, order: order++, status: 'PENDING' });
      }
      const manager = await this.getManager(storeId);
      if (manager) {
        line.push({ ...manager, order: order++, status: 'PENDING' });
      }
      const admin = await this.getCompanyAdmin(companyId);
      if (admin) {
        line.push({ ...admin, order: order++, status: 'PENDING' });
      }
    }
  }

  /**
   * 매장 관리자 조회
   */
  async getStoreManager(storeId: string): Promise<Omit<Approver, 'order' | 'status'> | null> {
    const { data } = await supabase
      .from('users')
      .select('id, name, role')
      .eq('store_id', storeId)
      .in('role', ['STORE_MANAGER', 'MANAGER'])
      .limit(1)
      .maybeSingle();

    if (!data) return null;

    return {
      approverId: data.id,
      approverName: data.name,
      approverRole: data.role,
    };
  }

  /**
   * 본사 관리자 조회
   */
  async getManager(storeId: string): Promise<Omit<Approver, 'order' | 'status'> | null> {
    // 매장의 회사 ID 조회
    const { data: store } = await supabase
      .from('stores')
      .select('company_id')
      .eq('id', storeId)
      .single();

    if (!store) return null;

    const { data } = await supabase
      .from('users')
      .select('id, name, role')
      .eq('company_id', store.company_id)
      .eq('role', 'ADMIN')
      .is('store_id', null)
      .limit(1)
      .maybeSingle();

    if (!data) return null;

    return {
      approverId: data.id,
      approverName: data.name,
      approverRole: data.role,
    };
  }

  /**
   * 회사 대표 조회
   */
  async getCompanyAdmin(companyId: string): Promise<Omit<Approver, 'order' | 'status'> | null> {
    const { data } = await supabase
      .from('users')
      .select('id, name, role')
      .eq('company_id', companyId)
      .eq('role', 'COMPANY_ADMIN')
      .limit(1)
      .maybeSingle();

    if (!data) return null;

    return {
      approverId: data.id,
      approverName: data.name,
      approverRole: data.role,
    };
  }

  /**
   * 승인 라인 템플릿 저장
   */
  async saveApprovalLineTemplate(
    companyId: string,
    type: ApprovalType,
    name: string,
    approvalLine: Approver[],
    conditions?: Record<string, any>,
    isDefault: boolean = false
  ): Promise<string> {
    // 기본 템플릿으로 설정하는 경우 기존 기본 해제
    if (isDefault) {
      await supabase
        .from('approval_line_templates')
        .update({ is_default: false })
        .eq('company_id', companyId)
        .eq('approval_type', type);
    }

    const { data, error } = await supabase
      .from('approval_line_templates')
      .insert({
        company_id: companyId,
        name,
        approval_type: type,
        conditions,
        approval_line: approvalLine,
        is_default: isDefault,
        is_active: true,
      })
      .select('id')
      .single();

    if (error) throw error;

    return data.id;
  }
}

export const approvalLineService = new ApprovalLineService();

export default ApprovalLineService;
