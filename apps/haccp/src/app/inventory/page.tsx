'use client';

import { useState, useEffect } from 'react';
import { Search, Package, ArrowUpCircle, ArrowDownCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { Label } from '@/components/ui/label';

interface MaterialStock {
  id: string;
  material_id: string;
  material_name?: string;
  material_code?: string;
  lot_number: string;
  quantity: number;
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
  material_name?: string;
  lot_number: string;
  quantity: number;
  unit: string;
  notes: string;
}

interface Material {
  id: string;
  name: string;
  code: string;
  unit: string;
}

export default function InventoryPage() {
  const [stocks, setStocks] = useState<MaterialStock[]>([]);
  const [transactions, setTransactions] = useState<MaterialTransaction[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'IN' | 'OUT'>('IN');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'stock' | 'transactions'>('stock');
  const [formData, setFormData] = useState({
    material_id: '',
    lot_number: '',
    quantity: 0,
    unit: 'kg',
    expiry_date: '',
    location: '',
    production_lot: '',
    notes: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [stocksRes, transactionsRes, materialsRes] = await Promise.all([
        fetch('/api/haccp/inventory/stocks'),
        fetch('/api/haccp/inventory/transactions'),
        fetch('/api/haccp/materials'),
      ]);

      if (stocksRes.ok) setStocks(await stocksRes.json());
      if (transactionsRes.ok) setTransactions(await transactionsRes.json());
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
      const response = await fetch('/api/haccp/inventory/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_type: modalType,
          transaction_date: new Date().toISOString().split('T')[0],
          ...formData,
        }),
      });

      if (response.ok) {
        setShowModal(false);
        fetchData();
        setFormData({
          material_id: '',
          lot_number: '',
          quantity: 0,
          unit: 'kg',
          expiry_date: '',
          location: '',
          production_lot: '',
          notes: '',
        });
      }
    } catch (error) {
      console.error('Failed to create transaction:', error);
    }
  };

  const openModal = (type: 'IN' | 'OUT') => {
    setModalType(type);
    setShowModal(true);
  };

  const filteredStocks = stocks.filter(s =>
    s.material_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.lot_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

  const transactionColors = {
    'IN': 'text-green-600',
    'OUT': 'text-red-600',
    'ADJUST': 'text-blue-600',
    'DISPOSE': 'text-gray-600',
  };

  const transactionIcons = {
    'IN': ArrowDownCircle,
    'OUT': ArrowUpCircle,
    'ADJUST': RefreshCw,
    'DISPOSE': AlertTriangle,
  };

  const transactionText = {
    'IN': '입고',
    'OUT': '출고',
    'ADJUST': '조정',
    'DISPOSE': '폐기',
  };

  // Calculate expiring soon
  const today = new Date();
  const expiringSoon = stocks.filter(s => {
    if (!s.expiry_date) return false;
    const expiry = new Date(s.expiry_date);
    const diff = (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    return diff <= 7 && diff > 0;
  });

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">재고 관리</h1>
          <p className="mt-1 text-sm text-gray-500">원부재료 재고 및 수불을 관리합니다</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => openModal('IN')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <ArrowDownCircle className="w-4 h-4" />
            입고
          </button>
          <button
            onClick={() => openModal('OUT')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            <ArrowUpCircle className="w-4 h-4" />
            출고
          </button>
        </div>
      </div>

      {/* Expiring Soon Alert */}
      {expiringSoon.length > 0 && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            <span className="font-medium text-yellow-800">유통기한 임박 ({expiringSoon.length}건)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {expiringSoon.map(s => (
              <span key={s.id} className="text-sm bg-yellow-100 text-yellow-700 px-2 py-1 rounded">
                {s.material_name} (LOT: {s.lot_number}) - {s.expiry_date}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-4 border-b">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('stock')}
            className={`pb-2 px-1 border-b-2 ${
              activeTab === 'stock' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'
            }`}
          >
            현재 재고
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={`pb-2 px-1 border-b-2 ${
              activeTab === 'transactions' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'
            }`}
          >
            수불 이력
          </button>
        </div>
      </div>

      {/* Search */}
      {activeTab === 'stock' && (
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
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : activeTab === 'stock' ? (
        filteredStocks.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
            <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">등록된 재고가 없습니다</p>
          </div>
        ) : (
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
                {filteredStocks.map((stock) => {
                  const isExpiringSoon = stock.expiry_date &&
                    ((new Date(stock.expiry_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) <= 7;
                  return (
                    <tr key={stock.id} className={`hover:bg-gray-50 ${isExpiringSoon ? 'bg-yellow-50' : ''}`}>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium">{stock.material_name}</p>
                        <p className="text-xs text-gray-500">{stock.material_code}</p>
                      </td>
                      <td className="px-6 py-4 text-sm font-mono">{stock.lot_number}</td>
                      <td className="px-6 py-4 text-sm font-medium">{stock.quantity} {stock.unit}</td>
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
                })}
              </tbody>
            </table>
          </div>
        )
      ) : (
        transactions.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
            <RefreshCw className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">수불 이력이 없습니다</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">일자</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">구분</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">원부재료</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">LOT</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">수량</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">비고</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {transactions.map((tx) => {
                  const Icon = transactionIcons[tx.transaction_type];
                  return (
                    <tr key={tx.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm">{tx.transaction_date}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 ${transactionColors[tx.transaction_type]}`}>
                          <Icon className="w-4 h-4" />
                          {transactionText[tx.transaction_type]}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium">{tx.material_name}</td>
                      <td className="px-6 py-4 text-sm font-mono">{tx.lot_number}</td>
                      <td className="px-6 py-4 text-sm">{tx.quantity} {tx.unit}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{tx.notes || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                {modalType === 'IN' ? (
                  <>
                    <ArrowDownCircle className="w-6 h-6 text-green-600" />
                    입고 등록
                  </>
                ) : (
                  <>
                    <ArrowUpCircle className="w-6 h-6 text-red-600" />
                    출고 등록
                  </>
                )}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                닫기
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label required>원부재료</Label>
                <select
                  value={formData.material_id}
                  onChange={(e) => {
                    const material = materials.find(m => m.id === e.target.value);
                    setFormData({
                      ...formData,
                      material_id: e.target.value,
                      unit: material?.unit || 'kg'
                    });
                  }}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                >
                  <option value="">선택하세요</option>
                  {materials.map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({m.code})</option>
                  ))}
                </select>
              </div>

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
                  <Label required>수량</Label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) })}
                      className="flex-1 px-3 py-2 border rounded-lg"
                      required
                    />
                    <span className="px-3 py-2 bg-gray-100 border rounded-lg text-gray-600">
                      {formData.unit}
                    </span>
                  </div>
                </div>
              </div>

              {modalType === 'IN' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>유통기한</Label>
                      <input
                        type="date"
                        value={formData.expiry_date}
                        onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <Label>보관위치</Label>
                      <input
                        type="text"
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg"
                        placeholder="예: 냉장고 A-1"
                      />
                    </div>
                  </div>
                </>
              )}

              {modalType === 'OUT' && (
                <div>
                  <Label>생산 LOT</Label>
                  <input
                    type="text"
                    value={formData.production_lot}
                    onChange={(e) => setFormData({ ...formData, production_lot: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="사용된 생산 로트번호"
                  />
                </div>
              )}

              <div>
                <Label>비고</Label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">
                  취소
                </button>
                <button
                  type="submit"
                  className={`flex-1 px-4 py-2 text-white rounded-lg ${
                    modalType === 'IN' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {modalType === 'IN' ? '입고' : '출고'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
