/**
 * HACCP 심사 준비 리포트 API
 * GET /api/haccp/audit-report - 심사 대비 종합 리포트 생성
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { subMonths, format } from 'date-fns';

interface AuditSection {
  name: string;
  score: number;
  maxScore: number;
  status: 'PASS' | 'WARNING' | 'FAIL';
  items: AuditItem[];
  recommendations: string[];
}

interface AuditItem {
  requirement: string;
  status: 'COMPLIANT' | 'PARTIAL' | 'NON_COMPLIANT' | 'NOT_APPLICABLE';
  evidence: string | null;
  notes: string | null;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { searchParams } = new URL(request.url);
    const months = parseInt(searchParams.get('months') || '3');

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

    const companyId = userProfile.company_id;
    const today = new Date();
    const periodStart = subMonths(today, months);
    const periodStartStr = format(periodStart, 'yyyy-MM-dd');

    const sections: AuditSection[] = [];

    // 1. 선행요건 관리 (위생 점검)
    sections.push(await evaluateHygieneSection(supabase, companyId, periodStartStr));
    // 2. CCP 모니터링
    sections.push(await evaluateCCPSection(supabase, companyId, periodStartStr));
    // 3. 원료/자재 관리
    sections.push(await evaluateMaterialSection(supabase, companyId, periodStartStr));
    // 4. 입고 검수
    sections.push(await evaluateReceivingSection(supabase, companyId, periodStartStr));
    // 5. 생산 기록
    sections.push(await evaluateProductionSection(supabase, companyId, periodStartStr));
    // 6. 개선 조치 관리
    sections.push(await evaluateCorrectiveSection(supabase, companyId, periodStartStr));
    // 7. 교육/훈련
    sections.push(await evaluateTrainingSection(supabase, companyId, periodStartStr));

    // 종합 점수 계산
    const totalScore = sections.reduce((sum, s) => sum + s.score, 0);
    const totalMaxScore = sections.reduce((sum, s) => sum + s.maxScore, 0);
    const overallPercentage = Math.round((totalScore / totalMaxScore) * 100);

    let overallStatus: 'EXCELLENT' | 'GOOD' | 'NEEDS_IMPROVEMENT' | 'CRITICAL';
    if (overallPercentage >= 90) overallStatus = 'EXCELLENT';
    else if (overallPercentage >= 75) overallStatus = 'GOOD';
    else if (overallPercentage >= 60) overallStatus = 'NEEDS_IMPROVEMENT';
    else overallStatus = 'CRITICAL';

    const allRecommendations = sections.flatMap((s) => s.recommendations);
    const priorityActions = sections
      .filter((s) => s.status === 'FAIL')
      .map((s) => \`\${s.name}: 즉시 개선 필요 (현재 \${Math.round((s.score / s.maxScore) * 100)}%)\`);

    return NextResponse.json({
      report: { generatedAt: today.toISOString(), periodStart: periodStartStr, periodEnd: format(today, 'yyyy-MM-dd'), companyId },
      summary: { totalScore, totalMaxScore, percentage: overallPercentage, status: overallStatus, statusLabel: { EXCELLENT: '우수', GOOD: '양호', NEEDS_IMPROVEMENT: '개선 필요', CRITICAL: '심각' }[overallStatus] },
      sections,
      recommendations: { priority: priorityActions, general: allRecommendations },
      readiness: { isReady: overallPercentage >= 75 && priorityActions.length === 0, message: overallPercentage >= 75 && priorityActions.length === 0 ? 'HACCP 심사 준비가 완료되었습니다.' : '심사 전 개선이 필요한 항목이 있습니다.' },
    });
  } catch (error) {
    console.error('Audit report error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function evaluateHygieneSection(supabase: any, companyId: string, periodStart: string): Promise<AuditSection> {
  const { count: totalChecks } = await supabase.from('haccp_hygiene_records').select('id', { count: 'exact', head: true }).eq('company_id', companyId).gte('check_date', periodStart);
  const { count: passedChecks } = await supabase.from('haccp_hygiene_records').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('result', 'PASS').gte('check_date', periodStart);
  const rate = totalChecks ? Math.round((passedChecks || 0) / totalChecks * 100) : 0;
  const score = Math.min(20, Math.round((rate / 100) * 20));
  const items: AuditItem[] = [{ requirement: '일일 위생 점검 실시', status: (totalChecks || 0) >= 30 ? 'COMPLIANT' : (totalChecks || 0) >= 15 ? 'PARTIAL' : 'NON_COMPLIANT', evidence: \`\${totalChecks}건 기록\`, notes: null }, { requirement: '위생 점검 합격률 90% 이상', status: rate >= 90 ? 'COMPLIANT' : rate >= 70 ? 'PARTIAL' : 'NON_COMPLIANT', evidence: \`합격률 \${rate}%\`, notes: null }];
  const recommendations: string[] = [];
  if ((totalChecks || 0) < 30) recommendations.push('위생 점검 빈도를 높여주세요.');
  if (rate < 90) recommendations.push('위생 점검 불합격 항목을 개선해주세요.');
  return { name: '선행요건 관리 (위생)', score, maxScore: 20, status: score >= 16 ? 'PASS' : score >= 10 ? 'WARNING' : 'FAIL', items, recommendations };
}

async function evaluateCCPSection(supabase: any, companyId: string, periodStart: string): Promise<AuditSection> {
  const { count: totalRecords } = await supabase.from('haccp_ccp_records').select('id', { count: 'exact', head: true }).eq('company_id', companyId).gte('recorded_at', periodStart);
  const { count: deviations } = await supabase.from('haccp_ccp_records').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('has_deviation', true).gte('recorded_at', periodStart);
  const deviationRate = totalRecords ? Math.round(((deviations || 0) / totalRecords) * 100) : 0;
  const score = Math.min(25, Math.round(((100 - deviationRate) / 100) * 25));
  const items: AuditItem[] = [{ requirement: 'CCP 모니터링 기록 유지', status: (totalRecords || 0) >= 50 ? 'COMPLIANT' : 'PARTIAL', evidence: \`\${totalRecords}건 기록\`, notes: null }, { requirement: 'CCP 이탈 5% 미만', status: deviationRate < 5 ? 'COMPLIANT' : deviationRate < 10 ? 'PARTIAL' : 'NON_COMPLIANT', evidence: \`이탈률 \${deviationRate}%\`, notes: null }];
  const recommendations: string[] = [];
  if (deviationRate >= 5) recommendations.push('CCP 이탈률을 낮추기 위한 개선 조치가 필요합니다.');
  return { name: 'CCP 모니터링', score, maxScore: 25, status: score >= 20 ? 'PASS' : score >= 12 ? 'WARNING' : 'FAIL', items, recommendations };
}

async function evaluateMaterialSection(supabase: any, companyId: string, periodStart: string): Promise<AuditSection> {
  const { data: materials } = await supabase.from('haccp_materials').select('id, current_stock, min_stock_level, expiry_date').eq('company_id', companyId).eq('is_active', true);
  const totalMaterials = materials?.length || 0;
  const lowStock = materials?.filter((m: any) => m.current_stock <= m.min_stock_level).length || 0;
  const expired = materials?.filter((m: any) => m.expiry_date && new Date(m.expiry_date) < new Date()).length || 0;
  const score = totalMaterials > 0 ? Math.min(15, Math.round(((totalMaterials - lowStock - expired) / totalMaterials) * 15)) : 15;
  const items: AuditItem[] = [{ requirement: '원자재 재고 관리', status: lowStock === 0 ? 'COMPLIANT' : lowStock <= 3 ? 'PARTIAL' : 'NON_COMPLIANT', evidence: \`재고 부족 \${lowStock}건\`, notes: null }, { requirement: '유통기한 관리', status: expired === 0 ? 'COMPLIANT' : 'NON_COMPLIANT', evidence: \`유통기한 초과 \${expired}건\`, notes: null }];
  const recommendations: string[] = [];
  if (lowStock > 0) recommendations.push(\`\${lowStock}개 원자재의 재고가 부족합니다. 발주가 필요합니다.\`);
  if (expired > 0) recommendations.push(\`\${expired}개 원자재의 유통기한이 초과되었습니다. 즉시 폐기 처리가 필요합니다.\`);
  return { name: '원료/자재 관리', score, maxScore: 15, status: score >= 12 ? 'PASS' : score >= 8 ? 'WARNING' : 'FAIL', items, recommendations };
}

async function evaluateReceivingSection(supabase: any, companyId: string, periodStart: string): Promise<AuditSection> {
  const { count: totalInspections } = await supabase.from('haccp_receiving_inspections').select('id', { count: 'exact', head: true }).eq('company_id', companyId).gte('inspection_date', periodStart);
  const { count: passedInspections } = await supabase.from('haccp_receiving_inspections').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('result', 'PASS').gte('inspection_date', periodStart);
  const rate = totalInspections ? Math.round((passedInspections || 0) / totalInspections * 100) : 0;
  const score = Math.min(10, Math.round((rate / 100) * 10));
  return { name: '입고 검수', score, maxScore: 10, status: score >= 8 ? 'PASS' : score >= 5 ? 'WARNING' : 'FAIL', items: [{ requirement: '입고 검수 실시', status: (totalInspections || 0) >= 10 ? 'COMPLIANT' : 'PARTIAL', evidence: \`\${totalInspections}건 기록\`, notes: null }], recommendations: [] };
}

async function evaluateProductionSection(supabase: any, companyId: string, periodStart: string): Promise<AuditSection> {
  const { count: totalProduction } = await supabase.from('haccp_production_records').select('id', { count: 'exact', head: true }).eq('company_id', companyId).gte('production_date', periodStart);
  const score = (totalProduction || 0) >= 30 ? 15 : Math.min(15, Math.round(((totalProduction || 0) / 30) * 15));
  return { name: '생산 기록', score, maxScore: 15, status: score >= 12 ? 'PASS' : score >= 8 ? 'WARNING' : 'FAIL', items: [{ requirement: '생산 기록 유지', status: (totalProduction || 0) >= 30 ? 'COMPLIANT' : 'PARTIAL', evidence: \`\${totalProduction}건 기록\`, notes: null }], recommendations: [] };
}

async function evaluateCorrectiveSection(supabase: any, companyId: string, periodStart: string): Promise<AuditSection> {
  const { count: totalActions } = await supabase.from('haccp_corrective_actions').select('id', { count: 'exact', head: true }).eq('company_id', companyId).gte('created_at', periodStart);
  const { count: completedActions } = await supabase.from('haccp_corrective_actions').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'COMPLETED').gte('created_at', periodStart);
  const rate = totalActions ? Math.round((completedActions || 0) / totalActions * 100) : 100;
  const score = Math.min(10, Math.round((rate / 100) * 10));
  const pendingActions = (totalActions || 0) - (completedActions || 0);
  const recommendations: string[] = [];
  if (pendingActions > 0) recommendations.push(\`\${pendingActions}건의 개선 조치가 미완료 상태입니다.\`);
  return { name: '개선 조치 관리', score, maxScore: 10, status: score >= 8 ? 'PASS' : score >= 5 ? 'WARNING' : 'FAIL', items: [{ requirement: '개선 조치 완료율', status: rate >= 90 ? 'COMPLIANT' : rate >= 70 ? 'PARTIAL' : 'NON_COMPLIANT', evidence: \`완료율 \${rate}%\`, notes: null }], recommendations };
}

async function evaluateTrainingSection(supabase: any, companyId: string, periodStart: string): Promise<AuditSection> {
  const { count: totalTraining } = await supabase.from('training_completions').select('id', { count: 'exact', head: true }).eq('company_id', companyId).gte('completed_at', periodStart);
  const score = (totalTraining || 0) >= 10 ? 5 : Math.min(5, Math.round(((totalTraining || 0) / 10) * 5));
  return { name: '교육/훈련', score, maxScore: 5, status: score >= 4 ? 'PASS' : score >= 2 ? 'WARNING' : 'FAIL', items: [{ requirement: '직원 교육 실시', status: (totalTraining || 0) >= 10 ? 'COMPLIANT' : 'PARTIAL', evidence: \`\${totalTraining}건 완료\`, notes: null }], recommendations: (totalTraining || 0) < 10 ? ['직원 교육을 더 실시해주세요.'] : [] };
}

export const dynamic = 'force-dynamic';
