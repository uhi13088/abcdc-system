/**
 * 급여명세서 이메일 발송 API
 * POST /api/salaries/[id]/send-email
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PDFGenerator, emailService, pushNotificationService } from '@abcdc/shared';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const salaryId = params.id;

    // 급여 정보 조회
    const { data: salary, error: salaryError } = await supabase
      .from('salaries')
      .select(`
        *,
        staff:users!staff_id (
          id,
          name,
          email,
          department,
          position
        ),
        company:companies!company_id (
          id,
          name
        )
      `)
      .eq('id', salaryId)
      .single();

    if (salaryError || !salary) {
      return NextResponse.json(
        { error: '급여 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (!salary.staff?.email) {
      return NextResponse.json(
        { error: '직원 이메일 정보가 없습니다.' },
        { status: 400 }
      );
    }

    // PDF 생성
    const pdfData = {
      ...salary,
      staffName: salary.staff?.name || 'Unknown',
      staffEmail: salary.staff?.email,
      companyName: salary.company?.name || 'Unknown',
      department: salary.staff?.department,
      position: salary.staff?.position,
      baseSalary: salary.base_salary,
      overtimePay: salary.overtime_pay,
      nightPay: salary.night_pay,
      holidayPay: salary.holiday_pay,
      weeklyHolidayPay: salary.weekly_holiday_pay,
      mealAllowance: salary.meal_allowance,
      transportAllowance: salary.transport_allowance,
      positionAllowance: salary.position_allowance,
      otherAllowances: salary.other_allowances,
      totalGrossPay: salary.total_gross_pay,
      nationalPension: salary.national_pension,
      healthInsurance: salary.health_insurance,
      longTermCare: salary.long_term_care,
      employmentInsurance: salary.employment_insurance,
      incomeTax: salary.income_tax,
      localIncomeTax: salary.local_income_tax,
      otherDeductions: salary.other_deductions,
      totalDeductions: salary.total_deductions,
      netPay: salary.net_pay,
      workDays: salary.work_days,
      totalHours: salary.total_hours,
      createdAt: new Date(salary.created_at),
      updatedAt: new Date(salary.updated_at),
    };

    const pdf = await PDFGenerator.generatePayslip(pdfData);

    // 이메일 발송
    const emailResult = await emailService.sendPayslip(
      salary.staff.email,
      pdf,
      {
        staffName: salary.staff.name,
        year: String(salary.year),
        month: String(salary.month),
        grossPay: salary.total_gross_pay.toLocaleString('ko-KR'),
        totalDeductions: salary.total_deductions.toLocaleString('ko-KR'),
        netPay: salary.net_pay.toLocaleString('ko-KR'),
      }
    );

    if (!emailResult.success) {
      console.error('Email sending failed:', emailResult.error);
      return NextResponse.json(
        { error: '이메일 발송에 실패했습니다.', details: emailResult.error },
        { status: 500 }
      );
    }

    // 푸시 알림 발송 (FCM 토큰 조회)
    const { data: fcmTokens } = await supabase
      .from('user_fcm_tokens')
      .select('fcm_token')
      .eq('user_id', salary.staff.id)
      .eq('is_active', true);

    if (fcmTokens && fcmTokens.length > 0) {
      for (const tokenRecord of fcmTokens) {
        await pushNotificationService.sendSalaryNotification(
          tokenRecord.fcm_token,
          {
            year: salary.year,
            month: salary.month,
            netPay: salary.net_pay,
            salaryId: salary.id,
          }
        );
      }
    }

    // 알림 기록 저장
    await supabase.from('notifications').insert({
      user_id: salary.staff.id,
      category: 'SALARY',
      priority: 'NORMAL',
      title: `${salary.year}년 ${salary.month}월 급여 확정`,
      body: `실수령액: ${salary.net_pay.toLocaleString('ko-KR')}원`,
      deep_link: `/salary/${salary.id}`,
      sent: true,
      sent_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      emailMessageId: emailResult.messageId,
      message: '급여명세서가 이메일로 발송되었습니다.',
    });
  } catch (error) {
    console.error('Payslip email send error:', error);
    return NextResponse.json(
      { error: '급여명세서 이메일 발송에 실패했습니다.' },
      { status: 500 }
    );
  }
}

// 일괄 발송
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { salaryIds } = body;

    if (!salaryIds || !Array.isArray(salaryIds) || salaryIds.length === 0) {
      return NextResponse.json(
        { error: '발송할 급여명세서를 선택해주세요.' },
        { status: 400 }
      );
    }

    const results = {
      success: [] as string[],
      failed: [] as { id: string; error: string }[],
    };

    for (const salaryId of salaryIds) {
      try {
        // 개별 발송 (위의 POST 로직을 재사용)
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL}/api/salaries/${salaryId}/send-email`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        if (response.ok) {
          results.success.push(salaryId);
        } else {
          const error = await response.json();
          results.failed.push({ id: salaryId, error: error.error });
        }
      } catch (err) {
        results.failed.push({
          id: salaryId,
          error: (err as Error).message,
        });
      }
    }

    return NextResponse.json({
      totalRequested: salaryIds.length,
      successCount: results.success.length,
      failedCount: results.failed.length,
      results,
    });
  } catch (error) {
    console.error('Bulk payslip email send error:', error);
    return NextResponse.json(
      { error: '일괄 발송 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
