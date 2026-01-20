import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Per-day schedule schema
const DayScheduleSchema = z.object({
  startTime: z.string(),
  endTime: z.string(),
  breakMinutes: z.number().min(0).default(60),
});

// 템플릿 수정 스키마
const UpdateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  storeId: z.string().uuid().nullable().optional(),
  useStoreHours: z.boolean().optional(),
  role: z.string().optional(),
  position: z.string().optional(),
  contractType: z.enum(['정규직', '계약직', '아르바이트', '인턴']).nullable().optional(),
  salaryType: z.enum(['hourly', 'daily', 'monthly']).optional(),
  salaryAmount: z.number().min(0).optional(),
  workDays: z.array(z.number().min(0).max(6)).optional(),
  workStartTime: z.string().optional(),
  workEndTime: z.string().optional(),
  breakMinutes: z.number().min(0).optional(),
  workSchedule: z.record(z.string(), DayScheduleSchema).nullable().optional(),
  requiredDocuments: z.array(z.string()).optional(),
  customFields: z.array(z.object({
    name: z.string(),
    type: z.enum(['text', 'number', 'date', 'file']),
    required: z.boolean().default(false),
  })).optional(),
  isActive: z.boolean().optional(),
});

// GET /api/invitation-templates/:id - 템플릿 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await adminClient
      .from('users')
      .select('company_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const { data: template, error } = await adminClient
      .from('invitation_templates')
      .select('*')
      .eq('id', params.id)
      .eq('company_id', userData.company_id)
      .single();

    if (error || !template) {
      return NextResponse.json({ error: '템플릿을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ data: template });
  } catch (error) {
    console.error('[GET /api/invitation-templates/:id] Catch error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PATCH /api/invitation-templates/:id - 템플릿 수정
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await adminClient
      .from('users')
      .select('company_id, role')
      .eq('auth_id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    if (!['super_admin', 'company_admin', 'manager'].includes(userData.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const validation = UpdateTemplateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    // 업데이트할 데이터 구성 (최소 필드 - 기존 컬럼만)
    const minimalUpdateData: Record<string, unknown> = {};
    if (validation.data.name !== undefined) minimalUpdateData.name = validation.data.name;
    if (validation.data.description !== undefined) minimalUpdateData.description = validation.data.description;
    if (validation.data.role !== undefined) minimalUpdateData.role = validation.data.role;
    if (validation.data.position !== undefined) minimalUpdateData.position = validation.data.position;
    if (validation.data.salaryType !== undefined) minimalUpdateData.salary_type = validation.data.salaryType;
    if (validation.data.salaryAmount !== undefined) minimalUpdateData.salary_amount = validation.data.salaryAmount;
    if (validation.data.workDays !== undefined) minimalUpdateData.work_days = validation.data.workDays;
    if (validation.data.workStartTime !== undefined) minimalUpdateData.work_start_time = validation.data.workStartTime;
    if (validation.data.workEndTime !== undefined) minimalUpdateData.work_end_time = validation.data.workEndTime;
    if (validation.data.breakMinutes !== undefined) minimalUpdateData.break_minutes = validation.data.breakMinutes;
    if (validation.data.workSchedule !== undefined) minimalUpdateData.work_schedule = validation.data.workSchedule;
    if (validation.data.requiredDocuments !== undefined) minimalUpdateData.required_documents = validation.data.requiredDocuments;
    if (validation.data.customFields !== undefined) minimalUpdateData.custom_fields = validation.data.customFields;
    if (validation.data.isActive !== undefined) minimalUpdateData.is_active = validation.data.isActive;

    // contract_type 추가 (마이그레이션 030 이후)
    const baseUpdateData = { ...minimalUpdateData };
    if (validation.data.contractType !== undefined) baseUpdateData.contract_type = validation.data.contractType;

    // store 관련 필드 추가 (마이그레이션 029 이후)
    const updateData = { ...baseUpdateData };
    if (validation.data.storeId !== undefined) updateData.store_id = validation.data.storeId;
    if (validation.data.useStoreHours !== undefined) updateData.use_store_hours = validation.data.useStoreHours;

    let { data, error } = await adminClient
      .from('invitation_templates')
      .update(updateData)
      .eq('id', params.id)
      .eq('company_id', userData.company_id)
      .select()
      .single();

    // store 관련 컬럼 오류 시 폴백
    if (error && (error.message.includes('store_id') || error.message.includes('use_store_hours'))) {
      console.warn('[PATCH /api/invitation-templates/:id] store columns not found, using fallback update');
      const fallbackResult = await adminClient
        .from('invitation_templates')
        .update(baseUpdateData)
        .eq('id', params.id)
        .eq('company_id', userData.company_id)
        .select()
        .single();

      data = fallbackResult.data;
      error = fallbackResult.error;
    }

    // contract_type 컬럼 오류 시 폴백
    if (error && error.message.includes('contract_type')) {
      console.warn('[PATCH /api/invitation-templates/:id] contract_type column not found, using minimal update');
      const minimalResult = await adminClient
        .from('invitation_templates')
        .update(minimalUpdateData)
        .eq('id', params.id)
        .eq('company_id', userData.company_id)
        .select()
        .single();

      data = minimalResult.data;
      error = minimalResult.error;
    }

    if (error) {
      console.error('[PATCH /api/invitation-templates/:id] Update error:', error);
      if (error.code === '23505') {
        return NextResponse.json(
          { error: '동일한 이름의 템플릿이 이미 존재합니다.' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: '템플릿을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('[PATCH /api/invitation-templates/:id] Catch error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/invitation-templates/:id - 템플릿 삭제 (소프트 삭제)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await adminClient
      .from('users')
      .select('company_id, role')
      .eq('auth_id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    if (!['super_admin', 'company_admin', 'manager'].includes(userData.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 소프트 삭제 (is_active = false)
    const { error } = await adminClient
      .from('invitation_templates')
      .update({ is_active: false })
      .eq('id', params.id)
      .eq('company_id', userData.company_id);

    if (error) {
      console.error('[DELETE /api/invitation-templates/:id] Delete error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: '템플릿이 삭제되었습니다.' });
  } catch (error) {
    console.error('[DELETE /api/invitation-templates/:id] Catch error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
