/**
 * POST /api/tax-accountant/payroll-excel - 세무대리인용 급여대장 엑셀 생성 및 전송
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { ExcelGenerator, PayrollReportData } from '@abc/shared/server';
import { z } from 'zod';
import { logger } from '@abc/shared';
import crypto from 'crypto';

// 주민번호 복호화
function decryptSSN(encrypted: string): string {
  try {
    if (!encrypted) return '';
    const parts = encrypted.split(':');
    if (parts.length !== 3) return '';

    const [ivHex, authTagHex, encryptedData] = parts;
    const algorithm = 'aes-256-gcm';
    const secretKey = process.env.SSN_ENCRYPTION_KEY || 'default-key-change-in-production-32';
    const key = crypto.scryptSync(secretKey, 'salt', 32);
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    // 주민번호 포맷팅 (123456-1234567)
    if (decrypted.length === 13) {
      return `${decrypted.slice(0, 6)}-${decrypted.slice(6)}`;
    }
    return decrypted;
  } catch {
    return '';
  }
}

// 공제유형 라벨 변환
interface DeductionConfig {
  deduction_type?: string;
  deductionType?: string;
  national_pension?: boolean;
  nationalPension?: boolean;
  health_insurance?: boolean;
  healthInsurance?: boolean;
  employment_insurance?: boolean;
  employmentInsurance?: boolean;
  income_tax?: boolean;
  incomeTax?: boolean;
}

function getDeductionTypeLabel(deductionConfig: DeductionConfig | null | undefined): string {
  if (!deductionConfig) return '-';

  const type = deductionConfig.deduction_type || deductionConfig.deductionType;
  if (type) {
    const labels: Record<string, string> = {
      full: '전체적용',
      employment_only: '고용보험만',
      freelancer: '프리랜서',
      none: '없음',
    };
    return labels[type] || type;
  }

  // fallback: 개별 필드로 판단
  const hasPension = deductionConfig.national_pension ?? deductionConfig.nationalPension;
  const hasHealth = deductionConfig.health_insurance ?? deductionConfig.healthInsurance;
  const hasEmployment = deductionConfig.employment_insurance ?? deductionConfig.employmentInsurance;
  const hasIncomeTax = deductionConfig.income_tax ?? deductionConfig.incomeTax;

  if (hasPension && hasHealth && hasEmployment) return '전체적용';
  if (!hasPension && !hasHealth && hasEmployment) return '고용보험만';
  if (!hasPension && !hasHealth && !hasEmployment && hasIncomeTax) return '프리랜서';
  if (!hasPension && !hasHealth && !hasEmployment && !hasIncomeTax) return '없음';

  return '-';
}

const PayrollExcelSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  companyId: z.string().uuid().optional(),
  autoSend: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    // 인증 확인
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 사용자 정보 확인
    const { data: userData } = await adminClient
      .from('users')
      .select('id, role, company_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData || !['super_admin', 'company_admin', 'manager'].includes(userData.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 요청 데이터 검증
    const body = await request.json();
    const validation = PayrollExcelSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { year, month, companyId, autoSend } = validation.data;

    // 회사 ID 결정
    const targetCompanyId = companyId || userData.company_id;

    // 권한 확인
    if (userData.role !== 'super_admin' && targetCompanyId !== userData.company_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 회사 정보 조회
    const { data: company } = await adminClient
      .from('companies')
      .select('id, name')
      .eq('id', targetCompanyId)
      .single();

    if (!company) {
      return NextResponse.json({ error: '회사를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 해당 월의 급여 데이터 조회
    const { data: salaries, error } = await adminClient
      .from('salaries')
      .select(`
        *,
        staff:users!staff_id (
          id,
          name,
          department,
          position,
          birth_date,
          address,
          ssn_encrypted,
          stores(id, name)
        )
      `)
      .eq('company_id', targetCompanyId)
      .eq('year', year)
      .eq('month', month)
      .in('status', ['CONFIRMED', 'PAID']);

    // 직원들의 현재 계약 정보 조회 (공제유형)
    const staffIds = salaries?.map(s => s.staff_id) || [];
    const { data: contracts } = await adminClient
      .from('contracts')
      .select('staff_id, deduction_config')
      .in('staff_id', staffIds)
      .eq('status', 'ACTIVE');

    const contractMap = new Map(
      (contracts || []).map(c => [c.staff_id, c.deduction_config])
    );

    if (error) {
      throw error;
    }

    if (!salaries || salaries.length === 0) {
      return NextResponse.json(
        { error: '해당 월에 확정된 급여 데이터가 없습니다.' },
        { status: 404 }
      );
    }

    // 관계 데이터 검증 및 필터링
    const validSalaries = salaries.filter(s => s.staff && s.staff.name);

    if (validSalaries.length === 0) {
      return NextResponse.json(
        { error: '유효한 급여 데이터가 없습니다.' },
        { status: 404 }
      );
    }

    // 직원 이름순 정렬
    validSalaries.sort((a, b) => a.staff.name.localeCompare(b.staff.name, 'ko'));

    // 생년월일 포맷팅 함수 (주민번호 없을 때 fallback)
    const formatBirthDate = (birthDate: string | null | undefined): string => {
      if (!birthDate) return '-';
      const date = new Date(birthDate);
      const y = date.getFullYear().toString().slice(-2);
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}${m}${d}-*******`;
    };

    // 주민번호 가져오기 (복호화 -> fallback: 생년월일)
    interface StaffInfo {
      ssn_encrypted?: string | null;
      birth_date?: string | null;
    }
    const getResidentNumber = (staff: StaffInfo): string => {
      if (staff.ssn_encrypted) {
        const decrypted = decryptSSN(staff.ssn_encrypted);
        if (decrypted) return decrypted;
      }
      return formatBirthDate(staff.birth_date);
    };

    // 급여 데이터 변환
    const payrollData: PayrollReportData[] = validSalaries.map((salary) => ({
      staffId: salary.staff_id,
      staffName: salary.staff.name,
      storeName: salary.staff.stores?.name || '-',
      residentNumber: getResidentNumber(salary.staff),
      address: salary.staff.address || '-',
      deductionType: getDeductionTypeLabel(contractMap.get(salary.staff_id)),
      department: salary.staff.department,
      position: salary.staff.position,
      baseSalary: salary.base_salary,
      overtimePay: salary.overtime_pay,
      nightPay: salary.night_pay,
      holidayPay: salary.holiday_pay,
      weeklyHolidayPay: salary.weekly_holiday_pay,
      mealAllowance: salary.meal_allowance,
      transportAllowance: salary.transport_allowance,
      positionAllowance: salary.position_allowance,
      otherAllowances: Object.values(salary.other_allowances || {}).reduce(
        (sum: number, val: unknown) => sum + (typeof val === 'number' ? val : 0),
        0
      ),
      totalGrossPay: salary.total_gross_pay,
      nationalPension: salary.national_pension,
      healthInsurance: salary.health_insurance,
      longTermCare: salary.long_term_care,
      employmentInsurance: salary.employment_insurance,
      incomeTax: salary.income_tax,
      localIncomeTax: salary.local_income_tax,
      otherDeductions: Object.values(salary.other_deductions || {}).reduce(
        (sum: number, val: unknown) => sum + (typeof val === 'number' ? val : 0),
        0
      ),
      totalDeductions: salary.total_deductions,
      netPay: salary.net_pay,
      workDays: salary.work_days,
      totalHours: salary.total_hours,
    }));

    // 엑셀 생성
    const excelBuffer = await ExcelGenerator.generatePayrollReport(payrollData, {
      companyName: company.name,
      year,
      month,
    });

    // Storage에 저장
    const fileName = `급여대장_${year}년${month}월_${company.name}.xlsx`;
    const filePath = `tax-accountant/${targetCompanyId}/${year}/${month}/${fileName}`;

    const { data: _uploadData, error: uploadError } = await adminClient.storage
      .from('payroll-reports')
      .upload(filePath, excelBuffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    // 공개 URL 생성
    const { data: urlData } = adminClient.storage
      .from('payroll-reports')
      .getPublicUrl(filePath);

    // 전송 기록 저장
    const { data: transmission } = await adminClient
      .from('tax_transmissions')
      .insert({
        company_id: targetCompanyId,
        year,
        month,
        method: 'MANUAL',
        format: 'EXCEL',
        total_employees: payrollData.length,
        total_gross_pay: payrollData.reduce((sum, item) => sum + item.totalGrossPay, 0),
        total_deductions: payrollData.reduce((sum, item) => sum + item.totalDeductions, 0),
        total_net_pay: payrollData.reduce((sum, item) => sum + item.netPay, 0),
        file_url: urlData.publicUrl,
        file_name: fileName,
        file_size: excelBuffer.length,
        status: autoSend ? 'PENDING' : 'COMPLETED',
        transmitted_by: userData.id,
      })
      .select()
      .single();

    // 자동 전송 (옵션)
    if (autoSend) {
      // 세무대리인 정보 조회
      const { data: taxAccountant } = await adminClient
        .from('tax_accountants')
        .select('*')
        .eq('company_id', targetCompanyId)
        .eq('is_active', true)
        .single();

      if (taxAccountant && taxAccountant.auto_send && taxAccountant.email) {
        // 이메일 전송 로직 (실제 구현 필요)
        logger.log('Sending email to:', taxAccountant.email);

        // 전송 완료 처리
        await adminClient
          .from('tax_transmissions')
          .update({
            status: 'SENT',
            transmitted_at: new Date().toISOString(),
          })
          .eq('id', transmission.id);
      }
    }

    // 다운로드 응답 (autoSend가 false인 경우 직접 다운로드)
    if (!autoSend) {
      return new NextResponse(new Uint8Array(excelBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
          'Content-Length': excelBuffer.length.toString(),
        },
      });
    }

    return NextResponse.json({
      message: '급여대장이 생성되었습니다.',
      data: {
        transmissionId: transmission.id,
        fileUrl: urlData.publicUrl,
        fileName,
        totalEmployees: payrollData.length,
        status: transmission.status,
      },
    });
  } catch (error) {
    console.error('[POST /api/tax-accountant/payroll-excel] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
