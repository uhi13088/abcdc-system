'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Building2, Edit, Trash2, X, Phone, Mail, MapPin } from 'lucide-react';

interface Supplier {
  id: string;
  code: string;
  name: string;
  contact: string;
  phone: string;
  email: string;
  address: string;
  certifications: string[];
  status: string;
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    contact: '',
    phone: '',
    email: '',
    address: '',
    certifications: [] as string[],
  });

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/haccp/suppliers');
      if (response.ok) {
        const data = await response.json();
        setSuppliers(data);
      }
    } catch (error) {
      console.error('Failed to fetch suppliers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editingSupplier ? 'PUT' : 'POST';
      const body = editingSupplier
        ? { id: editingSupplier.id, ...formData }
        : formData;

      const response = await fetch('/api/haccp/suppliers', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        setShowModal(false);
        setEditingSupplier(null);
        fetchSuppliers();
        resetForm();
      }
    } catch (error) {
      console.error('Failed to save supplier:', error);
    }
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      code: supplier.code || '',
      name: supplier.name || '',
      contact: supplier.contact || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      certifications: supplier.certifications || [],
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
      await fetch(`/api/haccp/suppliers/${id}`, { method: 'DELETE' });
      fetchSuppliers();
    } catch (error) {
      console.error('Failed to delete supplier:', error);
    }
  };

  const resetForm = () => {
    setFormData({ code: '', name: '', contact: '', phone: '', email: '', address: '', certifications: [] });
    setEditingSupplier(null);
  };

  const openNewModal = () => {
    resetForm();
    setShowModal(true);
  };

  const handleAutoFill = () => {
    const sampleSuppliers = [
      { code: 'SUP-2024-001', name: '대한식자재', contact: '김영수', phone: '02-1234-5678', email: 'contact@daehansikjajae.co.kr', address: '서울특별시 강남구 테헤란로 123', certifications: ['HACCP', 'ISO22000'] },
      { code: 'SUP-2024-002', name: '신선농산', contact: '박민호', phone: '031-987-6543', email: 'info@sinsun.co.kr', address: '경기도 용인시 처인구 농업로 456', certifications: ['GAP', 'HACCP'] },
      { code: 'SUP-2024-003', name: '청정축산', contact: '이수진', phone: '033-456-7890', email: 'order@cjchuksan.com', address: '강원도 횡성군 축산로 789', certifications: ['HACCP', 'ISO9001', 'GMP'] },
      { code: 'SUP-2024-004', name: '한국포장재', contact: '최동훈', phone: '02-333-4444', email: 'sales@hankookpack.co.kr', address: '인천광역시 서구 공단로 321', certifications: ['ISO9001', 'FSSC22000'] },
    ];
    const sample = sampleSuppliers[Math.floor(Math.random() * sampleSuppliers.length)];
    setFormData({
      code: sample.code,
      name: sample.name,
      contact: sample.contact,
      phone: sample.phone,
      email: sample.email,
      address: sample.address,
      certifications: sample.certifications,
    });
  };

  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const certificationOptions = ['HACCP', 'ISO22000', 'ISO9001', 'GAP', 'FSSC22000', 'GMP'];

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">공급업체 관리</h1>
          <p className="mt-1 text-sm text-gray-500">원부재료 공급업체 정보를 관리합니다</p>
        </div>
        <button
          onClick={openNewModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          공급업체 등록
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="업체명 또는 코드 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg"
          />
        </div>
      </div>

      {/* Suppliers Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <Building2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">등록된 공급업체가 없습니다</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSuppliers.map((supplier) => (
            <div key={supplier.id} className="bg-white rounded-xl shadow-sm border p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-xs text-gray-400 font-mono">{supplier.code}</p>
                  <h3 className="font-semibold text-gray-900">{supplier.name}</h3>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  supplier.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                }`}>
                  {supplier.status === 'ACTIVE' ? '거래중' : '거래중단'}
                </span>
              </div>

              <div className="space-y-2 text-sm text-gray-600 mb-4">
                {supplier.contact && (
                  <p className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-gray-400" />
                    {supplier.contact}
                  </p>
                )}
                {supplier.phone && (
                  <p className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-400" />
                    {supplier.phone}
                  </p>
                )}
                {supplier.email && (
                  <p className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-gray-400" />
                    {supplier.email}
                  </p>
                )}
                {supplier.address && (
                  <p className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span className="truncate">{supplier.address}</span>
                  </p>
                )}
              </div>

              {supplier.certifications && supplier.certifications.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-4">
                  {supplier.certifications.map((cert, idx) => (
                    <span key={idx} className="px-2 py-0.5 text-xs bg-blue-50 text-blue-600 rounded">
                      {cert}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex justify-end gap-1 pt-3 border-t">
                <button onClick={() => handleEdit(supplier)} className="p-2 hover:bg-gray-100 rounded">
                  <Edit className="w-4 h-4 text-gray-500" />
                </button>
                <button onClick={() => handleDelete(supplier.id)} className="p-2 hover:bg-red-100 rounded">
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">{editingSupplier ? '공급업체 수정' : '공급업체 등록'}</h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <button
                type="button"
                onClick={handleAutoFill}
                className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all shadow-md"
              >
                ✨ 자동 입력 (샘플 데이터)
              </button>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">업체코드</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">업체명</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">담당자</label>
                <input
                  type="text"
                  value={formData.contact}
                  onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">전화번호</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">주소</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">인증</label>
                <div className="flex flex-wrap gap-2">
                  {certificationOptions.map((cert) => (
                    <label key={cert} className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={formData.certifications.includes(cert)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({ ...formData, certifications: [...formData.certifications, cert] });
                          } else {
                            setFormData({ ...formData, certifications: formData.certifications.filter(c => c !== cert) });
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{cert}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">
                  취소
                </button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  {editingSupplier ? '수정' : '등록'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
