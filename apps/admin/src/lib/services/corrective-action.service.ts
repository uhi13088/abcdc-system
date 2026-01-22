/**
 * HACCP 개선조치 워크플로우 서비스
 * 부적합 발생 시 개선조치 프로세스 관리
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { addHours, addDays, format } from 'date-fns';

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

// Lazy-loaded supabase client accessor
const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (getSupabase() as any)[prop];
  }
});

export type WorkflowStep =
  | 'IMMEDIATE_ACTION'
  | 'ROOT_CAUSE_ANALYSIS'
  | 'CORRECTIVE_ACTION'
  | 'VERIFICATION'
  | 'CLOSURE';

export interface WorkflowStepData {
  step: WorkflowStep;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
  dueDate?: Date;
  startedAt?: Date;
  completedAt?: Date;
  completedBy?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: Record<string, any>;
  notes?: string;
  attachments?: string[];
}

export interface CorrectiveAction {
  id: string;
  companyId: string;
  sourceType: string;
  sourceId?: string;
  issueDescription: string;
  issueSeverity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  issueDate: string;
  status: WorkflowStep | 'CLOSED';
  workflow: WorkflowStepData[];
  assignedTo?: string;
  closedAt?: Date;
  closedBy?: string;
  effectivenessVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCorrectiveActionInput {
  companyId: string;
  sourceType: 'CCP_FAILURE' | 'AUDIT_FINDING' | 'CUSTOMER_COMPLAINT' | 'INSPECTION' | 'OTHER';
  sourceId?: string;
  issueDescription: string;
  issueSeverity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  issueDate?: Date;
  assignedTo?: string;
}

const STEP_LABELS: Record<WorkflowStep, string> = {
  IMMEDIATE_ACTION: '즉각 조치',
  ROOT_CAUSE_ANALYSIS: '원인 분석',
  CORRECTIVE_ACTION: '개선 조치',
  VERIFICATION: '검증',
  CLOSURE: '종결',
};

export class CorrectiveActionService {
  /**
   * 개선조치 생성
   */
  async create(input: CreateCorrectiveActionInput): Promise<CorrectiveAction> {
    const now = new Date();
    const issueDate = input.issueDate || now;

    // 심각도에 따른 기한 설정
    const dueDates = this.calculateDueDates(input.issueSeverity, now);

    const workflow: WorkflowStepData[] = [
      {
        step: 'IMMEDIATE_ACTION',
        status: 'IN_PROGRESS',
        dueDate: dueDates.immediateAction,
        startedAt: now,
      },
      {
        step: 'ROOT_CAUSE_ANALYSIS',
        status: 'PENDING',
        dueDate: dueDates.rootCause,
      },
      {
        step: 'CORRECTIVE_ACTION',
        status: 'PENDING',
        dueDate: dueDates.corrective,
      },
      {
        step: 'VERIFICATION',
        status: 'PENDING',
        dueDate: dueDates.verification,
      },
      {
        step: 'CLOSURE',
        status: 'PENDING',
      },
    ];

    const { data, error } = await supabase
      .from('corrective_actions')
      .insert({
        company_id: input.companyId,
        source_type: input.sourceType,
        source_id: input.sourceId,
        issue_description: input.issueDescription,
        issue_severity: input.issueSeverity,
        issue_date: format(issueDate, 'yyyy-MM-dd'),
        status: 'IMMEDIATE_ACTION',
        workflow,
        assigned_to: input.assignedTo,
        effectiveness_verified: false,
      })
      .select()
      .single();

    if (error) throw error;

    // 알림 생성
    if (input.assignedTo) {
      await supabase.from('notifications').insert({
        user_id: input.assignedTo,
        category: 'HACCP',
        priority: input.issueSeverity === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
        title: '개선조치 배정',
        body: `새로운 개선조치가 배정되었습니다: ${input.issueDescription}`,
        deep_link: `/haccp/corrective-actions/${data.id}`,
      });
    }

    return this.mapCorrectiveAction(data);
  }

  /**
   * 부적합에서 개선조치 자동 생성
   */
  async createFromNonConformance(nonConformanceId: string): Promise<CorrectiveAction> {
    const { data: nc, error } = await supabase
      .from('ccp_records')
      .select('*, ccp:ccp_definitions(*)')
      .eq('id', nonConformanceId)
      .single();

    if (error || !nc) {
      throw new Error('Non-conformance not found');
    }

    return this.create({
      companyId: nc.company_id,
      sourceType: 'CCP_FAILURE',
      sourceId: nonConformanceId,
      issueDescription: `${nc.ccp?.process || 'CCP'} 한계 초과: ${nc.measurement?.value}${nc.measurement?.unit}`,
      issueSeverity: 'HIGH',
      issueDate: new Date(nc.record_date),
    });
  }

  /**
   * 워크플로우 단계 진행
   */
  async progressStep(
    actionId: string,
    stepData: {
      notes?: string;
      attachments?: string[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data?: Record<string, any>;
    },
    userId: string
  ): Promise<CorrectiveAction> {
    const { data: action, error: fetchError } = await supabase
      .from('corrective_actions')
      .select('*')
      .eq('id', actionId)
      .single();

    if (fetchError || !action) {
      throw new Error('Corrective action not found');
    }

    const workflow = action.workflow as WorkflowStepData[];
    const currentStepIdx = workflow.findIndex(w => w.status === 'IN_PROGRESS');

    if (currentStepIdx === -1) {
      throw new Error('No active step found');
    }

    const now = new Date();

    // 현재 단계 완료
    workflow[currentStepIdx].status = 'COMPLETED';
    workflow[currentStepIdx].completedAt = now;
    workflow[currentStepIdx].completedBy = userId;
    workflow[currentStepIdx].notes = stepData.notes;
    workflow[currentStepIdx].attachments = stepData.attachments;
    workflow[currentStepIdx].data = stepData.data;

    let newStatus: WorkflowStep | 'CLOSED' = action.status;
    let closedAt: Date | undefined;
    let closedBy: string | undefined;

    // 다음 단계 시작
    if (currentStepIdx < workflow.length - 1) {
      workflow[currentStepIdx + 1].status = 'IN_PROGRESS';
      workflow[currentStepIdx + 1].startedAt = now;
      newStatus = workflow[currentStepIdx + 1].step;
    } else {
      // 마지막 단계(종결) 완료
      newStatus = 'CLOSED';
      closedAt = now;
      closedBy = userId;
    }

    const { data, error } = await supabase
      .from('corrective_actions')
      .update({
        workflow,
        status: newStatus,
        closed_at: closedAt?.toISOString(),
        closed_by: closedBy,
        updated_at: now.toISOString(),
      })
      .eq('id', actionId)
      .select()
      .single();

    if (error) throw error;

    return this.mapCorrectiveAction(data);
  }

  /**
   * 효과성 검증
   */
  async verifyEffectiveness(
    actionId: string,
    verified: boolean,
    notes: string,
    userId: string
  ): Promise<void> {
    await supabase
      .from('corrective_actions')
      .update({
        effectiveness_verified: verified,
        updated_at: new Date().toISOString(),
      })
      .eq('id', actionId);

    // 검증 단계 데이터 업데이트
    const { data: action } = await supabase
      .from('corrective_actions')
      .select('workflow')
      .eq('id', actionId)
      .single();

    if (action) {
      const workflow = action.workflow as WorkflowStepData[];
      const verificationStep = workflow.find(w => w.step === 'VERIFICATION');
      if (verificationStep) {
        verificationStep.data = {
          ...verificationStep.data,
          effectivenessVerified: verified,
          verificationNotes: notes,
          verifiedBy: userId,
          verifiedAt: new Date().toISOString(),
        };

        await supabase
          .from('corrective_actions')
          .update({ workflow })
          .eq('id', actionId);
      }
    }
  }

  /**
   * 개선조치 목록 조회
   */
  async list(
    companyId: string,
    options?: {
      status?: string;
      severity?: string;
      assignedTo?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ data: CorrectiveAction[]; total: number }> {
    let query = supabase
      .from('corrective_actions')
      .select('*', { count: 'exact' })
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (options?.status) {
      query = query.eq('status', options.status);
    }
    if (options?.severity) {
      query = query.eq('issue_severity', options.severity);
    }
    if (options?.assignedTo) {
      query = query.eq('assigned_to', options.assignedTo);
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    return {
      data: (data || []).map(this.mapCorrectiveAction),
      total: count || 0,
    };
  }

  /**
   * 심각도별 기한 계산
   */
  private calculateDueDates(
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    baseDate: Date
  ): {
    immediateAction: Date;
    rootCause: Date;
    corrective: Date;
    verification: Date;
  } {
    switch (severity) {
      case 'CRITICAL':
        return {
          immediateAction: addHours(baseDate, 4),
          rootCause: addDays(baseDate, 1),
          corrective: addDays(baseDate, 3),
          verification: addDays(baseDate, 7),
        };
      case 'HIGH':
        return {
          immediateAction: addHours(baseDate, 24),
          rootCause: addDays(baseDate, 3),
          corrective: addDays(baseDate, 7),
          verification: addDays(baseDate, 14),
        };
      case 'MEDIUM':
        return {
          immediateAction: addDays(baseDate, 2),
          rootCause: addDays(baseDate, 5),
          corrective: addDays(baseDate, 14),
          verification: addDays(baseDate, 21),
        };
      case 'LOW':
      default:
        return {
          immediateAction: addDays(baseDate, 3),
          rootCause: addDays(baseDate, 7),
          corrective: addDays(baseDate, 21),
          verification: addDays(baseDate, 30),
        };
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapCorrectiveAction(data: any): CorrectiveAction {
    return {
      id: data.id,
      companyId: data.company_id,
      sourceType: data.source_type,
      sourceId: data.source_id,
      issueDescription: data.issue_description,
      issueSeverity: data.issue_severity,
      issueDate: data.issue_date,
      status: data.status,
      workflow: data.workflow,
      assignedTo: data.assigned_to,
      closedAt: data.closed_at ? new Date(data.closed_at) : undefined,
      closedBy: data.closed_by,
      effectivenessVerified: data.effectiveness_verified,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  /**
   * 단계 라벨
   */
  getStepLabel(step: WorkflowStep): string {
    return STEP_LABELS[step] || step;
  }
}

export const correctiveActionService = new CorrectiveActionService();

export default CorrectiveActionService;
