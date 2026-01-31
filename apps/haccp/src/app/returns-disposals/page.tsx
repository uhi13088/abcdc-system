'use client';

import { useState, useEffect } from 'react';
import { Plus, Package, Trash2, RotateCcw, AlertTriangle, X, Edit2, Calendar } from 'lucide-react';
import { Label } from '@/components/ui/label';

interface ReturnDisposal {
  id: string;
  record_date: string;
  record_number: string;
  record_type: 'RETURN' | 'RECALL' | 'DISPOSAL';
  product_id?: string;
  material_id?: string;
  product_name?: string;
  material_name?: string;
  item_name: string;
  lot_number?: string;
  quantity: number;
  unit?: string;
  reason_category: 'QUALITY_DEFECT' | 'EXPIRY' | 'CONTAMINATION' | 'DAMAGE' | 'CUSTOMER_COMPLAINT' | 'RECALL' | 'OTHER';
  reason_detail: string;
  action_taken?: string;
  disposal_method?: 'DESTRUCTION' | 'REPROCESSING' | 'RETURN_TO_SUPPLIER' | 'LANDFILL' | 'INCINERATION' | 'OTHER';
  disposal_date?: string;
  disposal_location?: string;
  disposal_company?: string;
  disposal_cost?: number;
  customer_name?: string;
  customer_contact?: string;
  return_date?: string;
  notes?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  recorded_by_name?: string;
  approved_by_name?: string;
}

interface Product {
  id: string;
  name: string;
  code: string;
}

interface Material {
  id: string;
  name: string;
  code: string;
}

export default function ReturnsDisposalsPage() {
  const [records, setRecords] = useState<ReturnDisposal[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<ReturnDisposal | null>(null);
  const [filterType, setFilterType] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [formData, setFormData] = useState({
    record_type: 'DISPOSAL' as ReturnDisposal['record_type'],
    record_date: new Date().toISOString().split('T')[0],
    item_type: 'product' as 'product' | 'material',
    product_id: '',
    material_id: '',
    item_name: '',
    lot_number: '',
    quantity: 0,
    unit: 'kg',
    reason_category: 'QUALITY_DEFECT' as ReturnDisposal['reason_category'],
    reason_detail: '',
    action_taken: '',
    disposal_method: '' as ReturnDisposal['disposal_method'] | '',
    disposal_date: '',
    disposal_location: '',
    disposal_company: '',
    disposal_cost: 0,
    customer_name: '',
    customer_contact: '',
    return_date: '',
    notes: '',
  });

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, filterStatus]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterType) params.set('type', filterType);
      if (filterStatus) params.set('status', filterStatus);

      const [recordsRes, productsRes, materialsRes] = await Promise.all([
        fetch(`/api/haccp/returns-disposals?${params}`),
        fetch('/api/haccp/products'),
        fetch('/api/haccp/materials'),
      ]);

      if (recordsRes.ok) setRecords(await recordsRes.json());
      if (productsRes.ok) setProducts(await productsRes.json());
      if (materialsRes.ok) setMaterials(await materialsRes.json());
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editMode ? 'PUT' : 'POST';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body: any = {
        record_type: formData.record_type,
        record_date: formData.record_date,
        item_name: formData.item_name,
        lot_number: formData.lot_number,
        quantity: formData.quantity,
        unit: formData.unit,
        reason_category: formData.reason_category,
        reason_detail: formData.reason_detail,
        action_taken: formData.action_taken,
        notes: formData.notes,
      };

      if (formData.item_type === 'product' && formData.product_id) {
        body.product_id = formData.product_id;
      } else if (formData.item_type === 'material' && formData.material_id) {
        body.material_id = formData.material_id;
      }

      if (formData.record_type === 'DISPOSAL') {
        body.disposal_method = formData.disposal_method;
        body.disposal_date = formData.disposal_date;
        body.disposal_location = formData.disposal_location;
        body.disposal_company = formData.disposal_company;
        body.disposal_cost = formData.disposal_cost || null;
      } else if (formData.record_type === 'RETURN' || formData.record_type === 'RECALL') {
        body.customer_name = formData.customer_name;
        body.customer_contact = formData.customer_contact;
        body.return_date = formData.return_date;
      }

      if (editMode) {
        body.id = selectedRecord?.id;
      }

      const response = await fetch('/api/haccp/returns-disposals', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        setShowModal(false);
        fetchData();
        resetForm();
      }
    } catch (error) {
      console.error('Failed to save record:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      record_type: 'DISPOSAL',
      record_date: new Date().toISOString().split('T')[0],
      item_type: 'product',
      product_id: '',
      material_id: '',
      item_name: '',
      lot_number: '',
      quantity: 0,
      unit: 'kg',
      reason_category: 'QUALITY_DEFECT',
      reason_detail: '',
      action_taken: '',
      disposal_method: '',
      disposal_date: '',
      disposal_location: '',
      disposal_company: '',
      disposal_cost: 0,
      customer_name: '',
      customer_contact: '',
      return_date: '',
      notes: '',
    });
    setEditMode(false);
    setSelectedRecord(null);
  };

  const handleAutoFill = () => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const lotDate = today.toISOString().split('T')[0].replace(/-/g, '');

    const sampleDisposals = [
      { record_type: 'DISPOSAL' as const, item_name: '숯불갈비 양념 세트', reason_category: 'EXPIRY' as const, reason_detail: '유통기한 만료로 인한 폐기', disposal_method: 'DESTRUCTION' as const, disposal_company: '클린환경 주식회사', disposal_location: '지정 폐기물 처리장' },
      { record_type: 'DISPOSAL' as const, item_name: '돼지불백 양념육', reason_category: 'QUALITY_DEFECT' as const, reason_detail: '냉장 온도 이탈로 인한 품질 이상', disposal_method: 'INCINERATION' as const, disposal_company: '에코그린 환경', disposal_location: '소각 처리장' },
      { record_type: 'RETURN' as const, item_name: '매콤 닭갈비', reason_category: 'CUSTOMER_COMPLAINT' as const, reason_detail: '고객 불만 접수 - 이물질 발견', customer_name: '이마트 강남점', customer_contact: '02-555-1234' },
      { record_type: 'RECALL' as const, item_name: '소불고기 간편식', reason_category: 'CONTAMINATION' as const, reason_detail: '제조공정 오염 가능성으로 인한 자발적 회수', customer_name: '롯데마트 잠실점', customer_contact: '02-666-5678' },
    ];
    const sample = sampleDisposals[Math.floor(Math.random() * sampleDisposals.length)];
    const quantities = [3, 5, 10, 15, 20];

    setFormData({
      record_type: sample.record_type,
      record_date: todayStr,
      item_type: 'product',
      product_id: products.length > 0 ? products[Math.floor(Math.random() * products.length)].id : '',
      material_id: '',
      item_name: sample.item_name,
      lot_number: `LOT-${lotDate}-${String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')}`,
      quantity: quantities[Math.floor(Math.random() * quantities.length)],
      unit: 'kg',
      reason_category: sample.reason_category,
      reason_detail: sample.reason_detail,
      action_taken: sample.record_type === 'DISPOSAL' ? '폐기 처리 완료' : '반품/회수 처리 진행',
      disposal_method: sample.disposal_method || '',
      disposal_date: sample.record_type === 'DISPOSAL' ? todayStr : '',
      disposal_location: sample.disposal_location || '',
      disposal_company: sample.disposal_company || '',
      disposal_cost: sample.record_type === 'DISPOSAL' ? Math.floor(Math.random() * 50 + 10) * 1000 : 0,
      customer_name: sample.customer_name || '',
      customer_contact: sample.customer_contact || '',
      return_date: sample.record_type !== 'DISPOSAL' ? todayStr : '',
      notes: sample.record_type === 'DISPOSAL' ? '폐기 증명서 보관 필요' : '고객 응대 완료',
    });
  };

  const handleEdit = (record: ReturnDisposal) => {
    setSelectedRecord(record);
    setFormData({
      record_type: record.record_type,
      record_date: record.record_date,
      item_type: record.product_id ? 'product' : 'material',
      product_id: record.product_id || '',
      material_id: record.material_id || '',
      item_name: record.item_name,
      lot_number: record.lot_number || '',
      quantity: record.quantity,
      unit: record.unit || 'kg',
      reason_category: record.reason_category,
      reason_detail: record.reason_detail,
      action_taken: record.action_taken || '',
      disposal_method: record.disposal_method || '',
      disposal_date: record.disposal_date || '',
      disposal_location: record.disposal_location || '',
      disposal_company: record.disposal_company || '',
      disposal_cost: record.disposal_cost || 0,
      customer_name: record.customer_name || '',
      customer_contact: record.customer_contact || '',
      return_date: record.return_date || '',
      notes: record.notes || '',
    });
    setEditMode(true);
    setShowModal(true);
  };

  const handleStatusChange = async (record: ReturnDisposal, newStatus: ReturnDisposal['status']) => {
    try {
      const response = await fetch('/api/haccp/returns-disposals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: record.id, status: newStatus }),
      });

      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const recordTypeIcons: Record<string, React.ReactNode> = {
    'RETURN': <RotateCcw className="w-4 h-4" />,
    'RECALL': <AlertTriangle className="w-4 h-4" />,
    'DISPOSAL': <Trash2 className="w-4 h-4" />,
  };

  const recordTypeColors: Record<string, string> = {
    'RETURN': 'bg-blue-100 text-blue-700',
    'RECALL': 'bg-red-100 text-red-700',
    'DISPOSAL': 'bg-gray-100 text-gray-700',
  };

  const recordTypeText: Record<string, string> = {
    'RETURN': '반품',
    'RECALL': '회수',
    'DISPOSAL': '폐기',
  };

  const reasonCategoryText: Record<string, string> = {
    'QUALITY_DEFECT': '품질불량',
    'EXPIRY': '유통기한 만료',
    'CONTAMINATION': '오염',
    'DAMAGE': '파손',
    'CUSTOMER_COMPLAINT': '고객 불만',
    'RECALL': '리콜',
    'OTHER': '기타',
  };

  const disposalMethodText: Record<string, string> = {
    'DESTRUCTION': '파쇄',
    'REPROCESSING': '재가공',
    'RETURN_TO_SUPPLIER': '공급업체 반품',
    'LANDFILL': '매립',
    'INCINERATION': '소각',
    'OTHER': '기타',
  };

  const statusColors: Record<string, string> = {
    'PENDING': 'bg-yellow-100 text-yellow-700',
    'IN_PROGRESS': 'bg-blue-100 text-blue-700',
    'COMPLETED': 'bg-green-100 text-green-700',
    'CANCELLED': 'bg-gray-100 text-gray-500',
  };

  const statusText: Record<string, string> = {
    'PENDING': '대기',
    'IN_PROGRESS': '처리중',
    'COMPLETED': '완료',
    'CANCELLED': '취소',
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">반품/회수/폐기 관리</h1>
          <p className="mt-1 text-sm text-gray-500">제품 및 원재료의 반품, 회수, 폐기 기록을 관리합니다</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          기록 등록
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4 text-gray-500" />
            <p className="text-sm text-gray-500">전체</p>
          </div>
          <p className="text-2xl font-bold">{records.length}건</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="flex items-center gap-2 mb-2">
            <RotateCcw className="w-4 h-4 text-blue-500" />
            <p className="text-sm text-gray-500">반품</p>
          </div>
          <p className="text-2xl font-bold">{records.filter(r => r.record_type === 'RETURN').length}건</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <p className="text-sm text-gray-500">회수</p>
          </div>
          <p className="text-2xl font-bold text-red-600">{records.filter(r => r.record_type === 'RECALL').length}건</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="flex items-center gap-2 mb-2">
            <Trash2 className="w-4 h-4 text-gray-500" />
            <p className="text-sm text-gray-500">폐기</p>
          </div>
          <p className="text-2xl font-bold">{records.filter(r => r.record_type === 'DISPOSAL').length}건</p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex gap-4">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm"
        >
          <option value="">모든 유형</option>
          <option value="RETURN">반품</option>
          <option value="RECALL">회수</option>
          <option value="DISPOSAL">폐기</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm"
        >
          <option value="">모든 상태</option>
          <option value="PENDING">대기</option>
          <option value="IN_PROGRESS">처리중</option>
          <option value="COMPLETED">완료</option>
        </select>
      </div>

      {/* Records List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : records.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">등록된 기록이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-4">
          {records.map((record) => (
            <div key={record.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 text-xs rounded-full flex items-center gap-1 ${recordTypeColors[record.record_type]}`}>
                    {recordTypeIcons[record.record_type]}
                    {recordTypeText[record.record_type]}
                  </span>
                  <span className="text-sm font-mono text-gray-600">{record.record_number}</span>
                  <span className="text-sm text-gray-500">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    {record.record_date}
                  </span>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${statusColors[record.status]}`}>
                  {statusText[record.status]}
                </span>
              </div>

              <div className="p-4">
                <div className="flex justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{record.item_name}</h3>
                    {record.lot_number && <p className="text-sm text-gray-500">LOT: {record.lot_number}</p>}
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{record.quantity} {record.unit}</p>
                  </div>
                </div>

                <div className="bg-gray-50 p-3 rounded-lg mb-3">
                  <p className="text-sm">
                    <span className="font-medium text-gray-700">사유: </span>
                    <span className="text-gray-600">{reasonCategoryText[record.reason_category]}</span>
                  </p>
                  <p className="text-sm text-gray-600 mt-1">{record.reason_detail}</p>
                </div>

                {record.record_type === 'DISPOSAL' && record.disposal_method && (
                  <p className="text-sm text-gray-600">
                    폐기 방법: {disposalMethodText[record.disposal_method]}
                    {record.disposal_company && ` (${record.disposal_company})`}
                  </p>
                )}

                {(record.record_type === 'RETURN' || record.record_type === 'RECALL') && record.customer_name && (
                  <p className="text-sm text-gray-600">
                    거래처: {record.customer_name}
                    {record.customer_contact && ` (${record.customer_contact})`}
                  </p>
                )}

                {record.action_taken && (
                  <p className="text-sm text-gray-600 mt-2">조치사항: {record.action_taken}</p>
                )}
              </div>

              <div className="flex justify-between items-center px-4 py-3 border-t bg-gray-50">
                <div className="flex gap-2">
                  {record.status === 'PENDING' && (
                    <button
                      onClick={() => handleStatusChange(record, 'IN_PROGRESS')}
                      className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded"
                    >
                      처리 시작
                    </button>
                  )}
                  {record.status === 'IN_PROGRESS' && (
                    <button
                      onClick={() => handleStatusChange(record, 'COMPLETED')}
                      className="px-3 py-1.5 text-sm text-green-600 hover:bg-green-50 rounded"
                    >
                      완료 처리
                    </button>
                  )}
                </div>
                <button
                  onClick={() => handleEdit(record)}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded flex items-center gap-1"
                >
                  <Edit2 className="w-4 h-4" />
                  수정
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setShowModal(false); resetForm(); }}>
          <div className="bg-white rounded-xl w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">{editMode ? '기록 수정' : '기록 등록'}</h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="text-gray-500 hover:text-gray-700">
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
                  <Label required>유형</Label>
                  <select
                    value={formData.record_type}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    onChange={(e) => setFormData({ ...formData, record_type: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="DISPOSAL">폐기</option>
                    <option value="RETURN">반품</option>
                    <option value="RECALL">회수</option>
                  </select>
                </div>
                <div>
                  <Label required>일자</Label>
                  <input
                    type="date"
                    value={formData.record_date}
                    onChange={(e) => setFormData({ ...formData, record_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-medium mb-3">대상 정보</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <Label>대상 구분</Label>
                    <select
                      value={formData.item_type}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      onChange={(e) => setFormData({ ...formData, item_type: e.target.value as any, product_id: '', material_id: '' })}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="product">제품</option>
                      <option value="material">원재료</option>
                    </select>
                  </div>
                  <div>
                    <Label>{formData.item_type === 'product' ? '제품 선택' : '원재료 선택'}</Label>
                    <select
                      value={formData.item_type === 'product' ? formData.product_id : formData.material_id}
                      onChange={(e) => {
                        if (formData.item_type === 'product') {
                          const product = products.find(p => p.id === e.target.value);
                          setFormData({ ...formData, product_id: e.target.value, item_name: product?.name || '' });
                        } else {
                          const material = materials.find(m => m.id === e.target.value);
                          setFormData({ ...formData, material_id: e.target.value, item_name: material?.name || '' });
                        }
                      }}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="">직접 입력</option>
                      {(formData.item_type === 'product' ? products : materials).map(item => (
                        <option key={item.id} value={item.id}>{item.name} ({item.code})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label required>품목명</Label>
                    <input
                      type="text"
                      value={formData.item_name}
                      onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                      required
                    />
                  </div>
                  <div>
                    <Label>LOT 번호</Label>
                    <input
                      type="text"
                      value={formData.lot_number}
                      onChange={(e) => setFormData({ ...formData, lot_number: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <Label required>수량</Label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={formData.quantity}
                        onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) })}
                        className="flex-1 px-3 py-2 border rounded-lg"
                        required
                      />
                      <input
                        type="text"
                        value={formData.unit}
                        onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                        className="w-16 px-3 py-2 border rounded-lg"
                        placeholder="단위"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-medium mb-3">사유</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label required>사유 분류</Label>
                    <select
                      value={formData.reason_category}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      onChange={(e) => setFormData({ ...formData, reason_category: e.target.value as any })}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      {Object.entries(reasonCategoryText).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="mt-4">
                  <Label required>상세 사유</Label>
                  <textarea
                    value={formData.reason_detail}
                    onChange={(e) => setFormData({ ...formData, reason_detail: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    rows={2}
                    required
                  />
                </div>
              </div>

              {formData.record_type === 'DISPOSAL' && (
                <div className="border-t pt-4">
                  <h3 className="font-medium mb-3">폐기 정보</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>폐기 방법</Label>
                      <select
                        value={formData.disposal_method}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        onChange={(e) => setFormData({ ...formData, disposal_method: e.target.value as any })}
                        className="w-full px-3 py-2 border rounded-lg"
                      >
                        <option value="">선택</option>
                        {Object.entries(disposalMethodText).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label>폐기일</Label>
                      <input
                        type="date"
                        value={formData.disposal_date}
                        onChange={(e) => setFormData({ ...formData, disposal_date: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <Label>폐기 장소</Label>
                      <input
                        type="text"
                        value={formData.disposal_location}
                        onChange={(e) => setFormData({ ...formData, disposal_location: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <Label>폐기 업체</Label>
                      <input
                        type="text"
                        value={formData.disposal_company}
                        onChange={(e) => setFormData({ ...formData, disposal_company: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              )}

              {(formData.record_type === 'RETURN' || formData.record_type === 'RECALL') && (
                <div className="border-t pt-4">
                  <h3 className="font-medium mb-3">거래처 정보</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>거래처명</Label>
                      <input
                        type="text"
                        value={formData.customer_name}
                        onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <Label>연락처</Label>
                      <input
                        type="text"
                        value={formData.customer_contact}
                        onChange={(e) => setFormData({ ...formData, customer_contact: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <Label>반품/회수일</Label>
                      <input
                        type="date"
                        value={formData.return_date}
                        onChange={(e) => setFormData({ ...formData, return_date: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <Label>조치사항</Label>
                <textarea
                  value={formData.action_taken}
                  onChange={(e) => setFormData({ ...formData, action_taken: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                />
              </div>

              <div>
                <Label>비고</Label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">
                  취소
                </button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  {editMode ? '수정' : '저장'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
