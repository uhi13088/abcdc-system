/**
 * 스케줄 자동 생성 API
 * POST /api/schedules/generate
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createAuthClient } from '@/lib/supabase/server';
import { ScheduleGeneratorService } from '@/lib/services/schedule-generator.service';
import { parseISO } from 'date-fns';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseClient();
  const scheduleGenerator = new ScheduleGeneratorService();
  try {
    // 인증 검증
    const authClient = await createAuthClient();
    const { data: { user: authUser } } = await authClient.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 사용자 정보 및 권한 확인
    const { data: userData } = await supabase
      .from('users')
      .select('id, role, company_id')
      .eq('auth_id', authUser.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 관리자 권한 확인
    if (!['super_admin', 'company_admin', 'manager', 'store_manager'].includes(userData.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      contractId,
      companyId,
      staffId,
      startDate,
      endDate,
      skipExisting = true,
      skipHolidays = true,
    } = body;

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: '시작일과 종료일을 입력해주세요.' },
        { status: 400 }
      );
    }

    const start = parseISO(startDate);
    const end = parseISO(endDate);

    if (start > end) {
      return NextResponse.json(
        { error: '시작일이 종료일보다 늦을 수 없습니다.' },
        { status: 400 }
      );
    }

    // 개별 계약 기준 생성
    if (contractId) {
      const result = await scheduleGenerator.generateFromContract(
        contractId,
        start,
        end,
        { skipExisting, skipHolidays }
      );

      return NextResponse.json({
        success: result.success,
        result,
        message: `${result.schedulesCreated}개의 스케줄이 생성되었습니다.`,
      });
    }

    // 직원 ID 기준 생성 (해당 직원의 활성 계약 조회)
    if (staffId) {
      const { data: contract, error: contractError } = await supabase
        .from('contracts')
        .select('id')
        .eq('staff_id', staffId)
        .eq('status', 'ACTIVE')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (contractError || !contract) {
        return NextResponse.json(
          { error: '해당 직원의 활성 계약을 찾을 수 없습니다.' },
          { status: 404 }
        );
      }

      const result = await scheduleGenerator.generateFromContract(
        contract.id,
        start,
        end,
        { skipExisting, skipHolidays }
      );

      return NextResponse.json({
        success: result.success,
        result,
        message: `${result.schedulesCreated}개의 스케줄이 생성되었습니다.`,
      });
    }

    // 회사 전체 일괄 생성
    if (companyId) {
      const bulkResult = await scheduleGenerator.generateBulkSchedules(
        companyId,
        start,
        end
      );

      return NextResponse.json({
        success: bulkResult.success > 0,
        total: bulkResult.total,
        successCount: bulkResult.success,
        failed: bulkResult.failed,
        results: bulkResult.results,
        message: `총 ${bulkResult.total}명 중 ${bulkResult.success}명의 스케줄이 생성되었습니다.`,
      });
    }

    return NextResponse.json(
      { error: 'contractId, staffId, 또는 companyId 중 하나를 입력해주세요.' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Schedule generation error:', error);
    return NextResponse.json(
      { error: (error as Error).message || '스케줄 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 스케줄 삭제
export async function DELETE(request: NextRequest) {
  const supabase = getSupabaseClient();
  const scheduleGenerator = new ScheduleGeneratorService();
  try {
    // 인증 검증
    const authClient = await createAuthClient();
    const { data: { user: authUser } } = await authClient.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 사용자 정보 및 권한 확인
    const { data: userData } = await supabase
      .from('users')
      .select('id, role, company_id')
      .eq('auth_id', authUser.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 관리자 권한 확인
    if (!['super_admin', 'company_admin', 'manager', 'store_manager'].includes(userData.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const staffId = searchParams.get('staffId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!staffId || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'staffId, startDate, endDate가 필요합니다.' },
        { status: 400 }
      );
    }

    const deleted = await scheduleGenerator.deleteSchedules(
      staffId,
      parseISO(startDate),
      parseISO(endDate)
    );

    return NextResponse.json({
      success: true,
      deleted,
      message: `${deleted}개의 스케줄이 삭제되었습니다.`,
    });
  } catch (error) {
    console.error('Schedule delete error:', error);
    return NextResponse.json(
      { error: '스케줄 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
