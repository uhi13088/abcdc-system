'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, X, Package } from 'lucide-react';
import { Label } from '@/components/ui/label';

interface PackingSpec {
  id: string;
  name: string;
  description: string;
  dimensions: string;
  weight_unit: string;
  pieces_per_box: number;
  sort_order: number;
  is_active: boolean;
}

export default function PackingSpecsPage() {
  const [specs, setSpecs] = useState<PackingSpec[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSpec, setEditingSpec] = useState<PackingSpec | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    dimensions: '',
    weight_unit: 'g',
    pieces_per_box: 1,
    sort_order: 0,
  });

  useEffect(() => {
    fetchSpecs();
  }, []);

  const fetchSpecs = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/haccp/packing-specs');
      if (response.ok) {
        const data = await response.json();
        setSpecs(data);
      }
    } catch (error) {
      console.error('Failed to fetch packing specs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editingSpec ? 'PUT' : 'POST';
      const body = editingSpec
        ? { id: editingSpec.id, ...formData }
        : formData;

      const response = await fetch('/api/haccp/packing-specs', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        setShowModal(false);
        setEditingSpec(null);
        fetchSpecs();
        resetForm();
      }
    } catch (error) {
      console.error('Failed to save packing spec:', error);
    }
  };

  const handleEdit = (spec: PackingSpec) => {
    setEditingSpec(spec);
    setFormData({
      name: spec.name,
      description: spec.description || '',
      dimensions: spec.dimensions || '',
      weight_unit: spec.weight_unit || 'g',
      pieces_per_box: spec.pieces_per_box || 1,
      sort_order: spec.sort_order || 0,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
      const response = await fetch(`/api/haccp/packing-specs?id=${id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        fetchSpecs();
      }
    } catch (error) {
      console.error('Failed to delete packing spec:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      dimensions: '',
      weight_unit: 'g',
      pieces_per_box: 1,
      sort_order: 0,
    });
    setEditingSpec(null);
  };

  const openNewModal = () => {
    resetForm();
    setShowModal(true);
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">패킹 규격 관리</h1>
          <p className="mt-1 text-sm text-gray-500">제품 패킹 규격을 미리 정의하여 제품 등록 시 선택할 수 있습니다</p>
        </div>
        <button
          onClick={openNewModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          패킹 규격 추가
        </button>
      </div>

      {/* Specs Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">순서</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">규격명</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">설명</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">크기</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">단위</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">입수량</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {specs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    등록된 패킹 규격이 없습니다
                  </td>
                </tr>
              ) : (
                specs.map((spec) => (
                  <tr key={spec.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-500">{spec.sort_order}</td>
                    <td className="px-6 py-4 text-sm font-medium">{spec.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{spec.description || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{spec.dimensions || '-'}</td>
                    <td className="px-6 py-4 text-sm">{spec.weight_unit}</td>
                    <td className="px-6 py-4 text-sm">{spec.pieces_per_box}개</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleEdit(spec)}
                        className="p-1 hover:bg-gray-100 rounded mr-1"
                      >
                        <Edit className="w-4 h-4 text-gray-500" />
                      </button>
                      <button
                        onClick={() => handleDelete(spec.id)}
                        className="p-1 hover:bg-red-100 rounded"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">
                {editingSpec ? '패킹 규격 수정' : '패킹 규격 추가'}
              </h2>
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label required>규격명</Label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="예: 소형박스, 대형박스"
                  required
                />
              </div>
              <div>
                <Label>설명</Label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="예: 쿠키류 전용 소형 포장"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>크기 (가로x세로x높이)</Label>
                  <input
                    type="text"
                    value={formData.dimensions}
                    onChange={(e) => setFormData({ ...formData, dimensions: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="예: 20x15x10cm"
                  />
                </div>
                <div>
                  <Label>중량 단위</Label>
                  <select
                    value={formData.weight_unit}
                    onChange={(e) => setFormData({ ...formData, weight_unit: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="g">g</option>
                    <option value="kg">kg</option>
                    <option value="ml">ml</option>
                    <option value="L">L</option>
                    <option value="ea">개 (ea)</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>박스당 입수량</Label>
                  <input
                    type="number"
                    value={formData.pieces_per_box}
                    onChange={(e) => setFormData({ ...formData, pieces_per_box: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border rounded-lg"
                    min={1}
                  />
                </div>
                <div>
                  <Label>정렬 순서</Label>
                  <input
                    type="number"
                    value={formData.sort_order}
                    onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingSpec ? '수정' : '추가'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
