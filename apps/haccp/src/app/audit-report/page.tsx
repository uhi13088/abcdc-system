'use client';

import { useState, useEffect } from 'react';
import { FileText, Download, Calendar, CheckCircle, AlertCircle, Clock, Plus } from 'lucide-react';
import { Label } from '@/components/ui/label';

interface AuditReport {
  id: string;
  report_date: string;
  report_type: 'INTERNAL' | 'EXTERNAL' | 'CERTIFICATION';
  auditor_name: string;
  auditor_company?: string;
  summary: string;
  findings: Array<{
    category: string;
    finding: string;
    severity: 'MINOR' | 'MAJOR' | 'CRITICAL';
    status: 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
  }>;
  overall_score?: number;
  status: 'DRAFT' | 'FINAL';
  created_at: string;
}

export default function AuditReportPage() {
  const [reports, setReports] = useState<AuditReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    report_type: 'INTERNAL' as 'INTERNAL' | 'EXTERNAL' | 'CERTIFICATION',
    auditor_name: '',
    auditor_company: '',
    summary: '',
    overall_score: 0,
  });

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    // Simulated data - would connect to API in production
    setTimeout(() => {
      setReports([
        {
          id: '1',
          report_date: '2024-01-15',
          report_type: 'INTERNAL',
          auditor_name: '김철수',
          summary: '2024년 1월 내부 HACCP 감사 결과 전반적으로 양호함',
          findings: [
            { category: 'CCP 관리', finding: 'CCP-1 온도 기록 누락 2건', severity: 'MINOR', status: 'CLOSED' },
            { category: '일반위생', finding: '손세척대 소독제 보충 필요', severity: 'MINOR', status: 'CLOSED' },
          ],
          overall_score: 92,
          status: 'FINAL',
          created_at: '2024-01-15T10:00:00Z',
        },
        {
          id: '2',
          report_date: '2024-02-20',
          report_type: 'EXTERNAL',
          auditor_name: '박영희',
          auditor_company: '한국식품안전인증원',
          summary: '2024년 HACCP 갱신 심사',
          findings: [
            { category: '문서관리', finding: 'HACCP 계획서 개정 이력 관리 미흡', severity: 'MAJOR', status: 'IN_PROGRESS' },
          ],
          overall_score: 88,
          status: 'FINAL',
          created_at: '2024-02-20T14:00:00Z',
        },
      ]);
      setLoading(false);
    }, 500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newReport: AuditReport = {
      id: Date.now().toString(),
      report_date: new Date().toISOString().split('T')[0],
      report_type: formData.report_type,
      auditor_name: formData.auditor_name,
      auditor_company: formData.auditor_company || undefined,
      summary: formData.summary,
      findings: [],
      overall_score: formData.overall_score || undefined,
      status: 'DRAFT',
      created_at: new Date().toISOString(),
    };
    setReports([newReport, ...reports]);
    setShowModal(false);
    setFormData({
      report_type: 'INTERNAL',
      auditor_name: '',
      auditor_company: '',
      summary: '',
      overall_score: 0,
    });
  };

  const reportTypeColors = {
    'INTERNAL': 'bg-blue-100 text-blue-700',
    'EXTERNAL': 'bg-purple-100 text-purple-700',
    'CERTIFICATION': 'bg-green-100 text-green-700',
  };

  const reportTypeText = {
    'INTERNAL': '내부감사',
    'EXTERNAL': '외부감사',
    'CERTIFICATION': '인증심사',
  };

  const severityColors = {
    'MINOR': 'bg-yellow-100 text-yellow-700',
    'MAJOR': 'bg-orange-100 text-orange-700',
    'CRITICAL': 'bg-red-100 text-red-700',
  };

  const statusIcons = {
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
          onClick={() => setShowModal(true)}
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
            {reports.reduce((acc, r) => acc + r.findings.filter(f => f.status !== 'CLOSED').length, 0)}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <p className="text-sm text-gray-500">평균 점수</p>
          <p className="text-2xl font-bold text-green-600">
            {reports.length > 0
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
                    {report.status === 'FINAL' ? '완료' : '작성중'}
                  </span>
                </div>
              </div>

              <div className="p-4">
                <p className="text-sm text-gray-700 mb-4">{report.summary}</p>

                {report.findings.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">발견 사항</h4>
                    <div className="space-y-2">
                      {report.findings.map((finding, idx) => (
                        <div key={idx} className="flex items-center gap-3 text-sm bg-gray-50 rounded p-2">
                          {statusIcons[finding.status]}
                          <span className={`px-2 py-0.5 text-xs rounded ${severityColors[finding.severity]}`}>
                            {finding.severity}
                          </span>
                          <span className="text-gray-500">[{finding.category}]</span>
                          <span className="text-gray-700">{finding.finding}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 px-4 py-3 border-t bg-gray-50">
                <button className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded">
                  수정
                </button>
                <button className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded flex items-center gap-1">
                  <Download className="w-4 h-4" />
                  PDF 다운로드
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">감사 보고서 작성</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                닫기
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">감사 유형</label>
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">감사자명</label>
                  <input
                    type="text"
                    value={formData.auditor_name}
                    onChange={(e) => setFormData({ ...formData, auditor_name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">소속기관</label>
                  <input
                    type="text"
                    value={formData.auditor_company}
                    onChange={(e) => setFormData({ ...formData, auditor_company: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">요약</label>
                <textarea
                  value={formData.summary}
                  onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={3}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">종합 점수 (선택)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.overall_score || ''}
                  onChange={(e) => setFormData({ ...formData, overall_score: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">
                  취소
                </button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
