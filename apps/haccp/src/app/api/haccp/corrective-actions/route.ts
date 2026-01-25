import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { addHours, addDays, format } from 'date-fns';

export const dynamic = 'force-dynamic';

// 심각도별 기한 계산
function calculateDueDates(severity: string, baseDate: Date) {
  switch (severity) {
    case 'CRITICAL':
      return {
        immediate: addHours(baseDate, 4),
        rootCause: addDays(baseDate, 1),
        corrective: addDays(baseDate, 3),
        verification: addDays(baseDate, 7),
      };
    case 'HIGH':
      return {
        immediate: addHours(baseDate, 24),
        rootCause: addDays(baseDate, 3),
        corrective: addDays(baseDate, 7),
        verification: addDays(baseDate, 14),
      };
    case 'MEDIUM':
      return {
        immediate: addDays(baseDate, 2),
        rootCause: addDays(baseDate, 5),
        corrective: addDays(baseDate, 14),
        verification: addDays(baseDate, 21),
      };
    default: // LOW
      return {
        immediate: addDays(baseDate, 3),
        rootCause: addDays(baseDate, 7),
        corrective: addDays(baseDate, 21),
        verification: addDays(baseDate, 30),
      };
  }
}

// 개선조치 번호 생성
function generateActionNumber(date: Date): string {
  const dateStr = format(date, 'yyyyMMdd');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `CA-${dateStr}-${random}`;
}

// 개선조치 목록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
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
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const status = request.nextUrl.searchParams.get('status');
    const sourceType = request.nextUrl.searchParams.get('source_type');
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50');

    let query = supabase
      .from('corrective_actions')
      .select(`
        *,
        responsible:users!corrective_actions_responsible_person_fkey(id, name),
        verifier:users!corrective_actions_verified_by_fkey(id, name)
      `)
      .eq('company_id', userData.company_id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq('status', status);
    }
    if (sourceType) {
      query = query.eq('source_type', sourceType);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to fetch corrective actions:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Failed to fetch corrective actions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// 개선조치 생성
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('id, company_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      source_type,
      source_id,
      problem_description,
      severity = 'HIGH',
      immediate_action,
      responsible_person,
    } = body;

    if (!source_type || !problem_description) {
      return NextResponse.json(
        { error: 'source_type and problem_description are required' },
        { status: 400 }
      );
    }

    const now = new Date();
    const dueDates = calculateDueDates(severity, now);

    const { data, error } = await supabase
      .from('corrective_actions')
      .insert({
        company_id: userData.company_id,
        action_number: generateActionNumber(now),
        action_date: format(now, 'yyyy-MM-dd'),
        source_type,
        source_id,
        problem_description,
        immediate_action,
        corrective_action: '', // 나중에 입력
        responsible_person,
        due_date: format(dueDates.corrective, 'yyyy-MM-dd'),
        status: 'OPEN',
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create corrective action:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 담당자에게 알림 생성
    if (responsible_person) {
      await supabase.from('notifications').insert({
        user_id: responsible_person,
        category: 'HACCP',
        priority: severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
        title: '개선조치 배정',
        body: `새로운 개선조치가 배정되었습니다: ${problem_description.substring(0, 50)}`,
        deep_link: `/corrective-actions/${data.id}`,
      });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to create corrective action:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// 개선조치 수정
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('id, company_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    // 상태 변경 시 검증 정보 자동 설정
    if (updateData.status === 'VERIFIED' || updateData.status === 'CLOSED') {
      if (!updateData.verified_by) {
        updateData.verified_by = userData.id;
      }
      if (!updateData.verification_date) {
        updateData.verification_date = format(new Date(), 'yyyy-MM-dd');
      }
    }

    const { data, error } = await supabase
      .from('corrective_actions')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('company_id', userData.company_id)
      .select()
      .single();

    if (error) {
      console.error('Failed to update corrective action:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to update corrective action:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
