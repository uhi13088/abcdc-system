/**
 * HACCP 감사 보고서 API
 * GET /api/haccp/audit-reports - 감사 보고서 조회
 * POST /api/haccp/audit-reports - 감사 보고서 생성
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/haccp/audit-reports
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const reportType = searchParams.get('type');
    const status = searchParams.get('status');

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await supabase
      .from('users')
      .select('company_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    let query = supabase
      .from('audit_reports')
      .select(`
        *,
        created_by_user:created_by (name),
        approved_by_user:approved_by (name)
      `)
      .eq('company_id', userProfile.company_id)
      .order('report_date', { ascending: false });

    if (startDate) {
      query = query.gte('report_date', startDate);
    }
    if (endDate) {
      query = query.lte('report_date', endDate);
    }
    if (reportType) {
      query = query.eq('report_type', reportType);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching audit reports:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const result = (data || []).map((report: any) => ({
      ...report,
      created_by_name: report.created_by_user?.name,
      approved_by_name: report.approved_by_user?.name,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/haccp/audit-reports
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const body = await request.json();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await supabase
      .from('users')
      .select('id, company_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('audit_reports')
      .insert({
        company_id: userProfile.company_id,
        created_by: userProfile.id,
        report_date: body.report_date || new Date().toISOString().split('T')[0],
        report_type: body.report_type,
        auditor_name: body.auditor_name,
        auditor_company: body.auditor_company,
        auditor_contact: body.auditor_contact,
        audit_scope: body.audit_scope,
        audit_criteria: body.audit_criteria,
        summary: body.summary,
        findings: body.findings || [],
        overall_score: body.overall_score,
        effectiveness_rating: body.effectiveness_rating,
        recommendations: body.recommendations,
        next_audit_date: body.next_audit_date,
        attachment_urls: body.attachment_urls || [],
        status: body.status || 'DRAFT',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating audit report:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/haccp/audit-reports
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const body = await request.json();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await supabase
      .from('users')
      .select('id, company_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    // If approving
    if (updateData.approved) {
      updateData.approved_by = userProfile.id;
      updateData.approved_at = new Date().toISOString();
      updateData.status = 'FINAL';
      delete updateData.approved;
    }

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('audit_reports')
      .update(updateData)
      .eq('id', id)
      .eq('company_id', userProfile.company_id)
      .select()
      .single();

    if (error) {
      console.error('Error updating audit report:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
