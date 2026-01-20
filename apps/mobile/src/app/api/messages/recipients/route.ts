import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
}

// GET /api/messages/recipients - 메시지 수신자 목록 (관리자/매니저)
export async function GET(request: NextRequest) {
  const supabase = getSupabaseClient();

  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: userProfile } = await supabase
      .from('users')
      .select('id, company_id, store_id')
      .eq('auth_id', user.id)
      .single();

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // 같은 회사의 관리자/매니저 목록 조회
    const { data, error } = await supabase
      .from('users')
      .select('id, name, role, position')
      .eq('company_id', userProfile.company_id)
      .eq('status', 'ACTIVE')
      .in('role', ['company_admin', 'manager', 'store_manager'])
      .neq('id', userProfile.id)
      .order('name');

    if (error) {
      console.error('Error fetching recipients:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 역할 라벨 매핑
    const roleLabels: Record<string, string> = {
      company_admin: '관리자',
      manager: '매니저',
      store_manager: '점장',
    };

    const recipients = (data || []).map((u: any) => ({
      ...u,
      role_label: roleLabels[u.role] || u.role,
    }));

    return NextResponse.json(recipients);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
