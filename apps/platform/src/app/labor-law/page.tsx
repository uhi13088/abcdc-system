'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { DEFAULT_MINIMUM_WAGE, INSURANCE_RATES, ALLOWANCE_RATES } from '@abc/shared';
import { Label } from '@/components/ui/label';

interface LaborLawVersion {
  id: string;
  version: string;
  effectiveDate: string;
  minimumWageHourly: number;
  overtimeRate: number;
  nightRate: number;
  holidayRate: number;
  nationalPensionRate: number;
  healthInsuranceRate: number;
  longTermCareRate: number;
  employmentInsuranceRate: number;
  status: 'DRAFT' | 'VERIFIED' | 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
}

export default function LaborLawPage() {
  const [versions, setVersions] = useState<LaborLawVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingVersion, setEditingVersion] = useState<LaborLawVersion | null>(null);
  const [formData, setFormData] = useState({
    version: '',
    effectiveDate: '',
    minimumWageHourly: DEFAULT_MINIMUM_WAGE,
    overtimeRate: ALLOWANCE_RATES.overtime,
    nightRate: ALLOWANCE_RATES.night,
    holidayRate: ALLOWANCE_RATES.holiday,
    nationalPensionRate: INSURANCE_RATES.nationalPension * 100, // %로 표시
    healthInsuranceRate: INSURANCE_RATES.healthInsurance * 100,
    longTermCareRate: INSURANCE_RATES.longTermCare * 100,
    employmentInsuranceRate: INSURANCE_RATES.employmentInsurance * 100,
  });

  useEffect(() => {
    fetchVersions();
  }, []);

  const fetchVersions = async () => {
    try {
      const response = await fetch('/api/labor-law');
      if (response.ok) {
        const data = await response.json();
        setVersions(data.map((v: any) => ({
          id: v.id,
          version: v.version,
          effectiveDate: v.effective_date,
          minimumWageHourly: v.minimum_wage_hourly,
          overtimeRate: v.overtime_rate,
          nightRate: v.night_rate,
          holidayRate: v.holiday_rate,
          nationalPensionRate: v.national_pension_rate,
          healthInsuranceRate: v.health_insurance_rate,
          longTermCareRate: v.long_term_care_rate,
          employmentInsuranceRate: v.employment_insurance_rate,
          status: v.status,
          createdAt: v.created_at,
        })));
      }
    } catch (error) {
      console.error('Failed to fetch labor law versions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: LaborLawVersion['status']) => {
    const config = {
      DRAFT: { color: 'bg-gray-100 text-gray-700', icon: Edit2, label: '초안' },
      VERIFIED: { color: 'bg-blue-100 text-blue-700', icon: Clock, label: '검증됨' },
      ACTIVE: { color: 'bg-green-100 text-green-700', icon: CheckCircle, label: '적용 중' },
      ARCHIVED: { color: 'bg-orange-100 text-orange-700', icon: AlertCircle, label: '만료' },
    };
    const { color, icon: Icon, label } = config[status];
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${color}`}>
        <Icon className="w-3 h-3" />
        {label}
      </span>
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingVersion ? `/api/labor-law/${editingVersion.id}` : '/api/labor-law';
      const method = editingVersion ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setIsCreateOpen(false);
        setEditingVersion(null);
        fetchVersions();
      } else {
        alert('저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to save:', error);
      alert('저장에 실패했습니다.');
    }
  };

  const handleActivate = async (id: string) => {
    if (!confirm('이 버전을 활성화하시겠습니까? 현재 활성 버전은 만료됩니다.')) return;
    try {
      // Archive current active version
      const currentActive = versions.find(v => v.status === 'ACTIVE');
      if (currentActive) {
        await fetch(`/api/labor-law/${currentActive.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...currentActive, status: 'ARCHIVED' }),
        });
      }

      // Activate selected version
      const toActivate = versions.find(v => v.id === id);
      if (toActivate) {
        await fetch(`/api/labor-law/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...toActivate, status: 'ACTIVE' }),
        });
      }

      fetchVersions();
    } catch (error) {
      console.error('Failed to activate:', error);
      alert('활성화에 실패했습니다.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 버전을 삭제하시겠습니까?')) return;
    try {
      const response = await fetch(`/api/labor-law/${id}`, { method: 'DELETE' });
      if (response.ok) {
        fetchVersions();
      } else {
        alert('삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to delete:', error);
      alert('삭제에 실패했습니다.');
    }
  };

  const activeVersion = versions.find(v => v.status === 'ACTIVE');
  const pendingVersions = versions.filter(v => v.status === 'VERIFIED' || v.status === 'DRAFT');
  const archivedVersions = versions.filter(v => v.status === 'ARCHIVED');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">근로기준법 관리</h1>
          <p className="text-gray-600 mt-1">최저임금 및 4대보험 요율을 관리합니다</p>
        </div>
        <button
          onClick={() => {
            setEditingVersion(null);
            setFormData({
              version: '',
              effectiveDate: '',
              minimumWageHourly: DEFAULT_MINIMUM_WAGE,
              overtimeRate: ALLOWANCE_RATES.overtime,
              nightRate: ALLOWANCE_RATES.night,
              holidayRate: ALLOWANCE_RATES.holiday,
              nationalPensionRate: INSURANCE_RATES.nationalPension * 100,
              healthInsuranceRate: INSURANCE_RATES.healthInsurance * 100,
              longTermCareRate: INSURANCE_RATES.longTermCare * 100,
              employmentInsuranceRate: INSURANCE_RATES.employmentInsurance * 100,
            });
            setIsCreateOpen(true);
          }}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5 mr-2" />
          신규 버전 추가
        </button>
      </div>

      {/* 현재 적용 중인 법령 */}
      {activeVersion && (
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">현재 적용 중</h2>
            {getStatusBadge('ACTIVE')}
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-gray-500">버전</p>
                <p className="text-xl font-bold text-gray-900">{activeVersion.version}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">시행일</p>
                <p className="text-xl font-bold text-gray-900">
                  {format(new Date(activeVersion.effectiveDate), 'yyyy년 M월 d일', { locale: ko })}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">최저시급</p>
                <p className="text-xl font-bold text-blue-600">
                  {activeVersion.minimumWageHourly.toLocaleString()}원
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">연장근로수당</p>
                <p className="text-xl font-bold text-gray-900">{activeVersion.overtimeRate}배</p>
              </div>
            </div>

            {/* 전년도 대비 변경사항 */}
            {archivedVersions.length > 0 && (
              <div className="mt-6 pt-6 border-t">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">전년도 대비 변경사항</h3>
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-blue-800">최저시급</span>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 line-through">
                          ₩{archivedVersions[0].minimumWageHourly.toLocaleString()}
                        </span>
                        <span className="text-blue-600">→</span>
                        <span className="font-semibold text-blue-900">
                          ₩{activeVersion.minimumWageHourly.toLocaleString()}
                        </span>
                        <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                          +{((activeVersion.minimumWageHourly - archivedVersions[0].minimumWageHourly) / archivedVersions[0].minimumWageHourly * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-blue-800">건강보험</span>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 line-through">
                          {archivedVersions[0].healthInsuranceRate}%
                        </span>
                        <span className="text-blue-600">→</span>
                        <span className="font-semibold text-blue-900">
                          {activeVersion.healthInsuranceRate}%
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-blue-800">장기요양</span>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 line-through">
                          {archivedVersions[0].longTermCareRate}%
                        </span>
                        <span className="text-blue-600">→</span>
                        <span className="font-semibold text-blue-900">
                          {activeVersion.longTermCareRate}%
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-blue-600 mt-3">
                    * 이 변경사항은 모든 구독 고객사에 자동 적용됩니다
                  </p>
                </div>
              </div>
            )}

            <div className="mt-6 pt-6 border-t">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">4대보험 요율</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">국민연금</p>
                  <p className="text-lg font-semibold">{activeVersion.nationalPensionRate}%</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">건강보험</p>
                  <p className="text-lg font-semibold">{activeVersion.healthInsuranceRate}%</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">장기요양보험</p>
                  <p className="text-lg font-semibold">{activeVersion.longTermCareRate}%</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">고용보험</p>
                  <p className="text-lg font-semibold">{activeVersion.employmentInsuranceRate}%</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 예정된 업데이트 */}
      {pendingVersions.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">예정된 업데이트</h2>
          </div>
          <div className="divide-y">
            {pendingVersions.map(version => (
              <div key={version.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {getStatusBadge(version.status)}
                    <div>
                      <p className="font-semibold text-gray-900">{version.version}</p>
                      <p className="text-sm text-gray-500">
                        시행 예정일: {format(new Date(version.effectiveDate), 'yyyy년 M월 d일', { locale: ko })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-blue-600">
                      {version.minimumWageHourly.toLocaleString()}원/시
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleActivate(version.id)}
                        className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                      >
                        활성화
                      </button>
                      <button
                        onClick={() => {
                          setEditingVersion(version);
                          setFormData({
                            version: version.version,
                            effectiveDate: version.effectiveDate,
                            minimumWageHourly: version.minimumWageHourly,
                            overtimeRate: version.overtimeRate,
                            nightRate: version.nightRate,
                            holidayRate: version.holidayRate,
                            nationalPensionRate: version.nationalPensionRate,
                            healthInsuranceRate: version.healthInsuranceRate,
                            longTermCareRate: version.longTermCareRate,
                            employmentInsuranceRate: version.employmentInsuranceRate,
                          });
                          setIsCreateOpen(true);
                        }}
                        className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(version.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 이전 버전 */}
      {archivedVersions.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">이전 버전</h2>
          </div>
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">버전</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">시행일</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">최저시급</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {archivedVersions.map(version => (
                <tr key={version.id}>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{version.version}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {format(new Date(version.effectiveDate), 'yyyy-MM-dd')}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {version.minimumWageHourly.toLocaleString()}원
                  </td>
                  <td className="px-6 py-4">{getStatusBadge(version.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 생성/수정 모달 */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b">
              <h2 className="text-xl font-bold">
                {editingVersion ? '버전 수정' : '신규 버전 추가'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label required>버전</Label>
                  <input
                    type="text"
                    value={formData.version}
                    onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                    placeholder="예: 2026.07"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <Label required>시행일</Label>
                  <input
                    type="date"
                    value={formData.effectiveDate}
                    onChange={(e) => setFormData({ ...formData, effectiveDate: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <Label required>최저시급 (원)</Label>
                <input
                  type="number"
                  value={formData.minimumWageHourly}
                  onChange={(e) => setFormData({ ...formData, minimumWageHourly: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">연장근로수당 (배)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.overtimeRate}
                    onChange={(e) => setFormData({ ...formData, overtimeRate: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">야간근로수당 (배)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.nightRate}
                    onChange={(e) => setFormData({ ...formData, nightRate: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">휴일근로수당 (배)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.holidayRate}
                    onChange={(e) => setFormData({ ...formData, holidayRate: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">4대보험 요율 (%)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">국민연금</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.nationalPensionRate}
                      onChange={(e) => setFormData({ ...formData, nationalPensionRate: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">건강보험</label>
                    <input
                      type="number"
                      step="0.001"
                      value={formData.healthInsuranceRate}
                      onChange={(e) => setFormData({ ...formData, healthInsuranceRate: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">장기요양보험</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.longTermCareRate}
                      onChange={(e) => setFormData({ ...formData, longTermCareRate: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">고용보험</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.employmentInsuranceRate}
                      onChange={(e) => setFormData({ ...formData, employmentInsuranceRate: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateOpen(false);
                    setEditingVersion(null);
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingVersion ? '수정' : '추가'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
