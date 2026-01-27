'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Package, Edit, Trash2, X } from 'lucide-react';
import { Label } from '@/components/ui/label';

interface PackingSpec {
  id: string;
  spec_name: string;
  description: string;
}

interface Product {
  id: string;
  code: string;
  name: string;
  category: string;
  specification: string;
  shelf_life: number;
  storage_condition: string;
  manufacturing_report_number: string;
  packing_spec_id: string;
  packing_spec?: PackingSpec;
  status: string;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [packingSpecs, setPackingSpecs] = useState<PackingSpec[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    category: '',
    specification: '',
    shelf_life: 0,
    storage_condition: '',
    manufacturing_report_number: '',
    packing_spec_id: '',
  });

  useEffect(() => {
    fetchProducts();
    fetchPackingSpecs();
  }, []);

  const fetchPackingSpecs = async () => {
    try {
      const response = await fetch('/api/haccp/packing-specs');
      if (response.ok) {
        const data = await response.json();
        setPackingSpecs(data);
      }
    } catch (error) {
      console.error('Failed to fetch packing specs:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/haccp/products');
      if (response.ok) {
        const data = await response.json();
        setProducts(data);
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editingProduct ? 'PUT' : 'POST';
      const body = editingProduct
        ? { id: editingProduct.id, ...formData }
        : formData;

      const response = await fetch('/api/haccp/products', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        setShowModal(false);
        setEditingProduct(null);
        fetchProducts();
        resetForm();
      }
    } catch (error) {
      console.error('Failed to save product:', error);
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      code: product.code || '',
      name: product.name || '',
      category: product.category || '',
      specification: product.specification || '',
      shelf_life: product.shelf_life || 0,
      storage_condition: product.storage_condition || '',
      manufacturing_report_number: product.manufacturing_report_number || '',
      packing_spec_id: product.packing_spec_id || '',
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({ code: '', name: '', category: '', specification: '', shelf_life: 0, storage_condition: '', manufacturing_report_number: '', packing_spec_id: '' });
    setEditingProduct(null);
  };

  const openNewModal = () => {
    resetForm();
    // 제품코드 자동 생성
    generateProductCode();
    setShowModal(true);
  };

  // 제품코드 자동 생성 함수
  const generateProductCode = () => {
    const prefix = 'FP'; // Finished Product
    const existingCodes = products
      .filter(p => p.code?.startsWith(prefix))
      .map(p => {
        const num = parseInt(p.code.replace(prefix + '-', ''));
        return isNaN(num) ? 0 : num;
      });
    const nextNum = existingCodes.length > 0 ? Math.max(...existingCodes) + 1 : 1;
    const newCode = `${prefix}-${String(nextNum).padStart(3, '0')}`;
    setFormData(prev => ({ ...prev, code: newCode }));
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
      await fetch(`/api/haccp/products/${id}`, { method: 'DELETE' });
      fetchProducts();
    } catch (error) {
      console.error('Failed to delete product:', error);
    }
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">제품 관리</h1>
          <p className="mt-1 text-sm text-gray-500">제품 마스터 데이터를 관리합니다</p>
        </div>
        <button
          onClick={openNewModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          제품 등록
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="제품명 또는 제품코드 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg"
          />
        </div>
      </div>

      {/* Products Table */}
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">제품명</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">품목제조보고번호</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">패킹규격</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">유통기한</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    등록된 제품이 없습니다
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-mono">{product.code}</td>
                    <td className="px-6 py-4 text-sm font-medium">{product.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{product.manufacturing_report_number || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{product.packing_spec?.spec_name || '-'}</td>
                    <td className="px-6 py-4 text-sm">{product.shelf_life}일</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        product.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {product.status === 'ACTIVE' ? '사용중' : '중단'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => handleEdit(product)} className="p-1 hover:bg-gray-100 rounded mr-1">
                        <Edit className="w-4 h-4 text-gray-500" />
                      </button>
                      <button onClick={() => handleDelete(product.id)} className="p-1 hover:bg-red-100 rounded">
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
              <h2 className="text-xl font-bold">{editingProduct ? '제품 수정' : '제품 등록'}</h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label required>제품코드</Label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <Label required>제품명</Label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
              </div>
              <div>
                <Label>품목제조보고번호</Label>
                <input
                  type="text"
                  value={formData.manufacturing_report_number}
                  onChange={(e) => setFormData({ ...formData, manufacturing_report_number: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="예: 2024012345"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>카테고리</Label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <Label>패킹 규격</Label>
                  <select
                    value={formData.packing_spec_id}
                    onChange={(e) => setFormData({ ...formData, packing_spec_id: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="">선택하세요</option>
                    {packingSpecs.map((spec) => (
                      <option key={spec.id} value={spec.id}>{spec.spec_name}</option>
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
              <div className="grid grid-cols-2 gap-4">
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
                  <Label>보관조건</Label>
                  <select
                    value={formData.storage_condition}
                    onChange={(e) => setFormData({ ...formData, storage_condition: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="">선택하세요</option>
                    <option value="냉장 (0~10°C)">냉장 (0~10°C)</option>
                    <option value="냉동 (-18°C 이하)">냉동 (-18°C 이하)</option>
                    <option value="실온">실온</option>
                    <option value="서늘한 곳">서늘한 곳</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">
                  취소
                </button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  {editingProduct ? '수정' : '등록'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
