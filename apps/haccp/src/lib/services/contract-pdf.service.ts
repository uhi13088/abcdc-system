/**
 * 계약서 PDF 서비스
 * 근로계약서 PDF 생성 및 관리
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PDFGenerator, ContractPDFData } from '@abc/shared/server';

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

export interface ContractWithRelations {
  id: string;
  contract_number: string;
  staff_id: string;
  company_id: string;
  brand_id: string;
  store_id: string;
  contract_type: string;
  start_date: string;
  end_date?: string;
  probation_months?: number;
  work_schedules: any[];
  position?: string;
  department?: string;
  duties: string[];
  salary_config: any;
  deduction_config: any;
  standard_hours_per_week: number;
  standard_hours_per_day: number;
  break_minutes: number;
  annual_leave_days: number;
  paid_leave_days: number;
  sick_leave_days: number;
  benefits?: any;
  terms: any;
  termination_config: any;
  employee_signed_at?: string;
  employee_signature?: string;
  employer_signed_at?: string;
  employer_signature?: string;
  attachments?: any;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  staff: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    address?: string;
    ssn_encrypted?: string;
  };
  company: {
    id: string;
    name: string;
    business_number?: string;
    ceo_name?: string;
    address?: string;
  };
}

export class ContractPDFService {
  /**
   * 계약서 PDF 생성
   */
  async generate(contractId: string): Promise<Buffer> {
    // 계약서 정보 조회
    const { data: contract, error } = await supabase
      .from('contracts')
      .select(`
        *,
        staff:users!staff_id (
          id,
          name,
          email,
          phone,
          address,
          ssn_encrypted
        ),
        company:companies!company_id (
          id,
          name,
          business_number,
          ceo_name,
          address
        )
      `)
      .eq('id', contractId)
      .single();

    if (error || !contract) {
      throw new Error('Contract not found');
    }

    // PDF 데이터 변환
    const pdfData: ContractPDFData = this.transformContractData(contract);

    // PDF 생성
    return PDFGenerator.generateContract(pdfData);
  }

  /**
   * 초안 PDF 생성 (워터마크 포함)
   */
  async generateDraft(contractId: string): Promise<Buffer> {
    const pdf = await this.generate(contractId);
    // TODO: 워터마크 추가 로직
    return pdf;
  }

  /**
   * 서명된 PDF 생성
   */
  async generateSigned(contractId: string): Promise<Buffer> {
    const { data: contract, error } = await supabase
      .from('contracts')
      .select(`
        *,
        staff:users!staff_id (
          id,
          name,
          email,
          phone,
          address,
          ssn_encrypted
        ),
        company:companies!company_id (
          id,
          name,
          business_number,
          ceo_name,
          address
        )
      `)
      .eq('id', contractId)
      .single();

    if (error || !contract) {
      throw new Error('Contract not found');
    }

    if (!contract.employee_signature || !contract.employer_signature) {
      throw new Error('Contract is not fully signed');
    }

    const pdfData: ContractPDFData = this.transformContractData(contract);

    return PDFGenerator.generateContract(pdfData);
  }

  /**
   * PDF를 Storage에 저장
   */
  async saveToStorage(
    contractId: string,
    pdf: Buffer,
    type: 'draft' | 'signed'
  ): Promise<string> {
    const fileName = `${contractId}/${type}.pdf`;

    const { data, error } = await supabase.storage
      .from('contracts')
      .upload(fileName, pdf, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (error) {
      throw new Error(`Failed to upload PDF: ${error.message}`);
    }

    // 공개 URL 생성
    const { data: urlData } = supabase.storage
      .from('contracts')
      .getPublicUrl(fileName);

    // contracts 테이블 업데이트
    const updateField = type === 'draft' ? 'pdf_draft_url' : 'pdf_signed_url';
    await supabase
      .from('contracts')
      .update({ [updateField]: urlData.publicUrl })
      .eq('id', contractId);

    // contract_pdfs 테이블에 기록
    await supabase.from('contract_pdfs').insert({
      contract_id: contractId,
      pdf_type: type.toUpperCase(),
      file_url: urlData.publicUrl,
      file_name: fileName,
      file_size: pdf.length,
      has_watermark: type === 'draft',
      watermark_text: type === 'draft' ? 'DRAFT - 서명 전 문서' : null,
    });

    return urlData.publicUrl;
  }

  /**
   * 계약서 데이터 변환
   */
  private transformContractData(contract: ContractWithRelations): ContractPDFData {
    return {
      id: contract.id,
      contractNumber: contract.contract_number,
      staffId: contract.staff_id,
      companyId: contract.company_id,
      brandId: contract.brand_id,
      storeId: contract.store_id,
      contractType: contract.contract_type as any,
      startDate: new Date(contract.start_date),
      endDate: contract.end_date ? new Date(contract.end_date) : undefined,
      probationMonths: contract.probation_months,
      workSchedules: contract.work_schedules || [],
      position: contract.position,
      department: contract.department,
      duties: contract.duties || [],
      salaryConfig: {
        baseSalaryType: contract.salary_config?.base_salary_type || 'MONTHLY',
        baseSalaryAmount: contract.salary_config?.base_salary_amount || 0,
        allowances: {
          overtimeAllowance: contract.salary_config?.allowances?.overtime_allowance ?? true,
          nightAllowance: contract.salary_config?.allowances?.night_allowance ?? true,
          holidayAllowance: contract.salary_config?.allowances?.holiday_allowance ?? true,
          weeklyHolidayPay: contract.salary_config?.allowances?.weekly_holiday_pay ?? true,
          mealAllowance: contract.salary_config?.allowances?.meal_allowance,
          transportAllowance: contract.salary_config?.allowances?.transport_allowance,
          positionAllowance: contract.salary_config?.allowances?.position_allowance,
        },
        paymentDate: contract.salary_config?.payment_date || 10,
        paymentMethod: contract.salary_config?.payment_method || '계좌이체',
      },
      deductionConfig: {
        nationalPension: contract.deduction_config?.national_pension ?? true,
        healthInsurance: contract.deduction_config?.health_insurance ?? true,
        employmentInsurance: contract.deduction_config?.employment_insurance ?? true,
        industrialAccident: contract.deduction_config?.industrial_accident ?? true,
        incomeTax: contract.deduction_config?.income_tax ?? true,
        localIncomeTax: contract.deduction_config?.local_income_tax ?? true,
      },
      standardHoursPerWeek: contract.standard_hours_per_week || 40,
      standardHoursPerDay: contract.standard_hours_per_day || 8,
      breakMinutes: contract.break_minutes || 60,
      annualLeaveDays: contract.annual_leave_days || 15,
      paidLeaveDays: contract.paid_leave_days || 0,
      sickLeaveDays: contract.sick_leave_days || 0,
      benefits: contract.benefits,
      terms: {
        confidentiality: contract.terms?.confidentiality ?? true,
        nonCompete: contract.terms?.non_compete,
        intellectualProperty: contract.terms?.intellectual_property ?? true,
        terminationNotice: contract.terms?.termination_notice || 30,
      },
      terminationConfig: {
        employeeNotice: contract.termination_config?.employee_notice || 30,
        employerNotice: contract.termination_config?.employer_notice || 30,
        severancePay: contract.termination_config?.severance_pay ?? true,
        penaltyClause: contract.termination_config?.penalty_clause,
      },
      employeeSignedAt: contract.employee_signed_at
        ? new Date(contract.employee_signed_at)
        : undefined,
      employeeSignature: contract.employee_signature,
      employerSignedAt: contract.employer_signed_at
        ? new Date(contract.employer_signed_at)
        : undefined,
      employerSignature: contract.employer_signature,
      attachments: contract.attachments,
      status: contract.status as any,
      createdBy: contract.created_by,
      createdAt: new Date(contract.created_at),
      updatedAt: new Date(contract.updated_at),
      // 추가 정보
      companyName: contract.company?.name || '',
      companyAddress: contract.company?.address || '',
      companyBusinessNumber: contract.company?.business_number || '',
      companyCeoName: contract.company?.ceo_name || '',
      staffName: contract.staff?.name || '',
      staffAddress: contract.staff?.address || '',
      staffPhone: contract.staff?.phone || '',
      staffSSN: contract.staff?.ssn_encrypted,
    };
  }
}

export const contractPDFService = new ContractPDFService();

export default ContractPDFService;
