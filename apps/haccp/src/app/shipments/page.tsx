'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Calendar, Truck, Package, ThermometerSun, MapPin,
  Clock, CheckCircle2, XCircle, Eye, ClipboardCheck, Search,
  ChevronDown, ChevronUp, AlertTriangle, User, FileCheck, FileText
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Label } from '@/components/ui/label';

interface ShipmentItem {
  product_id: string;
  product_name?: string;
  product_code?: string;
  lot_number: string;
  quantity: number;
  unit: string;
}

interface ShipmentRecord {
  id: string;
  shipment_date: string;
  shipment_number: string;
  customer_name: string;
  customer_address: string;
  customer_contact?: string;
  items: ShipmentItem[];
  vehicle_number: string;
  vehicle_temp?: number;
  driver_name: string;
  driver_contact?: string;
  status: 'PENDING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  // 출하 시간
  shipment_time?: string;
  expected_arrival_time?: string;
  actual_arrival_time?: string;
  // 출하 전 검사
  pre_shipment_check?: boolean;
  pre_shipment_checked_by?: string;
  pre_shipment_checked_by_name?: string;
  pre_shipment_checked_at?: string;
  product_condition_check?: boolean;
  packaging_condition_check?: boolean;
  quantity_check?: boolean;
  label_check?: boolean;
  vehicle_cleanliness_check?: boolean;
  vehicle_temp_check?: boolean;
  departure_temp?: number;
  // 수령 확인
  received_at?: string;
  received_by?: string;
  receiver_signature?: string;
  arrival_temp?: number;
  // 담당자 정보
  shipped_by?: string;
  shipped_by_name?: string;
  // 비고
  notes?: string;
  created_at?: string;
}

interface Product {
  id: string;
  name: string;
  code?: string;
}

interface Customer {
  id: string;
  name: string;
  business_number: string | null;
  representative: string | null;
  phone: string | null;
  address: string | null;
  contact_person: string | null;
  contact_phone: string | null;
}

const PRE_SHIPMENT_CHECK_LABELS: Record<string, string> = {
  product_condition_check: '제품 상태',
  packaging_condition_check: '포장 상태',
  quantity_check: '수량 확인',
  label_check: '라벨 확인',
  vehicle_cleanliness_check: '차량 청결',
  vehicle_temp_check: '차량 온도',
};

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState<ShipmentRecord[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showPreCheckModal, setShowPreCheckModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<ShipmentRecord | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const [formData, setFormData] = useState({
    shipment_number: '',
    customer_id: '',
    customer_name: '',
    customer_address: '',
    customer_contact: '',
    items: [{ product_id: '', lot_number: '', quantity: 0, unit: 'box' }] as ShipmentItem[],
    vehicle_number: '',
    vehicle_temp: undefined as number | undefined,
    driver_name: '',
    driver_contact: '',
    expected_arrival_time: '',
    notes: '',
  });

  const [preCheckData, setPreCheckData] = useState({
    product_condition_check: false,
    packaging_condition_check: false,
    quantity_check: false,
    label_check: false,
    vehicle_cleanliness_check: false,
    vehicle_temp_check: false,
    departure_temp: undefined as number | undefined,
  });

  const [receiveData, setReceiveData] = useState({
    received_by: '',
    arrival_temp: undefined as number | undefined,
    notes: '',
  });

  const fetchShipments = useCallback(async () => {
    try {
      setLoading(true);
      let url = `/api/haccp/shipments?date=${selectedDate}`;
      if (filterStatus) url += `&status=${filterStatus}`;

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setShipments(data);
      }
    } catch (error) {
      console.error('Failed to fetch shipments:', error);
      toast.error('출하 목록을 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, filterStatus]);

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/haccp/products');
      if (response.ok) {
        const data = await response.json();
        setProducts(data);
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
      toast.error('제품 목록을 불러오는데 실패했습니다');
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await fetch('/api/haccp/customers');
      if (response.ok) {
        const data = await response.json();
        setCustomers(data);
      }
    } catch (error) {
      console.error('Failed to fetch customers:', error);
    }
  };

  // 고객 선택 시 자동으로 정보 입력
  const handleCustomerSelect = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    if (customer) {
      setFormData({
        ...formData,
        customer_id: customerId,
        customer_name: customer.name,
        customer_address: customer.address || '',
        customer_contact: customer.phone || customer.contact_phone || '',
      });
    } else {
      setFormData({
        ...formData,
        customer_id: '',
        customer_name: '',
        customer_address: '',
        customer_contact: '',
      });
    }
  };

  useEffect(() => {
    fetchShipments();
  }, [fetchShipments]);

  useEffect(() => {
    fetchProducts();
    fetchCustomers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const submitData = {
        shipment_date: selectedDate,
        ...formData,
        items: formData.items.filter(item => item.product_id),
      };

      const response = await fetch('/api/haccp/shipments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      });

      if (response.ok) {
        setShowModal(false);
        fetchShipments();
        resetForm();
        toast.success('출하가 등록되었습니다');
      }
    } catch (error) {
      console.error('Failed to create shipment:', error);
      toast.error('출하 등록에 실패했습니다');
    }
  };

  const resetForm = () => {
    setFormData({
      shipment_number: '',
      customer_id: '',
      customer_name: '',
      customer_address: '',
      customer_contact: '',
      items: [{ product_id: '', lot_number: '', quantity: 0, unit: 'box' }],
      vehicle_number: '',
      vehicle_temp: undefined,
      driver_name: '',
      driver_contact: '',
      expected_arrival_time: '',
      notes: '',
    });
  };

  const handlePreShipmentCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;

    try {
      const response = await fetch('/api/haccp/shipments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedRecord.id,
          action: 'pre_shipment_check',
          ...preCheckData,
        }),
      });

      if (response.ok) {
        setShowPreCheckModal(false);
        fetchShipments();
        toast.success('출하전 검사가 완료되었습니다');
      }
    } catch (error) {
      console.error('Failed to submit pre-shipment check:', error);
      toast.error('출하전 검사 저장에 실패했습니다');
    }
  };

  const handleShip = async (recordId: string) => {
    try {
      const response = await fetch('/api/haccp/shipments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: recordId,
          action: 'ship',
        }),
      });

      if (response.ok) {
        fetchShipments();
        toast.success('출하 처리되었습니다');
      }
    } catch (error) {
      console.error('Failed to ship:', error);
      toast.error('출하 처리에 실패했습니다');
    }
  };

  const handleDeliver = async (recordId: string) => {
    try {
      const response = await fetch('/api/haccp/shipments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: recordId,
          action: 'deliver',
        }),
      });

      if (response.ok) {
        fetchShipments();
        toast.success('배송 완료 처리되었습니다');
      }
    } catch (error) {
      console.error('Failed to deliver:', error);
      toast.error('배송 완료 처리에 실패했습니다');
    }
  };

  const handleReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;

    try {
      const response = await fetch('/api/haccp/shipments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedRecord.id,
          action: 'receive',
          ...receiveData,
        }),
      });

      if (response.ok) {
        setShowReceiveModal(false);
        fetchShipments();
        toast.success('수령 확인이 완료되었습니다');
      }
    } catch (error) {
      console.error('Failed to receive:', error);
      toast.error('수령 확인 저장에 실패했습니다');
    }
  };

  const handleCancel = async (recordId: string) => {
    if (!confirm('이 출하를 취소하시겠습니까?')) return;

    try {
      const response = await fetch('/api/haccp/shipments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: recordId,
          action: 'cancel',
        }),
      });

      if (response.ok) {
        fetchShipments();
        toast.success('출하가 취소되었습니다');
      }
    } catch (error) {
      console.error('Failed to cancel:', error);
      toast.error('출하 취소에 실패했습니다');
    }
  };

  const openPreCheckModal = (record: ShipmentRecord) => {
    setSelectedRecord(record);
    setPreCheckData({
      product_condition_check: record.product_condition_check || false,
      packaging_condition_check: record.packaging_condition_check || false,
      quantity_check: record.quantity_check || false,
      label_check: record.label_check || false,
      vehicle_cleanliness_check: record.vehicle_cleanliness_check || false,
      vehicle_temp_check: record.vehicle_temp_check || false,
      departure_temp: record.departure_temp,
    });
    setShowPreCheckModal(true);
  };

  const openReceiveModal = (record: ShipmentRecord) => {
    setSelectedRecord(record);
    setReceiveData({
      received_by: '',
      arrival_temp: undefined,
      notes: '',
    });
    setShowReceiveModal(true);
  };

  const openDetailModal = (record: ShipmentRecord) => {
    setSelectedRecord(record);
    setShowDetailModal(true);
  };

  const toggleRowExpand = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
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

  const statusColors: Record<string, string> = {
    'PENDING': 'bg-yellow-100 text-yellow-700',
    'SHIPPED': 'bg-blue-100 text-blue-700',
    'DELIVERED': 'bg-green-100 text-green-700',
    'CANCELLED': 'bg-gray-100 text-gray-700',
  };

  const statusText: Record<string, string> = {
    'PENDING': '대기',
    'SHIPPED': '출하',
    'DELIVERED': '배송완료',
    'CANCELLED': '취소',
  };

  const filteredShipments = shipments.filter(s => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        s.shipment_number?.toLowerCase().includes(search) ||
        s.customer_name?.toLowerCase().includes(search) ||
        s.driver_name?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  const summaryStats = {
    total: shipments.length,
    pending: shipments.filter(s => s.status === 'PENDING').length,
    shipped: shipments.filter(s => s.status === 'SHIPPED').length,
    delivered: shipments.filter(s => s.status === 'DELIVERED').length,
    needsPreCheck: shipments.filter(s => s.status === 'PENDING' && !s.pre_shipment_check).length,
    totalItems: shipments.reduce((sum, s) => sum + (s.items?.length || 0), 0),
  };

  // 자동 입력 핸들러
  const handleAutoFill = () => {
    const customers = [
      { name: '신세계푸드', address: '서울시 강남구 삼성동 159', contact: '02-1234-5678' },
      { name: '롯데마트 본사', address: '서울시 송파구 잠실동 40', contact: '02-2345-6789' },
      { name: '이마트 물류센터', address: '경기도 용인시 처인구 양지면', contact: '031-345-6789' },
      { name: 'CJ프레시웨이', address: '서울시 중구 동호로 330', contact: '02-3456-7890' },
      { name: '홈플러스 용산점', address: '서울시 용산구 한강대로 23길', contact: '02-4567-8901' },
    ];
    const drivers = [
      { name: '김철수', contact: '010-1234-5678' },
      { name: '이영희', contact: '010-2345-6789' },
      { name: '박민준', contact: '010-3456-7890' },
      { name: '최서연', contact: '010-4567-8901' },
    ];
    const vehicleNumbers = ['12가 3456', '34나 5678', '56다 7890', '78라 9012'];

    const today = new Date();
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
    const randomNum = String(Math.floor(Math.random() * 1000)).padStart(3, '0');

    const randomCustomer = customers[Math.floor(Math.random() * customers.length)];
    const randomDriver = drivers[Math.floor(Math.random() * drivers.length)];
    const randomVehicle = vehicleNumbers[Math.floor(Math.random() * vehicleNumbers.length)];

    // LOT 번호 생성
    const lotNumber = `LOT-${dateStr}-${randomNum}`;

    // 제품 아이템 생성 (1-3개)
    const itemCount = Math.floor(Math.random() * 3) + 1;
    const units = ['box', 'ea', 'kg'];
    const autoItems: ShipmentItem[] = [];

    for (let i = 0; i < itemCount; i++) {
      const productId = products.length > 0 ? products[Math.floor(Math.random() * products.length)].id : '';
      autoItems.push({
        product_id: productId,
        lot_number: `LOT-${dateStr}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
        quantity: Math.floor(Math.random() * 50) + 10,
        unit: units[Math.floor(Math.random() * units.length)],
      });
    }

    // 예상 도착 시간 (현재 시간 + 2-4시간)
    const arrivalHour = today.getHours() + 2 + Math.floor(Math.random() * 3);
    const arrivalTime = `${String(arrivalHour % 24).padStart(2, '0')}:00`;

    setFormData({
      shipment_number: '', // 자동 생성
      customer_id: '',
      customer_name: randomCustomer.name,
      customer_address: randomCustomer.address,
      customer_contact: randomCustomer.contact,
      items: autoItems.length > 0 ? autoItems : [{ product_id: '', lot_number: lotNumber, quantity: 20, unit: 'box' }],
      vehicle_number: randomVehicle,
      vehicle_temp: parseFloat((Math.random() * 3 + 2).toFixed(1)), // 2-5°C
      driver_name: randomDriver.name,
      driver_contact: randomDriver.contact,
      expected_arrival_time: arrivalTime,
      notes: '냉장 상태 유지 필요. 하차 시 온도 확인 요망.',
    });
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">출하 기록</h1>
          <p className="mt-1 text-sm text-gray-500">제품 출하 및 배송 현황을 관리합니다</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          출하 등록
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-gray-400" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border rounded-lg"
          />
        </div>
        <div className="flex items-center gap-2">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="출하번호, 고객명, 기사명 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3 py-2 border rounded-lg w-56"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border rounded-lg"
        >
          <option value="">전체 상태</option>
          <option value="PENDING">대기</option>
          <option value="SHIPPED">출하</option>
          <option value="DELIVERED">배송완료</option>
          <option value="CANCELLED">취소</option>
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Truck className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">총 출하건</p>
              <p className="text-lg font-bold">{summaryStats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">대기</p>
              <p className="text-lg font-bold">{summaryStats.pending}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Truck className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">출하중</p>
              <p className="text-lg font-bold">{summaryStats.shipped}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">배송완료</p>
              <p className="text-lg font-bold text-green-600">{summaryStats.delivered}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <ClipboardCheck className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">검사필요</p>
              <p className="text-lg font-bold text-orange-600">{summaryStats.needsPreCheck}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Package className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">총 품목수</p>
              <p className="text-lg font-bold">{summaryStats.totalItems}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Shipments List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredShipments.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <Truck className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">해당 날짜의 출하 기록이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredShipments.map((shipment) => (
            <div key={shipment.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
              {/* Shipment Header */}
              <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => toggleRowExpand(shipment.id)}
                    className="p-1 hover:bg-gray-200 rounded"
                  >
                    {expandedRows.has(shipment.id) ? (
                      <ChevronUp className="w-5 h-5 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-500" />
                    )}
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium text-lg">{shipment.shipment_number}</span>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${statusColors[shipment.status]}`}>
                        {statusText[shipment.status]}
                      </span>
                      {shipment.status === 'PENDING' && !shipment.pre_shipment_check && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-orange-100 text-orange-700">
                          검사필요
                        </span>
                      )}
                      {shipment.pre_shipment_check && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">
                          검사완료
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">{shipment.customer_name}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Truck className="w-4 h-4" />
                    <span>{shipment.vehicle_number}</span>
                  </div>
                  {shipment.vehicle_temp !== undefined && (
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      <ThermometerSun className="w-4 h-4" />
                      <span>{shipment.vehicle_temp}°C</span>
                    </div>
                  )}
                  <button
                    onClick={() => openDetailModal(shipment)}
                    className="p-2 hover:bg-gray-200 rounded-lg"
                    title="상세보기"
                  >
                    <Eye className="w-4 h-4 text-gray-600" />
                  </button>
                  <Link
                    href={`/shipments/invoice/${shipment.id}`}
                    target="_blank"
                    className="p-2 hover:bg-blue-100 rounded-lg"
                    title="거래명세서"
                  >
                    <FileText className="w-4 h-4 text-blue-600" />
                  </Link>

                  {/* 상태별 액션 버튼 */}
                  {shipment.status === 'PENDING' && !shipment.pre_shipment_check && (
                    <button
                      onClick={() => openPreCheckModal(shipment)}
                      className="px-3 py-1.5 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                    >
                      출하전검사
                    </button>
                  )}
                  {shipment.status === 'PENDING' && shipment.pre_shipment_check && (
                    <button
                      onClick={() => handleShip(shipment.id)}
                      className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      출하처리
                    </button>
                  )}
                  {shipment.status === 'SHIPPED' && (
                    <>
                      <button
                        onClick={() => handleDeliver(shipment.id)}
                        className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                      >
                        배송완료
                      </button>
                      <button
                        onClick={() => openReceiveModal(shipment)}
                        className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-100"
                      >
                        수령확인
                      </button>
                    </>
                  )}
                  {shipment.status === 'PENDING' && (
                    <button
                      onClick={() => handleCancel(shipment.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      title="취소"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Shipment Summary */}
              <div className="p-4 grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <p className="text-xs text-gray-500">배송지</p>
                  <p className="font-medium text-sm flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-gray-400" />
                    {shipment.customer_address || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">배송기사</p>
                  <p className="font-medium">{shipment.driver_name || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">출하시간</p>
                  <p className="font-medium">{shipment.shipment_time?.slice(0, 5) || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">품목수</p>
                  <p className="font-medium">{shipment.items?.length || 0}개</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">담당자</p>
                  <p className="font-medium">{shipment.shipped_by_name || '-'}</p>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedRows.has(shipment.id) && (
                <div className="p-4 border-t bg-gray-50 space-y-4">
                  {/* 출하품목 */}
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase mb-2">출하품목</p>
                    <div className="bg-white rounded-lg p-3 space-y-2">
                      {shipment.items?.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-4 text-sm py-2 border-b last:border-0">
                          <Package className="w-4 h-4 text-gray-400" />
                          <span className="font-medium flex-1">
                            {item.product_name || products.find(p => p.id === item.product_id)?.name || '-'}
                          </span>
                          <span className="font-mono text-gray-500">LOT: {item.lot_number}</span>
                          <span className="font-medium">{item.quantity} {item.unit}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 출하전 검사 결과 */}
                  {shipment.pre_shipment_check !== undefined && (
                    <div className={`rounded-lg p-3 ${
                      shipment.pre_shipment_check ? 'bg-green-50' : 'bg-red-50'
                    }`}>
                      <p className="text-xs font-medium mb-2 flex items-center gap-2">
                        {shipment.pre_shipment_check ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                            <span className="text-green-700">출하전 검사 합격</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-4 h-4 text-red-600" />
                            <span className="text-red-700">출하전 검사 불합격</span>
                          </>
                        )}
                      </p>
                      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-sm">
                        {Object.entries(PRE_SHIPMENT_CHECK_LABELS).map(([key, label]) => {
                          const passed = shipment[key as keyof ShipmentRecord];
                          return (
                            <div key={key} className={`text-center p-2 rounded ${
                              passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              <p className="text-xs">{label}</p>
                              <p className="font-medium">{passed ? '적합' : '부적합'}</p>
                            </div>
                          );
                        })}
                      </div>
                      {shipment.departure_temp !== undefined && (
                        <p className="mt-2 text-sm">
                          출발 온도: <span className="font-medium">{shipment.departure_temp}°C</span>
                        </p>
                      )}
                      <p className="mt-2 text-xs text-gray-500">
                        검사자: {shipment.pre_shipment_checked_by_name} /
                        {shipment.pre_shipment_checked_at?.slice(0, 16).replace('T', ' ')}
                      </p>
                    </div>
                  )}

                  {/* 배송 정보 */}
                  {shipment.status === 'DELIVERED' && (
                    <div className="bg-green-50 rounded-lg p-3">
                      <p className="text-xs font-medium text-green-700 mb-2 flex items-center gap-2">
                        <FileCheck className="w-4 h-4" />
                        배송 완료
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-xs text-green-600">도착 시간</p>
                          <p className="font-medium">
                            {shipment.actual_arrival_time?.slice(11, 16) || '-'}
                          </p>
                        </div>
                        {shipment.arrival_temp !== undefined && (
                          <div>
                            <p className="text-xs text-green-600">도착 온도</p>
                            <p className="font-medium">{shipment.arrival_temp}°C</p>
                          </div>
                        )}
                        {shipment.received_by && (
                          <div>
                            <p className="text-xs text-green-600">수령인</p>
                            <p className="font-medium">{shipment.received_by}</p>
                          </div>
                        )}
                        {shipment.received_at && (
                          <div>
                            <p className="text-xs text-green-600">수령 시간</p>
                            <p className="font-medium">
                              {shipment.received_at?.slice(11, 16)}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 비고 */}
                  {shipment.notes && (
                    <div>
                      <p className="text-xs text-gray-500">비고</p>
                      <p className="text-sm">{shipment.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">출하 등록</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                닫기
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              <button
                type="button"
                onClick={handleAutoFill}
                className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all shadow-md"
              >
                ✨ 자동 입력 (샘플 데이터)
              </button>

              {/* 기본 정보 */}
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900 border-b pb-2">기본 정보</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>출하번호</Label>
                    <input
                      type="text"
                      value={formData.shipment_number}
                      onChange={(e) => setFormData({ ...formData, shipment_number: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="자동 생성됩니다"
                    />
                    <p className="text-xs text-gray-500 mt-1">비워두면 자동 생성 (SHP-날짜-순번)</p>
                  </div>
                  <div>
                    <Label required>고객 선택</Label>
                    <select
                      value={formData.customer_id}
                      onChange={(e) => handleCustomerSelect(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg"
                      required
                    >
                      <option value="">고객을 선택하세요</option>
                      {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name} {customer.business_number && `(${customer.business_number})`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {formData.customer_id && (
                  <div className="bg-gray-50 p-3 rounded-lg space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 w-20">고객명:</span>
                      <span className="font-medium">{formData.customer_name}</span>
                    </div>
                    {formData.customer_address && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 w-20">주소:</span>
                        <span>{formData.customer_address}</span>
                      </div>
                    )}
                    {formData.customer_contact && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 w-20">연락처:</span>
                        <span>{formData.customer_contact}</span>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <Label>배송지 (직접 입력)</Label>
                  <input
                    type="text"
                    value={formData.customer_address}
                    onChange={(e) => setFormData({ ...formData, customer_address: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="고객 선택 시 자동 입력됩니다"
                  />
                </div>
              </div>

              {/* 차량/기사 정보 */}
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900 border-b pb-2">차량/기사 정보</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>차량번호</Label>
                    <input
                      type="text"
                      value={formData.vehicle_number}
                      onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <Label>차량온도 (°C)</Label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.vehicle_temp ?? ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        vehicle_temp: e.target.value ? parseFloat(e.target.value) : undefined
                      })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <Label>예상 도착시간</Label>
                    <input
                      type="time"
                      value={formData.expected_arrival_time}
                      onChange={(e) => setFormData({ ...formData, expected_arrival_time: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>배송기사</Label>
                    <input
                      type="text"
                      value={formData.driver_name}
                      onChange={(e) => setFormData({ ...formData, driver_name: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <Label>기사 연락처</Label>
                    <input
                      type="text"
                      value={formData.driver_contact}
                      onChange={(e) => setFormData({ ...formData, driver_contact: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="010-0000-0000"
                    />
                  </div>
                </div>
              </div>

              {/* 출하품목 */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="font-medium text-gray-900">출하품목</h3>
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
                          onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
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

              {/* 비고 */}
              <div>
                <Label>비고</Label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={3}
                  placeholder="특이사항이 있으면 입력하세요"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  등록
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pre-Shipment Check Modal */}
      {showPreCheckModal && selectedRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowPreCheckModal(false)}>
          <div className="bg-white rounded-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold">출하전 검사</h2>
                <p className="text-sm text-gray-500">{selectedRecord.shipment_number}</p>
              </div>
              <button onClick={() => setShowPreCheckModal(false)} className="text-gray-500 hover:text-gray-700">
                닫기
              </button>
            </div>
            <form onSubmit={handlePreShipmentCheck} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(PRE_SHIPMENT_CHECK_LABELS).map(([key, label]) => (
                  <label
                    key={key}
                    className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer ${
                      preCheckData[key as keyof typeof preCheckData]
                        ? 'bg-green-50 border-green-300'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={preCheckData[key as keyof typeof preCheckData] as boolean}
                      onChange={(e) => setPreCheckData({
                        ...preCheckData,
                        [key]: e.target.checked,
                      })}
                      className="w-5 h-5 rounded"
                    />
                    <div>
                      <p className="font-medium">{label}</p>
                      <p className="text-xs text-gray-500">
                        {preCheckData[key as keyof typeof preCheckData] ? '적합' : '부적합'}
                      </p>
                    </div>
                  </label>
                ))}
              </div>

              <div>
                <Label>출발 온도 (°C)</Label>
                <input
                  type="number"
                  step="0.1"
                  value={preCheckData.departure_temp ?? ''}
                  onChange={(e) => setPreCheckData({
                    ...preCheckData,
                    departure_temp: e.target.value ? parseFloat(e.target.value) : undefined
                  })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="차량 출발 시 온도"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowPreCheckModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  검사 완료
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receive Confirmation Modal */}
      {showReceiveModal && selectedRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowReceiveModal(false)}>
          <div className="bg-white rounded-xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold">수령 확인</h2>
                <p className="text-sm text-gray-500">{selectedRecord.shipment_number}</p>
              </div>
              <button onClick={() => setShowReceiveModal(false)} className="text-gray-500 hover:text-gray-700">
                닫기
              </button>
            </div>
            <form onSubmit={handleReceive} className="space-y-4">
              <div>
                <Label required>수령인</Label>
                <input
                  type="text"
                  value={receiveData.received_by}
                  onChange={(e) => setReceiveData({ ...receiveData, received_by: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="수령인 성명"
                  required
                />
              </div>

              <div>
                <Label>도착 온도 (°C)</Label>
                <input
                  type="number"
                  step="0.1"
                  value={receiveData.arrival_temp ?? ''}
                  onChange={(e) => setReceiveData({
                    ...receiveData,
                    arrival_temp: e.target.value ? parseFloat(e.target.value) : undefined
                  })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="도착 시 제품 온도"
                />
              </div>

              <div>
                <Label>비고</Label>
                <textarea
                  value={receiveData.notes}
                  onChange={(e) => setReceiveData({ ...receiveData, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                  placeholder="특이사항"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowReceiveModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  수령 확인
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowDetailModal(false)}>
          <div className="bg-white rounded-xl w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold">출하 상세</h2>
                <p className="text-sm text-gray-500">{selectedRecord.shipment_number}</p>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="text-gray-500 hover:text-gray-700">
                닫기
              </button>
            </div>

            <div className="space-y-6">
              {/* 기본 정보 */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3 border-b pb-2">기본 정보</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">출하번호</p>
                    <p className="font-medium">{selectedRecord.shipment_number}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">상태</p>
                    <span className={`px-2 py-1 text-xs rounded-full ${statusColors[selectedRecord.status]}`}>
                      {statusText[selectedRecord.status]}
                    </span>
                  </div>
                  <div>
                    <p className="text-gray-500">고객명</p>
                    <p className="font-medium">{selectedRecord.customer_name}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">배송지</p>
                    <p className="font-medium">{selectedRecord.customer_address || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">출하일자</p>
                    <p className="font-medium">{selectedRecord.shipment_date}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">출하시간</p>
                    <p className="font-medium">{selectedRecord.shipment_time?.slice(0, 5) || '-'}</p>
                  </div>
                </div>
              </div>

              {/* 차량/기사 정보 */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3 border-b pb-2">차량/기사 정보</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-gray-500">차량번호</p>
                      <p className="font-medium">{selectedRecord.vehicle_number || '-'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <ThermometerSun className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-gray-500">차량온도</p>
                      <p className="font-medium">
                        {selectedRecord.vehicle_temp !== undefined ? `${selectedRecord.vehicle_temp}°C` : '-'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-gray-500">배송기사</p>
                      <p className="font-medium">{selectedRecord.driver_name || '-'}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-gray-500">담당자</p>
                    <p className="font-medium">{selectedRecord.shipped_by_name || '-'}</p>
                  </div>
                </div>
              </div>

              {/* 출하품목 */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3 border-b pb-2">출하품목</h3>
                <div className="space-y-2">
                  {selectedRecord.items?.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-4 text-sm p-2 bg-gray-50 rounded">
                      <Package className="w-4 h-4 text-gray-400" />
                      <span className="font-medium flex-1">{item.product_name || '-'}</span>
                      <span className="font-mono text-gray-500">LOT: {item.lot_number}</span>
                      <span className="font-medium">{item.quantity} {item.unit}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 출하전 검사 */}
              {selectedRecord.pre_shipment_checked_at && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-3 border-b pb-2">출하전 검사</h3>
                  <div className={`p-3 rounded-lg ${
                    selectedRecord.pre_shipment_check ? 'bg-green-50' : 'bg-red-50'
                  }`}>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      {Object.entries(PRE_SHIPMENT_CHECK_LABELS).map(([key, label]) => {
                        const passed = selectedRecord[key as keyof ShipmentRecord];
                        return (
                          <div key={key} className={`text-center p-2 rounded ${
                            passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            <p className="text-xs">{label}</p>
                            <p className="font-medium">{passed ? '적합' : '부적합'}</p>
                          </div>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      검사자: {selectedRecord.pre_shipment_checked_by_name} /
                      {selectedRecord.pre_shipment_checked_at?.slice(0, 16).replace('T', ' ')}
                    </p>
                  </div>
                </div>
              )}

              {/* 배송 완료 정보 */}
              {selectedRecord.status === 'DELIVERED' && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-3 border-b pb-2">배송 완료</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">도착 시간</p>
                      <p className="font-medium">
                        {selectedRecord.actual_arrival_time?.slice(11, 16) || '-'}
                      </p>
                    </div>
                    {selectedRecord.arrival_temp !== undefined && (
                      <div>
                        <p className="text-gray-500">도착 온도</p>
                        <p className="font-medium">{selectedRecord.arrival_temp}°C</p>
                      </div>
                    )}
                    {selectedRecord.received_by && (
                      <div>
                        <p className="text-gray-500">수령인</p>
                        <p className="font-medium">{selectedRecord.received_by}</p>
                      </div>
                    )}
                    {selectedRecord.received_at && (
                      <div>
                        <p className="text-gray-500">수령 시간</p>
                        <p className="font-medium">
                          {selectedRecord.received_at?.slice(11, 16)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 비고 */}
              {selectedRecord.notes && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-3 border-b pb-2">비고</h3>
                  <p className="text-sm">{selectedRecord.notes}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end mt-6 pt-4 border-t">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
