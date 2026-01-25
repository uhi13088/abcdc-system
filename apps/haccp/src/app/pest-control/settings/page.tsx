'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Save,
  Plus,
  Trash2,
  Edit2,
  Bug,
  Target,
  MapPin,
  RefreshCw,
  AlertCircle,
  ChevronLeft,
} from 'lucide-react';
import Link from 'next/link';

interface PestType {
  id?: string;
  pest_category: '비래해충' | '보행해충' | '설치류';
  pest_name: string;
  sort_order: number;
  is_active: boolean;
}

interface Standard {
  id?: string;
  season: '동절기' | '하절기';
  zone_grade: '청결구역' | '일반구역';
  pest_category: '비래해충' | '보행해충' | '설치류';
  level: 1 | 2;
  upper_limit: number;
}

interface TrapLocation {
  id?: string;
  zone_id?: string;
  location_code: string;
  location_name: string;
  trap_type: string;
  target_pest_category?: '비래해충' | '보행해충' | '설치류';
  sort_order: number;
  is_active: boolean;
  zone?: { zone_name: string; zone_grade: string };
}

interface Zone {
  id: string;
  zone_name: string;
  zone_grade: string;
}

type TabType = 'pest-types' | 'standards' | 'trap-locations';

export default function PestControlSettingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('pest-types');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Data
  const [pestTypes, setPestTypes] = useState<PestType[]>([]);
  const [standards, setStandards] = useState<Standard[]>([]);
  const [trapLocations, setTrapLocations] = useState<TrapLocation[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);

  // Modals
  const [showPestTypeModal, setShowPestTypeModal] = useState(false);
  const [editingPestType, setEditingPestType] = useState<PestType | null>(null);
  const [showTrapModal, setShowTrapModal] = useState(false);
  const [editingTrap, setEditingTrap] = useState<TrapLocation | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/haccp/pest-control/settings');
      if (response.ok) {
        const data = await response.json();
        setPestTypes(data.pestTypes || []);
        setStandards(data.standards || []);
        setTrapLocations(data.trapLocations || []);
        setZones(data.zones || []);
      }
    } catch (err) {
      setError('설정을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Pest Type handlers
  const handleSavePestType = async () => {
    if (!editingPestType) return;
    try {
      setSaving(true);
      const isNew = !editingPestType.id;
      const response = await fetch('/api/haccp/pest-control/settings/pest-types', {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingPestType),
      });
      if (response.ok) {
        setShowPestTypeModal(false);
        setEditingPestType(null);
        fetchSettings();
        setSuccessMessage('해충 종류가 저장되었습니다.');
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err) {
      setError('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePestType = async (id: string) => {
    if (!confirm('이 해충 종류를 삭제하시겠습니까?')) return;
    try {
      const response = await fetch(`/api/haccp/pest-control/settings/pest-types?id=${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        fetchSettings();
        setSuccessMessage('해충 종류가 삭제되었습니다.');
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err) {
      setError('삭제에 실패했습니다.');
    }
  };

  // Standards handlers
  const handleSaveStandards = async () => {
    try {
      setSaving(true);
      const response = await fetch('/api/haccp/pest-control/settings/standards', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ standards }),
      });
      if (response.ok) {
        setSuccessMessage('관리 기준이 저장되었습니다.');
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err) {
      setError('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const updateStandard = (id: string, field: string, value: number) => {
    setStandards((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  // Trap Location handlers
  const handleSaveTrap = async () => {
    if (!editingTrap) return;
    try {
      setSaving(true);
      const isNew = !editingTrap.id;
      const response = await fetch('/api/haccp/pest-control/settings/trap-locations', {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingTrap),
      });
      if (response.ok) {
        setShowTrapModal(false);
        setEditingTrap(null);
        fetchSettings();
        setSuccessMessage('포획기 위치가 저장되었습니다.');
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err) {
      setError('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTrap = async (id: string) => {
    if (!confirm('이 포획기 위치를 삭제하시겠습니까?')) return;
    try {
      const response = await fetch(`/api/haccp/pest-control/settings/trap-locations?id=${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        fetchSettings();
        setSuccessMessage('포획기 위치가 삭제되었습니다.');
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err) {
      setError('삭제에 실패했습니다.');
    }
  };

  const pestCategories = ['비래해충', '보행해충', '설치류'] as const;
  const trapTypes = ['페로몬트랩', '끈끈이트랩', '전격살충기', '쥐덫', '기타'];

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link
          href="/pest-control"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2"
        >
          <ChevronLeft className="w-4 h-4" />
          방충방서 점검으로 돌아가기
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">방충방서 설정</h1>
        <p className="mt-1 text-sm text-gray-500">
          해충 종류, 관리 기준, 포획기 위치를 설정합니다
        </p>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}
      {successMessage && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          {successMessage}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b">
        <button
          onClick={() => setActiveTab('pest-types')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'pest-types'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Bug className="w-4 h-4" />
          해충 종류
        </button>
        <button
          onClick={() => setActiveTab('standards')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'standards'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Target className="w-4 h-4" />
          관리 기준
        </button>
        <button
          onClick={() => setActiveTab('trap-locations')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'trap-locations'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <MapPin className="w-4 h-4" />
          포획기 위치
        </button>
      </div>

      {/* Pest Types Tab */}
      {activeTab === 'pest-types' && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">해충 종류 관리</h2>
            <button
              onClick={() => {
                setEditingPestType({
                  pest_category: '비래해충',
                  pest_name: '',
                  sort_order: pestTypes.length,
                  is_active: true,
                });
                setShowPestTypeModal(true);
              }}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              해충 추가
            </button>
          </div>

          {pestCategories.map((category) => (
            <div key={category} className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    category === '비래해충'
                      ? 'bg-blue-500'
                      : category === '보행해충'
                        ? 'bg-orange-500'
                        : 'bg-gray-500'
                  }`}
                ></span>
                {category}
              </h3>
              <div className="flex flex-wrap gap-2">
                {pestTypes
                  .filter((p) => p.pest_category === category)
                  .map((pest) => (
                    <div
                      key={pest.id}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm ${
                        pest.is_active
                          ? 'bg-gray-50 border-gray-200'
                          : 'bg-gray-100 border-gray-300 opacity-50'
                      }`}
                    >
                      <span>{pest.pest_name}</span>
                      <button
                        onClick={() => {
                          setEditingPestType(pest);
                          setShowPestTypeModal(true);
                        }}
                        className="text-gray-400 hover:text-blue-600"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => pest.id && handleDeletePestType(pest.id)}
                        className="text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                {pestTypes.filter((p) => p.pest_category === category).length === 0 && (
                  <span className="text-sm text-gray-400">등록된 해충이 없습니다</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Standards Tab */}
      {activeTab === 'standards' && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">관리 기준</h2>
              <p className="text-sm text-gray-500">
                시즌/구역등급/해충분류별 1단계, 2단계 상한값을 설정합니다
              </p>
            </div>
            <button
              onClick={handleSaveStandards}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">시즌</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">구역 등급</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">해충 분류</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">단계</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">상한값</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {standards.map((standard) => (
                  <tr key={standard.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full ${
                          standard.season === '동절기'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-orange-100 text-orange-700'
                        }`}
                      >
                        {standard.season}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full ${
                          standard.zone_grade === '청결구역'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {standard.zone_grade}
                      </span>
                    </td>
                    <td className="px-4 py-3">{standard.pest_category}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full ${
                          standard.level === 1
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {standard.level}단계
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min={0}
                        value={standard.upper_limit}
                        onChange={(e) =>
                          standard.id &&
                          updateStandard(standard.id, 'upper_limit', parseInt(e.target.value) || 0)
                        }
                        className="w-20 px-2 py-1 border rounded text-center"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Trap Locations Tab */}
      {activeTab === 'trap-locations' && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">포획기 위치</h2>
              <p className="text-sm text-gray-500">점검 시 사용할 포획기 위치를 등록합니다</p>
            </div>
            <button
              onClick={() => {
                setEditingTrap({
                  location_code: '',
                  location_name: '',
                  trap_type: '페로몬트랩',
                  sort_order: trapLocations.length,
                  is_active: true,
                });
                setShowTrapModal(true);
              }}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              포획기 추가
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">코드</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">위치명</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">구역</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">포획기 종류</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">대상 해충</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">상태</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {trapLocations.map((trap) => (
                  <tr key={trap.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{trap.location_code}</td>
                    <td className="px-4 py-3 font-medium">{trap.location_name}</td>
                    <td className="px-4 py-3">
                      {trap.zone ? (
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full ${
                            trap.zone.zone_grade === '청결구역'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {trap.zone.zone_name}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-4 py-3">{trap.trap_type}</td>
                    <td className="px-4 py-3">{trap.target_pest_category || '-'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full ${
                          trap.is_active
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {trap.is_active ? '활성' : '비활성'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => {
                          setEditingTrap(trap);
                          setShowTrapModal(true);
                        }}
                        className="p-1 text-gray-400 hover:text-blue-600"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => trap.id && handleDeleteTrap(trap.id)}
                        className="p-1 text-gray-400 hover:text-red-600 ml-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {trapLocations.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              등록된 포획기 위치가 없습니다. 포획기를 추가해주세요.
            </div>
          )}
        </div>
      )}

      {/* Pest Type Modal */}
      {showPestTypeModal && editingPestType && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-xl font-bold mb-4">
              {editingPestType.id ? '해충 종류 수정' : '해충 종류 추가'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">해충 분류</label>
                <select
                  value={editingPestType.pest_category}
                  onChange={(e) =>
                    setEditingPestType({
                      ...editingPestType,
                      pest_category: e.target.value as '비래해충' | '보행해충' | '설치류',
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg"
                  disabled={!!editingPestType.id}
                >
                  <option value="비래해충">비래해충</option>
                  <option value="보행해충">보행해충</option>
                  <option value="설치류">설치류</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">해충명</label>
                <input
                  type="text"
                  value={editingPestType.pest_name}
                  onChange={(e) =>
                    setEditingPestType({ ...editingPestType, pest_name: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="예: 파리"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="pest_active"
                  checked={editingPestType.is_active}
                  onChange={(e) =>
                    setEditingPestType({ ...editingPestType, is_active: e.target.checked })
                  }
                  className="w-4 h-4 rounded"
                />
                <label htmlFor="pest_active" className="text-sm text-gray-700">
                  활성화
                </label>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowPestTypeModal(false);
                  setEditingPestType(null);
                }}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleSavePestType}
                disabled={saving || !editingPestType.pest_name}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trap Location Modal */}
      {showTrapModal && editingTrap && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-xl font-bold mb-4">
              {editingTrap.id ? '포획기 위치 수정' : '포획기 위치 추가'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">위치 코드</label>
                <input
                  type="text"
                  value={editingTrap.location_code}
                  onChange={(e) =>
                    setEditingTrap({ ...editingTrap, location_code: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="예: TRAP_01"
                  disabled={!!editingTrap.id}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">위치명</label>
                <input
                  type="text"
                  value={editingTrap.location_name}
                  onChange={(e) =>
                    setEditingTrap({ ...editingTrap, location_name: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="예: 원료창고 입구"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">구역</label>
                <select
                  value={editingTrap.zone_id || ''}
                  onChange={(e) =>
                    setEditingTrap({ ...editingTrap, zone_id: e.target.value || undefined })
                  }
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">선택 안함</option>
                  {zones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.zone_name} ({zone.zone_grade})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">포획기 종류</label>
                <select
                  value={editingTrap.trap_type}
                  onChange={(e) => setEditingTrap({ ...editingTrap, trap_type: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  {trapTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">대상 해충</label>
                <select
                  value={editingTrap.target_pest_category || ''}
                  onChange={(e) =>
                    setEditingTrap({
                      ...editingTrap,
                      target_pest_category: (e.target.value || undefined) as
                        | '비래해충'
                        | '보행해충'
                        | '설치류'
                        | undefined,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">선택 안함</option>
                  <option value="비래해충">비래해충</option>
                  <option value="보행해충">보행해충</option>
                  <option value="설치류">설치류</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="trap_active"
                  checked={editingTrap.is_active}
                  onChange={(e) =>
                    setEditingTrap({ ...editingTrap, is_active: e.target.checked })
                  }
                  className="w-4 h-4 rounded"
                />
                <label htmlFor="trap_active" className="text-sm text-gray-700">
                  활성화
                </label>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowTrapModal(false);
                  setEditingTrap(null);
                }}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleSaveTrap}
                disabled={saving || !editingTrap.location_code || !editingTrap.location_name}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
