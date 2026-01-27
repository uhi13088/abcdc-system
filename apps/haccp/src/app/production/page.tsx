'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Calendar, Factory, Clock, Users, Package,
  ThermometerSun, Droplets, CheckCircle2, XCircle,
  Eye, ClipboardCheck, FileCheck, Search,
  ChevronDown, ChevronUp, Settings
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import Link from 'next/link';

interface ProductionRecord {
  id: string;
  production_date: string;
  lot_number: string;
  product_id: string;
  product_name?: string;
  product_code?: string;
  line_number: string;
  start_time: string;
  end_time: string;
  planned_quantity: number;
  actual_quantity: number;
  defect_quantity: number;
  unit: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  // 생산조건
  production_temp?: number;
  production_humidity?: number;
  // 작업자 정보
  worker_names?: string[];
  supervisor_name?: string;
  supervisor_id?: string;
  // 불량 정보
  defect_reason?: string;
  defect_action?: string;
  // 품질검사
  quality_check_status?: 'PENDING' | 'PASS' | 'FAIL' | 'CONDITIONAL';
  appearance_check?: boolean;
  weight_check?: boolean;
  packaging_check?: boolean;
  label_check?: boolean;
  metal_detection_check?: boolean;
  taste_check?: boolean;
  smell_check?: boolean;
  color_check?: boolean;
  quality_checked_by?: string;
  quality_checked_by_name?: string;
  quality_checked_at?: string;
  quality_notes?: string;
  // 승인
  approval_status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'HOLD';
  approved_by?: string;
  approved_by_name?: string;
  approved_at?: string;
  approval_notes?: string;
  // 비고
  notes?: string;
  created_at?: string;
}

interface Product {
  id: string;
  name: string;
  code?: string;
}

interface ProductionStandard {
  id: string;
  product_id: string;
  product_name?: string;
  temp_min: number;
  temp_max: number;
  humidity_min: number;
  humidity_max: number;
  quality_checks: Record<string, boolean>;
}

const QUALITY_CHECK_LABELS: Record<string, string> = {
  appearance_check: '외관검사',
  weight_check: '중량검사',
  packaging_check: '포장상태',
  label_check: '라벨표시',
  metal_detection_check: '금속검출',
  taste_check: '맛검사',
  smell_check: '냄새검사',
  color_check: '색상검사',
};

export default function ProductionPage() {
  const [records, setRecords] = useState<ProductionRecord[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [standards, setStandards] = useState<ProductionStandard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showQualityModal, setShowQualityModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<ProductionRecord | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterQuality, setFilterQuality] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

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
    production_temp: undefined as number | undefined,
    production_humidity: undefined as number | undefined,
    worker_names: [''],
    supervisor_name: '',
    defect_reason: '',
    defect_action: '',
    notes: '',
  });

  // 품질검사 항목을 모두 합격(true)으로 프리필 (정상 상태 기본값)
  const [qualityFormData, setQualityFormData] = useState({
    appearance_check: true,
    weight_check: true,
    packaging_check: true,
    label_check: true,
    metal_detection_check: true,
    taste_check: true,
    smell_check: true,
    color_check: true,
    quality_notes: '',
  });

  const fetchRecords = useCallback(async () => {
    try {
      setLoading(true);
      let url = `/api/haccp/production?date=${selectedDate}`;
      if (filterStatus) url += `&status=${filterStatus}`;
      if (filterQuality) url += `&quality_status=${filterQuality}`;

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setRecords(data);
      }
    } catch (error) {
      console.error('Failed to fetch production records:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, filterStatus, filterQuality]);

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

  const fetchStandards = async () => {
    try {
      const response = await fetch('/api/haccp/production/standards');
      if (response.ok) {
        const data = await response.json();
        setStandards(data);
      }
    } catch (error) {
      console.error('Failed to fetch standards:', error);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  useEffect(() => {
    fetchProducts();
    fetchStandards();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const submitData = {
        production_date: selectedDate,
        ...formData,
        worker_names: formData.worker_names.filter(n => n.trim() !== ''),
      };

      const response = await fetch('/api/haccp/production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      });

      if (response.ok) {
        setShowModal(false);
        fetchRecords();
        resetForm();
      }
    } catch (error) {
      console.error('Failed to create production record:', error);
    }
  };

  const resetForm = () => {
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
      production_temp: undefined,
      production_humidity: undefined,
      worker_names: [''],
      supervisor_name: '',
      defect_reason: '',
      defect_action: '',
      notes: '',
    });
  };

  // 자동 입력 기능
  const handleAutoFill = () => {
    const today = new Date();
    const lotNumber = `LOT-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}-${String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')}`;

    // 제품 선택 (첫 번째 제품 또는 랜덤)
    const selectedProduct = products.length > 0 ? products[Math.floor(Math.random() * products.length)] : null;
    const standard = selectedProduct ? getStandardForProduct(selectedProduct.id) : null;

    // 적정 온습도 생성
    let temp = 20 + Math.random() * 5; // 기본값 20-25도
    let humidity = 50 + Math.random() * 10; // 기본값 50-60%

    if (standard) {
      // 기준 범위 내 값 생성
      temp = standard.temp_min + Math.random() * (standard.temp_max - standard.temp_min);
      humidity = standard.humidity_min + Math.random() * (standard.humidity_max - standard.humidity_min);
    }

    // 생산량 생성
    const planned = Math.floor(100 + Math.random() * 400); // 100-500
    const actual = Math.floor(planned * (0.95 + Math.random() * 0.05)); // 95-100%
    const defect = Math.floor(actual * Math.random() * 0.02); // 0-2% 불량

    // 작업자 이름
    const workerNames = ['김생산', '이품질', '박관리'];
    const selectedWorkers = workerNames.slice(0, Math.floor(Math.random() * 2) + 1);

    setFormData({
      lot_number: lotNumber,
      product_id: selectedProduct?.id || '',
      line_number: `L-${Math.floor(Math.random() * 3) + 1}`,
      start_time: '08:00',
      end_time: '17:00',
      planned_quantity: planned,
      actual_quantity: actual,
      defect_quantity: defect,
      unit: 'kg',
      production_temp: Math.round(temp * 10) / 10,
      production_humidity: Math.round(humidity * 10) / 10,
      worker_names: selectedWorkers,
      supervisor_name: '홍책임',
      defect_reason: defect > 0 ? '경미한 외관 불량' : '',
      defect_action: defect > 0 ? '선별 후 재가공' : '',
      notes: '',
    });
  };

  // 품질검사 자동 입력
  const handleQualityAutoFill = () => {
    setQualityFormData({
      appearance_check: true,
      weight_check: true,
      packaging_check: true,
      label_check: true,
      metal_detection_check: true,
      taste_check: true,
      smell_check: true,
      color_check: true,
      quality_notes: '',
    });
  };

  const handleQualityCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;

    try {
      const response = await fetch('/api/haccp/production', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedRecord.id,
          action: 'quality_check',
          ...qualityFormData,
        }),
      });

      if (response.ok) {
        setShowQualityModal(false);
        fetchRecords();
      }
    } catch (error) {
      console.error('Failed to submit quality check:', error);
    }
  };

  const handleApproval = async (recordId: string, action: 'approve' | 'reject' | 'hold', notes?: string) => {
    try {
      const response = await fetch('/api/haccp/production', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: recordId,
          action,
          approval_notes: notes,
        }),
      });

      if (response.ok) {
        fetchRecords();
      }
    } catch (error) {
      console.error('Failed to update approval:', error);
    }
  };

  const handleComplete = async (recordId: string) => {
    try {
      const response = await fetch('/api/haccp/production', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: recordId,
          action: 'complete',
        }),
      });

      if (response.ok) {
        fetchRecords();
      }
    } catch (error) {
      console.error('Failed to complete record:', error);
    }
  };

  const openQualityModal = (record: ProductionRecord) => {
    setSelectedRecord(record);
    setQualityFormData({
      appearance_check: record.appearance_check || false,
      weight_check: record.weight_check || false,
      packaging_check: record.packaging_check || false,
      label_check: record.label_check || false,
      metal_detection_check: record.metal_detection_check || false,
      taste_check: record.taste_check || false,
      smell_check: record.smell_check || false,
      color_check: record.color_check || false,
      quality_notes: record.quality_notes || '',
    });
    setShowQualityModal(true);
  };

  const openDetailModal = (record: ProductionRecord) => {
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

  const addWorker = () => {
    setFormData({
      ...formData,
      worker_names: [...formData.worker_names, ''],
    });
  };

  const removeWorker = (index: number) => {
    setFormData({
      ...formData,
      worker_names: formData.worker_names.filter((_, i) => i !== index),
    });
  };

  const updateWorker = (index: number, value: string) => {
    const newWorkers = [...formData.worker_names];
    newWorkers[index] = value;
    setFormData({ ...formData, worker_names: newWorkers });
  };

  const getStandardForProduct = (productId: string) => {
    return standards.find(s => s.product_id === productId);
  };

  const isTempInRange = (record: ProductionRecord) => {
    if (record.production_temp === undefined) return null;
    const standard = getStandardForProduct(record.product_id);
    if (!standard) return null;
    return record.production_temp >= standard.temp_min && record.production_temp <= standard.temp_max;
  };

  const isHumidityInRange = (record: ProductionRecord) => {
    if (record.production_humidity === undefined) return null;
    const standard = getStandardForProduct(record.product_id);
    if (!standard) return null;
    return record.production_humidity >= standard.humidity_min && record.production_humidity <= standard.humidity_max;
  };

  const statusColors: Record<string, string> = {
    'IN_PROGRESS': 'bg-blue-100 text-blue-700',
    'COMPLETED': 'bg-green-100 text-green-700',
    'CANCELLED': 'bg-gray-100 text-gray-700',
  };

  const statusText: Record<string, string> = {
    'IN_PROGRESS': '진행중',
    'COMPLETED': '완료',
    'CANCELLED': '취소',
  };

  const qualityStatusColors: Record<string, string> = {
    'PENDING': 'bg-gray-100 text-gray-700',
    'PASS': 'bg-green-100 text-green-700',
    'FAIL': 'bg-red-100 text-red-700',
    'CONDITIONAL': 'bg-yellow-100 text-yellow-700',
  };

  const qualityStatusText: Record<string, string> = {
    'PENDING': '검사대기',
    'PASS': '합격',
    'FAIL': '불합격',
    'CONDITIONAL': '조건부합격',
  };

  const approvalStatusColors: Record<string, string> = {
    'PENDING': 'bg-gray-100 text-gray-600',
    'APPROVED': 'bg-green-100 text-green-700',
    'REJECTED': 'bg-red-100 text-red-700',
    'HOLD': 'bg-yellow-100 text-yellow-700',
  };

  const approvalStatusText: Record<string, string> = {
    'PENDING': '승인대기',
    'APPROVED': '승인',
    'REJECTED': '반려',
    'HOLD': '보류',
  };

  const calculateYield = (actual: number, planned: number) => {
    if (planned === 0) return 0;
    return Math.round((actual / planned) * 100);
  };

  const filteredRecords = records.filter(r => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        r.lot_number?.toLowerCase().includes(search) ||
        r.product_name?.toLowerCase().includes(search) ||
        r.product_code?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  const summaryStats = {
    total: records.length,
    inProgress: records.filter(r => r.status === 'IN_PROGRESS').length,
    completed: records.filter(r => r.status === 'COMPLETED').length,
    totalQuantity: records.reduce((sum, r) => sum + (r.actual_quantity || 0), 0),
    totalDefects: records.reduce((sum, r) => sum + (r.defect_quantity || 0), 0),
    pendingQuality: records.filter(r => r.quality_check_status === 'PENDING').length,
    passedQuality: records.filter(r => r.quality_check_status === 'PASS').length,
    pendingApproval: records.filter(r => r.approval_status === 'PENDING').length,
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">완제품 생산기록</h1>
          <p className="mt-1 text-sm text-gray-500">일일 생산 현황 및 품질검사를 관리합니다</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/production/settings"
            className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            <Settings className="w-4 h-4" />
            생산기준 설정
          </Link>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            생산 등록
          </button>
        </div>
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
            placeholder="LOT번호, 제품명 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3 py-2 border rounded-lg w-48"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border rounded-lg"
        >
          <option value="">전체 상태</option>
          <option value="IN_PROGRESS">진행중</option>
          <option value="COMPLETED">완료</option>
          <option value="CANCELLED">취소</option>
        </select>
        <select
          value={filterQuality}
          onChange={(e) => setFilterQuality(e.target.value)}
          className="px-3 py-2 border rounded-lg"
        >
          <option value="">품질검사 전체</option>
          <option value="PENDING">검사대기</option>
          <option value="PASS">합격</option>
          <option value="FAIL">불합격</option>
          <option value="CONDITIONAL">조건부합격</option>
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Factory className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">총 생산건수</p>
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
              <p className="text-xs text-gray-500">진행중</p>
              <p className="text-lg font-bold">{summaryStats.inProgress}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">완료</p>
              <p className="text-lg font-bold">{summaryStats.completed}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Package className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">총 생산량</p>
              <p className="text-lg font-bold">{summaryStats.totalQuantity.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">불량수량</p>
              <p className="text-lg font-bold text-red-600">{summaryStats.totalDefects}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <ClipboardCheck className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">검사대기</p>
              <p className="text-lg font-bold">{summaryStats.pendingQuality}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <FileCheck className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">검사합격</p>
              <p className="text-lg font-bold text-green-600">{summaryStats.passedQuality}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Users className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">승인대기</p>
              <p className="text-lg font-bold">{summaryStats.pendingApproval}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Records List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <Factory className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">해당 날짜의 생산 기록이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRecords.map((record) => (
            <div key={record.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
              {/* Record Header */}
              <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => toggleRowExpand(record.id)}
                    className="p-1 hover:bg-gray-200 rounded"
                  >
                    {expandedRows.has(record.id) ? (
                      <ChevronUp className="w-5 h-5 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-500" />
                    )}
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium text-lg">{record.lot_number}</span>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${statusColors[record.status]}`}>
                        {statusText[record.status]}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500">
                      {record.product_name} {record.product_code && `(${record.product_code})`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {/* 품질검사 상태 */}
                  {record.quality_check_status && (
                    <span className={`px-2 py-1 text-xs rounded-full ${qualityStatusColors[record.quality_check_status]}`}>
                      품질: {qualityStatusText[record.quality_check_status]}
                    </span>
                  )}
                  {/* 승인 상태 */}
                  {record.approval_status && (
                    <span className={`px-2 py-1 text-xs rounded-full ${approvalStatusColors[record.approval_status]}`}>
                      {approvalStatusText[record.approval_status]}
                    </span>
                  )}
                  {/* 액션 버튼들 */}
                  <button
                    onClick={() => openDetailModal(record)}
                    className="p-2 hover:bg-gray-200 rounded-lg"
                    title="상세보기"
                  >
                    <Eye className="w-4 h-4 text-gray-600" />
                  </button>
                  {record.quality_check_status === 'PENDING' && (
                    <button
                      onClick={() => openQualityModal(record)}
                      className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      품질검사
                    </button>
                  )}
                  {record.status === 'IN_PROGRESS' && record.quality_check_status === 'PASS' && (
                    <button
                      onClick={() => handleComplete(record.id)}
                      className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      완료처리
                    </button>
                  )}
                </div>
              </div>

              {/* Record Summary */}
              <div className="p-4 grid grid-cols-2 md:grid-cols-6 gap-4">
                <div>
                  <p className="text-xs text-gray-500">생산라인</p>
                  <p className="font-medium">{record.line_number || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">생산시간</p>
                  <p className="font-medium">
                    {record.start_time?.slice(0, 5)} ~ {record.end_time?.slice(0, 5) || '진행중'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">계획/실적</p>
                  <p className="font-medium">
                    {record.planned_quantity} / {record.actual_quantity} {record.unit}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">달성률</p>
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
                    <span className="text-sm font-medium">{calculateYield(record.actual_quantity, record.planned_quantity)}%</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500">불량</p>
                  <p className={`font-medium ${record.defect_quantity > 0 ? 'text-red-600' : ''}`}>
                    {record.defect_quantity} {record.unit}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">담당자</p>
                  <p className="font-medium">{record.supervisor_name || '-'}</p>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedRows.has(record.id) && (
                <div className="p-4 border-t bg-gray-50 space-y-4">
                  {/* 생산조건 */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex items-center gap-2">
                      <ThermometerSun className="w-4 h-4 text-orange-500" />
                      <div>
                        <p className="text-xs text-gray-500">생산온도</p>
                        <p className={`font-medium ${
                          isTempInRange(record) === false ? 'text-red-600' :
                          isTempInRange(record) === true ? 'text-green-600' : ''
                        }`}>
                          {record.production_temp !== undefined ? `${record.production_temp}°C` : '-'}
                          {isTempInRange(record) === false && ' ⚠️'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Droplets className="w-4 h-4 text-blue-500" />
                      <div>
                        <p className="text-xs text-gray-500">습도</p>
                        <p className={`font-medium ${
                          isHumidityInRange(record) === false ? 'text-red-600' :
                          isHumidityInRange(record) === true ? 'text-green-600' : ''
                        }`}>
                          {record.production_humidity !== undefined ? `${record.production_humidity}%` : '-'}
                          {isHumidityInRange(record) === false && ' ⚠️'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 작업자 */}
                  {record.worker_names && record.worker_names.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">작업자</p>
                      <div className="flex flex-wrap gap-2">
                        {record.worker_names.map((name, idx) => (
                          <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm">
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 불량 사유/조치 */}
                  {record.defect_quantity > 0 && (
                    <div className="bg-red-50 rounded-lg p-3">
                      <p className="text-xs font-medium text-red-700 mb-2">불량 정보</p>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-xs text-red-600">불량 사유</p>
                          <p>{record.defect_reason || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-red-600">조치 내용</p>
                          <p>{record.defect_action || '-'}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 품질검사 결과 */}
                  {record.quality_check_status && record.quality_check_status !== 'PENDING' && (
                    <div className="bg-blue-50 rounded-lg p-3">
                      <p className="text-xs font-medium text-blue-700 mb-2">품질검사 결과</p>
                      <div className="grid grid-cols-4 md:grid-cols-8 gap-2 text-sm">
                        {Object.entries(QUALITY_CHECK_LABELS).map(([key, label]) => {
                          const passed = record[key as keyof ProductionRecord];
                          return (
                            <div key={key} className={`text-center p-2 rounded ${
                              passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              <p className="text-xs">{label}</p>
                              <p>{passed ? '합격' : '불합격'}</p>
                            </div>
                          );
                        })}
                      </div>
                      {record.quality_notes && (
                        <p className="mt-2 text-sm text-gray-600">비고: {record.quality_notes}</p>
                      )}
                      <p className="mt-2 text-xs text-gray-500">
                        검사자: {record.quality_checked_by_name} / {record.quality_checked_at?.slice(0, 16).replace('T', ' ')}
                      </p>
                    </div>
                  )}

                  {/* 승인 정보 */}
                  {record.approval_status && record.approval_status !== 'PENDING' && (
                    <div className={`rounded-lg p-3 ${
                      record.approval_status === 'APPROVED' ? 'bg-green-50' :
                      record.approval_status === 'REJECTED' ? 'bg-red-50' : 'bg-yellow-50'
                    }`}>
                      <p className="text-xs font-medium mb-1">
                        {approvalStatusText[record.approval_status]}
                      </p>
                      {record.approval_notes && (
                        <p className="text-sm">{record.approval_notes}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        {record.approved_by_name} / {record.approved_at?.slice(0, 16).replace('T', ' ')}
                      </p>
                    </div>
                  )}

                  {/* 승인 버튼 (품질검사 완료 후) */}
                  {record.quality_check_status !== 'PENDING' && record.approval_status === 'PENDING' && (
                    <div className="flex gap-2 pt-2 border-t">
                      <button
                        onClick={() => handleApproval(record.id, 'approve')}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                      >
                        승인
                      </button>
                      <button
                        onClick={() => handleApproval(record.id, 'hold')}
                        className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 text-sm"
                      >
                        보류
                      </button>
                      <button
                        onClick={() => {
                          const reason = prompt('반려 사유를 입력하세요:');
                          if (reason) handleApproval(record.id, 'reject', reason);
                        }}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                      >
                        반려
                      </button>
                    </div>
                  )}

                  {/* 비고 */}
                  {record.notes && (
                    <div>
                      <p className="text-xs text-gray-500">비고/특이사항</p>
                      <p className="text-sm">{record.notes}</p>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">생산 등록</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                닫기
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 자동 입력 버튼 */}
              <button
                type="button"
                onClick={handleAutoFill}
                className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all shadow-md"
              >
                ✨ 자동 입력 (샘플 생산 데이터)
              </button>

              {/* 기본 정보 */}
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900 border-b pb-2">기본 정보</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>LOT 번호</Label>
                    <input
                      type="text"
                      value={formData.lot_number}
                      onChange={(e) => setFormData({ ...formData, lot_number: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="자동 생성됩니다"
                    />
                    <p className="text-xs text-gray-500 mt-1">비워두면 자동 생성 (PRD-날짜-제품코드-순번)</p>
                  </div>
                  <div>
                    <Label>생산라인</Label>
                    <input
                      type="text"
                      value={formData.line_number}
                      onChange={(e) => setFormData({ ...formData, line_number: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="예: Line 1"
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
                      <option key={p.id} value={p.id}>{p.name} {p.code && `(${p.code})`}</option>
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
              </div>

              {/* 생산조건 */}
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900 border-b pb-2">생산조건</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>생산온도 (°C)</Label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.production_temp ?? ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        production_temp: e.target.value ? parseFloat(e.target.value) : undefined
                      })}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="예: 25.0"
                    />
                    {formData.product_id && getStandardForProduct(formData.product_id) && (
                      <p className="text-xs text-gray-500 mt-1">
                        기준: {getStandardForProduct(formData.product_id)?.temp_min}~{getStandardForProduct(formData.product_id)?.temp_max}°C
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>습도 (%)</Label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.production_humidity ?? ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        production_humidity: e.target.value ? parseFloat(e.target.value) : undefined
                      })}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="예: 60"
                    />
                    {formData.product_id && getStandardForProduct(formData.product_id) && (
                      <p className="text-xs text-gray-500 mt-1">
                        기준: {getStandardForProduct(formData.product_id)?.humidity_min}~{getStandardForProduct(formData.product_id)?.humidity_max}%
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* 수량 정보 */}
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900 border-b pb-2">수량 정보</h3>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <Label>계획 수량</Label>
                    <input
                      type="number"
                      value={formData.planned_quantity}
                      onChange={(e) => setFormData({ ...formData, planned_quantity: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <Label>실적 수량</Label>
                    <input
                      type="number"
                      value={formData.actual_quantity}
                      onChange={(e) => setFormData({ ...formData, actual_quantity: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <Label>불량 수량</Label>
                    <input
                      type="number"
                      value={formData.defect_quantity}
                      onChange={(e) => setFormData({ ...formData, defect_quantity: parseFloat(e.target.value) || 0 })}
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

                {/* 불량 사유/조치 */}
                {formData.defect_quantity > 0 && (
                  <div className="grid grid-cols-2 gap-4 bg-red-50 p-4 rounded-lg">
                    <div>
                      <Label>불량 사유</Label>
                      <input
                        type="text"
                        value={formData.defect_reason}
                        onChange={(e) => setFormData({ ...formData, defect_reason: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg"
                        placeholder="불량 발생 사유"
                      />
                    </div>
                    <div>
                      <Label>조치 내용</Label>
                      <input
                        type="text"
                        value={formData.defect_action}
                        onChange={(e) => setFormData({ ...formData, defect_action: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg"
                        placeholder="조치 내용"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 작업자 정보 */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="font-medium text-gray-900">작업자</h3>
                  <button
                    type="button"
                    onClick={addWorker}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    + 작업자 추가
                  </button>
                </div>
                <div className="space-y-2">
                  {formData.worker_names.map((worker, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        type="text"
                        value={worker}
                        onChange={(e) => updateWorker(idx, e.target.value)}
                        className="flex-1 px-3 py-2 border rounded-lg"
                        placeholder={`작업자 ${idx + 1}`}
                      />
                      {formData.worker_names.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeWorker(idx)}
                          className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg"
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <div>
                  <Label>담당자(관리자)</Label>
                  <input
                    type="text"
                    value={formData.supervisor_name}
                    onChange={(e) => setFormData({ ...formData, supervisor_name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="생산 담당자명"
                  />
                </div>
              </div>

              {/* 비고 */}
              <div>
                <Label>비고/특이사항</Label>
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

      {/* Quality Check Modal */}
      {showQualityModal && selectedRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold">품질검사</h2>
                <p className="text-sm text-gray-500">{selectedRecord.lot_number} - {selectedRecord.product_name}</p>
              </div>
              <button onClick={() => setShowQualityModal(false)} className="text-gray-500 hover:text-gray-700">
                닫기
              </button>
            </div>
            <form onSubmit={handleQualityCheck} className="space-y-4">
              {/* 자동 입력 버튼 */}
              <button
                type="button"
                onClick={handleQualityAutoFill}
                className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all shadow-md"
              >
                ✨ 자동 입력 (전체 합격 처리)
              </button>

              <div className="grid grid-cols-2 gap-3">
                {Object.entries(QUALITY_CHECK_LABELS).map(([key, label]) => (
                  <label
                    key={key}
                    className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer ${
                      qualityFormData[key as keyof typeof qualityFormData]
                        ? 'bg-green-50 border-green-300'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={qualityFormData[key as keyof typeof qualityFormData] as boolean}
                      onChange={(e) => setQualityFormData({
                        ...qualityFormData,
                        [key]: e.target.checked,
                      })}
                      className="w-5 h-5 rounded"
                    />
                    <div>
                      <p className="font-medium">{label}</p>
                      <p className="text-xs text-gray-500">
                        {qualityFormData[key as keyof typeof qualityFormData] ? '합격' : '불합격'}
                      </p>
                    </div>
                  </label>
                ))}
              </div>

              <div>
                <Label>검사 비고</Label>
                <textarea
                  value={qualityFormData.quality_notes}
                  onChange={(e) => setQualityFormData({ ...qualityFormData, quality_notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={3}
                  placeholder="품질검사 관련 특이사항"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowQualityModal(false)}
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

      {/* Detail Modal */}
      {showDetailModal && selectedRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold">생산 상세</h2>
                <p className="text-sm text-gray-500">{selectedRecord.lot_number}</p>
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
                    <p className="text-gray-500">LOT 번호</p>
                    <p className="font-medium">{selectedRecord.lot_number}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">제품</p>
                    <p className="font-medium">{selectedRecord.product_name}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">생산라인</p>
                    <p className="font-medium">{selectedRecord.line_number || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">생산일자</p>
                    <p className="font-medium">{selectedRecord.production_date}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">생산시간</p>
                    <p className="font-medium">
                      {selectedRecord.start_time?.slice(0, 5)} ~ {selectedRecord.end_time?.slice(0, 5) || '진행중'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">상태</p>
                    <span className={`px-2 py-1 text-xs rounded-full ${statusColors[selectedRecord.status]}`}>
                      {statusText[selectedRecord.status]}
                    </span>
                  </div>
                </div>
              </div>

              {/* 생산조건 */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3 border-b pb-2">생산조건</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <ThermometerSun className="w-4 h-4 text-orange-500" />
                    <div>
                      <p className="text-gray-500">생산온도</p>
                      <p className={`font-medium ${
                        isTempInRange(selectedRecord) === false ? 'text-red-600' : ''
                      }`}>
                        {selectedRecord.production_temp !== undefined ? `${selectedRecord.production_temp}°C` : '-'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Droplets className="w-4 h-4 text-blue-500" />
                    <div>
                      <p className="text-gray-500">습도</p>
                      <p className={`font-medium ${
                        isHumidityInRange(selectedRecord) === false ? 'text-red-600' : ''
                      }`}>
                        {selectedRecord.production_humidity !== undefined ? `${selectedRecord.production_humidity}%` : '-'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 수량 정보 */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3 border-b pb-2">수량 정보</h3>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">계획</p>
                    <p className="font-medium">{selectedRecord.planned_quantity} {selectedRecord.unit}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">실적</p>
                    <p className="font-medium">{selectedRecord.actual_quantity} {selectedRecord.unit}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">불량</p>
                    <p className={`font-medium ${selectedRecord.defect_quantity > 0 ? 'text-red-600' : ''}`}>
                      {selectedRecord.defect_quantity} {selectedRecord.unit}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">달성률</p>
                    <p className="font-medium">
                      {calculateYield(selectedRecord.actual_quantity, selectedRecord.planned_quantity)}%
                    </p>
                  </div>
                </div>
                {selectedRecord.defect_quantity > 0 && (
                  <div className="mt-3 p-3 bg-red-50 rounded-lg">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-red-600 text-xs">불량 사유</p>
                        <p>{selectedRecord.defect_reason || '-'}</p>
                      </div>
                      <div>
                        <p className="text-red-600 text-xs">조치 내용</p>
                        <p>{selectedRecord.defect_action || '-'}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 작업자 정보 */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3 border-b pb-2">작업자 정보</h3>
                <div className="text-sm">
                  {selectedRecord.worker_names && selectedRecord.worker_names.length > 0 && (
                    <div className="mb-2">
                      <p className="text-gray-500 mb-1">작업자</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedRecord.worker_names.map((name, idx) => (
                          <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="text-gray-500">담당자</p>
                    <p className="font-medium">{selectedRecord.supervisor_name || '-'}</p>
                  </div>
                </div>
              </div>

              {/* 품질검사 */}
              {selectedRecord.quality_check_status && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-3 border-b pb-2">품질검사</h3>
                  <div className="mb-2">
                    <span className={`px-2 py-1 text-xs rounded-full ${qualityStatusColors[selectedRecord.quality_check_status]}`}>
                      {qualityStatusText[selectedRecord.quality_check_status]}
                    </span>
                  </div>
                  {selectedRecord.quality_check_status !== 'PENDING' && (
                    <>
                      <div className="grid grid-cols-4 gap-2 text-sm">
                        {Object.entries(QUALITY_CHECK_LABELS).map(([key, label]) => {
                          const passed = selectedRecord[key as keyof ProductionRecord];
                          return (
                            <div key={key} className={`text-center p-2 rounded ${
                              passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              <p className="text-xs">{label}</p>
                              <p className="font-medium">{passed ? '합격' : '불합격'}</p>
                            </div>
                          );
                        })}
                      </div>
                      {selectedRecord.quality_notes && (
                        <p className="mt-2 text-sm text-gray-600">비고: {selectedRecord.quality_notes}</p>
                      )}
                      <p className="mt-2 text-xs text-gray-500">
                        검사자: {selectedRecord.quality_checked_by_name} /
                        {selectedRecord.quality_checked_at?.slice(0, 16).replace('T', ' ')}
                      </p>
                    </>
                  )}
                </div>
              )}

              {/* 승인 정보 */}
              {selectedRecord.approval_status && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-3 border-b pb-2">승인 정보</h3>
                  <div className="text-sm">
                    <span className={`px-2 py-1 text-xs rounded-full ${approvalStatusColors[selectedRecord.approval_status]}`}>
                      {approvalStatusText[selectedRecord.approval_status]}
                    </span>
                    {selectedRecord.approval_status !== 'PENDING' && (
                      <>
                        {selectedRecord.approval_notes && (
                          <p className="mt-2">{selectedRecord.approval_notes}</p>
                        )}
                        <p className="mt-2 text-xs text-gray-500">
                          {selectedRecord.approved_by_name} /
                          {selectedRecord.approved_at?.slice(0, 16).replace('T', ' ')}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* 비고 */}
              {selectedRecord.notes && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-3 border-b pb-2">비고/특이사항</h3>
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
