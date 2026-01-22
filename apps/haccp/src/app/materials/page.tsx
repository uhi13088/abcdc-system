'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Package, Edit, Trash2, X } from 'lucide-react';
import { Label } from '@/components/ui/label';

interface Material {
  id: string;
  code: string;
  name: string;
  type: '원료' | '부재료' | '포장재';
  supplier_id: string | null;
  supplier_name?: string;
  specification: string;
  storage_temp: string;
  shelf_life: number;
  unit: string;
  status: string;
}

interface Supplier {
  id: string;
  name: string;
}

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    type: '원료' as const,
    supplier_id: '',
    specification: '',
    storage_temp: '',
    shelf_life: 0,
    unit: 'kg',
  });

  useEffect(() => {
    fetchMaterials();
    fetchSuppliers();
  }, []);

  const fetchMaterials = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/haccp/materials');
      if (response.ok) {
        const data = await response.json();
        setMaterials(data);
      }
    } catch (error) {
      console.error('Failed to fetch materials:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const response = await fetch('/api/haccp/suppliers');
      if (response.ok) {
        const data = await response.json();
        setSuppliers(data);
      }
    } catch (error) {
      console.error('Failed to fetch suppliers:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/haccp/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setShowModal(false);
        fetchMaterials();
        setFormData({ code: '', name: '', type: '원료', supplier_id: '', specification: '', storage_temp: '', shelf_life: 0, unit: 'kg' });
      }
    } catch (error) {
      console.error('Failed to create material:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
      await fetch(`/api/haccp/materials/${id}`, { method: 'DELETE' });
      fetchMaterials();
    } catch (error) {
      console.error('Failed to delete material:', error);
    }
  };

  const filteredMaterials = materials.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const typeColors = {
    '원료': 'bg-blue-100 text-blue-700',
    '부재료': 'bg-green-100 text-green-700',
    '포장재': 'bg-purple-100 text-purple-700',
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">원부재료 관리</h1>
          <p className="mt-1 text-sm text-gray-500">원료, 부재료, 포장재 마스터 데이터를 관리합니다</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          원부재료 등록
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="원부재료명 또는 코드 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg"
          />
        </div>
      </div>

      {/* Materials Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">코드</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">원부재료명</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">구분</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">공급업체</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">보관온도</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">유통기한</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredMaterials.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    등록된 원부재료가 없습니다
                  </td>
                </tr>
              ) : (
                filteredMaterials.map((material) => (
                  <tr key={material.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-mono">{material.code}</td>
                    <td className="px-6 py-4 text-sm font-medium">{material.name}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${typeColors[material.type]}`}>
                        {material.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{material.supplier_name || '-'}</td>
                    <td className="px-6 py-4 text-sm">{material.storage_temp || '-'}</td>
                    <td className="px-6 py-4 text-sm">{material.shelf_life ? `${material.shelf_life}일` : '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        material.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {material.status === 'ACTIVE' ? '사용중' : '중단'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-1 hover:bg-gray-100 rounded mr-1">
                        <Edit className="w-4 h-4 text-gray-500" />
                      </button>
                      <button onClick={() => handleDelete(material.id)} className="p-1 hover:bg-red-100 rounded">
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
              <h2 className="text-xl font-bold">원부재료 등록</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label required>코드</Label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <Label required>원부재료명</Label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>구분</Label>
                  <select
                    value={formData.type}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="원료">원료</option>
                    <option value="부재료">부재료</option>
                    <option value="포장재">포장재</option>
                  </select>
                </div>
                <div>
                  <Label>공급업체</Label>
                  <select
                    value={formData.supplier_id}
                    onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="">선택하세요</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <Label>규격</Label>
                <input
                  type="text"
                  value={formData.specification}
                  onChange={(e) => setFormData({ ...formData, specification: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>보관온도</Label>
                  <input
                    type="text"
                    value={formData.storage_temp}
                    onChange={(e) => setFormData({ ...formData, storage_temp: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="예: 0~5°C"
                  />
                </div>
                <div>
                  <Label>유통기한 (일)</Label>
                  <input
                    type="number"
                    value={formData.shelf_life}
                    onChange={(e) => setFormData({ ...formData, shelf_life: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <Label>단위</Label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="L">L</option>
                    <option value="mL">mL</option>
                    <option value="ea">ea</option>
                    <option value="box">box</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">
                  취소
                </button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  등록
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
