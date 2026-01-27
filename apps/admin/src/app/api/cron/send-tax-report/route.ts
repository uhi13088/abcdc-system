/**
 * 세무대리인 자동 전송 Cron
 * GET /api/cron/send-tax-report
 *
 * Vercel Cron Jobs 또는 외부 cron 서비스에서 매일 호출
 * 오늘이 전송일인 회사들에 대해 급여대장 전송
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ExcelGenerator, emailService, PayrollReportData } from '@abc/shared/server';
import crypto from 'crypto';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
}

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

    if (decrypted.length === 13) {
      return `${decrypted.slice(0, 6)}-${decrypted.slice(6)}`;
    }
    return decrypted;
  } catch {
    return '';
  }
}

// 공제유형 라벨 변환
function getDeductionTypeLabel(deductionConfig: Record<string, boolean | string | undefined> | null): string {
  if (!deductionConfig) return '-';

  const type = deductionConfig['deduction_type'] || deductionConfig['deductionType'];
  if (type && typeof type === 'string') {
    const labels: Record<string, string> = {
      full: '전체적용',
      employment_only: '고용보험만',
      freelancer: '프리랜서',
      none: '없음',
    };
    return labels[type] || type;
  }

  const hasPension = deductionConfig['national_pension'] ?? deductionConfig['nationalPension'];
  const hasHealth = deductionConfig['health_insurance'] ?? deductionConfig['healthInsurance'];
  const hasEmployment = deductionConfig['employment_insurance'] ?? deductionConfig['employmentInsurance'];
  const hasIncomeTax = deductionConfig['income_tax'] ?? deductionConfig['incomeTax'];

  if (hasPension && hasHealth && hasEmployment) return '전체적용';
  if (!hasPension && !hasHealth && hasEmployment) return '고용보험만';
  if (!hasPension && !hasHealth && !hasEmployment && hasIncomeTax) return '프리랜서';
  if (!hasPension && !hasHealth && !hasEmployment && !hasIncomeTax) return '없음';

  return '-';
}

// Cron secret 검증
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  const supabase = getSupabaseClient();
  try {
    // Cron 인증 검증
    const authHeader = request.headers.get('authorization');
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const today = new Date();
    const dayOfMonth = today.getDate();

    // 오늘이 전송일인 세무대리인 설정 조회
    const { data: taxAccountants, error: taError } = await supabase
      .from('tax_accountants')
      .select(`
        *,
        company:companies!company_id (
          id,
          name
        )
      `)
      .eq('auto_send', true)
      .eq('send_day', dayOfMonth);

    if (taError) {
      console.error('Failed to fetch tax accountants:', taError);
      return NextResponse.json(
        { error: 'Failed to fetch tax accountants' },
        { status: 500 }
      );
    }

    if (!taxAccountants || taxAccountants.length === 0) {
      return NextResponse.json({
        message: 'No tax reports to send today',
        processed: 0,
      });
    }

    // 전월 계산
    const prevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const year = prevMonth.getFullYear();
    const month = prevMonth.getMonth() + 1;

    const results = {
      success: [] as string[],
      failed: [] as { companyId: string; error: string }[],
    };

    for (const ta of taxAccountants) {
      try {
        // 급여 데이터 조회
        const { data: salaries, error: salariesError } = await supabase
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
          .eq('company_id', ta.company_id)
          .eq('year', year)
          .eq('month', month);

        if (salariesError || !salaries || salaries.length === 0) {
          results.failed.push({
            companyId: ta.company_id,
            error: '급여 데이터가 없습니다.',
          });
          continue;
        }

        // 직원들의 현재 계약 정보 조회 (공제유형)
        const staffIds = salaries.map(s => s.staff_id);
        const { data: contracts } = await supabase
          .from('contracts')
          .select('staff_id, deduction_config')
          .in('staff_id', staffIds)
          .eq('status', 'ACTIVE');

        const contractMap = new Map(
          (contracts || []).map(c => [c.staff_id, c.deduction_config])
        );

        // 생년월일 포맷팅 함수 (주민번호 없을 때 fallback)
        const formatBirthDate = (birthDate: string | null): string => {
          if (!birthDate) return '-';
          const date = new Date(birthDate);
          const y = date.getFullYear().toString().slice(-2);
          const m = String(date.getMonth() + 1).padStart(2, '0');
          const d = String(date.getDate()).padStart(2, '0');
          return `${y}${m}${d}-*******`;
        };

        // 주민번호 가져오기
        const getResidentNumber = (staff: { ssn_encrypted?: string; birth_date?: string | null } | null): string => {
          if (staff?.ssn_encrypted) {
            const decrypted = decryptSSN(staff.ssn_encrypted);
            if (decrypted) return decrypted;
          }
          return formatBirthDate(staff?.birth_date ?? null);
        };

        // 데이터 변환
        const reportData: PayrollReportData[] = salaries.map((salary) => ({
          staffId: salary.staff_id,
          staffName: salary.staff?.name || 'Unknown',
          storeName: salary.staff?.stores?.name || '-',
          residentNumber: getResidentNumber(salary.staff),
          address: salary.staff?.address || '-',
          deductionType: getDeductionTypeLabel(contractMap.get(salary.staff_id)),
          department: salary.staff?.department,
          position: salary.staff?.position,
          baseSalary: salary.base_salary || 0,
          overtimePay: salary.overtime_pay || 0,
          nightPay: salary.night_pay || 0,
          holidayPay: salary.holiday_pay || 0,
          weeklyHolidayPay: salary.weekly_holiday_pay || 0,
          mealAllowance: salary.meal_allowance || 0,
          transportAllowance: salary.transport_allowance || 0,
          positionAllowance: salary.position_allowance || 0,
          otherAllowances: 0,
          totalGrossPay: salary.total_gross_pay || 0,
          nationalPension: salary.national_pension || 0,
          healthInsurance: salary.health_insurance || 0,
          longTermCare: salary.long_term_care || 0,
          employmentInsurance: salary.employment_insurance || 0,
          incomeTax: salary.income_tax || 0,
          localIncomeTax: salary.local_income_tax || 0,
          otherDeductions: 0,
          totalDeductions: salary.total_deductions || 0,
          netPay: salary.net_pay || 0,
          workDays: salary.work_days || 0,
          totalHours: salary.total_hours || 0,
        }));

        // 엑셀 생성
        const excel = await ExcelGenerator.generatePayrollReport(reportData, {
          companyName: ta.company?.name || '',
          year,
          month,
        });

        let transmissionStatus = 'SUCCESS';
        let fileUrl = '';

        // 전송 처리
        if (ta.transmission_method === 'EMAIL' && ta.email) {
          // 급여 총액 계산
          const totalPayroll = salaries.reduce(
            (sum, s) => sum + (s.total_gross_pay || 0),
            0
          );
          const totalInsurance = salaries.reduce(
            (sum, s) =>
              sum +
              (s.national_pension || 0) +
              (s.health_insurance || 0) +
              (s.employment_insurance || 0),
            0
          );
          const totalTax = salaries.reduce(
            (sum, s) => sum + (s.income_tax || 0) + (s.local_income_tax || 0),
            0
          );

          const emailResult = await emailService.sendTaxReport(
            ta.email,
            excel,
            {
              companyName: ta.company?.name || '',
              year: String(year),
              month: String(month),
              employeeCount: String(salaries.length),
              totalPayroll: totalPayroll.toLocaleString('ko-KR'),
              totalInsurance: totalInsurance.toLocaleString('ko-KR'),
              totalTax: totalTax.toLocaleString('ko-KR'),
            }
          );

          if (!emailResult.success) {
            transmissionStatus = 'FAILED';
            results.failed.push({
              companyId: ta.company_id,
              error: emailResult.error || '이메일 전송 실패',
            });
            continue;
          }
        } else {
          // Storage에 저장
          const fileName = `tax-reports/${ta.company_id}/${year}-${month}.xlsx`;
          const { error: uploadError } = await supabase.storage
            .from('tax-reports')
            .upload(fileName, excel, {
              contentType:
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              upsert: true,
            });

          if (uploadError) {
            transmissionStatus = 'FAILED';
            results.failed.push({
              companyId: ta.company_id,
              error: '파일 저장 실패',
            });
            continue;
          }

          const { data: urlData } = supabase.storage
            .from('tax-reports')
            .getPublicUrl(fileName);
          fileUrl = urlData.publicUrl;
        }

        // 전송 이력 저장
        await supabase.from('tax_transmissions').insert({
          company_id: ta.company_id,
          year,
          month,
          method: ta.transmission_method,
          file_url: fileUrl || null,
          status: transmissionStatus,
          transmitted_at: new Date().toISOString(),
        });

        results.success.push(ta.company_id);
      } catch (err) {
        console.error(
          `Failed to process tax report for company ${ta.company_id}:`,
          err
        );
        results.failed.push({
          companyId: ta.company_id,
          error: (err as Error).message,
        });
      }
    }

    return NextResponse.json({
      processed: taxAccountants.length,
      success: results.success.length,
      failed: results.failed.length,
      year,
      month,
      results,
    });
  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json(
      { error: 'Cron job failed' },
      { status: 500 }
    );
  }
}

// Vercel Cron 설정 - Route Segment Config
export const maxDuration = 60; // 최대 60초
export const dynamic = 'force-dynamic';
