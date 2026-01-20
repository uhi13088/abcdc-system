'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus, Search, Layers, Building2, MapPin, Edit, Trash2, X } from 'lucide-react';
import { Label } from '@/components/ui/label';

interface Brand {
  id: string;
  name: string;
  company_id: string;
  company_name: string;
  category: string;
  description?: string;
  stores_count: number;
  status: 'ACTIVE' | 'INACTIVE';
}

interface Company {
  id: string;
  name: string;
}

const initialFormData = {
  name: '',
  company_id: '',
  category: '',
  description: '',
};

export default function BrandsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
      <BrandsContent />
    </Suspense>
  );
}

function BrandsContent() {
  const searchParams = useSearchParams();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [formData, setFormData] = useState(initialFormData);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchBrands();
    fetchCompanies();
    if (searchParams.get('new') === 'true') {
      setShowModal(true);
    }
  }, [searchParams]);

  const fetchBrands = async () => {
    try {
      const response = await fetch('/api/brands');
      if (response.ok) {
        const data = await response.json();
        setBrands(data.map((b: any) => ({
          id: b.id,
          name: b.name,
          company_id: b.company_id,
          company_name: b.company_name || '알 수 없음',
          category: b.category || '미분류',
          description: b.description,
          stores_count: b.stores_count || 0,
          status: b.status || 'ACTIVE',
        })));
      }
    } catch (error) {
      console.error('Failed to fetch brands:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanies = async () => {
    try {
      const response = await fetch('/api/companies');
      if (response.ok) {
        const data = await response.json();
        setCompanies(data);
      }
    } catch (error) {
      console.error('Failed to fetch companies:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const url = editingBrand ? `/api/brands/${editingBrand.id}` : '/api/brands';
      const method = editingBrand ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setShowModal(false);
        setEditingBrand(null);
        setFormData(initialFormData);
        fetchBrands();
      } else {
        const data = await response.json();
        setError(data.error || '저장에 실패했습니다.');
      }
    } catch (err) {
      setError('저장에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (brand: Brand) => {
    setEditingBrand(brand);
    setFormData({
      name: brand.name,
      company_id: brand.company_id || '',
      category: brand.category || '',
      description: brand.description || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (brand: Brand) => {
    if (!confirm(`"${brand.name}" 브랜드를 비활성화하시겠습니까?`)) return;

    try {
      const response = await fetch(`/api/brands/${brand.id}`, { method: 'DELETE' });
      if (response.ok) {
        fetchBrands();
      } else {
        alert('비활성화에 실패했습니다.');
      }
    } catch (err) {
      alert('비활성화에 실패했습니다.');
    }
  };

  const openNewModal = () => {
    setEditingBrand(null);
    setFormData(initialFormData);
    setError('');
    setShowModal(true);
  };

  const filteredBrands = brands.filter(
    (brand) =>
      brand.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      brand.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      brand.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">브랜드 관리</h1>
          <p className="text-gray-600">모든 회사의 브랜드를 관리합니다</p>
        </div>
        <button
          onClick={openNewModal}
          className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-700"
        >
          <Plus className="w-5 h-5 mr-2" />
          브랜드 등록
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="브랜드명, 회사명, 카테고리로 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredBrands.map((brand) => (
          <div key={brand.id} className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <Layers className="w-6 h-6 text-primary" />
                </div>
                <div className="ml-4">
                  <h3 className="font-semibold text-gray-900">{brand.name}</h3>
                  <p className="text-sm text-gray-500">{brand.category}</p>
                </div>
              </div>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => handleEdit(brand)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(brand)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center text-gray-500">
                  <Building2 className="w-4 h-4 mr-1" />
                  {brand.company_name}
                </span>
                <span className="flex items-center text-gray-500">
                  <MapPin className="w-4 h-4 mr-1" />
                  {brand.stores_count}개 매장
                </span>
              </div>
            </div>
            <div className="mt-2">
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                brand.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {brand.status === 'ACTIVE' ? '활성' : '비활성'}
              </span>
            </div>
          </div>
        ))}
        {filteredBrands.length === 0 && (
          <div className="col-span-full py-12 text-center text-gray-500">
            {searchTerm ? '검색 결과가 없습니다.' : '등록된 브랜드가 없습니다.'}
          </div>
        )}
      </div>

      {/* Add/Edit Brand Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">
                {editingBrand ? '브랜드 수정' : '새 브랜드 등록'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-md text-sm">{error}</div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label required>브랜드명</Label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <Label required>회사</Label>
                <select
                  required
                  value={formData.company_id}
                  onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="">회사 선택</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>{company.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="예: 치킨, 카페, 베이커리..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {submitting ? '저장 중...' : editingBrand ? '수정' : '등록'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
