import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// 장비 검교정 기록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await adminClient
      .from('users')
      .select('company_id, store_id, current_store_id, current_haccp_store_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 현재 선택된 매장
    const currentStoreId = userData.current_store_id || userData.store_id;

    const equipmentType = request.nextUrl.searchParams.get('equipment_type');
    const checkExpiring = request.nextUrl.searchParams.get('check_expiring') === 'true';

    let query = adminClient
      .from('equipment_calibration_records')
      .select('*')
      .eq('company_id', userData.company_id)
      .eq('is_active', true);

    // store_id 필터링
    if (currentStoreId) {
      query = query.eq('store_id', currentStoreId);
    }

    query = query.order('next_calibration_date', { ascending: true });

    if (equipmentType) {
      query = query.eq('equipment_type', equipmentType);
    }

    // 만료 임박 (30일 이내) 장비만 조회
    if (checkExpiring) {
      const thirtyDaysLater = new Date();
      thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
      query = query.lte('next_calibration_date', thirtyDaysLater.toISOString().split('T')[0]);
    }

    const { data: records, error } = await query;

    if (error) {
      // 테이블이 없으면 빈 배열 반환
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json({ records: [], summary: { total: 0, expired: 0, expiringSoon: 0, valid: 0 } });
      }
      console.error('Failed to fetch calibration records:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 검교정 상태 요약
    const today = new Date().toISOString().split('T')[0];
    const summary = {
      total: records?.length || 0,
      expired: records?.filter(r => r.next_calibration_date && r.next_calibration_date < today).length || 0,
      expiringSoon: records?.filter(r => {
        if (!r.next_calibration_date) return false;
        const nextDate = new Date(r.next_calibration_date);
        const diffDays = Math.ceil((nextDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 30;
      }).length || 0,
      valid: records?.filter(r => {
        if (!r.next_calibration_date) return true;
        return r.next_calibration_date >= today;
      }).length || 0,
    };

    return NextResponse.json({ records: records || [], summary });
  } catch (error) {
    console.error('Failed to fetch calibration records:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// 장비 검교정 기록 생성
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await adminClient
      .from('users')
      .select('company_id, store_id, current_store_id, current_haccp_store_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 현재 선택된 매장
    const currentStoreId = userData.current_store_id || userData.store_id;

    const body = await request.json();
    const {
      equipment_type,
      equipment_name,
      equipment_code,
      location,
      last_calibration_date,
      calibration_frequency,
      calibration_provider,
      certificate_number,
      calibration_result,
      notes,
    } = body;

    if (!equipment_type || !equipment_name) {
      return NextResponse.json({ error: 'equipment_type and equipment_name are required' }, { status: 400 });
    }

    // 다음 검교정일 계산
    let next_calibration_date = null;
    if (last_calibration_date && calibration_frequency) {
      const lastDate = new Date(last_calibration_date);
      switch (calibration_frequency) {
        case 'YEARLY':
          lastDate.setFullYear(lastDate.getFullYear() + 1);
          break;
        case 'QUARTERLY':
          lastDate.setMonth(lastDate.getMonth() + 3);
          break;
        case 'MONTHLY':
          lastDate.setMonth(lastDate.getMonth() + 1);
          break;
        case 'WEEKLY':
          lastDate.setDate(lastDate.getDate() + 7);
          break;
      }
      next_calibration_date = lastDate.toISOString().split('T')[0];
    }

    const { data, error } = await adminClient
      .from('equipment_calibration_records')
      .insert({
        company_id: userData.company_id,
        store_id: currentStoreId || null,
        equipment_type,
        equipment_name,
        equipment_code,
        location,
        last_calibration_date,
        next_calibration_date,
        calibration_frequency: calibration_frequency || 'YEARLY',
        calibration_provider,
        certificate_number,
        calibration_result: calibration_result || 'PASS',
        notes,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      // 테이블이 없으면 null 반환
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json(null);
      }
      console.error('Failed to create calibration record:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to create calibration record:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// 장비 검교정 기록 수정
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await adminClient
      .from('users')
      .select('company_id, store_id, current_store_id, current_haccp_store_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 현재 선택된 매장
    const currentStoreId = userData.current_store_id || userData.store_id;

    const body = await request.json();
    const { id, action, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    // 검교정 갱신 액션
    if (action === 'renew') {
      const { last_calibration_date, calibration_frequency, certificate_number, calibration_result, calibration_provider, notes } = updateData;

      let next_calibration_date = null;
      if (last_calibration_date && calibration_frequency) {
        const lastDate = new Date(last_calibration_date);
        switch (calibration_frequency) {
          case 'YEARLY':
            lastDate.setFullYear(lastDate.getFullYear() + 1);
            break;
          case 'QUARTERLY':
            lastDate.setMonth(lastDate.getMonth() + 3);
            break;
          case 'MONTHLY':
            lastDate.setMonth(lastDate.getMonth() + 1);
            break;
          case 'WEEKLY':
            lastDate.setDate(lastDate.getDate() + 7);
            break;
        }
        next_calibration_date = lastDate.toISOString().split('T')[0];
      }

      let updateQuery = adminClient
        .from('equipment_calibration_records')
        .update({
          last_calibration_date,
          next_calibration_date,
          calibration_frequency,
          certificate_number,
          calibration_result: calibration_result || 'PASS',
          calibration_provider,
          notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('company_id', userData.company_id);

      if (currentStoreId) {
        updateQuery = updateQuery.eq('store_id', currentStoreId);
      }

      const { data, error } = await updateQuery.select().single();

      if (error) {
        console.error('Failed to renew calibration:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data);
    }

    // 일반 수정
    let updateQuery = adminClient
      .from('equipment_calibration_records')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('company_id', userData.company_id);

    if (currentStoreId) {
      updateQuery = updateQuery.eq('store_id', currentStoreId);
    }

    const { data, error } = await updateQuery.select().single();

    if (error) {
      console.error('Failed to update calibration record:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to update calibration record:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// 장비 검교정 기록 삭제
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await adminClient
      .from('users')
      .select('company_id, store_id, current_store_id, current_haccp_store_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 현재 선택된 매장
    const currentStoreId = userData.current_store_id || userData.store_id;

    const id = request.nextUrl.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    let deleteQuery = adminClient
      .from('equipment_calibration_records')
      .delete()
      .eq('id', id)
      .eq('company_id', userData.company_id);

    if (currentStoreId) {
      deleteQuery = deleteQuery.eq('store_id', currentStoreId);
    }

    const { error } = await deleteQuery;

    if (error) {
      console.error('Failed to delete calibration record:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete calibration record:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
