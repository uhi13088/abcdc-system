/**
 * 근태 수정 요청 상세 API
 * GET /api/attendance/corrections/[id] - 수정 요청 상세 조회
 * DELETE /api/attendance/corrections/[id] - 수정 요청 취소
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // 인증 확인
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 사용자 정보 조회
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', authUser.id)
      .single();

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 수정 요청 상세 조회
    const { data: correction, error } = await supabase
      .from('attendance_correction_requests')
      .select(`
        id,
        attendance_id,
        request_type,
        original_check_in,
        original_check_out,
        requested_check_in,
        requested_check_out,
        reason,
        reason_category,
        overtime_hours,
        overtime_type,
        status,
        reviewed_by,
        reviewed_at,
        review_comment,
        auto_generated,
        created_at,
        updated_at,
        attendances!attendance_id (
          id,
          work_date,
          scheduled_check_in,
          scheduled_check_out,
          actual_check_in,
          actual_check_out,
          status
        )
      `)
      .eq('id', id)
      .eq('staff_id', user.id)
      .single();

    if (error) {
      console.error('Correction query error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!correction) {
      return NextResponse.json(
        { error: '수정 요청을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 사유 카테고리 목록
    const { data: reasonCategories } = await supabase
      .from('attendance_reason_categories')
      .select('code, name, applicable_types')
      .eq('is_active', true)
      .order('sort_order');

    return NextResponse.json({
      correction,
      reasonCategories: reasonCategories || [],
    });
  } catch (error) {
    console.error('Correction detail API error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // 인증 확인
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 사용자 정보 조회
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', authUser.id)
      .single();

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 수정 요청 확인
    const { data: correction } = await supabase
      .from('attendance_correction_requests')
      .select('id, status')
      .eq('id', id)
      .eq('staff_id', user.id)
      .single();

    if (!correction) {
      return NextResponse.json(
        { error: '수정 요청을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (correction.status !== 'PENDING') {
      return NextResponse.json(
        { error: '이미 처리된 요청은 취소할 수 없습니다.' },
        { status: 400 }
      );
    }

    // 요청 취소 (상태 변경)
    const { error: updateError } = await supabase
      .from('attendance_correction_requests')
      .update({
        status: 'CANCELLED',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('Cancel error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: '수정 요청이 취소되었습니다.',
    });
  } catch (error) {
    console.error('Correction cancel API error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
