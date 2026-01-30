'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Thermometer,
  X,
  Edit2,
  Snowflake,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import { Label } from '@/components/ui/label';

interface MonitoringEquipment {
  id: string;
  key: string;
  name: string;
  type: 'freezer' | 'fridge';
  target_temp: number;
  enabled: boolean;
  location?: string;
  sensor_id?: string;
}

export default function EquipmentSettingsPage() {
  const [equipment, setEquipment] = useState<MonitoringEquipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<MonitoringEquipment | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'fridge' as 'freezer' | 'fridge',
    target_temp: 5,
    enabled: true,
    location: '',
  });

  const fetchEquipment = useCallback(async () => {
    try {
      const response = await fetch('/api/haccp/equipment-settings');
      if (response.ok) {
        const data = await response.json();
        setEquipment(data);
      }
    } catch (error) {
      console.error('Failed to fetch equipment:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEquipment();
  }, [fetchEquipment]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (editMode && selectedEquipment) {
        // 개별 수정
        const response = await fetch(`/api/haccp/equipment-settings/${selectedEquipment.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            key: formData.name.replace(/\s+/g, '_'),
          }),
        });

        if (response.ok) {
          fetchEquipment();
          setShowModal(false);
          resetForm();
        }
      } else {
        // 새 장비 추가
        const response = await fetch('/api/haccp/equipment-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            key: formData.name.replace(/\s+/g, '_'),
          }),
        });

        if (response.ok) {
          fetchEquipment();
          setShowModal(false);
          resetForm();
        }
      }
    } catch (error) {
      console.error('Failed to save equipment:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/haccp/equipment-settings/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchEquipment();
        setDeleteConfirm(null);
      }
    } catch (error) {
      console.error('Failed to delete equipment:', error);
    }
  };

  const handleToggleEnabled = async (eq: MonitoringEquipment) => {
    try {
      const response = await fetch(`/api/haccp/equipment-settings/${eq.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !eq.enabled }),
      });

      if (response.ok) {
        fetchEquipment();
      }
    } catch (error) {
      console.error('Failed to toggle equipment:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'fridge',
      target_temp: 5,
      enabled: true,
      location: '',
    });
    setEditMode(false);
    setSelectedEquipment(null);
  };

  const handleEdit = (eq: MonitoringEquipment) => {
    setSelectedEquipment(eq);
    setFormData({
      name: eq.name,
      type: eq.type,
      target_temp: eq.target_temp,
      enabled: eq.enabled,
      location: eq.location || '',
    });
    setEditMode(true);
    setShowModal(true);
  };

  const handleTypeChange = (type: 'freezer' | 'fridge') => {
    setFormData({
      ...formData,
      type,
      target_temp: type === 'freezer' ? -18 : 5,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/equipment" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">모니터링 장비 설정</h1>
            <p className="mt-1 text-sm text-gray-500">온도 모니터링 대상 장비를 설정합니다</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => fetchEquipment()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            새로고침
          </button>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            장비 추가
          </button>
        </div>
      </div>

      {/* Equipment List */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-4 border-b">
          <h2 className="font-semibold">등록된 모니터링 장비</h2>
          <p className="text-sm text-gray-500 mt-1">
            총 {equipment.length}개의 장비가 등록되어 있습니다
          </p>
        </div>

        {equipment.length === 0 ? (
          <div className="p-12 text-center">
            <Thermometer className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">등록된 장비가 없습니다</p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-4 text-blue-600 hover:text-blue-700"
            >
              새 장비 등록하기
            </button>
          </div>
        ) : (
          <div className="divide-y">
            {equipment.map((eq) => (
              <div
                key={eq.id}
                className={`p-4 flex items-center justify-between hover:bg-gray-50 ${
                  !eq.enabled ? 'opacity-50' : ''
                }`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      eq.type === 'freezer' ? 'bg-blue-100' : 'bg-cyan-100'
                    }`}
                  >
                    {eq.type === 'freezer' ? (
                      <Snowflake className="w-5 h-5 text-blue-600" />
                    ) : (
                      <Thermometer className="w-5 h-5 text-cyan-600" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-medium">{eq.name}</h3>
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      <span>{eq.type === 'freezer' ? '냉동' : '냉장'}</span>
                      <span>기준: {eq.target_temp}°C</span>
                      {eq.location && <span>위치: {eq.location}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleEnabled(eq)}
                    className={`px-3 py-1.5 text-sm rounded-lg ${
                      eq.enabled
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {eq.enabled ? '활성' : '비활성'}
                  </button>
                  <button
                    onClick={() => handleEdit(eq)}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                    title="수정"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(eq.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    title="삭제"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Card */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-800 mb-2">모니터링 장비 설정 안내</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>- 냉동 장비는 기본 기준온도 -18°C, 냉장 장비는 5°C입니다</li>
          <li>- 비활성화된 장비는 모니터링 대시보드에 표시되지 않습니다</li>
          <li>- IoT 센서와 연결하면 자동으로 온도가 기록됩니다</li>
        </ul>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-bold mb-2">장비 삭제</h3>
            <p className="text-gray-600 mb-4">
              이 장비를 삭제하시겠습니까? 관련된 온도 기록은 유지됩니다.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">
                {editMode ? '장비 수정' : '새 장비 등록'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label required>장비 이름</Label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="예: 냉동창고, 배합실 냉장고"
                  required
                />
              </div>

              <div>
                <Label required>장비 유형</Label>
                <div className="grid grid-cols-2 gap-3 mt-1">
                  <button
                    type="button"
                    onClick={() => handleTypeChange('fridge')}
                    className={`p-4 border rounded-lg text-left transition-colors ${
                      formData.type === 'fridge'
                        ? 'border-cyan-500 bg-cyan-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Thermometer
                        className={`w-5 h-5 ${
                          formData.type === 'fridge' ? 'text-cyan-600' : 'text-gray-400'
                        }`}
                      />
                      <span className="font-medium">냉장</span>
                    </div>
                    <p className="text-sm text-gray-500">0~10°C 범위</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTypeChange('freezer')}
                    className={`p-4 border rounded-lg text-left transition-colors ${
                      formData.type === 'freezer'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Snowflake
                        className={`w-5 h-5 ${
                          formData.type === 'freezer' ? 'text-blue-600' : 'text-gray-400'
                        }`}
                      />
                      <span className="font-medium">냉동</span>
                    </div>
                    <p className="text-sm text-gray-500">-18°C 이하</p>
                  </button>
                </div>
              </div>

              <div>
                <Label required>기준 온도 (°C)</Label>
                <input
                  type="number"
                  value={formData.target_temp}
                  onChange={(e) =>
                    setFormData({ ...formData, target_temp: parseFloat(e.target.value) })
                  }
                  className="w-full px-3 py-2 border rounded-lg"
                  step="0.1"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  {formData.type === 'freezer'
                    ? '냉동 장비는 이 온도 이하를 유지해야 합니다'
                    : '냉장 장비는 이 온도 이하를 유지해야 합니다'}
                </p>
              </div>

              <div>
                <Label>설치 위치</Label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="예: 주방, 창고"
                />
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.enabled}
                    onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm">모니터링 활성화</span>
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      저장 중...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      {editMode ? '수정' : '저장'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
