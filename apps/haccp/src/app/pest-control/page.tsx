'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Calendar, Bug, AlertTriangle, CheckCircle, Settings, RefreshCw } from 'lucide-react';
import Link from 'next/link';

interface Zone {
  id: string;
  zone_code: string;
  zone_name: string;
  zone_grade: '청결구역' | '일반구역';
  sort_order: number;
  is_active: boolean;
}

interface TrapLocation {
  id: string;
  zone_id: string;
  location_code: string;
  location_name: string;
  trap_type: string;
  target_pest_category: '비래해충' | '보행해충' | '설치류';
  sort_order: number;
  is_active: boolean;
  zone?: Zone;
}

interface PestType {
  id: string;
  pest_category: '비래해충' | '보행해충' | '설치류';
  pest_name: string;
  sort_order: number;
  is_active: boolean;
}

interface Standard {
  id: string;
  season: '동절기' | '하절기';
  zone_grade: '청결구역' | '일반구역';
  pest_category: '비래해충' | '보행해충' | '설치류';
  level: 1 | 2;
  upper_limit: number;
  lower_limit: number;
  description?: string;
}

interface TrapCheckInput {
  trap_location_id: string;
  location_name: string;
  trap_type: string;
  zone_id: string;
  zone_name: string;
  zone_grade: '청결구역' | '일반구역';
  target_pest_category: '비래해충' | '보행해충' | '설치류';
  catch_count: number;
  condition: string;
  evaluation?: {
    level: 0 | 1 | 2;
    status: 'NORMAL' | 'LEVEL1' | 'LEVEL2';
  };
}

interface PestControlCheck {
  id: string;
  check_date: string;
  check_type: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'EXTERNAL';
  checked_by_name?: string;
  season?: '동절기' | '하절기';
  trap_checks: TrapCheckInput[];
  findings: string;
  corrective_action: string;
  external_company?: string;
  overall_status: 'NORMAL' | 'LEVEL1' | 'LEVEL2' | 'ATTENTION' | 'CRITICAL';
}

interface Settings {
  zones: Zone[];
  trapLocations: TrapLocation[];
  pestTypes: PestType[];
  standards: Standard[];
  currentSeason: '동절기' | '하절기';
}

export default function PestControlPage() {
  const [checks, setChecks] = useState<PestControlCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [formData, setFormData] = useState<{
    check_type: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'EXTERNAL';
    trap_checks: TrapCheckInput[];
    findings: string;
    corrective_action: string;
    external_company: string;
  }>({
    check_type: 'WEEKLY',
    trap_checks: [],
    findings: '',
    corrective_action: '',
    external_company: '',
  });

  // 설정 데이터 로드
  const fetchSettings = useCallback(async () => {
    try {
      setSettingsLoading(true);
      const [settingsRes, seasonsRes] = await Promise.all([
        fetch('/api/haccp/pest-control/settings'),
        fetch('/api/haccp/settings/seasons'),
      ]);

      if (settingsRes.ok && seasonsRes.ok) {
        const settingsData = await settingsRes.json();
        const seasonsData = await seasonsRes.json();

        setSettings({
          zones: settingsData.zones || [],
          trapLocations: settingsData.trapLocations || [],
          pestTypes: settingsData.pestTypes || [],
          standards: settingsData.standards || [],
          currentSeason: seasonsData.currentSeason || '하절기',
        });
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  // 점검 기록 로드
  const fetchChecks = useCallback(async () => {
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
  }, [selectedDate]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    fetchChecks();
  }, [fetchChecks]);

  // 포획기 위치 기반 폼 데이터 초기화
  useEffect(() => {
    if (settings && settings.trapLocations.length > 0) {
      const trapChecks: TrapCheckInput[] = settings.trapLocations
        .filter(loc => loc.is_active)
        .map(loc => ({
          trap_location_id: loc.id,
          location_name: loc.location_name,
          trap_type: loc.trap_type,
          zone_id: loc.zone_id,
          zone_name: loc.zone?.zone_name || '',
          zone_grade: loc.zone?.zone_grade || '일반구역',
          target_pest_category: loc.target_pest_category,
          catch_count: 0,
          condition: '양호',
        }));
      setFormData(prev => ({ ...prev, trap_checks: trapChecks }));
    }
  }, [settings]);

  // 포획수에 따른 기준 평가
  const evaluateCatchCount = (
    catchCount: number,
    zoneGrade: '청결구역' | '일반구역',
    pestCategory: '비래해충' | '보행해충' | '설치류'
  ): { level: 0 | 1 | 2; status: 'NORMAL' | 'LEVEL1' | 'LEVEL2' } => {
    if (!settings) return { level: 0, status: 'NORMAL' };

    const currentSeason = settings.currentSeason;

    // 해당 조건에 맞는 기준 찾기
    const level1Standard = settings.standards.find(
      s => s.season === currentSeason &&
           s.zone_grade === zoneGrade &&
           s.pest_category === pestCategory &&
           s.level === 1
    );
    const level2Standard = settings.standards.find(
      s => s.season === currentSeason &&
           s.zone_grade === zoneGrade &&
           s.pest_category === pestCategory &&
           s.level === 2
    );

    // 2단계 기준 초과 확인
    if (level2Standard && catchCount >= level2Standard.upper_limit) {
      return { level: 2, status: 'LEVEL2' };
    }
    // 1단계 기준 초과 확인
    if (level1Standard && catchCount >= level1Standard.upper_limit) {
      return { level: 1, status: 'LEVEL1' };
    }

    return { level: 0, status: 'NORMAL' };
  };

  // 전체 상태 계산
  const calculateOverallStatus = (trapChecks: TrapCheckInput[]): 'NORMAL' | 'LEVEL1' | 'LEVEL2' => {
    let hasLevel2 = false;
    let hasLevel1 = false;

    for (const trap of trapChecks) {
      const evaluation = evaluateCatchCount(
        trap.catch_count,
        trap.zone_grade,
        trap.target_pest_category
      );
      if (evaluation.level === 2) hasLevel2 = true;
      if (evaluation.level === 1) hasLevel1 = true;
    }

    if (hasLevel2) return 'LEVEL2';
    if (hasLevel1) return 'LEVEL1';
    return 'NORMAL';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 각 포획기에 평가 결과 추가
    const evaluatedTrapChecks = formData.trap_checks.map(trap => ({
      ...trap,
      evaluation: evaluateCatchCount(trap.catch_count, trap.zone_grade, trap.target_pest_category),
    }));

    const overall_status = calculateOverallStatus(formData.trap_checks);

    try {
      const response = await fetch('/api/haccp/pest-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          check_date: selectedDate,
          check_type: formData.check_type,
          season: settings?.currentSeason || '하절기',
          trap_checks: evaluatedTrapChecks,
          findings: formData.findings,
          corrective_action: formData.corrective_action,
          external_company: formData.external_company,
          overall_status,
        }),
      });

      if (response.ok) {
        setShowModal(false);
        fetchChecks();
        // 폼 초기화
        if (settings && settings.trapLocations.length > 0) {
          const trapChecks: TrapCheckInput[] = settings.trapLocations
            .filter(loc => loc.is_active)
            .map(loc => ({
              trap_location_id: loc.id,
              location_name: loc.location_name,
              trap_type: loc.trap_type,
              zone_id: loc.zone_id,
              zone_name: loc.zone?.zone_name || '',
              zone_grade: loc.zone?.zone_grade || '일반구역',
              target_pest_category: loc.target_pest_category,
              catch_count: 0,
              condition: '양호',
            }));
          setFormData({
            check_type: 'WEEKLY',
            trap_checks: trapChecks,
            findings: '',
            corrective_action: '',
            external_company: '',
          });
        }
      }
    } catch (error) {
      console.error('Failed to create pest control check:', error);
    }
  };

  const updateTrapCheck = (index: number, field: string, value: string | number) => {
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
    'LEVEL1': 'bg-yellow-100 text-yellow-700 border-yellow-200',
    'LEVEL2': 'bg-red-100 text-red-700 border-red-200',
    'ATTENTION': 'bg-yellow-100 text-yellow-700 border-yellow-200',
    'CRITICAL': 'bg-red-100 text-red-700 border-red-200',
  };

  const statusText: Record<string, string> = {
    'NORMAL': '정상',
    'LEVEL1': '1단계 주의',
    'LEVEL2': '2단계 위험',
    'ATTENTION': '주의',
    'CRITICAL': '위험',
  };

  const pestCategoryColors = {
    '비래해충': 'bg-blue-50 text-blue-700',
    '보행해충': 'bg-amber-50 text-amber-700',
    '설치류': 'bg-red-50 text-red-700',
  };

  const zoneGradeColors = {
    '청결구역': 'bg-emerald-50 text-emerald-700',
    '일반구역': 'bg-gray-100 text-gray-700',
  };

  // 해충분류별 그룹핑
  const groupedTrapChecks = formData.trap_checks.reduce((acc, trap) => {
    const category = trap.target_pest_category;
    if (!acc[category]) acc[category] = [];
    acc[category].push(trap);
    return acc;
  }, {} as Record<string, TrapCheckInput[]>);

  if (settingsLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">방충방서 관리</h1>
          <p className="mt-1 text-sm text-gray-500">
            방충방서 점검 기록을 관리합니다
            {settings && (
              <span className="ml-2 px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">
                현재 시즌: {settings.currentSeason}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => fetchSettings()}
            className="inline-flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-gray-50"
            title="설정 새로고침"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link
            href="/pest-control/settings"
            className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            <Settings className="w-4 h-4" />
            설정
          </Link>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            점검 기록
          </button>
        </div>
      </div>

      {/* 관리 기준 요약 */}
      {settings && settings.standards.length > 0 && (
        <div className="mb-6 bg-white rounded-xl shadow-sm border p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            현재 관리 기준 ({settings.currentSeason})
          </h3>
          <div className="grid grid-cols-3 gap-4">
            {(['비래해충', '보행해충', '설치류'] as const).map(category => {
              const categoryStandards = settings.standards.filter(
                s => s.season === settings.currentSeason && s.pest_category === category
              );
              if (categoryStandards.length === 0) return null;

              return (
                <div key={category} className={`rounded-lg p-3 ${pestCategoryColors[category]}`}>
                  <h4 className="font-medium text-sm mb-2">{category}</h4>
                  <div className="space-y-1 text-xs">
                    {(['청결구역', '일반구역'] as const).map(grade => {
                      const level1 = categoryStandards.find(s => s.zone_grade === grade && s.level === 1);
                      const level2 = categoryStandards.find(s => s.zone_grade === grade && s.level === 2);
                      if (!level1 && !level2) return null;
                      return (
                        <div key={grade} className="flex justify-between">
                          <span>{grade}:</span>
                          <span>
                            1단계≥{level1?.upper_limit || '-'} / 2단계≥{level2?.upper_limit || '-'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
              check.overall_status === 'LEVEL2' || check.overall_status === 'CRITICAL' ? 'border-red-300' :
              check.overall_status === 'LEVEL1' || check.overall_status === 'ATTENTION' ? 'border-yellow-300' : ''
            }`}>
              <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 text-xs rounded-full ${checkTypeColors[check.check_type]}`}>
                    {checkTypeText[check.check_type]}
                  </span>
                  {check.season && (
                    <span className="text-xs text-gray-500">{check.season}</span>
                  )}
                  {check.external_company && (
                    <span className="text-sm text-gray-500">{check.external_company}</span>
                  )}
                </div>
                <span className={`px-3 py-1 text-sm rounded-full border ${statusColors[check.overall_status] || statusColors.NORMAL}`}>
                  {check.overall_status === 'NORMAL' && <CheckCircle className="w-4 h-4 inline mr-1" />}
                  {check.overall_status !== 'NORMAL' && <AlertTriangle className="w-4 h-4 inline mr-1" />}
                  {statusText[check.overall_status] || '정상'}
                </span>
              </div>

              <div className="p-4">
                {check.trap_checks && check.trap_checks.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">포획기 점검</h4>
                    <div className="grid grid-cols-3 gap-3">
                      {check.trap_checks.map((trap, idx) => (
                        <div key={idx} className={`rounded-lg p-3 ${
                          trap.evaluation?.level === 2 ? 'bg-red-50 border border-red-200' :
                          trap.evaluation?.level === 1 ? 'bg-yellow-50 border border-yellow-200' :
                          'bg-gray-50'
                        }`}>
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-medium text-sm">{trap.location_name}</p>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${zoneGradeColors[trap.zone_grade] || 'bg-gray-100'}`}>
                              {trap.zone_grade}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">{trap.trap_type}</p>
                          <div className="flex items-center justify-between mt-2">
                            <span className={`text-lg font-bold ${
                              trap.evaluation?.level === 2 ? 'text-red-600' :
                              trap.evaluation?.level === 1 ? 'text-yellow-600' : 'text-green-600'
                            }`}>
                              {trap.catch_count}
                            </span>
                            <div className="flex items-center gap-1">
                              <span className={`text-xs px-1.5 py-0.5 rounded ${pestCategoryColors[trap.target_pest_category] || 'bg-gray-100'}`}>
                                {trap.target_pest_category}
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                trap.condition === '양호' ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'
                              }`}>
                                {trap.condition}
                              </span>
                            </div>
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
          <div className="bg-white rounded-xl w-full max-w-4xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold">방충방서 점검 기록</h2>
                <p className="text-sm text-gray-500">
                  현재 시즌: <span className="font-medium">{settings?.currentSeason}</span>
                </p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                닫기
              </button>
            </div>

            {formData.trap_checks.length === 0 ? (
              <div className="text-center py-8">
                <Bug className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500 mb-4">포획기 위치가 설정되지 않았습니다</p>
                <Link
                  href="/pest-control/settings"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Settings className="w-4 h-4" />
                  설정으로 이동
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">점검 유형</label>
                    <select
                      value={formData.check_type}
                      onChange={(e) => setFormData({ ...formData, check_type: e.target.value as 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'EXTERNAL' })}
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

                {/* 해충분류별 포획기 점검 */}
                {Object.entries(groupedTrapChecks).map(([category, traps]) => (
                  <div key={category} className="bg-gray-50 rounded-lg p-4">
                    <h4 className={`font-medium mb-3 flex items-center gap-2`}>
                      <span className={`px-2 py-1 rounded text-sm ${pestCategoryColors[category as keyof typeof pestCategoryColors]}`}>
                        {category}
                      </span>
                      <span className="text-gray-500 text-sm">포획기 점검</span>
                    </h4>
                    <div className="space-y-3">
                      {traps.map((trap) => {
                        const originalIndex = formData.trap_checks.findIndex(t => t.trap_location_id === trap.trap_location_id);
                        const evaluation = evaluateCatchCount(trap.catch_count, trap.zone_grade, trap.target_pest_category);

                        return (
                          <div
                            key={trap.trap_location_id}
                            className={`grid grid-cols-5 gap-3 p-3 rounded-lg ${
                              evaluation.level === 2 ? 'bg-red-50 border border-red-200' :
                              evaluation.level === 1 ? 'bg-yellow-50 border border-yellow-200' :
                              'bg-white border'
                            }`}
                          >
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">위치</label>
                              <div className="font-medium text-sm">{trap.location_name}</div>
                              <div className="text-xs text-gray-500">{trap.zone_name}</div>
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">구역등급</label>
                              <span className={`inline-block px-2 py-1 rounded text-xs ${zoneGradeColors[trap.zone_grade]}`}>
                                {trap.zone_grade}
                              </span>
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">트랩종류</label>
                              <div className="text-sm">{trap.trap_type}</div>
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">포획수</label>
                              <input
                                type="number"
                                min="0"
                                value={trap.catch_count}
                                onChange={(e) => updateTrapCheck(originalIndex, 'catch_count', parseInt(e.target.value) || 0)}
                                className={`w-full px-2 py-1.5 border rounded text-sm ${
                                  evaluation.level === 2 ? 'border-red-300 bg-red-50' :
                                  evaluation.level === 1 ? 'border-yellow-300 bg-yellow-50' : ''
                                }`}
                              />
                              {evaluation.level > 0 && (
                                <div className={`text-xs mt-1 ${evaluation.level === 2 ? 'text-red-600' : 'text-yellow-600'}`}>
                                  {evaluation.level}단계 초과
                                </div>
                              )}
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">상태</label>
                              <select
                                value={trap.condition}
                                onChange={(e) => updateTrapCheck(originalIndex, 'condition', e.target.value)}
                                className="w-full px-2 py-1.5 border rounded text-sm"
                              >
                                <option value="양호">양호</option>
                                <option value="교체필요">교체필요</option>
                                <option value="파손">파손</option>
                              </select>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">발견사항</label>
                  <textarea
                    value={formData.findings}
                    onChange={(e) => setFormData({ ...formData, findings: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    rows={2}
                    placeholder="특이사항이 있으면 입력하세요"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">개선조치</label>
                  <textarea
                    value={formData.corrective_action}
                    onChange={(e) => setFormData({ ...formData, corrective_action: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    rows={2}
                    placeholder="조치사항이 있으면 입력하세요"
                  />
                </div>

                {/* 전체 상태 미리보기 */}
                <div className="bg-gray-100 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">전체 평가 결과</span>
                    <span className={`px-3 py-1 rounded-full text-sm ${
                      calculateOverallStatus(formData.trap_checks) === 'LEVEL2'
                        ? 'bg-red-100 text-red-700'
                        : calculateOverallStatus(formData.trap_checks) === 'LEVEL1'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {calculateOverallStatus(formData.trap_checks) === 'LEVEL2' && <AlertTriangle className="w-4 h-4 inline mr-1" />}
                      {calculateOverallStatus(formData.trap_checks) === 'LEVEL1' && <AlertTriangle className="w-4 h-4 inline mr-1" />}
                      {calculateOverallStatus(formData.trap_checks) === 'NORMAL' && <CheckCircle className="w-4 h-4 inline mr-1" />}
                      {statusText[calculateOverallStatus(formData.trap_checks)]}
                    </span>
                  </div>
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
            )}
          </div>
        </div>
      )}
    </div>
  );
}
