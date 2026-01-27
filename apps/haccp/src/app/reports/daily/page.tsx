'use client';

import { useState, useEffect, useRef } from 'react';
import {
  FileText, Calendar, Printer, Download, Users, Thermometer,
  Factory, Truck, Package, CheckCircle2, AlertTriangle,
  ClipboardCheck, ChevronLeft, ChevronRight, PenTool, Mail, Cloud
} from 'lucide-react';

interface AttendanceRecord {
  user_id: string;
  full_name: string;
  role: string;
  check_in_time: string;
  health_status: string;
}

interface CCPRecord {
  id: string;
  ccp_number: string;
  process: string;
  record_time: string;
  measurements: Array<{
    parameter: string;
    value: number;
    unit: string;
    is_within_limit: boolean;
  }>;
  is_within_limit: boolean;
  recorded_by_name: string;
  lot_number?: string;
}

interface ProductionRecord {
  id: string;
  lot_number: string;
  product_name: string;
  actual_quantity: number;
  unit: string;
  supervisor_name: string;
  worker_names: string[];
  start_time?: string;
  end_time?: string;
  quality_check_status?: string;
}

interface ShipmentRecord {
  id: string;
  shipment_number: string;
  customer_name: string;
  items: Array<{
    product_name: string;
    quantity: number;
    unit: string;
  }>;
  status: string;
  shipped_by_name: string;
}

interface MaterialSummary {
  material_name: string;
  opening_balance: number;
  in_quantity: number;
  out_quantity: number;
  closing_balance: number;
  unit: string;
}

interface HygieneCheck {
  id: string;
  shift: string;
  checked_by_name: string;
  check_time: string;
  passed: boolean;
}

interface DailyReportData {
  date: string;
  attendance: AttendanceRecord[];
  ccpRecords: CCPRecord[];
  productionRecords: ProductionRecord[];
  shipmentRecords: ShipmentRecord[];
  materialSummary: MaterialSummary[];
  hygieneChecks: HygieneCheck[];
  correctiveActions: Array<{
    id: string;
    action_number: string;
    problem_description: string;
    status: string;
  }>;
}

export default function DailyReportPage() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<DailyReportData | null>(null);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [verifierName, setVerifierName] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  useEffect(() => {
    fetchReportData();
  }, [selectedDate]);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/haccp/reports/daily?date=${selectedDate}`);
      if (response.ok) {
        const data = await response.json();
        setReportData(data);
      }
    } catch (error) {
      console.error('Failed to fetch report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const [showExportModal, setShowExportModal] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [exporting, setExporting] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleEmailExport = async () => {
    if (!emailAddress) {
      alert('이메일 주소를 입력해주세요.');
      return;
    }

    try {
      setExporting(true);
      const response = await fetch('/api/haccp/reports/daily/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          email: emailAddress,
          verifier_name: verifierName,
          signature: signature,
        }),
      });

      if (response.ok) {
        alert('이메일이 발송되었습니다.');
        setShowExportModal(false);
      } else {
        const error = await response.json();
        alert(error.message || '이메일 발송에 실패했습니다.');
      }
    } catch (error) {
      console.error('Email export failed:', error);
      alert('이메일 발송에 실패했습니다.');
    } finally {
      setExporting(false);
    }
  };

  const handleGoogleDriveExport = async () => {
    try {
      setExporting(true);
      const response = await fetch('/api/haccp/reports/daily/google-drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          verifier_name: verifierName,
          signature: signature,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.authUrl) {
          // Google OAuth 인증 필요
          window.open(data.authUrl, '_blank');
        } else if (data.fileUrl) {
          alert('Google Drive에 저장되었습니다.');
          window.open(data.fileUrl, '_blank');
        }
        setShowExportModal(false);
      } else {
        const error = await response.json();
        alert(error.message || 'Google Drive 저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('Google Drive export failed:', error);
      alert('Google Drive 저장에 실패했습니다.');
    } finally {
      setExporting(false);
    }
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + (direction === 'prev' ? -1 : 1));
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${days[date.getDay()]})`;
  };

  // 서명 캔버스 관련
  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    isDrawing.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let x, y;

    if ('touches' in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let x, y;

    if ('touches' in e) {
      e.preventDefault();
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    isDrawing.current = false;
  };

  const clearSignature = () => {
    initCanvas();
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL('image/png');
    setSignature(dataUrl);
    setShowSignatureModal(false);
  };

  useEffect(() => {
    if (showSignatureModal) {
      setTimeout(initCanvas, 100);
    }
  }, [showSignatureModal]);

  // 통계 계산
  const stats = reportData ? {
    totalWorkers: reportData.attendance.length,
    ccpTotal: reportData.ccpRecords.length,
    ccpPassed: reportData.ccpRecords.filter(r => r.is_within_limit).length,
    productionTotal: reportData.productionRecords.length,
    productionQuantity: reportData.productionRecords.reduce((sum, r) => sum + r.actual_quantity, 0),
    shipmentTotal: reportData.shipmentRecords.length,
    shipmentDelivered: reportData.shipmentRecords.filter(r => r.status === 'DELIVERED').length,
    hygieneTotal: reportData.hygieneChecks.length,
    hygienePassed: reportData.hygieneChecks.filter(r => r.passed).length,
    correctiveActionsOpen: reportData.correctiveActions.filter(a => a.status !== 'COMPLETED').length,
  } : null;

  return (
    <div className="p-6 print:p-4 bg-gray-50 min-h-screen print:bg-white">
      {/* Header - 인쇄시 숨김 */}
      <div className="mb-6 flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-7 h-7 text-blue-600" />
            일일종합보고서
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            HACCP 일일 운영 현황 및 보고서
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSignatureModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            <PenTool className="w-4 h-4" />
            서명
          </button>
          <button
            onClick={() => setShowExportModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            <Download className="w-4 h-4" />
            내보내기
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Printer className="w-4 h-4" />
            인쇄 / PDF
          </button>
        </div>
      </div>

      {/* 날짜 선택 - 인쇄시 숨김 */}
      <div className="mb-6 flex items-center justify-center gap-4 print:hidden">
        <button
          onClick={() => navigateDate('prev')}
          className="p-2 hover:bg-gray-200 rounded-lg"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-gray-400" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border rounded-lg font-medium"
          />
        </div>
        <button
          onClick={() => navigateDate('next')}
          className="p-2 hover:bg-gray-200 rounded-lg"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : !reportData ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">데이터를 불러올 수 없습니다</p>
        </div>
      ) : (
        <div className="space-y-6 print:space-y-4">
          {/* 보고서 헤더 */}
          <div className="bg-white rounded-xl shadow-sm border p-6 print:p-4 print:shadow-none print:border-2 print:border-gray-800">
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold print:text-xl">일 일 종 합 보 고 서</h2>
              <p className="text-lg mt-2 print:text-base">{formatDate(selectedDate)}</p>
            </div>

            {/* 요약 통계 */}
            <div className="grid grid-cols-3 md:grid-cols-6 gap-4 mt-6">
              <div className="text-center p-3 bg-blue-50 rounded-lg print:border print:bg-transparent">
                <Users className="w-5 h-5 mx-auto text-blue-600 mb-1" />
                <p className="text-xs text-gray-500">출근</p>
                <p className="text-lg font-bold">{stats?.totalWorkers}명</p>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg print:border print:bg-transparent">
                <Thermometer className="w-5 h-5 mx-auto text-green-600 mb-1" />
                <p className="text-xs text-gray-500">CCP</p>
                <p className="text-lg font-bold">{stats?.ccpPassed}/{stats?.ccpTotal}</p>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg print:border print:bg-transparent">
                <Factory className="w-5 h-5 mx-auto text-purple-600 mb-1" />
                <p className="text-xs text-gray-500">생산</p>
                <p className="text-lg font-bold">{stats?.productionTotal}건</p>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg print:border print:bg-transparent">
                <Truck className="w-5 h-5 mx-auto text-orange-600 mb-1" />
                <p className="text-xs text-gray-500">출하</p>
                <p className="text-lg font-bold">{stats?.shipmentDelivered}/{stats?.shipmentTotal}</p>
              </div>
              <div className="text-center p-3 bg-teal-50 rounded-lg print:border print:bg-transparent">
                <ClipboardCheck className="w-5 h-5 mx-auto text-teal-600 mb-1" />
                <p className="text-xs text-gray-500">위생</p>
                <p className="text-lg font-bold">{stats?.hygienePassed}/{stats?.hygieneTotal}</p>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg print:border print:bg-transparent">
                <AlertTriangle className="w-5 h-5 mx-auto text-red-600 mb-1" />
                <p className="text-xs text-gray-500">미결</p>
                <p className="text-lg font-bold text-red-600">{stats?.correctiveActionsOpen}</p>
              </div>
            </div>
          </div>

          {/* 1. 출근자 명단 */}
          <div className="bg-white rounded-xl shadow-sm border p-6 print:p-4 print:shadow-none print:border print:break-inside-avoid">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2 print:text-base">
              <Users className="w-5 h-5 text-blue-600" />
              1. 출근자 명단
            </h3>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 print:bg-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left">이름</th>
                  <th className="px-3 py-2 text-left">직책</th>
                  <th className="px-3 py-2 text-center">출근시간</th>
                  <th className="px-3 py-2 text-center">건강상태</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {reportData.attendance.length === 0 ? (
                  <tr><td colSpan={4} className="px-3 py-4 text-center text-gray-500">기록 없음</td></tr>
                ) : (
                  reportData.attendance.map((record, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-2 font-medium">{record.full_name}</td>
                      <td className="px-3 py-2">{record.role}</td>
                      <td className="px-3 py-2 text-center">{record.check_in_time?.slice(0, 5)}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          record.health_status === '양호' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {record.health_status || '양호'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 2. CCP 모니터링 기록 */}
          <div className="bg-white rounded-xl shadow-sm border p-6 print:p-4 print:shadow-none print:border print:break-inside-avoid">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2 print:text-base">
              <Thermometer className="w-5 h-5 text-green-600" />
              2. CCP 모니터링 기록
            </h3>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 print:bg-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left">CCP</th>
                  <th className="px-3 py-2 text-left">공정</th>
                  <th className="px-3 py-2 text-center">시간</th>
                  <th className="px-3 py-2 text-left">측정값</th>
                  <th className="px-3 py-2 text-center">결과</th>
                  <th className="px-3 py-2 text-left">담당자</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {reportData.ccpRecords.length === 0 ? (
                  <tr><td colSpan={6} className="px-3 py-4 text-center text-gray-500">기록 없음</td></tr>
                ) : (
                  reportData.ccpRecords.map((record, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-2 font-mono font-medium">{record.ccp_number}</td>
                      <td className="px-3 py-2">{record.process}</td>
                      <td className="px-3 py-2 text-center">{record.record_time?.slice(0, 5)}</td>
                      <td className="px-3 py-2">
                        {record.measurements?.map((m, i) => (
                          <span key={i} className="mr-2">
                            {m.parameter}: {m.value}{m.unit}
                          </span>
                        )) || '-'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {record.is_within_limit ? (
                          <span className="text-green-600 font-medium">적합</span>
                        ) : (
                          <span className="text-red-600 font-medium">이탈</span>
                        )}
                      </td>
                      <td className="px-3 py-2">{record.recorded_by_name}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 3. 생산 기록 */}
          <div className="bg-white rounded-xl shadow-sm border p-6 print:p-4 print:shadow-none print:border print:break-inside-avoid">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2 print:text-base">
              <Factory className="w-5 h-5 text-purple-600" />
              3. 생산 기록
            </h3>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 print:bg-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left">LOT번호</th>
                  <th className="px-3 py-2 text-left">제품명</th>
                  <th className="px-3 py-2 text-right">수량</th>
                  <th className="px-3 py-2 text-center">작업시간</th>
                  <th className="px-3 py-2 text-left">담당자</th>
                  <th className="px-3 py-2 text-center">품질</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {reportData.productionRecords.length === 0 ? (
                  <tr><td colSpan={6} className="px-3 py-4 text-center text-gray-500">기록 없음</td></tr>
                ) : (
                  reportData.productionRecords.map((record, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-2 font-mono">{record.lot_number}</td>
                      <td className="px-3 py-2 font-medium">{record.product_name}</td>
                      <td className="px-3 py-2 text-right">{record.actual_quantity} {record.unit}</td>
                      <td className="px-3 py-2 text-center">
                        {record.start_time?.slice(0, 5)} ~ {record.end_time?.slice(0, 5)}
                      </td>
                      <td className="px-3 py-2">{record.supervisor_name}</td>
                      <td className="px-3 py-2 text-center">
                        {record.quality_check_status === 'PASSED' ? (
                          <span className="text-green-600">합격</span>
                        ) : record.quality_check_status === 'FAILED' ? (
                          <span className="text-red-600">불합격</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 4. 출하 기록 */}
          <div className="bg-white rounded-xl shadow-sm border p-6 print:p-4 print:shadow-none print:border print:break-inside-avoid">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2 print:text-base">
              <Truck className="w-5 h-5 text-orange-600" />
              4. 출하 기록
            </h3>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 print:bg-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left">출하번호</th>
                  <th className="px-3 py-2 text-left">거래처</th>
                  <th className="px-3 py-2 text-left">품목</th>
                  <th className="px-3 py-2 text-center">상태</th>
                  <th className="px-3 py-2 text-left">담당자</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {reportData.shipmentRecords.length === 0 ? (
                  <tr><td colSpan={5} className="px-3 py-4 text-center text-gray-500">기록 없음</td></tr>
                ) : (
                  reportData.shipmentRecords.map((record, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-2 font-mono">{record.shipment_number}</td>
                      <td className="px-3 py-2 font-medium">{record.customer_name}</td>
                      <td className="px-3 py-2">
                        {record.items?.map((item, i) => (
                          <span key={i} className="mr-2">
                            {item.product_name} {item.quantity}{item.unit}
                          </span>
                        ))}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          record.status === 'DELIVERED' ? 'bg-green-100 text-green-700' :
                          record.status === 'SHIPPED' ? 'bg-blue-100 text-blue-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {record.status === 'DELIVERED' ? '완료' :
                           record.status === 'SHIPPED' ? '배송중' : '대기'}
                        </span>
                      </td>
                      <td className="px-3 py-2">{record.shipped_by_name}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 5. 원료 수불 현황 */}
          <div className="bg-white rounded-xl shadow-sm border p-6 print:p-4 print:shadow-none print:border print:break-inside-avoid">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2 print:text-base">
              <Package className="w-5 h-5 text-teal-600" />
              5. 원료 수불 현황
            </h3>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 print:bg-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left">원료명</th>
                  <th className="px-3 py-2 text-right">전일재고</th>
                  <th className="px-3 py-2 text-right">입고</th>
                  <th className="px-3 py-2 text-right">출고</th>
                  <th className="px-3 py-2 text-right">금일재고</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {reportData.materialSummary.length === 0 ? (
                  <tr><td colSpan={5} className="px-3 py-4 text-center text-gray-500">기록 없음</td></tr>
                ) : (
                  reportData.materialSummary.map((item, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-2 font-medium">{item.material_name}</td>
                      <td className="px-3 py-2 text-right">{item.opening_balance} {item.unit}</td>
                      <td className="px-3 py-2 text-right text-green-600">
                        {item.in_quantity > 0 ? `+${item.in_quantity}` : '-'}
                      </td>
                      <td className="px-3 py-2 text-right text-red-600">
                        {item.out_quantity > 0 ? `-${item.out_quantity}` : '-'}
                      </td>
                      <td className="px-3 py-2 text-right font-bold">{item.closing_balance} {item.unit}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 6. 위생점검 현황 */}
          <div className="bg-white rounded-xl shadow-sm border p-6 print:p-4 print:shadow-none print:border print:break-inside-avoid">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2 print:text-base">
              <ClipboardCheck className="w-5 h-5 text-teal-600" />
              6. 위생점검 현황
            </h3>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 print:bg-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left">시간대</th>
                  <th className="px-3 py-2 text-center">점검시간</th>
                  <th className="px-3 py-2 text-center">결과</th>
                  <th className="px-3 py-2 text-left">점검자</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {reportData.hygieneChecks.length === 0 ? (
                  <tr><td colSpan={4} className="px-3 py-4 text-center text-gray-500">기록 없음</td></tr>
                ) : (
                  reportData.hygieneChecks.map((check, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-2 font-medium">{check.shift}</td>
                      <td className="px-3 py-2 text-center">{check.check_time?.slice(0, 5)}</td>
                      <td className="px-3 py-2 text-center">
                        {check.passed ? (
                          <span className="text-green-600 font-medium">적합</span>
                        ) : (
                          <span className="text-red-600 font-medium">부적합</span>
                        )}
                      </td>
                      <td className="px-3 py-2">{check.checked_by_name}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 7. 개선조치 현황 */}
          {reportData.correctiveActions.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border p-6 print:p-4 print:shadow-none print:border print:break-inside-avoid">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2 print:text-base">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                7. 개선조치 현황
              </h3>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 print:bg-gray-200">
                  <tr>
                    <th className="px-3 py-2 text-left">조치번호</th>
                    <th className="px-3 py-2 text-left">문제내용</th>
                    <th className="px-3 py-2 text-center">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {reportData.correctiveActions.map((action, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-2 font-mono">{action.action_number}</td>
                      <td className="px-3 py-2">{action.problem_description}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          action.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                          action.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {action.status === 'COMPLETED' ? '완료' :
                           action.status === 'IN_PROGRESS' ? '진행중' : '대기'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 서명란 */}
          <div className="bg-white rounded-xl shadow-sm border p-6 print:p-4 print:shadow-none print:border">
            <h3 className="font-bold text-lg mb-4 print:text-base">검토 및 승인</h3>
            <div className="flex justify-end gap-8">
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-2">작성자</p>
                <div className="w-24 h-16 border-2 border-gray-300 flex items-center justify-center">
                  <span className="text-xs text-gray-400">(자동)</span>
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-2">검토자 ({verifierName || '미입력'})</p>
                <div className="w-24 h-16 border-2 border-gray-300 flex items-center justify-center">
                  {signature ? (
                    <img src={signature} alt="서명" className="max-w-full max-h-full" />
                  ) : (
                    <span className="text-xs text-gray-400">(인)</span>
                  )}
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-4 text-right">
              작성일시: {new Date().toLocaleString('ko-KR')}
            </p>
          </div>
        </div>
      )}

      {/* 서명 모달 */}
      {showSignatureModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 print:hidden">
          <div className="bg-white rounded-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-bold mb-4">검토자 서명</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">검토자 이름</label>
              <input
                type="text"
                value={verifierName}
                onChange={(e) => setVerifierName(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="검토자 이름을 입력하세요"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">서명</label>
              <div className="border-2 border-gray-300 rounded-lg overflow-hidden">
                <canvas
                  ref={canvasRef}
                  width={360}
                  height={150}
                  className="touch-none w-full"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
              </div>
              <button
                onClick={clearSignature}
                className="mt-2 text-sm text-blue-600 hover:underline"
              >
                지우기
              </button>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowSignatureModal(false)}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={saveSignature}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 내보내기 모달 */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 print:hidden">
          <div className="bg-white rounded-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-bold mb-4">보고서 내보내기</h3>

            <div className="space-y-4">
              {/* 이메일 발송 */}
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Mail className="w-5 h-5 text-blue-600" />
                  <h4 className="font-medium">이메일로 발송</h4>
                </div>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                    className="flex-1 px-3 py-2 border rounded-lg text-sm"
                    placeholder="이메일 주소 입력"
                  />
                  <button
                    onClick={handleEmailExport}
                    disabled={exporting}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
                  >
                    {exporting ? '발송중...' : '발송'}
                  </button>
                </div>
              </div>

              {/* Google Drive 저장 */}
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Cloud className="w-5 h-5 text-green-600" />
                  <h4 className="font-medium">Google Drive에 저장</h4>
                </div>
                <p className="text-sm text-gray-500 mb-3">
                  Google 계정과 연동하여 Drive에 자동 저장합니다.
                </p>
                <button
                  onClick={handleGoogleDriveExport}
                  disabled={exporting}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {exporting ? '저장중...' : 'Google Drive에 저장'}
                </button>
              </div>

              {/* PDF 다운로드 안내 */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  <strong>PDF 저장:</strong> 인쇄 버튼 클릭 후 &quot;PDF로 저장&quot;을 선택하면 PDF 파일로 저장할 수 있습니다.
                </p>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowExportModal(false)}
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
