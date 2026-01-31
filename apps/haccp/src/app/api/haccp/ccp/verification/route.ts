import { createClient as createServerClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// CCP 월간 검증 조회
export async function GET(request: NextRequest) {
  const supabase = await createServerClient();
  const adminClient = createAdminClient();

  const { searchParams } = new URL(request.url);
  const year = searchParams.get('year');
  const month = searchParams.get('month');
  const status = searchParams.get('status');
  const processTypeId = searchParams.get('process_type_id');
  const id = searchParams.get('id');

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await adminClient
      .from('users')
      .select('company_id, store_id, current_store_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const currentStoreId = userData.current_store_id || userData.store_id;

    // 단일 검증 상세 조회 (응답 포함)
    if (id) {
      let detailQuery = adminClient
        .from('ccp_verifications')
        .select(`
          *,
          ccp_definitions (id, ccp_number, process, hazard, control_measure, critical_limit, monitoring_method, corrective_action),
          process_type:process_type_id (id, code, name, parameters)
        `)
        .eq('id', id)
        .eq('company_id', userData.company_id);

      if (currentStoreId) {
        detailQuery = detailQuery.eq('store_id', currentStoreId);
      }

      const { data: verification, error } = await detailQuery.single();

      if (error) {
        console.error('Error fetching verification:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // 사용자 정보 별도 조회
      const userIds = new Set<string>();
      if (verification.verified_by) userIds.add(verification.verified_by);
      if (verification.approved_by) userIds.add(verification.approved_by);

      let usersMap: Record<string, { id: string; name: string }> = {};
      if (userIds.size > 0) {
        const { data: users } = await adminClient
          .from('users')
          .select('id, name')
          .in('id', Array.from(userIds));

        if (users) {
          usersMap = users.reduce((acc, u) => {
            acc[u.id] = u;
            return acc;
          }, {} as Record<string, { id: string; name: string }>);
        }
      }

      // 체크리스트 응답 조회
      const { data: responses } = await adminClient
        .from('ccp_verification_responses')
        .select(`
          *,
          question:question_id (id, question_code, question_text, question_category, help_text),
          common_question:common_question_id (id, question_code, question_text, question_category, equipment_type, help_text)
        `)
        .eq('verification_id', id);

      // 응답의 checker 정보 조회
      const checkerIds = new Set<string>();
      responses?.forEach(r => {
        if (r.checked_by) checkerIds.add(r.checked_by);
      });

      let checkersMap: Record<string, { id: string; name: string }> = {};
      if (checkerIds.size > 0) {
        const { data: checkers } = await adminClient
          .from('users')
          .select('id, name')
          .in('id', Array.from(checkerIds));

        if (checkers) {
          checkersMap = checkers.reduce((acc, u) => {
            acc[u.id] = u;
            return acc;
          }, {} as Record<string, { id: string; name: string }>);
        }
      }

      const enrichedResponses = responses?.map(r => ({
        ...r,
        checker: r.checked_by ? checkersMap[r.checked_by] || null : null,
      })) || [];

      return NextResponse.json({
        ...verification,
        verifier: verification.verified_by ? usersMap[verification.verified_by] || null : null,
        approver: verification.approved_by ? usersMap[verification.approved_by] || null : null,
        responses: enrichedResponses,
      });
    }

    // 목록 조회
    let query = adminClient
      .from('ccp_verifications')
      .select(`
        *,
        ccp_definitions (id, ccp_number, process, critical_limit),
        process_type:process_type_id (id, code, name)
      `)
      .eq('company_id', userData.company_id);

    if (currentStoreId) {
      query = query.eq('store_id', currentStoreId);
    }

    query = query
      .order('verification_year', { ascending: false })
      .order('verification_month', { ascending: false });

    if (year) {
      query = query.eq('verification_year', parseInt(year));
    }

    if (month) {
      query = query.eq('verification_month', parseInt(month));
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (processTypeId) {
      query = query.eq('process_type_id', processTypeId);
    }

    const { data, error } = await query.limit(100);

    if (error) {
      console.error('Error fetching CCP verifications:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json([]);
    }

    // 사용자 정보 별도 조회
    const userIds = new Set<string>();
    data.forEach(v => {
      if (v.verified_by) userIds.add(v.verified_by);
      if (v.approved_by) userIds.add(v.approved_by);
    });

    let usersMap: Record<string, { name: string }> = {};
    if (userIds.size > 0) {
      const { data: users } = await adminClient
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

    const enrichedData = data.map(v => ({
      ...v,
      verifier: v.verified_by ? usersMap[v.verified_by] || null : null,
      approver: v.approved_by ? usersMap[v.approved_by] || null : null,
    }));

    return NextResponse.json(enrichedData);
  } catch (error) {
    console.error('Error in GET /api/haccp/ccp/verification:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// CCP 월간 검증 생성
export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const adminClient = createAdminClient();
  const body = await request.json();

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await adminClient
      .from('users')
      .select('id, company_id, store_id, current_store_id')
      .eq('auth_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const currentStoreId = profile.current_store_id || profile.store_id;

    const {
      process_type_id,
      ccp_id,
      verification_year,
      verification_month,
      records_reviewed,
      deviations_found,
      corrective_actions_taken,
      effectiveness_rating,
      findings,
      recommendations,
      special_notes,
      action_taken,
      equipment_calibration_verified,
      responses, // 체크리스트 응답 배열
    } = body;

    // 검증 레코드 생성
    const { data: verification, error: verificationError } = await adminClient
      .from('ccp_verifications')
      .insert({
        company_id: profile.company_id,
        store_id: currentStoreId || null,
        process_type_id,
        ccp_id,
        verification_year,
        verification_month,
        records_reviewed: records_reviewed || 0,
        deviations_found: deviations_found || 0,
        corrective_actions_taken: corrective_actions_taken || 0,
        effectiveness_rating: effectiveness_rating || 'GOOD',
        findings,
        recommendations,
        special_notes,
        action_taken,
        equipment_calibration_verified: equipment_calibration_verified || false,
        overall_compliance_status: 'PENDING',
        status: 'DRAFT',
        verified_by: profile.id,
        verified_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (verificationError) {
      console.error('Error creating CCP verification:', verificationError);
      return NextResponse.json({ error: verificationError.message }, { status: 500 });
    }

    // 체크리스트 응답 저장
    if (responses && responses.length > 0) {
      const responsesToInsert = responses.map((r: {
        question_id?: string;
        common_question_id?: string;
        is_compliant?: boolean;
        non_compliance_reason?: string;
        corrective_action?: string;
        evidence_notes?: string;
      }) => ({
        verification_id: verification.id,
        question_id: r.question_id || null,
        common_question_id: r.common_question_id || null,
        is_compliant: r.is_compliant,
        non_compliance_reason: r.non_compliance_reason,
        corrective_action: r.corrective_action,
        evidence_notes: r.evidence_notes,
        checked_by: profile.id,
        checked_at: new Date().toISOString(),
      }));

      const { error: responsesError } = await adminClient
        .from('ccp_verification_responses')
        .insert(responsesToInsert);

      if (responsesError) {
        console.error('Error saving verification responses:', responsesError);
      }

      // 전체 적합 여부 계산
      const compliantCount = responses.filter((r: { is_compliant?: boolean }) => r.is_compliant === true).length;
      const nonCompliantCount = responses.filter((r: { is_compliant?: boolean }) => r.is_compliant === false).length;
      const totalResponses = responses.length;

      let overallStatus = 'PENDING';
      if (totalResponses > 0) {
        if (nonCompliantCount === 0) {
          overallStatus = 'COMPLIANT';
        } else if (compliantCount === 0) {
          overallStatus = 'NON_COMPLIANT';
        } else {
          overallStatus = 'PARTIAL';
        }
      }

      // 적합 상태 업데이트
      await adminClient
        .from('ccp_verifications')
        .update({ overall_compliance_status: overallStatus })
        .eq('id', verification.id);
    }

    return NextResponse.json(verification);
  } catch (error) {
    console.error('Error in POST /api/haccp/ccp/verification:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// CCP 월간 검증 수정/액션
export async function PUT(request: NextRequest) {
  const supabase = await createServerClient();
  const adminClient = createAdminClient();
  const body = await request.json();

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await adminClient
      .from('users')
      .select('id, company_id, store_id, current_store_id')
      .eq('auth_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const currentStoreId = profile.current_store_id || profile.store_id;

    const { id, action, responses, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    // 액션별 처리
    if (action === 'submit') {
      // 제출 (검토 요청)
      let submitQuery = adminClient
        .from('ccp_verifications')
        .update({
          status: 'SUBMITTED',
          submitted_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('company_id', profile.company_id);

      if (currentStoreId) {
        submitQuery = submitQuery.eq('store_id', currentStoreId);
      }

      const { data, error } = await submitQuery.select().single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json(data);
    }

    if (action === 'approve') {
      // 승인
      let approveQuery = adminClient
        .from('ccp_verifications')
        .update({
          status: 'APPROVED',
          approved_by: profile.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('company_id', profile.company_id);

      if (currentStoreId) {
        approveQuery = approveQuery.eq('store_id', currentStoreId);
      }

      const { data, error } = await approveQuery.select().single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json(data);
    }

    if (action === 'reject') {
      // 반려
      let rejectQuery = adminClient
        .from('ccp_verifications')
        .update({
          status: 'REJECTED',
          rejection_reason: updateData.rejection_reason,
          approved_by: profile.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('company_id', profile.company_id);

      if (currentStoreId) {
        rejectQuery = rejectQuery.eq('store_id', currentStoreId);
      }

      const { data, error } = await rejectQuery.select().single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json(data);
    }

    if (action === 'save_responses') {
      // 체크리스트 응답 저장/업데이트
      if (responses && responses.length > 0) {
        // 기존 응답 삭제 후 재삽입
        await adminClient
          .from('ccp_verification_responses')
          .delete()
          .eq('verification_id', id);

        const responsesToInsert = responses.map((r: {
          question_id?: string;
          common_question_id?: string;
          is_compliant?: boolean;
          non_compliance_reason?: string;
          corrective_action?: string;
          evidence_notes?: string;
        }) => ({
          verification_id: id,
          question_id: r.question_id || null,
          common_question_id: r.common_question_id || null,
          is_compliant: r.is_compliant,
          non_compliance_reason: r.non_compliance_reason,
          corrective_action: r.corrective_action,
          evidence_notes: r.evidence_notes,
          checked_by: profile.id,
          checked_at: new Date().toISOString(),
        }));

        await adminClient
          .from('ccp_verification_responses')
          .insert(responsesToInsert);

        // 전체 적합 여부 계산
        const compliantCount = responses.filter((r: { is_compliant?: boolean }) => r.is_compliant === true).length;
        const nonCompliantCount = responses.filter((r: { is_compliant?: boolean }) => r.is_compliant === false).length;
        const totalResponses = responses.length;

        let overallStatus = 'PENDING';
        if (totalResponses > 0) {
          if (nonCompliantCount === 0) {
            overallStatus = 'COMPLIANT';
          } else if (compliantCount === 0) {
            overallStatus = 'NON_COMPLIANT';
          } else {
            overallStatus = 'PARTIAL';
          }
        }

        await adminClient
          .from('ccp_verifications')
          .update({ overall_compliance_status: overallStatus })
          .eq('id', id);
      }

      return NextResponse.json({ success: true });
    }

    // 일반 업데이트
    let generalQuery = adminClient
      .from('ccp_verifications')
      .update({
        ...updateData,
        verified_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('company_id', profile.company_id);

    if (currentStoreId) {
      generalQuery = generalQuery.eq('store_id', currentStoreId);
    }

    const { data, error } = await generalQuery.select().single();

    if (error) {
      console.error('Error updating CCP verification:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in PUT /api/haccp/ccp/verification:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// CCP 월간 검증 삭제
export async function DELETE(request: NextRequest) {
  const supabase = await createServerClient();
  const adminClient = createAdminClient();
  const id = request.nextUrl.searchParams.get('id');

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await adminClient
      .from('users')
      .select('company_id, store_id, current_store_id')
      .eq('auth_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const currentStoreId = profile.current_store_id || profile.store_id;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    // 응답 먼저 삭제
    await adminClient
      .from('ccp_verification_responses')
      .delete()
      .eq('verification_id', id);

    // 검증 삭제
    let deleteQuery = adminClient
      .from('ccp_verifications')
      .delete()
      .eq('id', id)
      .eq('company_id', profile.company_id);

    if (currentStoreId) {
      deleteQuery = deleteQuery.eq('store_id', currentStoreId);
    }

    const { error } = await deleteQuery;

    if (error) {
      console.error('Error deleting CCP verification:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/haccp/ccp/verification:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
