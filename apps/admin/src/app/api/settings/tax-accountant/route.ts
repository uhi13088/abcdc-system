/**
 * 세무대리인 설정 API
 * GET/POST /api/settings/tax-accountant
 */

import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const TaxAccountantSchema = z.object({
  name: z.string().min(1, '세무사명을 입력해주세요.').max(100),
  email: z.string().email('올바른 이메일 형식이 아닙니다.').optional().nullable(),
  phone: z.string().optional().nullable(),
  autoSend: z.boolean().default(false),
  sendDay: z.number().int().min(1).max(28).default(5),
  transmissionMethod: z.enum(['EMAIL', 'MANUAL']).default('EMAIL'),
});

// GET - 세무대리인 정보 조회
export async function GET() {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 사용자 정보 조회
    const { data: userData } = await adminClient
      .from('users')
      .select('id, role, company_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 권한 확인
    if (!['super_admin', 'company_admin', 'manager'].includes(userData.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 세무대리인 정보 조회
    const { data: taxAccountant, error } = await adminClient
      .from('tax_accountants')
      .select('*')
      .eq('company_id', userData.company_id)
      .maybeSingle();

    if (error) {
      console.error('Failed to fetch tax accountant:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 데이터 변환 (snake_case -> camelCase)
    if (taxAccountant) {
      return NextResponse.json({
        id: taxAccountant.id,
        name: taxAccountant.name,
        email: taxAccountant.email,
        phone: taxAccountant.phone,
        autoSend: taxAccountant.auto_send,
        sendDay: taxAccountant.send_day,
        transmissionMethod: taxAccountant.transmission_method,
        isActive: taxAccountant.is_active,
        createdAt: taxAccountant.created_at,
        updatedAt: taxAccountant.updated_at,
      });
    }

    return NextResponse.json(null);
  } catch (error) {
    console.error('[GET /api/settings/tax-accountant] Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// POST - 세무대리인 정보 생성/수정
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 사용자 정보 조회
    const { data: userData } = await adminClient
      .from('users')
      .select('id, role, company_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 권한 확인
    if (!['super_admin', 'company_admin'].includes(userData.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 요청 데이터 검증
    const body = await request.json();
    const validation = TaxAccountantSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { name, email, phone, autoSend, sendDay, transmissionMethod } = validation.data;

    // 기존 데이터 확인
    const { data: existing } = await adminClient
      .from('tax_accountants')
      .select('id')
      .eq('company_id', userData.company_id)
      .maybeSingle();

    const taxAccountantData = {
      company_id: userData.company_id,
      name,
      email: email || null,
      phone: phone || null,
      auto_send: autoSend,
      send_day: sendDay,
      transmission_method: transmissionMethod,
      is_active: true,
    };

    let result;

    if (existing) {
      // 업데이트
      const { data, error } = await adminClient
        .from('tax_accountants')
        .update({
          ...taxAccountantData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        console.error('Failed to update tax accountant:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      result = data;
    } else {
      // 생성
      const { data, error } = await adminClient
        .from('tax_accountants')
        .insert(taxAccountantData)
        .select()
        .single();

      if (error) {
        console.error('Failed to create tax accountant:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      result = data;
    }

    return NextResponse.json({
      id: result.id,
      name: result.name,
      email: result.email,
      phone: result.phone,
      autoSend: result.auto_send,
      sendDay: result.send_day,
      transmissionMethod: result.transmission_method,
      isActive: result.is_active,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    });
  } catch (error) {
    console.error('[POST /api/settings/tax-accountant] Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// DELETE - 세무대리인 정보 삭제 (비활성화)
export async function DELETE() {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 사용자 정보 조회
    const { data: userData } = await adminClient
      .from('users')
      .select('id, role, company_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 권한 확인
    if (!['super_admin', 'company_admin'].includes(userData.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 비활성화 처리
    const { error } = await adminClient
      .from('tax_accountants')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('company_id', userData.company_id);

    if (error) {
      console.error('Failed to delete tax accountant:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/settings/tax-accountant] Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
