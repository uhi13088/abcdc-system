import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/haccp/ccp/master/[id]/items - 특정 마스터 그룹의 CCP 항목 목록 조회
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: masterId } = await params;
    const supabase = await createServerClient();
    const adminClient = createAdminClient();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await adminClient
      .from('users')
      .select('company_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const { data, error } = await adminClient
      .from('ccp_definitions')
      .select('*')
      .eq('company_id', userProfile.company_id)
      .eq('master_id', masterId)
      .order('ccp_number', { ascending: true });

    if (error) {
      // If master_id column doesn't exist, return empty array
      if (error.code === '42703' || error.message?.includes('master_id')) {
        console.warn('master_id column does not exist in ccp_definitions. Run migrations.');
        return NextResponse.json([]);
      }
      console.error('Error fetching CCP items:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
