'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, X, Layers, ChevronRight, ChevronDown, Settings } from 'lucide-react';
import Link from 'next/link';
import { Label } from '@/components/ui/label';

interface CCPMaster {
  id: string;
  master_code: string;
  group_prefix: string;
  process_name: string;
  hazard_type: 'B' | 'C' | 'P' | null;
  monitoring_frequency: string;
  description: string;
  sort_order: number;
  status: string;
  items_count: number;
}

interface CCPItem {
  id: string;
  ccp_number: string;
  item_code: string;
  process: string;
  hazard: string;
  control_measure: string;
  critical_limit: {
    parameter: string;
    min?: number;
    max?: number;
    unit: string;
  };
  monitoring_method: string;
  monitoring_frequency: string;
  corrective_action: string;
  status: string;
}

const HAZARD_TYPES = {
  'B': { label: '생물학적 (Biological)', color: 'bg-green-100 text-green-700' },
  'C': { label: '화학적 (Chemical)', color: 'bg-yellow-100 text-yellow-700' },
  'P': { label: '물리적 (Physical)', color: 'bg-blue-100 text-blue-700' },
};

export default function CCPMasterPage() {
  const [masters, setMasters] = useState<CCPMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMasterModal, setShowMasterModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingMaster, setEditingMaster] = useState<CCPMaster | null>(null);
  const [selectedMaster, setSelectedMaster] = useState<CCPMaster | null>(null);
  const [masterItems, setMasterItems] = useState<CCPItem[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<CCPItem | null>(null);

  const [masterFormData, setMasterFormData] = useState({
    master_code: '',
    group_prefix: '',
    process_name: '',
    hazard_type: '' as 'B' | 'C' | 'P' | '',
    monitoring_frequency: '',
    description: '',
    sort_order: 0,
  });

  const [itemFormData, setItemFormData] = useState({
    ccp_number: '',
    item_code: '',
    process: '',
    hazard: '',
    control_measure: '',
    critical_limit: { parameter: '', min: 0, max: 0, unit: '' },
    monitoring_method: '',
    monitoring_frequency: '',
    corrective_action: '',
  });

  useEffect(() => {
    fetchMasters();
  }, []);

  const fetchMasters = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/haccp/ccp/master');
      if (response.ok) {
        const data = await response.json();
        setMasters(data);
      }
    } catch (error) {
      console.error('Failed to fetch CCP masters:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMasterItems = async (masterId: string) => {
    try {
      const response = await fetch(`/api/haccp/ccp/master/${masterId}/items`);
      if (response.ok) {
        const data = await response.json();
        setMasterItems(data);
      }
    } catch (error) {
      console.error('Failed to fetch master items:', error);
    }
  };

  const toggleGroup = async (master: CCPMaster) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(master.id)) {
      newExpanded.delete(master.id);
      setSelectedMaster(null);
      setMasterItems([]);
    } else {
      newExpanded.add(master.id);
      setSelectedMaster(master);
      await fetchMasterItems(master.id);
    }
    setExpandedGroups(newExpanded);
  };

  const handleMasterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editingMaster ? 'PUT' : 'POST';
      const body = editingMaster
        ? { id: editingMaster.id, ...masterFormData }
        : masterFormData;

      const response = await fetch('/api/haccp/ccp/master', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        setShowMasterModal(false);
        setEditingMaster(null);
        resetMasterForm();
        fetchMasters();
      }
    } catch (error) {
      console.error('Failed to save CCP master:', error);
    }
  };

  const handleItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMaster) return;

    try {
      const method = editingItem ? 'PUT' : 'POST';
      const url = editingItem ? `/api/haccp/ccp/${editingItem.id}` : '/api/haccp/ccp';

      const body = {
        ...itemFormData,
        master_id: selectedMaster.id,
        ccp_number: `CCP-${selectedMaster.master_code}-${itemFormData.item_code}`,
      };

      if (editingItem) {
        Object.assign(body, { id: editingItem.id });
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        setShowItemModal(false);
        setEditingItem(null);
        resetItemForm();
        fetchMasterItems(selectedMaster.id);
        fetchMasters(); // Update counts
      }
    } catch (error) {
      console.error('Failed to save CCP item:', error);
    }
  };

  const handleDeleteMaster = async (id: string) => {
    if (!confirm('이 그룹을 삭제하시겠습니까? 연결된 CCP 항목들은 그룹 연결이 해제됩니다.')) return;
    try {
      await fetch(`/api/haccp/ccp/master?id=${id}`, { method: 'DELETE' });
      fetchMasters();
    } catch (error) {
      console.error('Failed to delete CCP master:', error);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('이 CCP 항목을 삭제하시겠습니까?')) return;
    try {
      await fetch(`/api/haccp/ccp/${id}`, { method: 'DELETE' });
      if (selectedMaster) {
        fetchMasterItems(selectedMaster.id);
        fetchMasters();
      }
    } catch (error) {
      console.error('Failed to delete CCP item:', error);
    }
  };

  const resetMasterForm = () => {
    setMasterFormData({
      master_code: '',
      group_prefix: '',
      process_name: '',
      hazard_type: '',
      monitoring_frequency: '',
      description: '',
      sort_order: 0,
    });
  };

  const resetItemForm = () => {
    setItemFormData({
      ccp_number: '',
      item_code: '',
      process: '',
      hazard: '',
      control_measure: '',
      critical_limit: { parameter: '', min: 0, max: 0, unit: '' },
      monitoring_method: '',
      monitoring_frequency: '',
      corrective_action: '',
    });
  };

  const openNewMasterModal = () => {
    resetMasterForm();
    setEditingMaster(null);
    setShowMasterModal(true);
  };

  const openEditMasterModal = (master: CCPMaster) => {
    setEditingMaster(master);
    setMasterFormData({
      master_code: master.master_code,
      group_prefix: master.group_prefix,
      process_name: master.process_name,
      hazard_type: master.hazard_type || '',
      monitoring_frequency: master.monitoring_frequency || '',
      description: master.description || '',
      sort_order: master.sort_order,
    });
    setShowMasterModal(true);
  };

  const openNewItemModal = () => {
    resetItemForm();
    setEditingItem(null);
    setShowItemModal(true);
  };

  const openEditItemModal = (item: CCPItem) => {
    setEditingItem(item);
    // Extract item_code from ccp_number (e.g., "CCP-1B-COOKIE-TEMP" -> "TEMP")
    const parts = item.ccp_number.split('-');
    const itemCode = parts.length > 3 ? parts.slice(3).join('-') : item.item_code || '';

    setItemFormData({
      ccp_number: item.ccp_number,
      item_code: itemCode,
      process: item.process || '',
      hazard: item.hazard || '',
      control_measure: item.control_measure || '',
      critical_limit: {
        parameter: item.critical_limit?.parameter || '',
        min: item.critical_limit?.min ?? 0,
        max: item.critical_limit?.max ?? 0,
        unit: item.critical_limit?.unit || ''
      },
      monitoring_method: item.monitoring_method || '',
      monitoring_frequency: item.monitoring_frequency || '',
      corrective_action: item.corrective_action || '',
    });
    setShowItemModal(true);
  };

  // Group masters by group_prefix
  const groupedMasters = masters.reduce((acc, master) => {
    const prefix = master.group_prefix;
    if (!acc[prefix]) {
      acc[prefix] = [];
    }
    acc[prefix].push(master);
    return acc;
  }, {} as Record<string, CCPMaster[]>);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CCP 그룹 관리</h1>
          <p className="mt-1 text-sm text-gray-500">CCP를 그룹으로 묶어 체계적으로 관리합니다</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/ccp"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            <Settings className="w-4 h-4" />
            전체 CCP 보기
          </Link>
          <button
            onClick={openNewMasterModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            그룹 추가
          </button>
        </div>
      </div>

      {/* Masters List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : masters.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <Layers className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500 mb-4">등록된 CCP 그룹이 없습니다</p>
          <button
            onClick={openNewMasterModal}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            첫 번째 그룹 만들기
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedMasters).sort().map(([prefix, prefixMasters]) => (
            <div key={prefix} className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className="bg-gradient-to-r from-slate-700 to-slate-600 px-5 py-3">
                <h2 className="text-lg font-bold text-white">
                  {prefix} 그룹
                  <span className="ml-2 text-sm font-normal text-white/70">
                    ({prefixMasters.length}개 카테고리)
                  </span>
                </h2>
              </div>

              <div className="divide-y">
                {prefixMasters.map((master) => (
                  <div key={master.id}>
                    {/* Master Row */}
                    <div
                      className={`px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                        expandedGroups.has(master.id) ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => toggleGroup(master)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {expandedGroups.has(master.id) ? (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-gray-400" />
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-blue-600">{master.master_code}</span>
                              <span className="text-gray-900">{master.process_name}</span>
                              {master.hazard_type && (
                                <span className={`px-2 py-0.5 text-xs rounded-full ${HAZARD_TYPES[master.hazard_type].color}`}>
                                  {master.hazard_type}
                                </span>
                              )}
                            </div>
                            {master.monitoring_frequency && (
                              <p className="text-sm text-gray-500 mt-1">
                                모니터링: {master.monitoring_frequency}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-gray-500">
                            {master.items_count}개 항목
                          </span>
                          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => openEditMasterModal(master)}
                              className="p-2 hover:bg-gray-200 rounded"
                            >
                              <Edit className="w-4 h-4 text-gray-500" />
                            </button>
                            <button
                              onClick={() => handleDeleteMaster(master.id)}
                              className="p-2 hover:bg-red-100 rounded"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Items */}
                    {expandedGroups.has(master.id) && selectedMaster?.id === master.id && (
                      <div className="bg-gray-50 px-5 py-4 border-t">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-medium text-gray-700">모니터링 항목</h4>
                          <button
                            onClick={openNewItemModal}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                          >
                            <Plus className="w-3 h-3" />
                            항목 추가
                          </button>
                        </div>

                        {masterItems.length === 0 ? (
                          <p className="text-sm text-gray-500 py-4 text-center">
                            등록된 모니터링 항목이 없습니다
                          </p>
                        ) : (
                          <div className="bg-white rounded-lg border overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-100">
                                <tr>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">CCP코드</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">공정명</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">한계기준</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">단위</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">측정빈도</th>
                                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">관리</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                {masterItems.map((item) => (
                                  <tr key={item.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-sm font-mono">{item.ccp_number}</td>
                                    <td className="px-4 py-3 text-sm">{item.process}</td>
                                    <td className="px-4 py-3 text-sm">
                                      {item.critical_limit.min !== undefined && item.critical_limit.min}
                                      {item.critical_limit.min !== undefined && item.critical_limit.max !== undefined && ' ~ '}
                                      {item.critical_limit.max !== undefined && item.critical_limit.max}
                                    </td>
                                    <td className="px-4 py-3 text-sm">{item.critical_limit.unit}</td>
                                    <td className="px-4 py-3 text-sm">{item.monitoring_frequency}</td>
                                    <td className="px-4 py-3 text-right">
                                      <button
                                        onClick={() => openEditItemModal(item)}
                                        className="p-1 hover:bg-gray-200 rounded mr-1"
                                      >
                                        <Edit className="w-4 h-4 text-gray-500" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteItem(item.id)}
                                        className="p-1 hover:bg-red-100 rounded"
                                      >
                                        <Trash2 className="w-4 h-4 text-red-500" />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Master Modal */}
      {showMasterModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">
                {editingMaster ? 'CCP 그룹 수정' : 'CCP 그룹 추가'}
              </h2>
              <button onClick={() => setShowMasterModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleMasterSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label required>그룹 프리픽스</Label>
                  <input
                    type="text"
                    value={masterFormData.group_prefix}
                    onChange={(e) => setMasterFormData({ ...masterFormData, group_prefix: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="예: 1B, 2B, 3B"
                    required
                  />
                </div>
                <div>
                  <Label required>마스터 코드</Label>
                  <input
                    type="text"
                    value={masterFormData.master_code}
                    onChange={(e) => setMasterFormData({ ...masterFormData, master_code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="예: 1B-COOKIE"
                    required
                  />
                </div>
              </div>

              <div>
                <Label required>공정명</Label>
                <input
                  type="text"
                  value={masterFormData.process_name}
                  onChange={(e) => setMasterFormData({ ...masterFormData, process_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="예: 오븐(굽기)-과자"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>위해 유형</Label>
                  <select
                    value={masterFormData.hazard_type}
                    onChange={(e) => setMasterFormData({ ...masterFormData, hazard_type: e.target.value as 'B' | 'C' | 'P' | '' })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="">선택</option>
                    <option value="B">B - 생물학적</option>
                    <option value="C">C - 화학적</option>
                    <option value="P">P - 물리적</option>
                  </select>
                </div>
                <div>
                  <Label>정렬 순서</Label>
                  <input
                    type="number"
                    value={masterFormData.sort_order}
                    onChange={(e) => setMasterFormData({ ...masterFormData, sort_order: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div>
                <Label>모니터링 빈도</Label>
                <input
                  type="text"
                  value={masterFormData.monitoring_frequency}
                  onChange={(e) => setMasterFormData({ ...masterFormData, monitoring_frequency: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="예: 시작전/2시간마다/변경시/종료"
                />
              </div>

              <div>
                <Label>설명</Label>
                <textarea
                  value={masterFormData.description}
                  onChange={(e) => setMasterFormData({ ...masterFormData, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowMasterModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingMaster ? '수정' : '추가'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Item Modal */}
      {showItemModal && selectedMaster && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold">
                  {editingItem ? 'CCP 항목 수정' : 'CCP 항목 추가'}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  그룹: {selectedMaster.master_code} ({selectedMaster.process_name})
                </p>
              </div>
              <button onClick={() => setShowItemModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleItemSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label required>항목 코드</Label>
                  <input
                    type="text"
                    value={itemFormData.item_code}
                    onChange={(e) => setItemFormData({ ...itemFormData, item_code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="예: TEMP, TIME, CORE"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    CCP 코드: CCP-{selectedMaster.master_code}-{itemFormData.item_code || '???'}
                  </p>
                </div>
                <div>
                  <Label required>공정명 (상세)</Label>
                  <input
                    type="text"
                    value={itemFormData.process}
                    onChange={(e) => setItemFormData({ ...itemFormData, process: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="예: 오븐(굽기)-과자-가열온도(°C)"
                    required
                  />
                </div>
              </div>

              <div>
                <Label>위해요소</Label>
                <textarea
                  value={itemFormData.hazard}
                  onChange={(e) => setItemFormData({ ...itemFormData, hazard: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                  placeholder="예: 생물학적 위해요소 - 병원성 미생물 잔존"
                />
              </div>

              <div>
                <Label>관리방법</Label>
                <textarea
                  value={itemFormData.control_measure}
                  onChange={(e) => setItemFormData({ ...itemFormData, control_measure: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                  placeholder="예: 중심온도 85°C 이상 1분간 가열"
                />
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <label className="block text-sm font-medium text-gray-700 mb-3">한계기준</label>
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">측정항목</label>
                    <input
                      type="text"
                      value={itemFormData.critical_limit.parameter}
                      onChange={(e) => setItemFormData({
                        ...itemFormData,
                        critical_limit: { ...itemFormData.critical_limit, parameter: e.target.value }
                      })}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="가열온도"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">최소값</label>
                    <input
                      type="number"
                      value={itemFormData.critical_limit.min}
                      onChange={(e) => setItemFormData({
                        ...itemFormData,
                        critical_limit: { ...itemFormData.critical_limit, min: parseFloat(e.target.value) || 0 }
                      })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">최대값</label>
                    <input
                      type="number"
                      value={itemFormData.critical_limit.max}
                      onChange={(e) => setItemFormData({
                        ...itemFormData,
                        critical_limit: { ...itemFormData.critical_limit, max: parseFloat(e.target.value) || 0 }
                      })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">단위</label>
                    <input
                      type="text"
                      value={itemFormData.critical_limit.unit}
                      onChange={(e) => setItemFormData({
                        ...itemFormData,
                        critical_limit: { ...itemFormData.critical_limit, unit: e.target.value }
                      })}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="°C"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>모니터링 방법</Label>
                  <input
                    type="text"
                    value={itemFormData.monitoring_method}
                    onChange={(e) => setItemFormData({ ...itemFormData, monitoring_method: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="예: 중심온도계로 측정"
                  />
                </div>
                <div>
                  <Label>점검 주기</Label>
                  <input
                    type="text"
                    value={itemFormData.monitoring_frequency}
                    onChange={(e) => setItemFormData({ ...itemFormData, monitoring_frequency: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="예: 시작전/2시간마다/변경시/종료"
                  />
                </div>
              </div>

              <div>
                <Label>개선조치</Label>
                <textarea
                  value={itemFormData.corrective_action}
                  onChange={(e) => setItemFormData({ ...itemFormData, corrective_action: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                  placeholder="예: 재가열 또는 폐기 처리"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowItemModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingItem ? '수정' : '추가'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
