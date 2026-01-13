'use client';

import { useState, useEffect } from 'react';
import { Plus, Calendar, Bug, AlertTriangle, CheckCircle } from 'lucide-react';

interface PestControlCheck {
  id: string;
  check_date: string;
  check_type: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'EXTERNAL';
  checked_by_name?: string;
  trap_checks: Array<{
    location: string;
    trap_type: string;
    catch_count: number;
    condition: string;
  }>;
  findings: string;
  corrective_action: string;
  external_company?: string;
  overall_status: 'NORMAL' | 'ATTENTION' | 'CRITICAL';
}

export default function PestControlPage() {
  const [checks, setChecks] = useState<PestControlCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [formData, setFormData] = useState<{
    check_type: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'EXTERNAL';
    trap_checks: Array<{ location: string; trap_type: string; catch_count: number; condition: string }>;
    findings: string;
    corrective_action: string;
    external_company: string;
  }>({
    check_type: 'DAILY',
    trap_checks: [
      { location: '원료창고', trap_type: '페로몬트랩', catch_count: 0, condition: '양호' },
      { location: '생산장', trap_type: '전격살충기', catch_count: 0, condition: '양호' },
      { location: '출하장', trap_type: '끈끈이트랩', catch_count: 0, condition: '양호' },
    ],
    findings: '',
    corrective_action: '',
    external_company: '',
  });

  useEffect(() => {
    fetchChecks();
  }, [selectedDate]);

  const fetchChecks = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/haccp/pest-control?date=${selectedDate}`);
      if (response.ok) {
        const data = await response.json();
        setChecks(data);
      }
    } catch (error) {
      console.error('Failed to fetch pest control checks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const totalCatch = formData.trap_checks.reduce((sum, t) => sum + t.catch_count, 0);
    const overall_status = totalCatch >= 10 ? 'CRITICAL' : totalCatch >= 5 ? 'ATTENTION' : 'NORMAL';

    try {
      const response = await fetch('/api/haccp/pest-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          check_date: selectedDate,
          ...formData,
          overall_status,
        }),
      });

      if (response.ok) {
        setShowModal(false);
        fetchChecks();
      }
    } catch (error) {
      console.error('Failed to create pest control check:', error);
    }
  };

  const updateTrapCheck = (index: number, field: string, value: any) => {
    const newTrapChecks = [...formData.trap_checks];
    newTrapChecks[index] = { ...newTrapChecks[index], [field]: value };
    setFormData({ ...formData, trap_checks: newTrapChecks });
  };

  const checkTypeColors = {
    'DAILY': 'bg-blue-100 text-blue-700',
    'WEEKLY': 'bg-green-100 text-green-700',
    'MONTHLY': 'bg-purple-100 text-purple-700',
    'EXTERNAL': 'bg-orange-100 text-orange-700',
  };

  const checkTypeText = {
    'DAILY': '일일',
    'WEEKLY': '주간',
    'MONTHLY': '월간',
    'EXTERNAL': '외부업체',
  };

  const statusColors = {
    'NORMAL': 'bg-green-100 text-green-700 border-green-200',
    'ATTENTION': 'bg-yellow-100 text-yellow-700 border-yellow-200',
    'CRITICAL': 'bg-red-100 text-red-700 border-red-200',
  };

  const statusText = {
    'NORMAL': '정상',
    'ATTENTION': '주의',
    'CRITICAL': '위험',
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">방충방서 관리</h1>
          <p className="mt-1 text-sm text-gray-500">방충방서 점검 기록을 관리합니다</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          점검 기록
        </button>
      </div>

      {/* Date Selector */}
      <div className="mb-6 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-gray-400" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border rounded-lg"
          />
        </div>
      </div>

      {/* Checks */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : checks.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <Bug className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">해당 날짜의 점검 기록이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-4">
          {checks.map((check) => (
            <div key={check.id} className={`bg-white rounded-xl shadow-sm border overflow-hidden ${
              check.overall_status === 'CRITICAL' ? 'border-red-300' :
              check.overall_status === 'ATTENTION' ? 'border-yellow-300' : ''
            }`}>
              <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 text-xs rounded-full ${checkTypeColors[check.check_type]}`}>
                    {checkTypeText[check.check_type]}
                  </span>
                  {check.external_company && (
                    <span className="text-sm text-gray-500">{check.external_company}</span>
                  )}
                </div>
                <span className={`px-3 py-1 text-sm rounded-full border ${statusColors[check.overall_status]}`}>
                  {check.overall_status === 'NORMAL' && <CheckCircle className="w-4 h-4 inline mr-1" />}
                  {check.overall_status !== 'NORMAL' && <AlertTriangle className="w-4 h-4 inline mr-1" />}
                  {statusText[check.overall_status]}
                </span>
              </div>

              <div className="p-4">
                {check.trap_checks && check.trap_checks.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">포획기 점검</h4>
                    <div className="grid grid-cols-3 gap-3">
                      {check.trap_checks.map((trap, idx) => (
                        <div key={idx} className="bg-gray-50 rounded-lg p-3">
                          <p className="font-medium text-sm">{trap.location}</p>
                          <p className="text-xs text-gray-500">{trap.trap_type}</p>
                          <div className="flex items-center justify-between mt-2">
                            <span className={`text-lg font-bold ${
                              trap.catch_count >= 5 ? 'text-red-600' :
                              trap.catch_count >= 2 ? 'text-yellow-600' : 'text-green-600'
                            }`}>
                              {trap.catch_count}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              trap.condition === '양호' ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'
                            }`}>
                              {trap.condition}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {check.findings && (
                  <div className="mb-3">
                    <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">발견사항</h4>
                    <p className="text-sm text-gray-700">{check.findings}</p>
                  </div>
                )}

                {check.corrective_action && (
                  <div className="bg-yellow-50 rounded-lg p-3">
                    <h4 className="text-xs font-medium text-yellow-800 uppercase mb-1">개선조치</h4>
                    <p className="text-sm text-yellow-700">{check.corrective_action}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">방충방서 점검 기록</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                닫기
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">점검 유형</label>
                  <select
                    value={formData.check_type}
                    onChange={(e) => setFormData({ ...formData, check_type: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="DAILY">일일 점검</option>
                    <option value="WEEKLY">주간 점검</option>
                    <option value="MONTHLY">월간 점검</option>
                    <option value="EXTERNAL">외부업체 점검</option>
                  </select>
                </div>
                {formData.check_type === 'EXTERNAL' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">외부업체명</label>
                    <input
                      type="text"
                      value={formData.external_company}
                      onChange={(e) => setFormData({ ...formData, external_company: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                )}
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">포획기 점검</h4>
                <div className="space-y-3">
                  {formData.trap_checks.map((trap, idx) => (
                    <div key={idx} className="grid grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">위치</label>
                        <input
                          type="text"
                          value={trap.location}
                          onChange={(e) => updateTrapCheck(idx, 'location', e.target.value)}
                          className="w-full px-2 py-1.5 border rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">종류</label>
                        <input
                          type="text"
                          value={trap.trap_type}
                          onChange={(e) => updateTrapCheck(idx, 'trap_type', e.target.value)}
                          className="w-full px-2 py-1.5 border rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">포획수</label>
                        <input
                          type="number"
                          value={trap.catch_count}
                          onChange={(e) => updateTrapCheck(idx, 'catch_count', parseInt(e.target.value))}
                          className="w-full px-2 py-1.5 border rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">상태</label>
                        <select
                          value={trap.condition}
                          onChange={(e) => updateTrapCheck(idx, 'condition', e.target.value)}
                          className="w-full px-2 py-1.5 border rounded text-sm"
                        >
                          <option value="양호">양호</option>
                          <option value="교체필요">교체필요</option>
                          <option value="파손">파손</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">발견사항</label>
                <textarea
                  value={formData.findings}
                  onChange={(e) => setFormData({ ...formData, findings: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">개선조치</label>
                <textarea
                  value={formData.corrective_action}
                  onChange={(e) => setFormData({ ...formData, corrective_action: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
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
