'use client';

import { useState, useEffect } from 'react';
import { Plus, Calendar, CreditCard, Banknote, Receipt, TrendingUp } from 'lucide-react';

interface DailySale {
  id: string;
  sale_date: string;
  source_type: string;
  total_amount: number;
  card_amount: number;
  cash_amount: number;
  transfer_amount: number;
  transaction_count: number;
  is_auto_synced: boolean;
}

export default function SalesPage() {
  const [sales, setSales] = useState<DailySale[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [formData, setFormData] = useState({
    sale_date: new Date().toISOString().split('T')[0],
    source_type: 'MANUAL',
    total_amount: 0,
    card_amount: 0,
    cash_amount: 0,
    transfer_amount: 0,
    transaction_count: 0,
  });

  useEffect(() => {
    fetchSales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth]);

  const fetchSales = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/business/sales?month=${selectedMonth}`);
      if (response.ok) {
        const data = await response.json();
        setSales(data);
      }
    } catch (error) {
      console.error('Failed to fetch sales:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/business/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setShowModal(false);
        fetchSales();
        setFormData({
          sale_date: new Date().toISOString().split('T')[0],
          source_type: 'MANUAL',
          total_amount: 0,
          card_amount: 0,
          cash_amount: 0,
          transfer_amount: 0,
          transaction_count: 0,
        });
      }
    } catch (error) {
      console.error('Failed to create sale:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount) + '원';
  };

  const totals = sales.reduce((acc, sale) => ({
    total: acc.total + sale.total_amount,
    card: acc.card + sale.card_amount,
    cash: acc.cash + sale.cash_amount,
    transfer: acc.transfer + sale.transfer_amount,
    count: acc.count + sale.transaction_count,
  }), { total: 0, card: 0, cash: 0, transfer: 0, count: 0 });

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">매출 관리</h1>
          <p className="mt-1 text-sm text-gray-500">일일 매출을 기록하고 관리합니다</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          매출 입력
        </button>
      </div>

      {/* Month Selector & Summary */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500">조회 기간</span>
          </div>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-green-500" />
            <span className="text-sm text-gray-500">총 매출</span>
          </div>
          <p className="text-xl font-bold">{formatCurrency(totals.total)}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-2 mb-1">
            <CreditCard className="w-4 h-4 text-blue-500" />
            <span className="text-sm text-gray-500">카드</span>
          </div>
          <p className="text-xl font-bold">{formatCurrency(totals.card)}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-2 mb-1">
            <Banknote className="w-4 h-4 text-green-500" />
            <span className="text-sm text-gray-500">현금</span>
          </div>
          <p className="text-xl font-bold">{formatCurrency(totals.cash)}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-2 mb-1">
            <Receipt className="w-4 h-4 text-purple-500" />
            <span className="text-sm text-gray-500">거래 수</span>
          </div>
          <p className="text-xl font-bold">{totals.count.toLocaleString()}건</p>
        </div>
      </div>

      {/* Sales Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">날짜</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">출처</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">총 매출</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">카드</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">현금</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">이체</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">거래 수</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sales.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <TrendingUp className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    등록된 매출이 없습니다
                  </td>
                </tr>
              ) : (
                sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm">{sale.sale_date}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        sale.is_auto_synced ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {sale.source_type === 'MANUAL' ? '수동입력' : sale.source_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-medium">{formatCurrency(sale.total_amount)}</td>
                    <td className="px-6 py-4 text-sm text-right text-gray-500">{formatCurrency(sale.card_amount)}</td>
                    <td className="px-6 py-4 text-sm text-right text-gray-500">{formatCurrency(sale.cash_amount)}</td>
                    <td className="px-6 py-4 text-sm text-right text-gray-500">{formatCurrency(sale.transfer_amount)}</td>
                    <td className="px-6 py-4 text-sm text-right">{sale.transaction_count}</td>
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
              <h2 className="text-xl font-bold">매출 입력</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                닫기
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">날짜</label>
                  <input
                    type="date"
                    value={formData.sale_date}
                    onChange={(e) => setFormData({ ...formData, sale_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">출처</label>
                  <select
                    value={formData.source_type}
                    onChange={(e) => setFormData({ ...formData, source_type: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="MANUAL">수동입력</option>
                    <option value="TOSS_POS">Toss POS</option>
                    <option value="BAEMIN">배민</option>
                    <option value="COUPANG_EATS">쿠팡이츠</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">총 매출</label>
                <input
                  type="number"
                  value={formData.total_amount}
                  onChange={(e) => setFormData({ ...formData, total_amount: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">카드</label>
                  <input
                    type="number"
                    value={formData.card_amount}
                    onChange={(e) => setFormData({ ...formData, card_amount: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">현금</label>
                  <input
                    type="number"
                    value={formData.cash_amount}
                    onChange={(e) => setFormData({ ...formData, cash_amount: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">이체</label>
                  <input
                    type="number"
                    value={formData.transfer_amount}
                    onChange={(e) => setFormData({ ...formData, transfer_amount: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">거래 건수</label>
                <input
                  type="number"
                  value={formData.transaction_count}
                  onChange={(e) => setFormData({ ...formData, transaction_count: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
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
