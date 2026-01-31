'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Search,
  Building2,
  Phone,
  Mail,
  MapPin,
  Edit2,
  Trash2,
  X,
  User,
  FileText,
} from 'lucide-react';

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

// 사업자등록번호 포맷팅 (000-00-00000)
const formatBusinessNumber = (value: string): string => {
  const numbers = value.replace(/[^0-9]/g, '').slice(0, 10);
  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 5) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
  return `${numbers.slice(0, 3)}-${numbers.slice(3, 5)}-${numbers.slice(5)}`;
};

// 전화번호 포맷팅
const formatPhoneNumber = (value: string): string => {
  const numbers = value.replace(/[^0-9]/g, '').slice(0, 11);

  if (numbers.length <= 3) return numbers;

  // 02로 시작하는 서울 지역번호
  if (numbers.startsWith('02')) {
    if (numbers.length <= 5) return `${numbers.slice(0, 2)}-${numbers.slice(2)}`;
    if (numbers.length <= 9) return `${numbers.slice(0, 2)}-${numbers.slice(2, 5)}-${numbers.slice(5)}`;
    return `${numbers.slice(0, 2)}-${numbers.slice(2, 6)}-${numbers.slice(6)}`;
  }

  // 010, 011 등 휴대폰 또는 3자리 지역번호
  if (numbers.length <= 6) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
  if (numbers.length <= 10) return `${numbers.slice(0, 3)}-${numbers.slice(3, 6)}-${numbers.slice(6)}`;
  return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
};

interface Customer {
  id: string;
  name: string;
  business_number: string | null;
  representative: string | null;
  phone: string | null;
  fax: string | null;
  email: string | null;
  address: string | null;
  postal_code: string | null;
  contact_person: string | null;
  contact_phone: string | null;
  payment_terms: string | null;
  notes: string | null;
  status: string;
  created_at: string;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [detailAddress, setDetailAddress] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    business_number: '',
    representative: '',
    phone: '',
    fax: '',
    email: '',
    address: '',
    postal_code: '',
    contact_person: '',
    contact_phone: '',
    payment_terms: '',
    notes: '',
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

          setFormData(prev => ({
            ...prev,
            postal_code: data.zonecode,
            address: fullAddress,
          }));
          setDetailAddress('');
        },
      }).open();
    }
  }, []);

  // 사업자등록번호 변경 핸들러
  const handleBusinessNumberChange = (value: string) => {
    setFormData({ ...formData, business_number: formatBusinessNumber(value) });
  };

  // 전화번호 변경 핸들러
  const handlePhoneChange = (field: 'phone' | 'fax' | 'contact_phone', value: string) => {
    setFormData({ ...formData, [field]: formatPhoneNumber(value) });
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/haccp/customers');
      if (response.ok) {
        const data = await response.json();
        setCustomers(data);
      }
    } catch (error) {
      console.error('Failed to fetch customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 상세 주소가 있으면 기본 주소와 합침
    const fullAddress = detailAddress
      ? `${formData.address} ${detailAddress}`
      : formData.address;

    const submitData = {
      ...formData,
      address: fullAddress,
    };

    try {
      if (editingCustomer) {
        // Update
        const response = await fetch('/api/haccp/customers', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingCustomer.id, ...submitData }),
        });

        if (response.ok) {
          await fetchCustomers();
          closeModal();
        }
      } else {
        // Insert
        const response = await fetch('/api/haccp/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(submitData),
        });

        if (response.ok) {
          await fetchCustomers();
          closeModal();
        }
      }
    } catch (error) {
      console.error('Failed to save customer:', error);
    }
  };

  const handleDelete = async (customer: Customer) => {
    if (!confirm(`"${customer.name}" 고객을 삭제하시겠습니까?`)) return;

    try {
      const response = await fetch(`/api/haccp/customers?id=${customer.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchCustomers();
      }
    } catch (error) {
      console.error('Failed to delete customer:', error);
    }
  };

  const openEditModal = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      business_number: customer.business_number || '',
      representative: customer.representative || '',
      phone: customer.phone || '',
      fax: customer.fax || '',
      email: customer.email || '',
      address: customer.address || '',
      postal_code: customer.postal_code || '',
      contact_person: customer.contact_person || '',
      contact_phone: customer.contact_phone || '',
      payment_terms: customer.payment_terms || '',
      notes: customer.notes || '',
    });
    setDetailAddress('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCustomer(null);
    setFormData({
      name: '',
      business_number: '',
      representative: '',
      phone: '',
      fax: '',
      email: '',
      address: '',
      postal_code: '',
      contact_person: '',
      contact_phone: '',
      payment_terms: '',
      notes: '',
    });
    setDetailAddress('');
  };

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.business_number?.includes(searchTerm) ||
    c.contact_person?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">고객 관리</h1>
          <p className="mt-1 text-sm text-gray-500">
            거래처/고객 정보를 관리합니다
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          고객 등록
        </button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="고객명, 사업자번호, 담당자로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Customer List */}
      {filteredCustomers.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">
            {searchTerm ? '검색 결과가 없습니다' : '등록된 고객이 없습니다'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredCustomers.map((customer) => (
            <div
              key={customer.id}
              className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{customer.name}</h3>
                    {customer.business_number && (
                      <p className="text-xs text-gray-500">{customer.business_number}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEditModal(customer)}
                    className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(customer)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                {customer.representative && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <User className="w-4 h-4 text-gray-400" />
                    <span>대표: {customer.representative}</span>
                  </div>
                )}
                {customer.phone && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span>{customer.phone}</span>
                  </div>
                )}
                {customer.email && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span className="truncate">{customer.email}</span>
                  </div>
                )}
                {customer.address && (
                  <div className="flex items-start gap-2 text-gray-600">
                    <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{customer.address}</span>
                  </div>
                )}
                {customer.contact_person && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <FileText className="w-4 h-4 text-gray-400" />
                    <span>담당: {customer.contact_person} {customer.contact_phone && `(${customer.contact_phone})`}</span>
                  </div>
                )}
              </div>

              {customer.payment_terms && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <span className="text-xs text-gray-500">결제조건: {customer.payment_terms}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={closeModal}>
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 pb-4 border-b">
              <h2 className="text-lg font-semibold">
                {editingCustomer ? '고객 수정' : '고객 등록'}
              </h2>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 기본 정보 */}
                <div className="md:col-span-2">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">기본 정보</h3>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    거래처명 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    사업자등록번호
                  </label>
                  <input
                    type="text"
                    value={formData.business_number}
                    onChange={(e) => handleBusinessNumberChange(e.target.value)}
                    placeholder="000-00-00000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    대표자명
                  </label>
                  <input
                    type="text"
                    value={formData.representative}
                    onChange={(e) => setFormData({ ...formData, representative: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    결제조건
                  </label>
                  <select
                    value={formData.payment_terms}
                    onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="">선택</option>
                    <option value="현금">현금</option>
                    <option value="30일">30일</option>
                    <option value="60일">60일</option>
                    <option value="90일">90일</option>
                    <option value="월말">월말</option>
                  </select>
                </div>

                {/* 연락처 정보 */}
                <div className="md:col-span-2 mt-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">연락처 정보</h3>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    전화번호
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handlePhoneChange('phone', e.target.value)}
                    placeholder="000-0000-0000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    팩스번호
                  </label>
                  <input
                    type="tel"
                    value={formData.fax}
                    onChange={(e) => handlePhoneChange('fax', e.target.value)}
                    placeholder="000-0000-0000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    이메일
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>

                {/* 주소 정보 */}
                <div className="md:col-span-2 mt-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">주소 정보</h3>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    우편번호
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formData.postal_code}
                      readOnly
                      placeholder="우편번호"
                      className="w-32 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={handleAddressSearch}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
                    >
                      <Search className="w-4 h-4" />
                      주소 검색
                    </button>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    기본 주소
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    readOnly
                    placeholder="주소 검색 버튼을 클릭하세요"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    상세 주소
                  </label>
                  <input
                    type="text"
                    value={detailAddress}
                    onChange={(e) => setDetailAddress(e.target.value)}
                    placeholder="상세 주소를 입력하세요"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>

                {/* 담당자 정보 */}
                <div className="md:col-span-2 mt-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">담당자 정보</h3>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    담당자명
                  </label>
                  <input
                    type="text"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    담당자 연락처
                  </label>
                  <input
                    type="tel"
                    value={formData.contact_phone}
                    onChange={(e) => handlePhoneChange('contact_phone', e.target.value)}
                    placeholder="000-0000-0000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>

                {/* 메모 */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    메모
                  </label>
                  <textarea
                    rows={3}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
              </div>
            </form>

            <div className="flex gap-3 p-6 pt-4 border-t">
              <button
                type="button"
                onClick={closeModal}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="submit"
                onClick={handleSubmit}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
              >
                {editingCustomer ? '수정' : '등록'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
