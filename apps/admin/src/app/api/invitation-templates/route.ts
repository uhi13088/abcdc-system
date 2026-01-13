import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Per-day schedule schema
const DayScheduleSchema = z.object({
  startTime: z.string(),
  endTime: z.string(),
  breakMinutes: z.number().min(0).default(60),
});

// 템플릿 생성 스키마
const CreateTemplateSchema = z.object({
  name: z.string().min(1, '템플릿명을 입력해주세요').max(100),
  description: z.string().optional(),
  role: z.string().default('staff'),
  position: z.string().optional(),
  salaryType: z.enum(['hourly', 'daily', 'monthly']).default('hourly'),
  salaryAmount: z.number().min(0, '급여는 0 이상이어야 합니다'),
  workDays: z.array(z.number().min(0).max(6)).default([1, 2, 3, 4, 5]),
  workStartTime: z.string().optional(),
  workEndTime: z.string().optional(),
  breakMinutes: z.number().min(0).default(60),
  // Per-day schedule (optional) - if set, overrides single time values
  workSchedule: z.record(z.string(), DayScheduleSchema).nullable().optional(),
  requiredDocuments: z.array(z.string()).default([]),
  customFields: z.array(z.object({
    name: z.string(),
    type: z.enum(['text', 'number', 'date', 'file']),
    required: z.boolean().default(false),
  })).default([]),
});

// GET /api/invitation-templates - 템플릿 목록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData, error: userError } = await adminClient
      .from('users')
      .select('company_id, role')
      .eq('auth_id', user.id)
      .single();

    if (userError || !userData) {
      console.error('[GET /api/invitation-templates] User lookup error:', userError);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!userData.company_id) {
      return NextResponse.json({ data: [] });
    }

    const { data: templates, error } = await adminClient
      .from('invitation_templates')
      .select('*')
      .eq('company_id', userData.company_id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[GET /api/invitation-templates] Query error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: templates || [] });
  } catch (error) {
    console.error('[GET /api/invitation-templates] Catch error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/invitation-templates - 템플릿 생성
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData, error: userError } = await adminClient
      .from('users')
      .select('id, company_id, role')
      .eq('auth_id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 권한 체크
    if (!['super_admin', 'company_admin', 'manager'].includes(userData.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!userData.company_id) {
      return NextResponse.json({ error: '회사 정보가 없습니다.' }, { status: 400 });
    }

    const body = await request.json();
    const validation = CreateTemplateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { data, error } = await adminClient
      .from('invitation_templates')
      .insert({
        company_id: userData.company_id,
        name: validation.data.name,
        description: validation.data.description || null,
        role: validation.data.role,
        position: validation.data.position || null,
        salary_type: validation.data.salaryType,
        salary_amount: validation.data.salaryAmount,
        work_days: validation.data.workDays,
        work_start_time: validation.data.workStartTime || '09:00',
        work_end_time: validation.data.workEndTime || '18:00',
        break_minutes: validation.data.breakMinutes,
        work_schedule: validation.data.workSchedule || null,
        required_documents: validation.data.requiredDocuments,
        custom_fields: validation.data.customFields,
      })
      .select()
      .single();

    if (error) {
      console.error('[POST /api/invitation-templates] Insert error:', error);
      if (error.code === '23505') {
        return NextResponse.json(
          { error: '동일한 이름의 템플릿이 이미 존재합니다.' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/invitation-templates] Catch error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
