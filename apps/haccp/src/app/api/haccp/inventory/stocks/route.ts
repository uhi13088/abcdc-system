import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/haccp/inventory/stocks
export async function GET(_request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await adminClient
      .from('users')
      .select('company_id, store_id, current_store_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 현재 선택된 매장
    const currentStoreId = userProfile.current_store_id || userProfile.store_id;

    let query = adminClient
      .from('material_stocks')
      .select(`
        *,
        materials:material_id (name, code, unit)
      `)
      .eq('company_id', userProfile.company_id)
      .neq('status', 'DISPOSED')
      .gt('quantity', 0);

    // store_id 필터링
    if (currentStoreId) {
      query = query.eq('store_id', currentStoreId);
    }

    const { data, error } = await query.order('expiry_date', { ascending: true });

    if (error) {
      // 테이블이 없으면 빈 배열 반환
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json([]);
      }
      console.error('Error fetching stocks:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (data || []).map((s: any) => ({
      ...s,
      material_name: s.materials?.name,
      material_code: s.materials?.code,
      unit: s.unit || s.materials?.unit,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
