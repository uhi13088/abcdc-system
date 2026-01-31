'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Building2, Edit, Trash2, X, Phone, Mail, MapPin } from 'lucide-react';

declare global {
  interface Window {
    daum: {
      Postcode: new (config: {
        oncomplete: (data: DaumPostcodeData) => void;
      }) => { open: () => void };
    };
  }
}

interface DaumPostcodeData {
  zonecode: string;
  roadAddress: string;
  jibunAddress: string;
  userSelectedType: string;
  bname: string;
  buildingName: string;
  apartment: string;
}

// 전화번호 포맷팅
const formatPhoneNumber = (value: string): string => {
  const numbers = value.replace(/[^0-9]/g, '').slice(0, 11);
  if (numbers.length <= 3) return numbers;
  if (numbers.startsWith('02')) {
    if (numbers.length <= 5) return `${numbers.slice(0, 2)}-${numbers.slice(2)}`;
    if (numbers.length <= 9) return `${numbers.slice(0, 2)}-${numbers.slice(2, 5)}-${numbers.slice(5)}`;
    return `${numbers.slice(0, 2)}-${numbers.slice(2, 6)}-${numbers.slice(6)}`;
  }
  if (numbers.length <= 6) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
  if (numbers.length <= 10) return `${numbers.slice(0, 3)}-${numbers.slice(3, 6)}-${numbers.slice(6)}`;
  return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
};

interface Supplier {
  id: string;
  code: string;
  name: string;
  contact: string;
  phone: string;
  email: string;
  address: string;
  address_detail: string;
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
    address_detail: '',
    certifications: [] as string[],
  });

  // 다음 우편번호 스크립트 로드
  useEffect(() => {
    const script = document.createElement('script');
    script.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
    script.async = true;
    document.head.appendChild(script);
    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  // 주소 검색 핸들러
  const handleAddressSearch = useCallback(() => {
    if (typeof window !== 'undefined' && window.daum?.Postcode) {
      new window.daum.Postcode({
        oncomplete: (data: DaumPostcodeData) => {
          const roadAddr = data.roadAddress;
          let extraAddr = '';
          if (data.userSelectedType === 'R') {
            if (data.bname !== '' && /[동|로|가]$/g.test(data.bname)) {
              extraAddr += data.bname;
            }
            if (data.buildingName !== '' && data.apartment === 'Y') {
              extraAddr += extraAddr !== '' ? ', ' + data.buildingName : data.buildingName;
            }
          }
          const fullAddress = extraAddr !== '' ? `${roadAddr} (${extraAddr})` : roadAddr;
          setFormData(prev => ({ ...prev, address: fullAddress }));
        },
      }).open();
    }
  }, []);

  // 전화번호 변경 핸들러
  const handlePhoneChange = (value: string) => {
    setFormData({ ...formData, phone: formatPhoneNumber(value) });
  };

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
      address_detail: supplier.address_detail || '',
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
    setFormData({ code: '', name: '', contact: '', phone: '', email: '', address: '', address_detail: '', certifications: [] });
    setEditingSupplier(null);
  };

  const generateSupplierCode = () => {
    const prefix = 'SUP';
    const existingCodes = suppliers
      .filter(s => s.code?.startsWith(prefix))
      .map(s => {
        const num = parseInt(s.code.replace(prefix + '-', ''));
        return isNaN(num) ? 0 : num;
      });
    const nextNum = existingCodes.length > 0 ? Math.max(...existingCodes) + 1 : 1;
    return `${prefix}-${String(nextNum).padStart(3, '0')}`;
  };

  const openNewModal = () => {
    resetForm();
    setFormData(prev => ({ ...prev, code: generateSupplierCode() }));
    setShowModal(true);
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
                {(supplier.address || supplier.address_detail) && (
                  <p className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span className="truncate">
                      {supplier.address}
                      {supplier.address_detail && ` ${supplier.address_detail}`}
                    </span>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setShowModal(false); resetForm(); }}>
          <div className="bg-white rounded-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">{editingSupplier ? '공급업체 수정' : '공급업체 등록'}</h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
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
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder="000-0000-0000"
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
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.address}
                    readOnly
                    placeholder="주소 검색 버튼을 클릭하세요"
                    className="flex-1 px-3 py-2 border rounded-lg bg-gray-50"
                  />
                  <button
                    type="button"
                    onClick={handleAddressSearch}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
                  >
                    <Search className="w-4 h-4" />
                    검색
                  </button>
                </div>
                <input
                  type="text"
                  value={formData.address_detail}
                  onChange={(e) => setFormData({ ...formData, address_detail: e.target.value })}
                  placeholder="상세주소 (건물명, 동/호수 등)"
                  className="w-full px-3 py-2 border rounded-lg mt-2"
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
