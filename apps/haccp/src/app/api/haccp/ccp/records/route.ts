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
    let query = supabase
      .from('ccp_records')
      .select(`
        *,
        ccp_definitions (id, ccp_number, process, critical_limit),
        recorder:users!ccp_records_recorded_by_fkey (name),
        verifier:users!ccp_records_verified_by_fkey (name),
        corrective_action:corrective_actions!ccp_records_corrective_action_id_fkey (id, action_number, status)
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

    return NextResponse.json(data || []);
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
      .select('ccp_number, process, critical_limit')
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
      const limit = ccpDef?.critical_limit;
      const problemDesc = `[${ccpDef?.ccp_number || 'CCP'}] ${ccpDef?.process || ''} 한계기준 이탈\n` +
        `측정값: ${body.measurement?.value}${body.measurement?.unit}\n` +
        `한계기준: ${limit?.min !== undefined ? limit.min : ''} ~ ${limit?.max !== undefined ? limit.max : ''} ${limit?.unit || ''}\n` +
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
