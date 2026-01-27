import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { pushNotificationService } from '@abc/shared/server';
import { format } from 'date-fns';

function getServiceSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
}

// GET /api/emergency-shifts - 긴급 근무 목록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const store_id = searchParams.get('store_id');

    let query = supabase
      .from('emergency_shifts')
      .select(`
        *,
        stores (name)
      `)
      .order('work_date', { ascending: true });

    if (status) {
      query = query.eq('status', status);
    }

    if (store_id) {
      query = query.eq('store_id', store_id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching emergency shifts:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const shifts = data?.map((shift: Record<string, unknown> & { stores?: { name?: string }; applicants?: unknown[] }) => ({
      ...shift,
      store_name: shift.stores?.name,
      applicants: shift.applicants || [],
    })) || [];

    return NextResponse.json(shifts);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/emergency-shifts - 긴급 근무 생성
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const body = await request.json();

    const {
      store_id,
      work_date,
      start_time,
      end_time,
      positions, // JSONB array: [{role: string, count: number}]
      reason,
      description,
      hourly_rate,
      bonus,
      benefits,
      deadline,
      show_bonus_in_notification = false,
    } = body;

    // Get user's company_id for authorization
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: userProfile } = await supabase
      .from('users')
      .select('id, company_id, role')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Authorization check
    const allowedRoles = ['super_admin', 'company_admin', 'manager', 'store_manager'];
    if (!allowedRoles.includes(userProfile.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Get store info to get brand_id and validate company_id
    const { data: storeData } = await supabase
      .from('stores')
      .select('id, company_id, brand_id')
      .eq('id', store_id)
      .single();

    if (!storeData) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    // Verify user has access to this store's company
    if (userProfile.role !== 'super_admin' && storeData.company_id !== userProfile.company_id) {
      return NextResponse.json({ error: 'Insufficient permissions for this store' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('emergency_shifts')
      .insert({
        store_id,
        company_id: storeData.company_id,
        brand_id: storeData.brand_id,
        work_date,
        start_time,
        end_time,
        positions: positions || [{ role: '직원', count: 1 }],
        reason,
        description,
        hourly_rate,
        bonus: bonus || 0,
        benefits: benefits || [],
        deadline: deadline || null, // Convert empty string to null for timestamp field
        status: 'OPEN',
        applicants: [],
        created_by: userProfile.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating emergency shift:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 자동 알림 전송: 해당 날짜에 근무가 없는 직원들에게 알림 발송
    try {
      const serviceSupabase = getServiceSupabaseClient();
      const invitedIds = await sendEmergencyNotifications(
        serviceSupabase,
        data,
        storeData,
        show_bonus_in_notification
      );

      // 초대된 직원 ID 업데이트
      if (invitedIds.length > 0) {
        await serviceSupabase
          .from('emergency_shifts')
          .update({ invited_staff_ids: invitedIds })
          .eq('id', data.id);
      }

    } catch (notifyError) {
      console.error('알림 전송 중 오류 (긴급근무 생성은 성공):', notifyError);
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * 긴급근무 알림 전송
 * 해당 매장의 직원 중 지정된 날짜에 근무가 없는 직원들에게 알림 발송
 */
async function sendEmergencyNotifications(
  supabase: ReturnType<typeof getServiceSupabaseClient>,
  shift: { id: string; store_id: string; work_date: string; start_time: string; end_time: string; bonus?: number },
  storeData: { id: string; company_id: string; brand_id: string },
  showBonusInNotification: boolean
): Promise<string[]> {
  const workDate = shift.work_date;
  const maxInvites = 50; // 최대 초대 인원

  // 같은 회사의 활성 직원 조회 (직원/파트타임)
  const { data: staffList, error } = await supabase
    .from('users')
    .select('id, name, position')
    .eq('company_id', storeData.company_id)
    .eq('status', 'ACTIVE')
    .in('role', ['staff', 'part_time']);

  if (error || !staffList || staffList.length === 0) {
    return [];
  }

  // 해당 날짜에 스케줄이 있는 직원 ID 목록 조회
  const { data: scheduledStaff } = await supabase
    .from('schedules')
    .select('staff_id')
    .eq('work_date', workDate)
    .in('staff_id', staffList.map(s => s.id));

  const scheduledStaffIds = new Set((scheduledStaff || []).map((s: { staff_id: string }) => s.staff_id));

  // 스케줄이 없는 직원만 필터
  const availableStaff = staffList
    .filter(staff => !scheduledStaffIds.has(staff.id))
    .slice(0, maxInvites);

  if (availableStaff.length === 0) {
    return [];
  }

  // 알림 메시지 생성
  const formattedDate = format(new Date(shift.work_date), 'M월 d일');
  const startTime = shift.start_time.substring(0, 5); // HH:mm
  const endTime = shift.end_time.substring(0, 5);
  // 보너스 알림 노출은 showBonusInNotification이 true이고 보너스가 있을 때만
  const bonusText = showBonusInNotification && shift.bonus && shift.bonus > 0
    ? ` (+${shift.bonus.toLocaleString()}원 보너스)`
    : '';

  // 매장 이름 조회
  const { data: storeInfo } = await supabase
    .from('stores')
    .select('name')
    .eq('id', shift.store_id)
    .single();

  const storeName = storeInfo?.name || '매장';
  const invitedIds: string[] = [];

  for (const staff of availableStaff) {
    // FCM 토큰 조회 및 푸시 알림 발송
    const { data: fcmTokens } = await supabase
      .from('user_fcm_tokens')
      .select('fcm_token')
      .eq('user_id', staff.id)
      .eq('is_active', true);

    if (fcmTokens && fcmTokens.length > 0) {
      for (const tokenRecord of fcmTokens) {
        try {
          await pushNotificationService.send(tokenRecord.fcm_token, {
            title: '🚨 긴급 근무 요청',
            body: `${storeName}에서 ${formattedDate} ${startTime}~${endTime} 근무자를 찾고 있습니다.${bonusText}`,
            category: 'EMERGENCY',
            priority: 'HIGH',
            deepLink: `/emergency-shifts/${shift.id}`,
            actions: [
              { id: 'APPLY', title: '지원하기' },
              { id: 'DECLINE', title: '거절' },
            ],
          });
        } catch (err) {
          console.error('Push notification error:', err);
        }
      }
    }

    // 알림 기록 저장
    await supabase.from('notifications').insert({
      user_id: staff.id,
      category: 'EMERGENCY_SHIFT',
      priority: 'URGENT',
      title: '긴급 근무 요청',
      body: `${storeName}에서 ${formattedDate} ${startTime}~${endTime} 근무자를 찾고 있습니다.${bonusText}`,
      deep_link: `/emergency-shifts/${shift.id}`,
      data: {
        shiftId: shift.id,
        storeId: shift.store_id,
        workDate: shift.work_date,
        bonus: shift.bonus,
      },
      sent: true,
      sent_at: new Date().toISOString(),
    });

    invitedIds.push(staff.id);
  }

  return invitedIds;
}
