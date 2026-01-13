'use client';

import { useState, useEffect } from 'react';
import { Plus, Calendar, CheckCircle, XCircle, AlertCircle, ClipboardCheck } from 'lucide-react';

interface MaterialInspection {
  id: string;
  inspection_date: string;
  inspected_by_name?: string;
  material_id: string;
  material_name?: string;
  supplier_name?: string;
  lot_number: string;
  quantity: number;
  unit: string;
  appearance_check: boolean;
  packaging_check: boolean;
  label_check: boolean;
  temp_check: { value: number; passed: boolean } | null;
  expiry_check: boolean;
  document_check: boolean;
  overall_result: 'PASS' | 'FAIL' | 'CONDITIONAL';
  rejection_reason?: string;
}

interface Material {
  id: string;
  name: string;
  supplier_id: string;
}

interface Supplier {
  id: string;
  name: string;
}

export default function InspectionsPage() {
  const [inspections, setInspections] = useState<MaterialInspection[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [formData, setFormData] = useState({
    material_id: '',
    supplier_id: '',
    lot_number: '',
    quantity: 0,
    unit: 'kg',
    appearance_check: false,
    packaging_check: false,
    label_check: false,
    temp_check: { value: 0, passed: false },
    expiry_check: false,
    document_check: false,
  });

  useEffect(() => {
    fetchInspections();
    fetchMaterials();
    fetchSuppliers();
  }, [selectedDate]);

  const fetchInspections = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/haccp/inspections?date=${selectedDate}`);
      if (response.ok) {
        const data = await response.json();
        setInspections(data);
      }
    } catch (error) {
      console.error('Failed to fetch inspections:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMaterials = async () => {
    try {
      const response = await fetch('/api/haccp/materials');
      if (response.ok) {
        const data = await response.json();
        setMaterials(data);
      }
    } catch (error) {
      console.error('Failed to fetch materials:', error);
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

    const checks = [
      formData.appearance_check,
      formData.packaging_check,
      formData.label_check,
      formData.temp_check.passed,
      formData.expiry_check,
      formData.document_check,
    ];
    const passCount = checks.filter(Boolean).length;
    const overall_result = passCount === 6 ? 'PASS' : passCount >= 4 ? 'CONDITIONAL' : 'FAIL';

    try {
      const response = await fetch('/api/haccp/inspections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inspection_date: selectedDate,
          ...formData,
          overall_result,
        }),
      });

      if (response.ok) {
        setShowModal(false);
        fetchInspections();
        setFormData({
          material_id: '',
          supplier_id: '',
          lot_number: '',
          quantity: 0,
          unit: 'kg',
          appearance_check: false,
          packaging_check: false,
          label_check: false,
          temp_check: { value: 0, passed: false },
          expiry_check: false,
          document_check: false,
        });
      }
    } catch (error) {
      console.error('Failed to create inspection:', error);
    }
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

  const resultIcons = {
    'PASS': CheckCircle,
    'FAIL': XCircle,
    'CONDITIONAL': AlertCircle,
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">입고 검사</h1>
          <p className="mt-1 text-sm text-gray-500">원부재료 입고검사 기록을 관리합니다</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          검사 기록
        </button>
      </div>

      {/* Date Selector */}
      <div className="mb-6 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-gray-400" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border rounded-lg"
          />
        </div>
      </div>

      {/* Inspections */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : inspections.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <ClipboardCheck className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">해당 날짜의 입고검사 기록이 없습니다</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">원부재료</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">공급업체</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">LOT</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">수량</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">검사항목</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">결과</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {inspections.map((inspection) => {
                const ResultIcon = resultIcons[inspection.overall_result];
                return (
                  <tr key={inspection.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium">{inspection.material_name}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{inspection.supplier_name || '-'}</td>
                    <td className="px-6 py-4 text-sm font-mono">{inspection.lot_number}</td>
                    <td className="px-6 py-4 text-sm">{inspection.quantity} {inspection.unit}</td>
                    <td className="px-6 py-4">
                      <div className="flex gap-1">
                        <span className={`w-6 h-6 flex items-center justify-center rounded text-xs ${inspection.appearance_check ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>외</span>
                        <span className={`w-6 h-6 flex items-center justify-center rounded text-xs ${inspection.packaging_check ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>포</span>
                        <span className={`w-6 h-6 flex items-center justify-center rounded text-xs ${inspection.label_check ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>표</span>
                        <span className={`w-6 h-6 flex items-center justify-center rounded text-xs ${inspection.temp_check?.passed ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>온</span>
                        <span className={`w-6 h-6 flex items-center justify-center rounded text-xs ${inspection.expiry_check ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>기</span>
                        <span className={`w-6 h-6 flex items-center justify-center rounded text-xs ${inspection.document_check ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>서</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full ${resultColors[inspection.overall_result]}`}>
                        <ResultIcon className="w-3 h-3" />
                        {resultText[inspection.overall_result]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">입고검사 기록</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                닫기
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">원부재료</label>
                <select
                  value={formData.material_id}
                  onChange={(e) => setFormData({ ...formData, material_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                >
                  <option value="">선택하세요</option>
                  {materials.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">공급업체</label>
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

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">LOT 번호</label>
                  <input
                    type="text"
                    value={formData.lot_number}
                    onChange={(e) => setFormData({ ...formData, lot_number: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">수량</label>
                  <input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">단위</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="kg">kg</option>
                    <option value="ea">ea</option>
                    <option value="box">box</option>
                    <option value="L">L</option>
                  </select>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">검사 항목</h4>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.appearance_check}
                      onChange={(e) => setFormData({ ...formData, appearance_check: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm">외관검사</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.packaging_check}
                      onChange={(e) => setFormData({ ...formData, packaging_check: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm">포장상태</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.label_check}
                      onChange={(e) => setFormData({ ...formData, label_check: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm">표시사항</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.expiry_check}
                      onChange={(e) => setFormData({ ...formData, expiry_check: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm">유통기한</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.document_check}
                      onChange={(e) => setFormData({ ...formData, document_check: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm">서류확인</span>
                  </label>
                </div>
                <div className="mt-3 pt-3 border-t">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.temp_check.passed}
                      onChange={(e) => setFormData({ ...formData, temp_check: { ...formData.temp_check, passed: e.target.checked } })}
                      className="rounded"
                    />
                    <span className="text-sm">온도검사</span>
                    <input
                      type="number"
                      value={formData.temp_check.value}
                      onChange={(e) => setFormData({ ...formData, temp_check: { ...formData.temp_check, value: parseFloat(e.target.value) } })}
                      className="w-20 px-2 py-1 border rounded text-sm ml-2"
                      placeholder="온도"
                    />
                    <span className="text-sm text-gray-500">°C</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">
                  취소
                </button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
