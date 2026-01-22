'use client';

import { useState, useEffect } from 'react';
import { Plus, Calendar, Factory, Clock, Users, Package } from 'lucide-react';
import { Label } from '@/components/ui/label';

interface ProductionRecord {
  id: string;
  production_date: string;
  lot_number: string;
  product_id: string;
  product_name?: string;
  line_number: string;
  start_time: string;
  end_time: string;
  planned_quantity: number;
  actual_quantity: number;
  defect_quantity: number;
  unit: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  supervisor_name?: string;
}

interface Product {
  id: string;
  name: string;
}

export default function ProductionPage() {
  const [records, setRecords] = useState<ProductionRecord[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [formData, setFormData] = useState({
    lot_number: '',
    product_id: '',
    line_number: '',
    start_time: '',
    end_time: '',
    planned_quantity: 0,
    actual_quantity: 0,
    defect_quantity: 0,
    unit: 'kg',
  });

  useEffect(() => {
    fetchRecords();
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/haccp/production?date=${selectedDate}`);
      if (response.ok) {
        const data = await response.json();
        setRecords(data);
      }
    } catch (error) {
      console.error('Failed to fetch production records:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/haccp/products');
      if (response.ok) {
        const data = await response.json();
        setProducts(data);
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/haccp/production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          production_date: selectedDate,
          ...formData,
        }),
      });

      if (response.ok) {
        setShowModal(false);
        fetchRecords();
        setFormData({
          lot_number: '',
          product_id: '',
          line_number: '',
          start_time: '',
          end_time: '',
          planned_quantity: 0,
          actual_quantity: 0,
          defect_quantity: 0,
          unit: 'kg',
        });
      }
    } catch (error) {
      console.error('Failed to create production record:', error);
    }
  };

  const statusColors = {
    'IN_PROGRESS': 'bg-blue-100 text-blue-700',
    'COMPLETED': 'bg-green-100 text-green-700',
    'CANCELLED': 'bg-gray-100 text-gray-700',
  };

  const statusText = {
    'IN_PROGRESS': '진행중',
    'COMPLETED': '완료',
    'CANCELLED': '취소',
  };

  const calculateYield = (actual: number, planned: number) => {
    if (planned === 0) return 0;
    return Math.round((actual / planned) * 100);
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">생산 기록</h1>
          <p className="mt-1 text-sm text-gray-500">일일 생산 기록을 관리합니다</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          생산 기록
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Factory className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">총 생산건수</p>
              <p className="text-xl font-bold">{records.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Package className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">총 생산량</p>
              <p className="text-xl font-bold">
                {records.reduce((sum, r) => sum + r.actual_quantity, 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">진행중</p>
              <p className="text-xl font-bold">
                {records.filter(r => r.status === 'IN_PROGRESS').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">완료</p>
              <p className="text-xl font-bold">
                {records.filter(r => r.status === 'COMPLETED').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Records Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : records.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <Factory className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">해당 날짜의 생산 기록이 없습니다</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">LOT 번호</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">제품</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">라인</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">시간</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">계획/실적</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">달성률</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {records.map((record) => (
                <tr key={record.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-mono">{record.lot_number}</td>
                  <td className="px-6 py-4 text-sm font-medium">{record.product_name || '-'}</td>
                  <td className="px-6 py-4 text-sm">{record.line_number || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {record.start_time?.slice(0, 5)} ~ {record.end_time?.slice(0, 5) || '진행중'}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className="text-gray-500">{record.planned_quantity}</span>
                    {' / '}
                    <span className="font-medium">{record.actual_quantity}</span>
                    <span className="text-gray-400 ml-1">{record.unit}</span>
                    {record.defect_quantity > 0 && (
                      <span className="text-red-500 ml-2">(불량: {record.defect_quantity})</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            calculateYield(record.actual_quantity, record.planned_quantity) >= 100
                              ? 'bg-green-500'
                              : calculateYield(record.actual_quantity, record.planned_quantity) >= 80
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(calculateYield(record.actual_quantity, record.planned_quantity), 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-sm">{calculateYield(record.actual_quantity, record.planned_quantity)}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs rounded-full ${statusColors[record.status]}`}>
                      {statusText[record.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">생산 기록</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                닫기
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label required>LOT 번호</Label>
                  <input
                    type="text"
                    value={formData.lot_number}
                    onChange={(e) => setFormData({ ...formData, lot_number: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <Label>생산라인</Label>
                  <input
                    type="text"
                    value={formData.line_number}
                    onChange={(e) => setFormData({ ...formData, line_number: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div>
                <Label required>제품</Label>
                <select
                  value={formData.product_id}
                  onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                >
                  <option value="">선택하세요</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>시작 시간</Label>
                  <input
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <Label>종료 시간</Label>
                  <input
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>계획 수량</Label>
                  <input
                    type="number"
                    value={formData.planned_quantity}
                    onChange={(e) => setFormData({ ...formData, planned_quantity: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <Label>실적 수량</Label>
                  <input
                    type="number"
                    value={formData.actual_quantity}
                    onChange={(e) => setFormData({ ...formData, actual_quantity: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>불량 수량</Label>
                  <input
                    type="number"
                    value={formData.defect_quantity}
                    onChange={(e) => setFormData({ ...formData, defect_quantity: parseFloat(e.target.value) })}
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
                    <option value="ea">ea</option>
                    <option value="box">box</option>
                    <option value="L">L</option>
                  </select>
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
