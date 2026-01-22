'use client';

import { useState, useEffect } from 'react';
import { Plus, Calendar, Truck, Package, ThermometerSun, MapPin } from 'lucide-react';

interface ShipmentRecord {
  id: string;
  shipment_date: string;
  shipment_number: string;
  customer_name: string;
  customer_address: string;
  items: Array<{
    product_id: string;
    product_name?: string;
    lot_number: string;
    quantity: number;
    unit: string;
  }>;
  vehicle_number: string;
  vehicle_temp: number;
  driver_name: string;
  status: 'PENDING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
}

interface Product {
  id: string;
  name: string;
}

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState<ShipmentRecord[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [formData, setFormData] = useState({
    shipment_number: '',
    customer_name: '',
    customer_address: '',
    items: [{ product_id: '', lot_number: '', quantity: 0, unit: 'box' }],
    vehicle_number: '',
    vehicle_temp: 0,
    driver_name: '',
  });

  useEffect(() => {
    fetchShipments();
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const fetchShipments = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/haccp/shipments?date=${selectedDate}`);
      if (response.ok) {
        const data = await response.json();
        setShipments(data);
      }
    } catch (error) {
      console.error('Failed to fetch shipments:', error);
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
      const response = await fetch('/api/haccp/shipments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shipment_date: selectedDate,
          ...formData,
        }),
      });

      if (response.ok) {
        setShowModal(false);
        fetchShipments();
        setFormData({
          shipment_number: '',
          customer_name: '',
          customer_address: '',
          items: [{ product_id: '', lot_number: '', quantity: 0, unit: 'box' }],
          vehicle_number: '',
          vehicle_temp: 0,
          driver_name: '',
        });
      }
    } catch (error) {
      console.error('Failed to create shipment:', error);
    }
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { product_id: '', lot_number: '', quantity: 0, unit: 'box' }],
    });
  };

  const removeItem = (index: number) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index),
    });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
  };

  const statusColors = {
    'PENDING': 'bg-yellow-100 text-yellow-700',
    'SHIPPED': 'bg-blue-100 text-blue-700',
    'DELIVERED': 'bg-green-100 text-green-700',
    'CANCELLED': 'bg-gray-100 text-gray-700',
  };

  const statusText = {
    'PENDING': '대기',
    'SHIPPED': '출하',
    'DELIVERED': '배송완료',
    'CANCELLED': '취소',
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">출하 기록</h1>
          <p className="mt-1 text-sm text-gray-500">제품 출하 기록을 관리합니다</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          출하 기록
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

      {/* Shipments */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : shipments.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <Truck className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">해당 날짜의 출하 기록이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-4">
          {shipments.map((shipment) => (
            <div key={shipment.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="font-mono font-medium">{shipment.shipment_number}</span>
                  <span className={`px-2 py-1 text-xs rounded-full ${statusColors[shipment.status]}`}>
                    {statusText[shipment.status]}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <Truck className="w-4 h-4" />
                    {shipment.vehicle_number}
                  </span>
                  <span className="flex items-center gap-1">
                    <ThermometerSun className="w-4 h-4" />
                    {shipment.vehicle_temp}°C
                  </span>
                </div>
              </div>

              <div className="p-4">
                <div className="flex items-start gap-4 mb-4">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{shipment.customer_name}</p>
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {shipment.customer_address}
                    </p>
                  </div>
                  <div className="text-sm text-gray-500">
                    배송기사: {shipment.driver_name}
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-3">
                  <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">출하품목</h4>
                  <div className="space-y-2">
                    {shipment.items.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-4 text-sm">
                        <Package className="w-4 h-4 text-gray-400" />
                        <span className="font-medium">{item.product_name || products.find(p => p.id === item.product_id)?.name}</span>
                        <span className="font-mono text-gray-500">LOT: {item.lot_number}</span>
                        <span>{item.quantity} {item.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">출하 기록</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                닫기
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">출하번호</label>
                  <input
                    type="text"
                    value={formData.shipment_number}
                    onChange={(e) => setFormData({ ...formData, shipment_number: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">고객명</label>
                  <input
                    type="text"
                    value={formData.customer_name}
                    onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">배송지</label>
                <input
                  type="text"
                  value={formData.customer_address}
                  onChange={(e) => setFormData({ ...formData, customer_address: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">차량번호</label>
                  <input
                    type="text"
                    value={formData.vehicle_number}
                    onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">차량온도 (°C)</label>
                  <input
                    type="number"
                    value={formData.vehicle_temp}
                    onChange={(e) => setFormData({ ...formData, vehicle_temp: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">배송기사</label>
                  <input
                    type="text"
                    value={formData.driver_name}
                    onChange={(e) => setFormData({ ...formData, driver_name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900">출하품목</h4>
                  <button type="button" onClick={addItem} className="text-sm text-blue-600 hover:text-blue-700">
                    + 품목 추가
                  </button>
                </div>
                <div className="space-y-3">
                  {formData.items.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-5 gap-2 items-end">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">제품</label>
                        <select
                          value={item.product_id}
                          onChange={(e) => updateItem(idx, 'product_id', e.target.value)}
                          className="w-full px-2 py-1.5 border rounded text-sm"
                        >
                          <option value="">선택</option>
                          {products.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">LOT</label>
                        <input
                          type="text"
                          value={item.lot_number}
                          onChange={(e) => updateItem(idx, 'lot_number', e.target.value)}
                          className="w-full px-2 py-1.5 border rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">수량</label>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value))}
                          className="w-full px-2 py-1.5 border rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">단위</label>
                        <select
                          value={item.unit}
                          onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                          className="w-full px-2 py-1.5 border rounded text-sm"
                        >
                          <option value="box">box</option>
                          <option value="ea">ea</option>
                          <option value="kg">kg</option>
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="px-2 py-1.5 text-red-500 hover:bg-red-50 rounded text-sm"
                        disabled={formData.items.length === 1}
                      >
                        삭제
                      </button>
                    </div>
                  ))}
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
