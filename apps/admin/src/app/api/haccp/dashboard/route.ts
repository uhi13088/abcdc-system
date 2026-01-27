/**
 * HACCP Dashboard Stats API
 * GET /api/haccp/dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createServerClient();

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
      return NextResponse.json({
        todayHygieneChecks: 0,
        totalHygieneChecks: 0,
        pendingCcpRecords: 0,
        lowStockMaterials: 0,
        pendingInspections: 0,
        todayProduction: 0,
        ccpDeviations: 0,
        recentActivities: [],
      });
    }

    const companyId = userProfile.company_id;
    const today = new Date().toISOString().split('T')[0];

    // Today's hygiene checks (completed)
    const { count: todayHygieneChecks } = await supabase
      .from('haccp_hygiene_records')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .gte('check_date', today);

    // Get expected daily hygiene checks count (e.g., from company settings or default 3)
    const totalHygieneChecks = 3; // Default daily hygiene check target

    // Pending CCP records (status = PENDING)
    const { count: pendingCcpRecords } = await supabase
      .from('haccp_ccp_records')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('status', 'PENDING');

    // Low stock materials (stock <= min_stock_level)
    const { data: lowStockData } = await supabase
      .from('haccp_materials')
      .select('id, current_stock, min_stock_level')
      .eq('company_id', companyId)
      .eq('is_active', true);

    const lowStockMaterials = (lowStockData || []).filter(
      (m) => m.current_stock <= (m.min_stock_level || 0)
    ).length;

    // Pending inspections (status = PENDING)
    const { count: pendingInspections } = await supabase
      .from('haccp_receiving_inspections')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('status', 'PENDING');

    // Today's production records
    const { count: todayProduction } = await supabase
      .from('haccp_production_records')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .gte('production_date', today);

    // CCP deviations (records with deviation today)
    const { count: ccpDeviations } = await supabase
      .from('haccp_ccp_records')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('has_deviation', true)
      .gte('recorded_at', today);

    // Recent activities
    const { data: recentHygiene } = await supabase
      .from('haccp_hygiene_records')
      .select('id, check_date, result, checked_by')
      .eq('company_id', companyId)
      .order('check_date', { ascending: false })
      .limit(3);

    const { data: recentCcp } = await supabase
      .from('haccp_ccp_records')
      .select('id, ccp_name, recorded_at, status, recorded_by')
      .eq('company_id', companyId)
      .order('recorded_at', { ascending: false })
      .limit(3);

    const { data: recentInspections } = await supabase
      .from('haccp_receiving_inspections')
      .select('id, inspection_date, result, inspector_id')
      .eq('company_id', companyId)
      .order('inspection_date', { ascending: false })
      .limit(3);

    // Combine and sort recent activities
    const recentActivities = [
      ...(recentHygiene || []).map((h) => ({
        type: 'hygiene',
        id: h.id,
        date: h.check_date,
        result: h.result,
        user: h.checked_by,
      })),
      ...(recentCcp || []).map((c) => ({
        type: 'ccp',
        id: c.id,
        date: c.recorded_at,
        name: c.ccp_name,
        status: c.status,
        user: c.recorded_by,
      })),
      ...(recentInspections || []).map((i) => ({
        type: 'inspection',
        id: i.id,
        date: i.inspection_date,
        result: i.result,
        user: i.inspector_id,
      })),
    ]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);

    return NextResponse.json({
      todayHygieneChecks: todayHygieneChecks || 0,
      totalHygieneChecks,
      pendingCcpRecords: pendingCcpRecords || 0,
      lowStockMaterials,
      pendingInspections: pendingInspections || 0,
      todayProduction: todayProduction || 0,
      ccpDeviations: ccpDeviations || 0,
      recentActivities,
    });
  } catch (error) {
    console.error('HACCP dashboard error:', error);
    return NextResponse.json({
      todayHygieneChecks: 0,
      totalHygieneChecks: 3,
      pendingCcpRecords: 0,
      lowStockMaterials: 0,
      pendingInspections: 0,
      todayProduction: 0,
      ccpDeviations: 0,
      recentActivities: [],
    });
  }
}

export const dynamic = 'force-dynamic';
