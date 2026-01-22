'use client';

import { useState, useEffect } from 'react';
import { FileText, Download, Calendar, CheckCircle, AlertCircle, Clock, Plus, X, Edit2 } from 'lucide-react';
import { Label } from '@/components/ui/label';

interface Finding {
  category: string;
  finding: string;
  severity: 'MINOR' | 'MAJOR' | 'CRITICAL';
  status: 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
  corrective_action?: string;
  due_date?: string;
  closed_date?: string;
}

interface AuditReport {
  id: string;
  report_date: string;
  report_type: 'INTERNAL' | 'EXTERNAL' | 'CERTIFICATION';
  auditor_name: string;
  auditor_company?: string;
  auditor_contact?: string;
  audit_scope?: string;
  audit_criteria?: string;
  summary: string;
  findings: Finding[];
  overall_score?: number;
  effectiveness_rating?: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
  recommendations?: string;
  next_audit_date?: string;
  status: 'DRAFT' | 'FINAL' | 'ARCHIVED';
  created_by_name?: string;
  approved_by_name?: string;
  created_at: string;
}

export default function AuditReportPage() {
  const [reports, setReports] = useState<AuditReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showFindingModal, setShowFindingModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<AuditReport | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    report_type: 'INTERNAL' as AuditReport['report_type'],
    report_date: new Date().toISOString().split('T')[0],
    auditor_name: '',
    auditor_company: '',
    auditor_contact: '',
    audit_scope: '',
    audit_criteria: '',
    summary: '',
    overall_score: 0,
    effectiveness_rating: '' as AuditReport['effectiveness_rating'] | '',
    recommendations: '',
    next_audit_date: '',
  });
  const [findingForm, setFindingForm] = useState<Finding>({
    category: '',
    finding: '',
    severity: 'MINOR',
    status: 'OPEN',
    corrective_action: '',
    due_date: '',
  });

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/haccp/audit-reports');
      if (response.ok) {
        const data = await response.json();
        setReports(data);
      }
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editMode ? 'PUT' : 'POST';
      const body = editMode
        ? { id: selectedReport?.id, ...formData, findings: selectedReport?.findings || [] }
        : { ...formData, findings: [] };

      const response = await fetch('/api/haccp/audit-reports', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        setShowModal(false);
        fetchReports();
        resetForm();
      }
    } catch (error) {
      console.error('Failed to save report:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      report_type: 'INTERNAL',
      report_date: new Date().toISOString().split('T')[0],
      auditor_name: '',
      auditor_company: '',
      auditor_contact: '',
      audit_scope: '',
      audit_criteria: '',
      summary: '',
      overall_score: 0,
      effectiveness_rating: '',
      recommendations: '',
      next_audit_date: '',
    });
    setEditMode(false);
    setSelectedReport(null);
  };

  const handleEdit = (report: AuditReport) => {
    setSelectedReport(report);
    setFormData({
      report_type: report.report_type,
      report_date: report.report_date,
      auditor_name: report.auditor_name,
      auditor_company: report.auditor_company || '',
      auditor_contact: report.auditor_contact || '',
      audit_scope: report.audit_scope || '',
      audit_criteria: report.audit_criteria || '',
      summary: report.summary,
      overall_score: report.overall_score || 0,
      effectiveness_rating: report.effectiveness_rating || '',
      recommendations: report.recommendations || '',
      next_audit_date: report.next_audit_date || '',
    });
    setEditMode(true);
    setShowModal(true);
  };

  const handleAddFinding = async () => {
    if (!selectedReport || !findingForm.finding) return;

    const updatedFindings = [...(selectedReport.findings || []), findingForm];

    try {
      const response = await fetch('/api/haccp/audit-reports', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedReport.id, findings: updatedFindings }),
      });

      if (response.ok) {
        fetchReports();
        setFindingForm({
          category: '',
          finding: '',
          severity: 'MINOR',
          status: 'OPEN',
          corrective_action: '',
          due_date: '',
        });
        setSelectedReport({ ...selectedReport, findings: updatedFindings });
      }
    } catch (error) {
      console.error('Failed to add finding:', error);
    }
  };

  const handleUpdateFindingStatus = async (findingIndex: number, newStatus: Finding['status']) => {
    if (!selectedReport) return;

    const updatedFindings = selectedReport.findings.map((f, i) =>
      i === findingIndex
        ? { ...f, status: newStatus, closed_date: newStatus === 'CLOSED' ? new Date().toISOString().split('T')[0] : undefined }
        : f
    );

    try {
      const response = await fetch('/api/haccp/audit-reports', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedReport.id, findings: updatedFindings }),
      });

      if (response.ok) {
        fetchReports();
        setSelectedReport({ ...selectedReport, findings: updatedFindings });
      }
    } catch (error) {
      console.error('Failed to update finding:', error);
    }
  };

  const handleFinalize = async (report: AuditReport) => {
    try {
      const response = await fetch('/api/haccp/audit-reports', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: report.id, approved: true }),
      });

      if (response.ok) {
        fetchReports();
      }
    } catch (error) {
      console.error('Failed to finalize report:', error);
    }
  };

  const handlePrint = (report: AuditReport) => {
    const severityText: Record<string, string> = {
      'MINOR': '경미',
      'MAJOR': '중대',
      'CRITICAL': '치명적',
    };
    const statusText: Record<string, string> = {
      'OPEN': '미결',
      'IN_PROGRESS': '진행중',
      'CLOSED': '완료',
    };
    const reportTypeText: Record<string, string> = {
      'INTERNAL': '내부감사',
      'EXTERNAL': '외부감사',
      'CERTIFICATION': '인증심사',
    };

    const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>HACCP 감사 보고서 - ${report.report_date}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body {
            font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif;
            padding: 20px;
            font-size: 12px;
            line-height: 1.6;
          }
          h1 { text-align: center; margin-bottom: 20px; font-size: 22px; }
          .header { text-align: center; margin-bottom: 20px; color: #666; }
          .info-box { background: #f5f5f5; padding: 16px; border-radius: 8px; margin-bottom: 20px; }
          .info-row { display: flex; margin-bottom: 8px; }
          .info-label { font-weight: 600; width: 100px; }
          .score-box { text-align: center; padding: 20px; margin-bottom: 20px; }
          .score { font-size: 48px; font-weight: bold; color: ${report.overall_score && report.overall_score >= 90 ? '#16a34a' : report.overall_score && report.overall_score >= 70 ? '#ca8a04' : '#dc2626'}; }
          .section-title { font-size: 14px; font-weight: bold; margin: 20px 0 10px 0; padding-bottom: 8px; border-bottom: 2px solid #333; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
          th { background-color: #f5f5f5; font-weight: 600; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; }
          .minor { background: #fef3c7; color: #92400e; }
          .major { background: #ffedd5; color: #9a3412; }
          .critical { background: #fee2e2; color: #991b1b; }
          .open { color: #dc2626; }
          .in-progress { color: #ca8a04; }
          .closed { color: #16a34a; }
          .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #999; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <h1>HACCP 감사 보고서</h1>
        <p class="header">${reportTypeText[report.report_type]} | ${report.report_date}</p>

        <div class="info-box">
          <div class="info-row">
            <span class="info-label">감사 유형</span>
            <span>${reportTypeText[report.report_type]}</span>
          </div>
          <div class="info-row">
            <span class="info-label">감사일</span>
            <span>${report.report_date}</span>
          </div>
          <div class="info-row">
            <span class="info-label">감사자</span>
            <span>${report.auditor_name}${report.auditor_company ? ` (${report.auditor_company})` : ''}</span>
          </div>
          <div class="info-row">
            <span class="info-label">상태</span>
            <span>${report.status === 'FINAL' ? '완료' : report.status === 'DRAFT' ? '작성중' : '보관'}</span>
          </div>
        </div>

        ${report.overall_score ? `
        <div class="score-box">
          <div class="score">${report.overall_score}</div>
          <div style="color: #666;">종합 점수</div>
        </div>
        ` : ''}

        <div class="section-title">감사 요약</div>
        <p style="margin-bottom: 20px;">${report.summary}</p>

        ${report.findings.length > 0 ? `
        <div class="section-title">발견 사항 (${report.findings.length}건)</div>
        <table>
          <thead>
            <tr>
              <th style="width: 15%;">분류</th>
              <th style="width: 45%;">내용</th>
              <th style="width: 20%;">심각도</th>
              <th style="width: 20%;">상태</th>
            </tr>
          </thead>
          <tbody>
            ${report.findings.map(f => `
              <tr>
                <td>${f.category}</td>
                <td>${f.finding}</td>
                <td><span class="badge ${f.severity.toLowerCase()}">${severityText[f.severity]}</span></td>
                <td class="${f.status.toLowerCase().replace('_', '-')}">${statusText[f.status]}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ` : '<p>발견 사항 없음</p>'}

        ${report.recommendations ? `
        <div class="section-title">권고 사항</div>
        <p>${report.recommendations}</p>
        ` : ''}

        <div class="footer">
          본 보고서는 HACCP 시스템에서 자동 생성되었습니다.<br/>
          생성일: ${new Date().toLocaleDateString('ko-KR')}
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(content);
      printWindow.document.close();
      printWindow.print();
    } else {
      alert('팝업이 차단되었습니다. 팝업을 허용해주세요.');
    }
  };

  const reportTypeColors: Record<string, string> = {
    'INTERNAL': 'bg-blue-100 text-blue-700',
    'EXTERNAL': 'bg-purple-100 text-purple-700',
    'CERTIFICATION': 'bg-green-100 text-green-700',
  };

  const reportTypeText: Record<string, string> = {
    'INTERNAL': '내부감사',
    'EXTERNAL': '외부감사',
    'CERTIFICATION': '인증심사',
  };

  const severityColors: Record<string, string> = {
    'MINOR': 'bg-yellow-100 text-yellow-700',
    'MAJOR': 'bg-orange-100 text-orange-700',
    'CRITICAL': 'bg-red-100 text-red-700',
  };

  const statusIcons: Record<string, JSX.Element> = {
    'OPEN': <AlertCircle className="w-4 h-4 text-red-500" />,
    'IN_PROGRESS': <Clock className="w-4 h-4 text-yellow-500" />,
    'CLOSED': <CheckCircle className="w-4 h-4 text-green-500" />,
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">감사 보고서</h1>
          <p className="mt-1 text-sm text-gray-500">HACCP 내부/외부 감사 보고서를 관리합니다</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          감사 보고서 작성
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <p className="text-sm text-gray-500">전체 감사</p>
          <p className="text-2xl font-bold">{reports.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <p className="text-sm text-gray-500">내부 감사</p>
          <p className="text-2xl font-bold">{reports.filter(r => r.report_type === 'INTERNAL').length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <p className="text-sm text-gray-500">미결 사항</p>
          <p className="text-2xl font-bold text-orange-600">
            {reports.reduce((acc, r) => acc + (r.findings || []).filter(f => f.status !== 'CLOSED').length, 0)}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <p className="text-sm text-gray-500">평균 점수</p>
          <p className="text-2xl font-bold text-green-600">
            {reports.filter(r => r.overall_score).length > 0
              ? Math.round(reports.reduce((acc, r) => acc + (r.overall_score || 0), 0) / reports.filter(r => r.overall_score).length)
              : '-'
            }
          </p>
        </div>
      </div>

      {/* Reports List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : reports.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">등록된 감사 보고서가 없습니다</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <div key={report.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 text-xs rounded-full ${reportTypeColors[report.report_type]}`}>
                    {reportTypeText[report.report_type]}
                  </span>
                  <span className="text-sm text-gray-600">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    {report.report_date}
                  </span>
                  <span className="text-sm text-gray-500">
                    감사자: {report.auditor_name}
                    {report.auditor_company && ` (${report.auditor_company})`}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {report.overall_score && (
                    <span className={`text-lg font-bold ${
                      report.overall_score >= 90 ? 'text-green-600' :
                      report.overall_score >= 70 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {report.overall_score}점
                    </span>
                  )}
                  <span className={`px-2 py-1 text-xs rounded ${
                    report.status === 'FINAL' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {report.status === 'FINAL' ? '완료' : report.status === 'DRAFT' ? '작성중' : '보관'}
                  </span>
                </div>
              </div>

              <div className="p-4">
                <p className="text-sm text-gray-700 mb-4">{report.summary}</p>

                {(report.findings || []).length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">발견 사항</h4>
                    <div className="space-y-2">
                      {(report.findings || []).map((finding, idx) => (
                        <div key={idx} className="flex items-center gap-3 text-sm bg-gray-50 rounded p-2">
                          {statusIcons[finding.status]}
                          <span className={`px-2 py-0.5 text-xs rounded ${severityColors[finding.severity]}`}>
                            {finding.severity === 'MINOR' ? '경미' : finding.severity === 'MAJOR' ? '중대' : '치명적'}
                          </span>
                          <span className="text-gray-500">[{finding.category}]</span>
                          <span className="text-gray-700">{finding.finding}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center px-4 py-3 border-t bg-gray-50">
                <div className="flex gap-2">
                  {report.status === 'DRAFT' && (
                    <button
                      onClick={() => handleFinalize(report)}
                      className="px-3 py-1.5 text-sm text-green-600 hover:bg-green-50 rounded"
                    >
                      완료 처리
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(report)}
                    className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded flex items-center gap-1"
                  >
                    <Edit2 className="w-4 h-4" />
                    수정
                  </button>
                  <button
                    onClick={() => {
                      setSelectedReport(report);
                      setShowFindingModal(true);
                    }}
                    className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded"
                  >
                    발견사항 관리
                  </button>
                  <button
                    onClick={() => handlePrint(report)}
                    className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded flex items-center gap-1"
                  >
                    <Download className="w-4 h-4" />
                    PDF 다운로드
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Report Form Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">{editMode ? '감사 보고서 수정' : '감사 보고서 작성'}</h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>감사 유형</Label>
                  <select
                    value={formData.report_type}
                    onChange={(e) => setFormData({ ...formData, report_type: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="INTERNAL">내부 감사</option>
                    <option value="EXTERNAL">외부 감사</option>
                    <option value="CERTIFICATION">인증 심사</option>
                  </select>
                </div>
                <div>
                  <Label required>감사일</Label>
                  <input
                    type="date"
                    value={formData.report_date}
                    onChange={(e) => setFormData({ ...formData, report_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label required>감사자명</Label>
                  <input
                    type="text"
                    value={formData.auditor_name}
                    onChange={(e) => setFormData({ ...formData, auditor_name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <Label>소속기관</Label>
                  <input
                    type="text"
                    value={formData.auditor_company}
                    onChange={(e) => setFormData({ ...formData, auditor_company: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div>
                <Label>감사 범위</Label>
                <input
                  type="text"
                  value={formData.audit_scope}
                  onChange={(e) => setFormData({ ...formData, audit_scope: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="예: HACCP 전반, CCP 관리, 위생관리 등"
                />
              </div>

              <div>
                <Label required>요약</Label>
                <textarea
                  value={formData.summary}
                  onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={3}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>종합 점수 (0-100)</Label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.overall_score || ''}
                    onChange={(e) => setFormData({ ...formData, overall_score: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <Label>효과성 평가</Label>
                  <select
                    value={formData.effectiveness_rating}
                    onChange={(e) => setFormData({ ...formData, effectiveness_rating: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="">선택</option>
                    <option value="EXCELLENT">우수</option>
                    <option value="GOOD">양호</option>
                    <option value="FAIR">보통</option>
                    <option value="POOR">미흡</option>
                  </select>
                </div>
              </div>

              <div>
                <Label>권고 사항</Label>
                <textarea
                  value={formData.recommendations}
                  onChange={(e) => setFormData({ ...formData, recommendations: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                />
              </div>

              <div>
                <Label>다음 감사 예정일</Label>
                <input
                  type="date"
                  value={formData.next_audit_date}
                  onChange={(e) => setFormData({ ...formData, next_audit_date: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">
                  취소
                </button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  {editMode ? '수정' : '저장'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Finding Management Modal */}
      {showFindingModal && selectedReport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">발견사항 관리</h2>
              <button onClick={() => setShowFindingModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-4">{selectedReport.summary}</p>

            {/* Add Finding Form */}
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <h3 className="text-sm font-medium mb-3">발견사항 추가</h3>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <input
                  type="text"
                  placeholder="분류 (예: CCP 관리)"
                  value={findingForm.category}
                  onChange={(e) => setFindingForm({ ...findingForm, category: e.target.value })}
                  className="px-3 py-2 border rounded-lg text-sm"
                />
                <select
                  value={findingForm.severity}
                  onChange={(e) => setFindingForm({ ...findingForm, severity: e.target.value as any })}
                  className="px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="MINOR">경미</option>
                  <option value="MAJOR">중대</option>
                  <option value="CRITICAL">치명적</option>
                </select>
              </div>
              <textarea
                placeholder="발견사항 내용"
                value={findingForm.finding}
                onChange={(e) => setFindingForm({ ...findingForm, finding: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm mb-2"
                rows={2}
              />
              <div className="grid grid-cols-2 gap-2 mb-2">
                <input
                  type="text"
                  placeholder="시정조치"
                  value={findingForm.corrective_action}
                  onChange={(e) => setFindingForm({ ...findingForm, corrective_action: e.target.value })}
                  className="px-3 py-2 border rounded-lg text-sm"
                />
                <input
                  type="date"
                  placeholder="완료기한"
                  value={findingForm.due_date}
                  onChange={(e) => setFindingForm({ ...findingForm, due_date: e.target.value })}
                  className="px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <button
                onClick={handleAddFinding}
                disabled={!findingForm.finding || !findingForm.category}
                className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                추가
              </button>
            </div>

            {/* Finding List */}
            <div className="space-y-2">
              {(selectedReport.findings || []).length === 0 ? (
                <p className="text-gray-500 text-center py-4">등록된 발견사항이 없습니다</p>
              ) : (
                (selectedReport.findings || []).map((finding, idx) => (
                  <div
                    key={idx}
                    className="p-3 border rounded-lg"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {statusIcons[finding.status]}
                        <span className={`px-2 py-0.5 text-xs rounded ${severityColors[finding.severity]}`}>
                          {finding.severity === 'MINOR' ? '경미' : finding.severity === 'MAJOR' ? '중대' : '치명적'}
                        </span>
                        <span className="text-sm text-gray-500">[{finding.category}]</span>
                      </div>
                      <select
                        value={finding.status}
                        onChange={(e) => handleUpdateFindingStatus(idx, e.target.value as Finding['status'])}
                        className="text-sm border rounded px-2 py-1"
                      >
                        <option value="OPEN">미결</option>
                        <option value="IN_PROGRESS">진행중</option>
                        <option value="CLOSED">완료</option>
                      </select>
                    </div>
                    <p className="text-sm text-gray-700">{finding.finding}</p>
                    {finding.corrective_action && (
                      <p className="text-sm text-gray-500 mt-1">시정조치: {finding.corrective_action}</p>
                    )}
                    {finding.due_date && (
                      <p className="text-xs text-gray-400 mt-1">완료기한: {finding.due_date}</p>
                    )}
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => setShowFindingModal(false)}
              className="w-full mt-4 px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
