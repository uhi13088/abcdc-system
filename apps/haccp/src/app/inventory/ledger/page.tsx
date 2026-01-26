'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  FileSpreadsheet,
  Download,
  Printer,
  ChevronDown,
  ChevronRight,
  ArrowUpCircle,
  ArrowDownCircle,
  Package,
  Factory,
  Filter,
  RefreshCw
} from 'lucide-react';

interface MaterialLedgerEntry {
  material_id: string;
  material_code: string;
  material_name: string;
  material_type?: string;
  unit: string;
  date: string;
  opening_balance: number;
  in_quantity: number;
  out_quantity: number;
  adjust_quantity: number;
  closing_balance: number;
  production_count?: number;
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
  earliest_expiry?: string;
  lot_count?: number;
}

interface DailyTransaction {
  date: string;
  in_quantity: number;
  out_quantity: number;
  adjust_quantity: number;
  production_lots?: string[];
}

interface MaterialDetail {
  material_id: string;
  material_code: string;
  material_name: string;
  unit: string;
  opening_balance: number;
  current_balance: number;
  transactions: DailyTransaction[];
}

type ViewMode = 'summary' | 'daily' | 'monthly';
type DateRange = 'today' | 'week' | 'month' | 'custom';

export default function MaterialLedgerPage() {
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('summary');
  const [dateRange, setDateRange] = useState<DateRange>('month');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedMaterial, setSelectedMaterial] = useState<string>('all');
  const [materials, setMaterials] = useState<{id: string; name: string; code: string}[]>([]);
  const [summaryData, setSummaryData] = useState<MaterialSummary[]>([]);
  const [ledgerData, setLedgerData] = useState<MaterialLedgerEntry[]>([]);
  const [expandedMaterials, setExpandedMaterials] = useState<Set<string>>(new Set());
  const [materialDetails, setMaterialDetails] = useState<Record<string, MaterialDetail>>({});

  useEffect(() => {
    fetchMaterials();
    fetchLedgerData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (dateRange !== 'custom') {
      const today = new Date();
      let start = new Date();

      switch (dateRange) {
        case 'today':
          start = today;
          break;
        case 'week':
          start.setDate(today.getDate() - 7);
          break;
        case 'month':
          start.setDate(1);
          break;
      }

      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(today.toISOString().split('T')[0]);
    }
  }, [dateRange]);

  const fetchMaterials = async () => {
    try {
      const res = await fetch('/api/haccp/materials');
      if (res.ok) {
        setMaterials(await res.json());
      }
    } catch (error) {
      console.error('Failed to fetch materials:', error);
    }
  };

  const fetchLedgerData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        view_mode: viewMode,
      });
      if (selectedMaterial !== 'all') {
        params.append('material_id', selectedMaterial);
      }

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
  };

  // 재조회 버튼 클릭
  const handleSearch = () => {
    fetchLedgerData();
  };

  // 원료별 상세 조회
  const toggleMaterialDetail = async (materialId: string) => {
    const newExpanded = new Set(expandedMaterials);
    if (newExpanded.has(materialId)) {
      newExpanded.delete(materialId);
    } else {
      newExpanded.add(materialId);
      // 상세 데이터 로드
      if (!materialDetails[materialId]) {
        try {
          const params = new URLSearchParams({
            material_id: materialId,
            start_date: startDate,
            end_date: endDate,
          });
          const res = await fetch(`/api/haccp/inventory/ledger/detail?${params}`);
          if (res.ok) {
            const detail = await res.json();
            setMaterialDetails(prev => ({ ...prev, [materialId]: detail }));
          }
        } catch (error) {
          console.error('Failed to fetch material detail:', error);
        }
      }
    }
    setExpandedMaterials(newExpanded);
  };

  // 일별 데이터를 원료별로 그룹화
  const groupedByMaterial = useMemo(() => {
    const grouped: Record<string, MaterialLedgerEntry[]> = {};
    ledgerData.forEach(entry => {
      if (!grouped[entry.material_id]) {
        grouped[entry.material_id] = [];
      }
      grouped[entry.material_id].push(entry);
    });
    return grouped;
  }, [ledgerData]);

  // 엑셀 내보내기
  const handleExport = () => {
    // CSV 형식으로 내보내기
    const headers = ['원료코드', '원료명', '단위', '날짜', '전일재고', '입고', '출고', '조정', '재고'];
    const rows = ledgerData.map(entry => [
      entry.material_code,
      entry.material_name,
      entry.unit,
      entry.date,
      entry.opening_balance,
      entry.in_quantity,
      entry.out_quantity,
      entry.adjust_quantity,
      entry.closing_balance,
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

  // 인쇄
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-6 print:p-2">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileSpreadsheet className="w-7 h-7 text-blue-600" />
            원료수불부
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            HACCP 원료수불부 - 입고/출고/재고 현황을 관리합니다
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            <Download className="w-4 h-4" />
            내보내기
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            <Printer className="w-4 h-4" />
            인쇄
          </button>
        </div>
      </div>

      {/* Print Header */}
      <div className="hidden print:block mb-4">
        <h1 className="text-xl font-bold text-center">원 료 수 불 부</h1>
        <p className="text-sm text-center text-gray-600">
          기간: {startDate} ~ {endDate}
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border p-4 mb-6 print:hidden">
        <div className="flex flex-wrap items-end gap-4">
          {/* 보기 모드 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">보기</label>
            <div className="flex border rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('summary')}
                className={`px-3 py-2 text-sm ${viewMode === 'summary' ? 'bg-blue-600 text-white' : 'bg-white hover:bg-gray-50'}`}
              >
                요약
              </button>
              <button
                onClick={() => setViewMode('daily')}
                className={`px-3 py-2 text-sm border-l ${viewMode === 'daily' ? 'bg-blue-600 text-white' : 'bg-white hover:bg-gray-50'}`}
              >
                일별
              </button>
              <button
                onClick={() => setViewMode('monthly')}
                className={`px-3 py-2 text-sm border-l ${viewMode === 'monthly' ? 'bg-blue-600 text-white' : 'bg-white hover:bg-gray-50'}`}
              >
                월별
              </button>
            </div>
          </div>

          {/* 기간 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">기간</label>
            <div className="flex border rounded-lg overflow-hidden">
              <button
                onClick={() => setDateRange('today')}
                className={`px-3 py-2 text-sm ${dateRange === 'today' ? 'bg-blue-600 text-white' : 'bg-white hover:bg-gray-50'}`}
              >
                오늘
              </button>
              <button
                onClick={() => setDateRange('week')}
                className={`px-3 py-2 text-sm border-l ${dateRange === 'week' ? 'bg-blue-600 text-white' : 'bg-white hover:bg-gray-50'}`}
              >
                최근 7일
              </button>
              <button
                onClick={() => setDateRange('month')}
                className={`px-3 py-2 text-sm border-l ${dateRange === 'month' ? 'bg-blue-600 text-white' : 'bg-white hover:bg-gray-50'}`}
              >
                이번 달
              </button>
              <button
                onClick={() => setDateRange('custom')}
                className={`px-3 py-2 text-sm border-l ${dateRange === 'custom' ? 'bg-blue-600 text-white' : 'bg-white hover:bg-gray-50'}`}
              >
                직접 선택
              </button>
            </div>
          </div>

          {/* 날짜 입력 (직접 선택시) */}
          {dateRange === 'custom' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">시작일</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">종료일</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-2 border rounded-lg"
                />
              </div>
            </>
          )}

          {/* 원료 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">원료</label>
            <select
              value={selectedMaterial}
              onChange={(e) => setSelectedMaterial(e.target.value)}
              className="px-3 py-2 border rounded-lg min-w-[200px]"
            >
              <option value="all">전체 원료</option>
              {materials.map(m => (
                <option key={m.id} value={m.id}>{m.name} ({m.code})</option>
              ))}
            </select>
          </div>

          {/* 조회 버튼 */}
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Filter className="w-4 h-4" />
            조회
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : viewMode === 'summary' ? (
        /* 요약 보기 */
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden print:shadow-none print:border-black">
          <table className="min-w-full divide-y divide-gray-200 print:divide-gray-400">
            <thead className="bg-gray-50 print:bg-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase print:text-[10px]">원료코드</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase print:text-[10px]">원료명</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase print:text-[10px]">분류</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase print:text-[10px]">입고량</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase print:text-[10px]">출고량</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase print:text-[10px]">조정</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase print:text-[10px]">현재고</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase print:text-[10px]">유통기한</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase print:text-[10px]">LOT수</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 print:divide-gray-400">
              {summaryData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                    <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>데이터가 없습니다</p>
                  </td>
                </tr>
              ) : (
                summaryData.map((item) => (
                  <tr key={item.material_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono text-gray-600">{item.material_code}</td>
                    <td className="px-4 py-3 text-sm font-medium">{item.material_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{item.material_type || '-'}</td>
                    <td className="px-4 py-3 text-sm text-right text-green-600">
                      <span className="inline-flex items-center gap-1">
                        <ArrowDownCircle className="w-3 h-3" />
                        {item.total_in.toLocaleString()} {item.unit}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-red-600">
                      <span className="inline-flex items-center gap-1">
                        <ArrowUpCircle className="w-3 h-3" />
                        {item.total_out.toLocaleString()} {item.unit}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-blue-600">
                      {item.total_adjust !== 0 ? (
                        <span>{item.total_adjust > 0 ? '+' : ''}{item.total_adjust.toLocaleString()}</span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-bold">
                      {item.current_stock.toLocaleString()} {item.unit}
                    </td>
                    <td className="px-4 py-3 text-sm text-center">
                      {item.earliest_expiry ? (
                        <span className={
                          new Date(item.earliest_expiry) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                            ? 'text-red-600 font-medium'
                            : ''
                        }>
                          {item.earliest_expiry}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-center">{item.lot_count || 0}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* 일별/월별 상세 보기 */
        <div className="space-y-4">
          {Object.keys(groupedByMaterial).length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
              <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500">데이터가 없습니다</p>
            </div>
          ) : (
            Object.entries(groupedByMaterial).map(([materialId, entries]) => {
              const material = entries[0];
              const isExpanded = expandedMaterials.has(materialId);
              // detail reserved for future enhanced views
              const _detail = materialDetails[materialId];

              // 기간 내 총계 계산
              const periodTotal = entries.reduce(
                (acc, e) => ({
                  in: acc.in + e.in_quantity,
                  out: acc.out + e.out_quantity,
                  adjust: acc.adjust + e.adjust_quantity,
                }),
                { in: 0, out: 0, adjust: 0 }
              );

              return (
                <div key={materialId} className="bg-white rounded-xl shadow-sm border overflow-hidden print:break-inside-avoid">
                  {/* 원료 헤더 */}
                  <div
                    className="px-4 py-3 bg-gray-50 flex items-center justify-between cursor-pointer hover:bg-gray-100"
                    onClick={() => toggleMaterialDetail(materialId)}
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      )}
                      <div>
                        <span className="font-medium">{material.material_name}</span>
                        <span className="text-sm text-gray-500 ml-2">({material.material_code})</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <span className="text-green-600">
                        입고: {periodTotal.in.toLocaleString()} {material.unit}
                      </span>
                      <span className="text-red-600">
                        출고: {periodTotal.out.toLocaleString()} {material.unit}
                      </span>
                      <span className="font-bold">
                        재고: {entries[entries.length - 1]?.closing_balance?.toLocaleString() || 0} {material.unit}
                      </span>
                    </div>
                  </div>

                  {/* 일별 상세 테이블 */}
                  {isExpanded && (
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            {viewMode === 'monthly' ? '월' : '날짜'}
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">전일재고</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">입고</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">출고</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">조정</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">재고</th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">생산LOT</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {entries.map((entry, idx) => (
                          <tr key={`${entry.material_id}-${entry.date}-${idx}`} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-sm">{entry.date}</td>
                            <td className="px-4 py-2 text-sm text-right text-gray-500">
                              {entry.opening_balance.toLocaleString()}
                            </td>
                            <td className="px-4 py-2 text-sm text-right">
                              {entry.in_quantity > 0 ? (
                                <span className="text-green-600">+{entry.in_quantity.toLocaleString()}</span>
                              ) : '-'}
                            </td>
                            <td className="px-4 py-2 text-sm text-right">
                              {entry.out_quantity > 0 ? (
                                <span className="text-red-600">-{entry.out_quantity.toLocaleString()}</span>
                              ) : '-'}
                            </td>
                            <td className="px-4 py-2 text-sm text-right">
                              {entry.adjust_quantity !== 0 ? (
                                <span className="text-blue-600">
                                  {entry.adjust_quantity > 0 ? '+' : ''}{entry.adjust_quantity.toLocaleString()}
                                </span>
                              ) : '-'}
                            </td>
                            <td className="px-4 py-2 text-sm text-right font-medium">
                              {entry.closing_balance.toLocaleString()}
                            </td>
                            <td className="px-4 py-2 text-sm text-center">
                              {entry.production_count && entry.production_count > 0 ? (
                                <span className="inline-flex items-center gap-1 text-purple-600">
                                  <Factory className="w-3 h-3" />
                                  {entry.production_count}건
                                </span>
                              ) : '-'}
                            </td>
                          </tr>
                        ))}
                        {/* 합계 행 */}
                        <tr className="bg-gray-50 font-medium">
                          <td className="px-4 py-2 text-sm">합계</td>
                          <td className="px-4 py-2 text-sm text-right text-gray-500">-</td>
                          <td className="px-4 py-2 text-sm text-right text-green-600">
                            +{periodTotal.in.toLocaleString()}
                          </td>
                          <td className="px-4 py-2 text-sm text-right text-red-600">
                            -{periodTotal.out.toLocaleString()}
                          </td>
                          <td className="px-4 py-2 text-sm text-right text-blue-600">
                            {periodTotal.adjust !== 0 ? (
                              <span>{periodTotal.adjust > 0 ? '+' : ''}{periodTotal.adjust.toLocaleString()}</span>
                            ) : '-'}
                          </td>
                          <td className="px-4 py-2 text-sm text-right">
                            {entries[entries.length - 1]?.closing_balance?.toLocaleString() || 0}
                          </td>
                          <td className="px-4 py-2 text-sm text-center">-</td>
                        </tr>
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 범례 */}
      <div className="mt-6 bg-white rounded-xl shadow-sm border p-4 print:hidden">
        <h3 className="text-sm font-medium text-gray-700 mb-2">범례</h3>
        <div className="flex flex-wrap gap-4 text-sm">
          <span className="inline-flex items-center gap-1">
            <ArrowDownCircle className="w-4 h-4 text-green-600" />
            <span className="text-green-600">입고</span>: 원부재료 입고 (구매, 반품 등)
          </span>
          <span className="inline-flex items-center gap-1">
            <ArrowUpCircle className="w-4 h-4 text-red-600" />
            <span className="text-red-600">출고</span>: 원부재료 출고 (생산 사용, 폐기 등)
          </span>
          <span className="inline-flex items-center gap-1">
            <RefreshCw className="w-4 h-4 text-blue-600" />
            <span className="text-blue-600">조정</span>: 재고 실사 조정
          </span>
          <span className="inline-flex items-center gap-1">
            <Factory className="w-4 h-4 text-purple-600" />
            <span className="text-purple-600">생산LOT</span>: 연결된 생산 기록
          </span>
        </div>
      </div>

      {/* Print Footer */}
      <div className="hidden print:block mt-8 pt-4 border-t text-sm text-gray-500">
        <div className="flex justify-between">
          <span>출력일: {new Date().toLocaleDateString('ko-KR')}</span>
          <span>HACCP 원료수불부</span>
        </div>
      </div>
    </div>
  );
}
