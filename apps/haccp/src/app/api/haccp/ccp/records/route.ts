import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { format, addDays } from 'date-fns';

export const dynamic = 'force-dynamic';

// 개선조치 번호 생성
function generateActionNumber(date: Date): string {
  const dateStr = format(date, 'yyyyMMdd');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `CA-${dateStr}-${random}`;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const { searchParams } = new URL(request.url);
  const ccpId = searchParams.get('ccp_id');
  const date = searchParams.get('date');

  try {
    // 기본 쿼리 (FK 조인 최소화)
    let query = supabase
      .from('ccp_records')
      .select(`
        *,
        ccp_definitions (id, ccp_number, process, critical_limit, critical_limits)
      `)
      .order('record_date', { ascending: false })
      .order('record_time', { ascending: false });

    if (ccpId) {
      query = query.eq('ccp_id', ccpId);
    }

    if (date) {
      query = query.eq('record_date', date);
    }

    const { data, error } = await query.limit(100);

    if (error) {
      console.error('Error fetching CCP records:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json([]);
    }

    // 사용자 및 개선조치 정보 별도 조회
    const userIds = new Set<string>();
    const caIds = new Set<string>();

    data.forEach(record => {
      if (record.recorded_by) userIds.add(record.recorded_by);
      if (record.verified_by) userIds.add(record.verified_by);
      if (record.corrective_action_id) caIds.add(record.corrective_action_id);
    });

    // 사용자 정보 조회
    let usersMap: Record<string, { name: string }> = {};
    if (userIds.size > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, name')
        .in('id', Array.from(userIds));

      if (users) {
        usersMap = users.reduce((acc, u) => {
          acc[u.id] = { name: u.name };
          return acc;
        }, {} as Record<string, { name: string }>);
      }
    }

    // 개선조치 정보 조회
    let caMap: Record<string, { id: string; action_number: string; status: string }> = {};
    if (caIds.size > 0) {
      const { data: actions } = await supabase
        .from('corrective_actions')
        .select('id, action_number, status')
        .in('id', Array.from(caIds));

      if (actions) {
        caMap = actions.reduce((acc, a) => {
          acc[a.id] = a;
          return acc;
        }, {} as Record<string, { id: string; action_number: string; status: string }>);
      }
    }

    // 데이터 병합
    const enrichedData = data.map(record => ({
      ...record,
      recorder: record.recorded_by ? usersMap[record.recorded_by] || null : null,
      verifier: record.verified_by ? usersMap[record.verified_by] || null : null,
      corrective_action: record.corrective_action_id ? caMap[record.corrective_action_id] || null : null,
    }));

    return NextResponse.json(enrichedData);
  } catch (error) {
    console.error('Error in GET /api/haccp/ccp/records:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();

  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's company_id
    const { data: profile } = await supabase
      .from('users')
      .select('id, company_id')
      .eq('auth_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // CCP 정보 조회 (이탈 시 개선조치 생성용)
    const { data: ccpDef } = await supabase
      .from('ccp_definitions')
      .select('ccp_number, process, critical_limit, critical_limits')
      .eq('id', body.ccp_id)
      .single();

    const { data, error } = await supabase
      .from('ccp_records')
      .insert({
        company_id: profile.company_id,
        ccp_id: body.ccp_id,
        record_date: body.record_date,
        record_time: body.record_time,
        recorded_by: profile.id,
        lot_number: body.lot_number || null,
        product_id: body.product_id || null,
        measurement: body.measurement,
        measurements: body.measurements || null,
        is_within_limit: body.is_within_limit,
        deviation_action: body.deviation_action || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating CCP record:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 이탈 발생 시 개선조치 자동 생성
    let correctiveAction = null;
    if (!body.is_within_limit) {
      const now = new Date();

      // 측정값 이탈 상세 정보 생성
      let measurementDetails = '';
      if (body.measurements && body.measurements.length > 0) {
        const deviations = body.measurements
          .filter((m: { is_within_limit?: boolean }) => !m.is_within_limit)
          .map((m: { parameter: string; value: number; unit: string; min?: number; max?: number }) =>
            `  - ${m.parameter}: ${m.value}${m.unit} (기준: ${m.min ?? ''} ~ ${m.max ?? ''}${m.unit})`
          );
        measurementDetails = deviations.length > 0
          ? `이탈 항목:\n${deviations.join('\n')}`
          : `측정값: ${body.measurement?.value}${body.measurement?.unit}`;
      } else {
        const limit = ccpDef?.critical_limit;
        measurementDetails = `측정값: ${body.measurement?.value}${body.measurement?.unit}\n` +
          `한계기준: ${limit?.min !== undefined ? limit.min : ''} ~ ${limit?.max !== undefined ? limit.max : ''} ${limit?.unit || ''}`;
      }

      const problemDesc = `[${ccpDef?.ccp_number || 'CCP'}] ${ccpDef?.process || ''} 한계기준 이탈\n` +
        `${measurementDetails}\n` +
        `LOT: ${body.lot_number || '-'}`;

      const { data: caData, error: caError } = await supabase
        .from('corrective_actions')
        .insert({
          company_id: profile.company_id,
          action_number: generateActionNumber(now),
          action_date: body.record_date,
          source_type: 'CCP',
          source_id: data.id,
          problem_description: problemDesc,
          immediate_action: body.deviation_action || null,
          corrective_action: '',
          due_date: format(addDays(now, 7), 'yyyy-MM-dd'),
          status: 'OPEN',
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .select()
        .single();

      if (caError) {
        console.error('Error creating corrective action:', caError);
        // 개선조치 생성 실패해도 CCP 기록은 저장됨
      } else {
        correctiveAction = caData;

        // CCP 기록에 개선조치 ID 연결
        await supabase
          .from('ccp_records')
          .update({ corrective_action_id: caData.id })
          .eq('id', data.id);
      }
    }

    return NextResponse.json({ ...data, corrective_action: correctiveAction });
  } catch (error) {
    console.error('Error in POST /api/haccp/ccp/records:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/haccp/ccp/records
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('users')
      .select('id, company_id')
      .eq('auth_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Record ID is required' }, { status: 400 });
    }

    // 기록 존재 여부 확인
    const { data: existing } = await supabase
      .from('ccp_records')
      .select('id, corrective_action_id')
      .eq('id', id)
      .eq('company_id', profile.company_id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    // 연결된 개선조치가 있으면 연결 해제
    if (existing.corrective_action_id) {
      await supabase
        .from('corrective_actions')
        .update({ source_id: null })
        .eq('id', existing.corrective_action_id);
    }

    // CCP 기록 삭제
    const { error } = await supabase
      .from('ccp_records')
      .delete()
      .eq('id', id)
      .eq('company_id', profile.company_id);

    if (error) {
      console.error('Error deleting CCP record:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'CCP 기록이 삭제되었습니다.' });
  } catch (error) {
    console.error('Error in DELETE /api/haccp/ccp/records:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
