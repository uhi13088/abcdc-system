'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Search, Package, Edit, Trash2, X, AlertTriangle,
  ArrowDownCircle, ArrowUpCircle, RefreshCw, CheckCircle, XCircle, AlertCircle,
  ClipboardCheck, FileSpreadsheet, Download, Printer, ChevronDown, ChevronRight,
  Factory, Filter, Settings, Eye
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { ALLERGENS, formatAllergens } from '@/lib/constants/allergens';
import { toBaseUnit, fromBaseUnit, toDisplayUnit, formatQuantity, getUnitType, ALL_UNIT_OPTIONS, type UnitType } from '@/lib/utils/unit-conversion';
import Link from 'next/link';
import toast from 'react-hot-toast';

// ============================================
// Types
// ============================================
interface Material {
  id: string;
  code: string;
  name: string;
  type: '원료' | '부재료' | '포장재';
  unit_type: UnitType;
  supplier_id: string | null;
  supplier_name?: string;
  specification: string;
  storage_temp: string;
  shelf_life: number;
  unit: string;
  status: string;
  allergens?: string[];
}

interface Supplier {
  id: string;
  name: string;
}

interface MaterialStock {
  id: string;
  material_id: string;
  material_name?: string;
  material_code?: string;
  lot_number: string;
  quantity: number;      // 기본단위 (g, mL, ea)
  unit: string;
  received_date: string;
  expiry_date: string;
  location: string;
  status: 'AVAILABLE' | 'RESERVED' | 'EXPIRED' | 'DISPOSED';
}

interface MaterialTransaction {
  id: string;
  transaction_date: string;
  transaction_type: 'IN' | 'OUT' | 'ADJUST' | 'DISPOSE';
  material_id?: string;
  material_name?: string;
  lot_number: string;
  quantity: number;
  input_quantity?: number;
  input_unit?: string;
  unit: string;
  notes: string;
}

interface MaterialInspection {
  id: string;
  inspection_date: string;
  inspected_by_name?: string;
  material_id: string;
  material_name?: string;
  material_code?: string;
  material_type?: '원료' | '부재료' | '포장재';
  supplier_name?: string;
  lot_number: string;
  quantity: number;
  unit: string;
  expiry_date?: string;
  storage_location?: string;
  appearance_check: boolean;
  packaging_check: boolean;
  temp_check: { value: number; passed: boolean } | null;
  overall_result: 'PASS' | 'FAIL' | 'CONDITIONAL';
  remarks?: string;
}

interface MaterialSummary {
  material_id: string;
  material_code: string;
  material_name: string;
  material_type?: string;
  unit: string;
  total_in: number;
  total_out: number;
  total_adjust: number;
  current_stock: number;
}

interface MaterialLedgerEntry {
  material_id: string;
  material_code: string;
  material_name: string;
  unit: string;
  date: string;
  opening_balance: number;
  in_quantity: number;
  out_quantity: number;
  adjust_quantity: number;
  closing_balance: number;
}

// Tab type
type TabType = 'master' | 'receiving' | 'stock' | 'outgoing' | 'ledger';

// ============================================
// Main Component
// ============================================
export default function MaterialsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('master');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [stocks, setStocks] = useState<MaterialStock[]>([]);
  const [transactions, setTransactions] = useState<MaterialTransaction[]>([]);
  const [inspections, setInspections] = useState<MaterialInspection[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch all data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [materialsRes, suppliersRes, stocksRes, transactionsRes] = await Promise.all([
        fetch('/api/haccp/materials'),
        fetch('/api/haccp/suppliers'),
        fetch('/api/haccp/inventory/stocks'),
        fetch('/api/haccp/inventory/transactions'),
      ]);

      if (materialsRes.ok) setMaterials(await materialsRes.json());
      if (suppliersRes.ok) setSuppliers(await suppliersRes.json());
      if (stocksRes.ok) setStocks(await stocksRes.json());
      if (transactionsRes.ok) setTransactions(await transactionsRes.json());
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const tabs = [
    { id: 'master' as TabType, label: '마스터', icon: Package },
    { id: 'receiving' as TabType, label: '입고/검사', icon: ClipboardCheck },
    { id: 'stock' as TabType, label: '현재고', icon: Package },
    { id: 'outgoing' as TabType, label: '출고', icon: ArrowUpCircle },
    { id: 'ledger' as TabType, label: '수불부', icon: FileSpreadsheet },
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">원부재료 관리</h1>
        <p className="mt-1 text-sm text-gray-500">원료, 부재료, 포장재의 마스터 데이터, 입고검사, 재고, 수불을 통합 관리합니다</p>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b">
        <div className="flex gap-1">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          {activeTab === 'master' && (
            <MasterTab
              materials={materials}
              suppliers={suppliers}
              onRefresh={fetchData}
            />
          )}
          {activeTab === 'receiving' && (
            <ReceivingTab
              materials={materials}
              suppliers={suppliers}
              onRefresh={fetchData}
            />
          )}
          {activeTab === 'stock' && (
            <StockTab
              stocks={stocks}
              materials={materials}
              onRefresh={fetchData}
            />
          )}
          {activeTab === 'outgoing' && (
            <OutgoingTab
              stocks={stocks}
              materials={materials}
              transactions={transactions}
              onRefresh={fetchData}
            />
          )}
          {activeTab === 'ledger' && (
            <LedgerTab materials={materials} />
          )}
        </>
      )}
    </div>
  );
}

// ============================================
// Master Tab (원부재료 마스터)
// ============================================
function MasterTab({
  materials,
  suppliers,
  onRefresh,
}: {
  materials: Material[];
  suppliers: Supplier[];
  onRefresh: () => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    type: '원료' as '원료' | '부재료' | '포장재',
    unit_type: 'weight' as UnitType,
    supplier_id: '',
    specification: '',
    storage_temp: '',
    shelf_life: 0,
    unit: 'kg',
    allergens: [] as string[],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editingMaterial ? 'PUT' : 'POST';
      const body = editingMaterial
        ? { id: editingMaterial.id, ...formData }
        : formData;

      const response = await fetch('/api/haccp/materials', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        setShowModal(false);
        setEditingMaterial(null);
        onRefresh();
        resetForm();
        toast.success(editingMaterial ? '수정되었습니다.' : '등록되었습니다.');
      }
    } catch (error) {
      console.error('Failed to save material:', error);
      toast.error('저장에 실패했습니다.');
    }
  };

  const handleEdit = (material: Material) => {
    setEditingMaterial(material);
    setFormData({
      code: material.code || '',
      name: material.name || '',
      type: material.type || '원료',
      unit_type: material.unit_type || getUnitType(material.unit),
      supplier_id: material.supplier_id || '',
      specification: material.specification || '',
      storage_temp: material.storage_temp || '',
      shelf_life: material.shelf_life || 0,
      unit: material.unit || 'kg',
      allergens: material.allergens || [],
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
      await fetch(`/api/haccp/materials/${id}`, { method: 'DELETE' });
      onRefresh();
      toast.success('삭제되었습니다.');
    } catch (error) {
      console.error('Failed to delete material:', error);
      toast.error('삭제에 실패했습니다.');
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      type: '원료',
      unit_type: 'weight',
      supplier_id: '',
      specification: '',
      storage_temp: '',
      shelf_life: 0,
      unit: 'kg',
      allergens: [],
    });
    setEditingMaterial(null);
  };

  const generateCode = (type: '원료' | '부재료' | '포장재') => {
    const prefixMap = { '원료': 'RM', '부재료': 'SM', '포장재': 'PM' };
    const prefix = prefixMap[type];
    const existingCodes = materials
      .filter(m => m.code?.startsWith(prefix))
      .map(m => {
        const num = parseInt(m.code.replace(prefix + '-', ''));
        return isNaN(num) ? 0 : num;
      });
    const nextNum = existingCodes.length > 0 ? Math.max(...existingCodes) + 1 : 1;
    return `${prefix}-${String(nextNum).padStart(3, '0')}`;
  };

  const openNewModal = () => {
    resetForm();
    const newCode = generateCode('원료');
    setFormData(prev => ({ ...prev, code: newCode }));
    setShowModal(true);
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
    <>
      {/* Actions */}
      <div className="mb-4 flex items-center justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="원부재료명 또는 코드 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg"
          />
        </div>
        <button
          onClick={openNewModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          원부재료 등록
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">코드</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">원부재료명</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">구분</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">단위</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">알레르기</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">공급업체</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">보관</th>
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
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {material.unit || '-'}
                  </td>
                  <td className="px-6 py-4">
                    {material.allergens && material.allergens.length > 0 ? (
                      <div className="flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-orange-500" />
                        <span className="text-xs text-orange-600" title={formatAllergens(material.allergens)}>
                          {material.allergens.length}종
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">없음</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{material.supplier_name || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{material.storage_temp || '-'}</td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => handleEdit(material)} className="p-1 hover:bg-gray-100 rounded mr-1">
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">{editingMaterial ? '원부재료 수정' : '원부재료 등록'}</h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="p-2 hover:bg-gray-100 rounded-lg">
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
                    onChange={(e) => {
                      const newType = e.target.value as '원료' | '부재료' | '포장재';
                      if (!editingMaterial) {
                        const newCode = generateCode(newType);
                        setFormData(prev => ({ ...prev, type: newType, code: newCode }));
                      } else {
                        setFormData(prev => ({ ...prev, type: newType }));
                      }
                    }}
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

              {/* 단위 선택 */}
              <div>
                <Label>단위</Label>
                <select
                  value={formData.unit}
                  onChange={(e) => {
                    const newUnit = e.target.value;
                    const newUnitType = getUnitType(newUnit);
                    setFormData(prev => ({ ...prev, unit: newUnit, unit_type: newUnitType }));
                  }}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <optgroup label="중량 (kg ↔ g 자동 환산)">
                    <option value="kg">kg (킬로그램)</option>
                    <option value="g">g (그램)</option>
                  </optgroup>
                  <optgroup label="용량 (L ↔ mL 자동 환산)">
                    <option value="L">L (리터)</option>
                    <option value="mL">mL (밀리리터)</option>
                  </optgroup>
                  <optgroup label="개수">
                    <option value="ea">ea (개)</option>
                    <option value="box">box (박스)</option>
                    <option value="pack">pack (팩)</option>
                    <option value="roll">roll (롤)</option>
                  </optgroup>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  * kg/g, L/mL은 입출고 시 자동 환산됩니다
                </p>
              </div>

              <div>
                <Label>규격 (포장 형태)</Label>
                <input
                  type="text"
                  value={formData.specification}
                  onChange={(e) => setFormData({ ...formData, specification: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="예: 20kg 포대, 500g 봉지, 1박스 24개입"
                />
                <p className="text-xs text-gray-500 mt-1">
                  * 포장 단위나 규격을 자유롭게 입력하세요
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
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
              </div>

              {/* 알레르기 유발물질 */}
              <div>
                <Label>알레르기 유발물질</Label>
                <div className="mt-2 p-3 border rounded-lg bg-orange-50 max-h-40 overflow-y-auto">
                  <div className="grid grid-cols-3 gap-2">
                    {ALLERGENS.map((allergen) => (
                      <label key={allergen.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-orange-100 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={formData.allergens.includes(allergen.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({ ...formData, allergens: [...formData.allergens, allergen.id] });
                            } else {
                              setFormData({ ...formData, allergens: formData.allergens.filter(a => a !== allergen.id) });
                            }
                          }}
                          className="rounded border-orange-300 text-orange-600"
                        />
                        <span className="text-gray-700">{allergen.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">
                  취소
                </button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  {editingMaterial ? '수정' : '등록'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================
// Receiving Tab (입고/검사)
// ============================================
function ReceivingTab({
  materials,
  suppliers,
  onRefresh,
}: {
  materials: Material[];
  suppliers: Supplier[];
  onRefresh: () => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const [inspections, setInspections] = useState<MaterialInspection[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [simpleMode, setSimpleMode] = useState(false);
  const [formData, setFormData] = useState({
    material_id: '',
    supplier_id: '',
    lot_number: '',
    quantity: 0,
    unit: 'kg',
    expiry_date: '',
    storage_location: '',
    appearance_check: true,
    packaging_check: true,
    temp_check: { value: 5, passed: true },
    remarks: '',
  });

  const fetchInspections = useCallback(async () => {
    try {
      const res = await fetch(`/api/haccp/inspections?date=${selectedDate}`);
      if (res.ok) {
        setInspections(await res.json());
      }
    } catch (error) {
      console.error('Failed to fetch inspections:', error);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchInspections();
  }, [fetchInspections]);

  const handleMaterialChange = (materialId: string) => {
    const material = materials.find(m => m.id === materialId);
    if (material) {
      setFormData(prev => ({
        ...prev,
        material_id: materialId,
        supplier_id: material.supplier_id || '',
        unit: material.unit || 'kg',
      }));
    }
  };

  const generateLotNumber = () => {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
    return `LOT-${dateStr}-${String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 간편 모드면 검사 생략하고 바로 재고 등록
    if (simpleMode) {
      try {
        // 재고 트랜잭션 직접 생성
        const response = await fetch('/api/haccp/inventory/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transaction_type: 'IN',
            transaction_date: selectedDate,
            material_id: formData.material_id,
            lot_number: formData.lot_number || generateLotNumber(),
            quantity: formData.quantity,
            unit: formData.unit,
            expiry_date: formData.expiry_date,
            location: formData.storage_location,
            notes: '간편 입고 (검사 생략)',
          }),
        });

        if (response.ok) {
          toast.success('입고 처리되었습니다.');
          setShowModal(false);
          onRefresh();
          resetForm();
        }
      } catch (error) {
        console.error('Failed to process receiving:', error);
        toast.error('입고 처리에 실패했습니다.');
      }
      return;
    }

    // 검사 모드: 검사 기록 생성 + 합격 시 재고 자동 등록
    const overall_result = (formData.appearance_check && formData.packaging_check && formData.temp_check.passed)
      ? 'PASS'
      : (!formData.appearance_check || !formData.packaging_check || !formData.temp_check.passed)
        ? 'FAIL'
        : 'CONDITIONAL';

    try {
      const response = await fetch('/api/haccp/inspections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inspection_date: selectedDate,
          ...formData,
          lot_number: formData.lot_number || generateLotNumber(),
          overall_result,
          auto_stock: overall_result !== 'FAIL', // 합격/조건부면 재고 자동 등록
        }),
      });

      if (response.ok) {
        const resultText = overall_result === 'PASS' ? '적합' : overall_result === 'FAIL' ? '부적합' : '조건부';
        toast.success(`검사 완료 (${resultText})${overall_result !== 'FAIL' ? ' - 재고 자동 등록됨' : ''}`);
        setShowModal(false);
        fetchInspections();
        onRefresh();
        resetForm();
      }
    } catch (error) {
      console.error('Failed to create inspection:', error);
      toast.error('검사 등록에 실패했습니다.');
    }
  };

  const resetForm = () => {
    setFormData({
      material_id: '',
      supplier_id: '',
      lot_number: '',
      quantity: 0,
      unit: 'kg',
      expiry_date: '',
      storage_location: '',
      appearance_check: true,
      packaging_check: true,
      temp_check: { value: 5, passed: true },
      remarks: '',
    });
  };

  const resultColors = {
    'PASS': 'bg-green-100 text-green-700',
    'FAIL': 'bg-red-100 text-red-700',
    'CONDITIONAL': 'bg-yellow-100 text-yellow-700',
  };

  const resultText = {
    'PASS': '적합',
    'FAIL': '부적합',
    'CONDITIONAL': '조건부',
  };

  return (
    <>
      {/* Actions */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border rounded-lg"
          />
          <span className="text-sm text-gray-500">
            {inspections.length}건의 입고검사
          </span>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          <ArrowDownCircle className="w-4 h-4" />
          입고 등록
        </button>
      </div>

      {/* Inspections Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">원부재료</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">공급업체</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">LOT / 수량</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">유통기한</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">검사결과</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">검사자</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {inspections.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                  <ClipboardCheck className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  해당 날짜의 입고검사 기록이 없습니다
                </td>
              </tr>
            ) : (
              inspections.map((inspection) => (
                <tr key={inspection.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-sm">{inspection.material_name}</div>
                    <div className="text-xs text-gray-500">{inspection.material_code}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{inspection.supplier_name || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-mono">{inspection.lot_number}</div>
                    <div className="text-xs text-gray-500">{inspection.quantity} {inspection.unit}</div>
                  </td>
                  <td className="px-4 py-3 text-sm">{inspection.expiry_date || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${resultColors[inspection.overall_result]}`}>
                      {resultText[inspection.overall_result]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">{inspection.inspected_by_name || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <ArrowDownCircle className="w-6 h-6 text-green-600" />
                입고 등록
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 간편 입고 모드 토글 */}
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={simpleMode}
                  onChange={(e) => setSimpleMode(e.target.checked)}
                  className="w-5 h-5 rounded"
                />
                <div>
                  <span className="font-medium text-blue-800">간편 입고 모드</span>
                  <p className="text-xs text-blue-600">검사 항목 생략하고 바로 재고에 등록합니다 (포장재 등)</p>
                </div>
              </label>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label required>원부재료</Label>
                  <select
                    value={formData.material_id}
                    onChange={(e) => handleMaterialChange(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  >
                    <option value="">선택하세요</option>
                    {materials.map(m => (
                      <option key={m.id} value={m.id}>
                        [{m.type}] {m.name} ({m.code})
                      </option>
                    ))}
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

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>LOT 번호</Label>
                  <input
                    type="text"
                    value={formData.lot_number}
                    onChange={(e) => setFormData({ ...formData, lot_number: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="자동 생성"
                  />
                </div>
                <div>
                  <Label required>입고량</Label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="0.01"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
                      className="flex-1 px-3 py-2 border rounded-lg"
                      required
                    />
                    <select
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      className="w-20 px-2 py-2 border rounded-lg"
                    >
                      {ALL_UNIT_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <Label>유통기한</Label>
                  <input
                    type="date"
                    value={formData.expiry_date}
                    onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div>
                <Label>보관위치</Label>
                <input
                  type="text"
                  value={formData.storage_location}
                  onChange={(e) => setFormData({ ...formData, storage_location: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="예: 냉장고 A-1"
                />
              </div>

              {/* 검사 항목 (간편 모드가 아닐 때만) */}
              {!simpleMode && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium mb-4">검사 항목</h4>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 p-2 rounded hover:bg-gray-100 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.appearance_check}
                        onChange={(e) => setFormData({ ...formData, appearance_check: e.target.checked })}
                        className="w-5 h-5 rounded"
                      />
                      <div>
                        <span className="font-medium">외관검사</span>
                        <p className="text-xs text-gray-500">제품 외관 상태, 이물질 혼입 여부</p>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 p-2 rounded hover:bg-gray-100 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.packaging_check}
                        onChange={(e) => setFormData({ ...formData, packaging_check: e.target.checked })}
                        className="w-5 h-5 rounded"
                      />
                      <div>
                        <span className="font-medium">포장상태</span>
                        <p className="text-xs text-gray-500">포장 파손, 오염, 표시사항 확인</p>
                      </div>
                    </label>
                    <div className="flex items-center gap-3 p-2 rounded bg-blue-50">
                      <input
                        type="checkbox"
                        checked={formData.temp_check.passed}
                        onChange={(e) => setFormData({
                          ...formData,
                          temp_check: { ...formData.temp_check, passed: e.target.checked }
                        })}
                        className="w-5 h-5 rounded"
                      />
                      <div className="flex-1">
                        <span className="font-medium">온도검사</span>
                        <p className="text-xs text-gray-500">입고 온도 측정</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.1"
                          value={formData.temp_check.value}
                          onChange={(e) => setFormData({
                            ...formData,
                            temp_check: { ...formData.temp_check, value: parseFloat(e.target.value) || 0 }
                          })}
                          className="w-20 px-2 py-1 border rounded text-sm"
                        />
                        <span className="text-sm">°C</span>
                      </div>
                    </div>
                  </div>

                  {/* 검사 결과 미리보기 */}
                  <div className="mt-4 p-3 bg-white rounded border">
                    <span className="text-sm text-gray-500">예상 결과: </span>
                    {formData.appearance_check && formData.packaging_check && formData.temp_check.passed ? (
                      <span className="text-green-600 font-medium">적합 → 재고 자동 등록</span>
                    ) : (
                      <span className="text-red-600 font-medium">부적합 → 재고 미등록</span>
                    )}
                  </div>
                </div>
              )}

              <div>
                <Label>비고</Label>
                <textarea
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">
                  취소
                </button>
                <button type="submit" className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                  {simpleMode ? '입고 처리' : '검사 완료 및 입고'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================
// Stock Tab (현재고)
// ============================================
function StockTab({
  stocks,
  materials,
  onRefresh,
}: {
  stocks: MaterialStock[];
  materials: Material[];
  onRefresh: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredStocks = stocks.filter(s =>
    s.material_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.lot_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate expiring soon
  const today = new Date();
  const expiringSoon = stocks.filter(s => {
    if (!s.expiry_date) return false;
    const expiry = new Date(s.expiry_date);
    const diff = (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    return diff <= 7 && diff > 0;
  });

  const statusColors = {
    'AVAILABLE': 'bg-green-100 text-green-700',
    'RESERVED': 'bg-blue-100 text-blue-700',
    'EXPIRED': 'bg-red-100 text-red-700',
    'DISPOSED': 'bg-gray-100 text-gray-700',
  };

  const statusText = {
    'AVAILABLE': '가용',
    'RESERVED': '예약',
    'EXPIRED': '만료',
    'DISPOSED': '폐기',
  };

  // 재고 합계 계산 (원료별)
  const stockSummary = stocks.reduce((acc, stock) => {
    const material = materials.find(m => m.id === stock.material_id);
    const key = stock.material_id;
    if (!acc[key]) {
      acc[key] = {
        material_name: stock.material_name || '',
        material_code: stock.material_code || '',
        unit_type: material?.unit_type || getUnitType(stock.unit),
        total_quantity: 0,
        unit: stock.unit,
        lot_count: 0,
      };
    }
    // 기본 단위로 변환해서 합계
    acc[key].total_quantity += toBaseUnit(stock.quantity, stock.unit);
    acc[key].lot_count += 1;
    return acc;
  }, {} as Record<string, { material_name: string; material_code: string; unit_type: UnitType; total_quantity: number; unit: string; lot_count: number }>);

  return (
    <>
      {/* Expiring Soon Alert */}
      {expiringSoon.length > 0 && (
        <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            <span className="font-medium text-yellow-800">유통기한 임박 ({expiringSoon.length}건)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {expiringSoon.map(s => (
              <span key={s.id} className="text-sm bg-yellow-100 text-yellow-700 px-2 py-1 rounded">
                {s.material_name} ({s.lot_number}) - {s.expiry_date}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.values(stockSummary).slice(0, 4).map((item, idx) => {
          const display = toDisplayUnit(item.total_quantity, item.unit_type);
          return (
            <div key={idx} className="bg-white rounded-lg border p-4">
              <p className="text-sm text-gray-500">{item.material_name}</p>
              <p className="text-2xl font-bold">
                {formatQuantity(display.value)} <span className="text-sm font-normal text-gray-500">{display.unit}</span>
              </p>
              <p className="text-xs text-gray-400">{item.lot_count}개 LOT</p>
            </div>
          );
        })}
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="원부재료명 또는 LOT 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">원부재료</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">LOT</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">수량</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">위치</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">입고일</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">유통기한</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredStocks.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  등록된 재고가 없습니다
                </td>
              </tr>
            ) : (
              filteredStocks.map((stock) => {
                const isExpiringSoon = stock.expiry_date &&
                  ((new Date(stock.expiry_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) <= 7;
                return (
                  <tr key={stock.id} className={`hover:bg-gray-50 ${isExpiringSoon ? 'bg-yellow-50' : ''}`}>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium">{stock.material_name}</p>
                      <p className="text-xs text-gray-500">{stock.material_code}</p>
                    </td>
                    <td className="px-6 py-4 text-sm font-mono">{stock.lot_number}</td>
                    <td className="px-6 py-4 text-sm font-medium">{formatQuantity(stock.quantity)} {stock.unit}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{stock.location || '-'}</td>
                    <td className="px-6 py-4 text-sm">{stock.received_date}</td>
                    <td className={`px-6 py-4 text-sm ${isExpiringSoon ? 'text-yellow-700 font-medium' : ''}`}>
                      {stock.expiry_date || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${statusColors[stock.status]}`}>
                        {statusText[stock.status]}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ============================================
// Outgoing Tab (출고)
// ============================================
function OutgoingTab({
  stocks,
  materials,
  transactions,
  onRefresh,
}: {
  stocks: MaterialStock[];
  materials: Material[];
  transactions: MaterialTransaction[];
  onRefresh: () => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    material_id: '',
    lot_number: '',
    quantity: 0,
    unit: 'kg',
    production_lot: '',
    notes: '',
  });

  // 선택 가능한 LOT 목록
  const availableStocks = stocks.filter(s =>
    s.status === 'AVAILABLE' &&
    (!formData.material_id || s.material_id === formData.material_id)
  );

  const handleMaterialChange = (materialId: string) => {
    const material = materials.find(m => m.id === materialId);
    setFormData(prev => ({
      ...prev,
      material_id: materialId,
      lot_number: '',
      unit: material?.unit || 'kg',
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/haccp/inventory/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_type: 'OUT',
          transaction_date: new Date().toISOString().split('T')[0],
          ...formData,
        }),
      });

      if (response.ok) {
        toast.success('출고 처리되었습니다.');
        setShowModal(false);
        onRefresh();
        setFormData({
          material_id: '',
          lot_number: '',
          quantity: 0,
          unit: 'kg',
          production_lot: '',
          notes: '',
        });
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || '출고에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to process outgoing:', error);
      toast.error('출고 처리에 실패했습니다.');
    }
  };

  const outTransactions = transactions.filter(t => t.transaction_type === 'OUT');

  return (
    <>
      {/* Actions */}
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm text-gray-500">
          최근 출고 {outTransactions.length}건
        </span>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          <ArrowUpCircle className="w-4 h-4" />
          출고 등록
        </button>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">일자</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">원부재료</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">LOT</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">수량</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">생산LOT</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">비고</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {outTransactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  <ArrowUpCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  출고 기록이 없습니다
                </td>
              </tr>
            ) : (
              outTransactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm">{tx.transaction_date}</td>
                  <td className="px-6 py-4 text-sm font-medium">{tx.material_name}</td>
                  <td className="px-6 py-4 text-sm font-mono">{tx.lot_number}</td>
                  <td className="px-6 py-4 text-sm text-red-600">-{tx.quantity} {tx.unit}</td>
                  <td className="px-6 py-4 text-sm text-purple-600">{tx.notes?.match(/PROD-[\w-]+/)?.[0] || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{tx.notes || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <ArrowUpCircle className="w-6 h-6 text-red-600" />
                출고 등록
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label required>원부재료</Label>
                <select
                  value={formData.material_id}
                  onChange={(e) => handleMaterialChange(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                >
                  <option value="">선택하세요</option>
                  {materials.map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({m.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <Label required>LOT 선택</Label>
                <select
                  value={formData.lot_number}
                  onChange={(e) => setFormData({ ...formData, lot_number: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                >
                  <option value="">선택하세요</option>
                  {availableStocks.map(s => (
                    <option key={s.id} value={s.lot_number}>
                      {s.lot_number} (재고: {s.quantity}{s.unit}, 유통기한: {s.expiry_date || '없음'})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">* FIFO: 오래된 LOT를 먼저 선택하세요</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label required>출고량</Label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="0.01"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
                      className="flex-1 px-3 py-2 border rounded-lg"
                      required
                    />
                    <select
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      className="w-20 px-2 py-2 border rounded-lg"
                    >
                      {ALL_UNIT_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <Label>생산 LOT</Label>
                  <input
                    type="text"
                    value={formData.production_lot}
                    onChange={(e) => setFormData({ ...formData, production_lot: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="예: PROD-20260129-001"
                  />
                </div>
              </div>

              <div>
                <Label>비고</Label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="사용 용도"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">
                  취소
                </button>
                <button type="submit" className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
                  출고
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================
// Ledger Tab (수불부)
// ============================================
function LedgerTab({ materials }: { materials: Material[] }) {
  const [loading, setLoading] = useState(true);
  const [summaryData, setSummaryData] = useState<MaterialSummary[]>([]);
  const [ledgerData, setLedgerData] = useState<MaterialLedgerEntry[]>([]);
  const [viewMode, setViewMode] = useState<'summary' | 'daily'>('summary');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const fetchLedgerData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        view_mode: viewMode,
      });

      const res = await fetch(`/api/haccp/inventory/ledger?${params}`);
      if (res.ok) {
        const data = await res.json();
        setSummaryData(data.summary || []);
        setLedgerData(data.ledger || []);
      }
    } catch (error) {
      console.error('Failed to fetch ledger data:', error);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, viewMode]);

  useEffect(() => {
    fetchLedgerData();
  }, [fetchLedgerData]);

  const handleExport = () => {
    const headers = ['원료코드', '원료명', '입고', '출고', '조정', '현재고'];
    const rows = summaryData.map(item => [
      item.material_code,
      item.material_name,
      item.total_in,
      item.total_out,
      item.total_adjust,
      item.current_stock,
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `원료수불부_${startDate}_${endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <>
      {/* Filters */}
      <div className="mb-4 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('summary')}
            className={`px-3 py-2 text-sm rounded-l-lg border ${viewMode === 'summary' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-300'}`}
          >
            요약
          </button>
          <button
            onClick={() => setViewMode('daily')}
            className={`px-3 py-2 text-sm rounded-r-lg border-t border-r border-b ${viewMode === 'daily' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-300'}`}
          >
            일별
          </button>
        </div>

        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm"
        />
        <span>~</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm"
        />

        <button
          onClick={fetchLedgerData}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          조회
        </button>

        <button
          onClick={handleExport}
          className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          내보내기
        </button>
      </div>

      {/* Summary View */}
      {viewMode === 'summary' && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">원료코드</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">원료명</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-green-700 uppercase">입고</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-red-700 uppercase">출고</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-blue-700 uppercase">조정</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">현재고</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {summaryData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                    <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    데이터가 없습니다
                  </td>
                </tr>
              ) : (
                summaryData.map((item) => (
                  <tr key={item.material_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono">{item.material_code}</td>
                    <td className="px-4 py-3 text-sm font-medium">{item.material_name}</td>
                    <td className="px-4 py-3 text-sm text-right text-green-600">
                      +{formatQuantity(item.total_in)} {item.unit}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-red-600">
                      -{formatQuantity(item.total_out)} {item.unit}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-blue-600">
                      {item.total_adjust !== 0 ? `${item.total_adjust > 0 ? '+' : ''}${formatQuantity(item.total_adjust)}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-bold">
                      {formatQuantity(item.current_stock)} {item.unit}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Daily View */}
      {viewMode === 'daily' && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">날짜</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">원료명</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">전일재고</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-green-700 uppercase">입고</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-red-700 uppercase">출고</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">재고</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {ledgerData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                    <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    데이터가 없습니다
                  </td>
                </tr>
              ) : (
                ledgerData.map((entry, idx) => (
                  <tr key={`${entry.material_id}-${entry.date}-${idx}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">{entry.date}</td>
                    <td className="px-4 py-3 text-sm font-medium">{entry.material_name}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-500">{formatQuantity(entry.opening_balance)}</td>
                    <td className="px-4 py-3 text-sm text-right text-green-600">
                      {entry.in_quantity > 0 ? `+${formatQuantity(entry.in_quantity)}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-red-600">
                      {entry.out_quantity > 0 ? `-${formatQuantity(entry.out_quantity)}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium">{formatQuantity(entry.closing_balance)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
