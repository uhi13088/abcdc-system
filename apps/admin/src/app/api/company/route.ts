import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/company - 현재 사용자의 회사 정보 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ data: null });
    }

    const { data: company, error } = await supabase
      .from('companies')
      .select('*')
      .eq('id', userData.company_id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: company });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/company - 회사 생성 또는 업데이트
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('id, company_id, role')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // company_admin 이상만 회사 정보 수정 가능
    if (!['super_admin', 'company_admin'].includes(userData.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name, businessNumber, ceoName, address, phone } = body;

    if (!name) {
      return NextResponse.json({ error: '회사명은 필수입니다.' }, { status: 400 });
    }

    const companyData = {
      name,
      business_number: businessNumber || null,
      ceo_name: ceoName || null,
      address: address || null,
      phone: phone || null,
      updated_at: new Date().toISOString(),
    };

    if (userData.company_id) {
      // Update existing company
      const { data, error } = await adminClient
        .from('companies')
        .update(companyData)
        .eq('id', userData.company_id)
        .select()
        .single();

      if (error) {
        console.error('Company update error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ data, message: '회사 정보가 업데이트되었습니다.' });
    } else {
      // Create new company
      const { data: newCompany, error: createError } = await adminClient
        .from('companies')
        .insert({
          ...companyData,
          status: 'ACTIVE',
        })
        .select()
        .single();

      if (createError) {
        console.error('Company create error:', createError);
        return NextResponse.json({ error: createError.message }, { status: 500 });
      }

      // Link company to user
      const { error: updateError } = await adminClient
        .from('users')
        .update({ company_id: newCompany.id })
        .eq('id', userData.id);

      if (updateError) {
        console.error('User update error:', updateError);
        // Rollback - delete the created company
        await adminClient.from('companies').delete().eq('id', newCompany.id);
        return NextResponse.json({
          error: `회사 연결에 실패했습니다: ${updateError.message}`
        }, { status: 500 });
      }

      console.log('[POST /api/company] Company created and linked:', newCompany.id);

      return NextResponse.json({
        data: newCompany,
        message: '회사가 생성되었습니다.'
      }, { status: 201 });
    }
  } catch (error) {
    console.error('Company API error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
