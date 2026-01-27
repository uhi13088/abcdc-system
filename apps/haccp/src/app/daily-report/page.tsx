'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Thermometer,
  ClipboardCheck,
  Factory,
  Truck,
  Bug,
  Sparkles,
  PenTool,
  Download,
  Loader2,
  User,
} from 'lucide-react';

interface DailySummary {
  ccp_records: {
    total: number;
    passed: number;
    failed: number;
    items: Array<{
      id: string;
      ccp_number: string;
      process: string;
      record_time: string;
      measurement: Record<string, unknown>;
      is_within_limit: boolean;
      recorded_by_name: string;
    }>;
  };
  hygiene_checks: {
    shifts: Array<{
      shift: string;
      checked: boolean;
      checked_by_name: string;
      overall_status: string;
    }>;
  };
  equipment_temp: {
    total: number;
    items: Array<{
      id: string;
      equipment_name: string;
      temperature: number;
      recorded_at: string;
      recorded_by_name: string;
      is_normal: boolean;
    }>;
  };
  inspections: {
    total: number;
    passed: number;
    failed: number;
    conditional: number;
    items: Array<{
      id: string;
      material_name: string;
      lot_number: string;
      overall_result: string;
      inspected_by_name: string;
    }>;
  };
  production: {
    total: number;
    items: Array<{
      id: string;
      lot_number: string;
      product_name: string;
      actual_quantity: number;
      unit: string;
      status: string;
      supervisor_name: string;
    }>;
  };
  shipments: {
    total: number;
    items: Array<{
      id: string;
      shipment_number: string;
      customer_name: string;
      status: string;
      shipped_by_name: string;
    }>;
  };
  pest_control: {
    checked: boolean;
    items: Array<{
      id: string;
      check_type: string;
      overall_status: string;
      checked_by_name: string;
    }>;
  };
  deviations: Array<{
    type: string;
    description: string;
    corrective_action?: string;
  }>;
}

interface Verification {
  id: string;
  verified_by_name: string;
  verified_at: string;
  verification_signature: string | null;
  verification_comment: string | null;
  status: string;
}

export default function DailyReportPage() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [verification, setVerification] = useState<Verification | null>(null);
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [verificationComment, setVerificationComment] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/haccp/daily-report?date=${selectedDate}`);
      if (response.ok) {
        const data = await response.json();
        setSummary(data.summary);
        setVerification(data.verification);
      }
    } catch (error) {
      console.error('Failed to fetch report:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    );
  };

  // Canvas 서명 관련
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleVerify = async () => {
    try {
      setIsVerifying(true);

      const canvas = canvasRef.current;
      const signature = canvas ? canvas.toDataURL('image/png') : null;

      const response = await fetch('/api/haccp/daily-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          signature,
          comment: verificationComment,
        }),
      });

      if (response.ok) {
        setShowSignatureModal(false);
        fetchReport();
        setVerificationComment('');
        clearSignature();
      } else {
        const error = await response.json();
        alert(error.error || '검증에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to verify:', error);
      alert('검증에 실패했습니다.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const SectionCard = ({
    title,
    icon: Icon,
    status,
    statusText,
    sectionKey,
    children,
  }: {
    title: string;
    icon: React.ElementType;
    status: 'success' | 'warning' | 'error' | 'neutral';
    statusText: string;
    sectionKey: string;
    children: React.ReactNode;
  }) => {
    const isExpanded = expandedSections.includes(sectionKey);
    const statusColors = {
      success: 'bg-green-100 text-green-700 border-green-200',
      warning: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      error: 'bg-red-100 text-red-700 border-red-200',
      neutral: 'bg-gray-100 text-gray-700 border-gray-200',
    };

    return (
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <button
          onClick={() => toggleSection(sectionKey)}
          className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${statusColors[status]}`}>
              <Icon className="w-5 h-5" />
            </div>
            <span className="font-medium text-gray-900">{title}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm ${statusColors[status]}`}>
              {statusText}
            </span>
            {isExpanded ? (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </button>
        {isExpanded && <div className="border-t p-4 bg-gray-50">{children}</div>}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const isVerified = verification?.status === 'VERIFIED';

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">일일 종합 보고서</h1>
          <p className="mt-1 text-sm text-gray-500">하루 동안의 모든 HACCP 기록을 한눈에 확인합니다</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-4 py-2 border rounded-lg"
          />
          <button
            onClick={handlePrint}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            인쇄
          </button>
        </div>
      </div>

      {/* Print Header */}
      <div className="hidden print:block mb-6 text-center">
        <h1 className="text-2xl font-bold">HACCP 일일 종합 보고서</h1>
        <p className="text-lg mt-2">{selectedDate}</p>
      </div>

      {/* Verification Status Banner */}
      {isVerified && verification && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-green-600" />
            <div>
              <p className="font-medium text-green-800">검증 완료</p>
              <p className="text-sm text-green-600">
                {verification.verified_by_name} | {new Date(verification.verified_at).toLocaleString('ko-KR')}
              </p>
            </div>
          </div>
          {verification.verification_signature && (
            <Image
              src={verification.verification_signature}
              alt="서명"
              width={80}
              height={48}
              className="h-12 border rounded"
            />
          )}
        </div>
      )}

      {/* Deviations Alert */}
      {summary && summary.deviations.length > 0 && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <span className="font-medium text-red-800">이탈 사항 ({summary.deviations.length}건)</span>
          </div>
          <ul className="space-y-1 text-sm text-red-700">
            {summary.deviations.map((d, i) => (
              <li key={i}>• [{d.type}] {d.description}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="space-y-4 mb-6">
          {/* CCP Records */}
          <SectionCard
            title="CCP 모니터링"
            icon={Thermometer}
            status={summary.ccp_records.failed > 0 ? 'error' : summary.ccp_records.total > 0 ? 'success' : 'neutral'}
            statusText={`${summary.ccp_records.passed}건 정상 / ${summary.ccp_records.failed}건 이탈`}
            sectionKey="ccp"
          >
            {summary.ccp_records.items.length > 0 ? (
              <div className="space-y-2">
                {summary.ccp_records.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                    <div className="flex items-center gap-3">
                      {item.is_within_limit ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500" />
                      )}
                      <div>
                        <p className="font-medium">{item.ccp_number}</p>
                        <p className="text-sm text-gray-500">{item.process}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">{item.record_time}</p>
                      <p className="text-xs text-gray-400 flex items-center gap-1">
                        <User className="w-3 h-3" /> {item.recorded_by_name}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">기록 없음</p>
            )}
          </SectionCard>

          {/* Hygiene Checks */}
          <SectionCard
            title="위생 점검"
            icon={Sparkles}
            status={
              summary.hygiene_checks.shifts.filter((s) => s.checked).length === 0
                ? 'neutral'
                : summary.hygiene_checks.shifts.every((s) => s.checked || s.shift === '야간')
                ? 'success'
                : 'warning'
            }
            statusText={`${summary.hygiene_checks.shifts.filter((s) => s.checked).length}/3 완료`}
            sectionKey="hygiene"
          >
            <div className="grid grid-cols-3 gap-3">
              {summary.hygiene_checks.shifts.map((shift) => (
                <div
                  key={shift.shift}
                  className={`p-3 rounded-lg border ${shift.checked ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}
                >
                  <p className="font-medium">{shift.shift}</p>
                  {shift.checked ? (
                    <>
                      <p className="text-sm text-green-600">{shift.overall_status === 'PASS' ? '합격' : '불합격'}</p>
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                        <User className="w-3 h-3" /> {shift.checked_by_name}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-400">미점검</p>
                  )}
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Equipment Temperature */}
          <SectionCard
            title="장비 온도 기록"
            icon={Thermometer}
            status={summary.equipment_temp.total > 0 ? 'success' : 'neutral'}
            statusText={`${summary.equipment_temp.total}건`}
            sectionKey="equipment"
          >
            {summary.equipment_temp.items.length > 0 ? (
              <div className="space-y-2">
                {summary.equipment_temp.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                    <div className="flex items-center gap-3">
                      {item.is_normal ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-yellow-500" />
                      )}
                      <div>
                        <p className="font-medium">{item.equipment_name}</p>
                        <p className="text-sm text-gray-500">{item.temperature}°C</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">{new Date(item.recorded_at).toLocaleTimeString('ko-KR')}</p>
                      <p className="text-xs text-gray-400 flex items-center gap-1">
                        <User className="w-3 h-3" /> {item.recorded_by_name}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">기록 없음</p>
            )}
          </SectionCard>

          {/* Inspections */}
          <SectionCard
            title="입고 검사"
            icon={ClipboardCheck}
            status={summary.inspections.failed > 0 ? 'error' : summary.inspections.total > 0 ? 'success' : 'neutral'}
            statusText={`${summary.inspections.passed}건 합격 / ${summary.inspections.failed}건 불합격`}
            sectionKey="inspections"
          >
            {summary.inspections.items.length > 0 ? (
              <div className="space-y-2">
                {summary.inspections.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                    <div className="flex items-center gap-3">
                      {item.overall_result === 'PASS' ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : item.overall_result === 'FAIL' ? (
                        <XCircle className="w-5 h-5 text-red-500" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-yellow-500" />
                      )}
                      <div>
                        <p className="font-medium">{item.material_name}</p>
                        <p className="text-sm text-gray-500">LOT: {item.lot_number}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-1 rounded text-xs ${
                        item.overall_result === 'PASS' ? 'bg-green-100 text-green-700' :
                        item.overall_result === 'FAIL' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {item.overall_result === 'PASS' ? '합격' : item.overall_result === 'FAIL' ? '불합격' : '조건부'}
                      </span>
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                        <User className="w-3 h-3" /> {item.inspected_by_name}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">기록 없음</p>
            )}
          </SectionCard>

          {/* Production */}
          <SectionCard
            title="생산 기록"
            icon={Factory}
            status={summary.production.total > 0 ? 'success' : 'neutral'}
            statusText={`${summary.production.total}건`}
            sectionKey="production"
          >
            {summary.production.items.length > 0 ? (
              <div className="space-y-2">
                {summary.production.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                    <div>
                      <p className="font-medium">{item.product_name}</p>
                      <p className="text-sm text-gray-500">LOT: {item.lot_number}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{item.actual_quantity} {item.unit}</p>
                      <p className="text-xs text-gray-400 flex items-center gap-1">
                        <User className="w-3 h-3" /> {item.supervisor_name}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">기록 없음</p>
            )}
          </SectionCard>

          {/* Shipments */}
          <SectionCard
            title="출하 기록"
            icon={Truck}
            status={summary.shipments.total > 0 ? 'success' : 'neutral'}
            statusText={`${summary.shipments.total}건`}
            sectionKey="shipments"
          >
            {summary.shipments.items.length > 0 ? (
              <div className="space-y-2">
                {summary.shipments.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                    <div>
                      <p className="font-medium">{item.shipment_number}</p>
                      <p className="text-sm text-gray-500">{item.customer_name}</p>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-1 rounded text-xs ${
                        item.status === 'DELIVERED' ? 'bg-green-100 text-green-700' :
                        item.status === 'SHIPPED' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {item.status === 'DELIVERED' ? '배송완료' : item.status === 'SHIPPED' ? '출하' : '대기'}
                      </span>
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                        <User className="w-3 h-3" /> {item.shipped_by_name}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">기록 없음</p>
            )}
          </SectionCard>

          {/* Pest Control */}
          <SectionCard
            title="방충방서 점검"
            icon={Bug}
            status={summary.pest_control.checked ? 'success' : 'warning'}
            statusText={summary.pest_control.checked ? '점검 완료' : '미점검'}
            sectionKey="pest"
          >
            {summary.pest_control.items.length > 0 ? (
              <div className="space-y-2">
                {summary.pest_control.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                    <div>
                      <p className="font-medium">{item.check_type}</p>
                      <p className={`text-sm ${
                        item.overall_status === 'NORMAL' ? 'text-green-600' :
                        item.overall_status === 'ATTENTION' ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {item.overall_status === 'NORMAL' ? '정상' : item.overall_status === 'ATTENTION' ? '주의' : '위험'}
                      </p>
                    </div>
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <User className="w-3 h-3" /> {item.checked_by_name}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">점검 기록 없음</p>
            )}
          </SectionCard>
        </div>
      )}

      {/* Verification Section */}
      {!isVerified && (
        <div className="bg-white rounded-xl shadow-sm border p-6 print:hidden">
          <div className="flex items-center gap-3 mb-4">
            <PenTool className="w-6 h-6 text-blue-600" />
            <h2 className="text-lg font-bold">최종 검증</h2>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            위 내용을 확인하셨으면 검증 서명을 진행해주세요. 검증 완료 후에는 해당 일자의 기록을 수정할 수 없습니다.
          </p>
          <button
            onClick={() => setShowSignatureModal(true)}
            className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
          >
            <PenTool className="w-5 h-5" />
            검증 서명하기
          </button>
        </div>
      )}

      {/* Signature Modal */}
      {showSignatureModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 print:hidden">
          <div className="bg-white rounded-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-xl font-bold mb-4">검증 서명</h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">검증 의견 (선택)</label>
              <textarea
                value={verificationComment}
                onChange={(e) => setVerificationComment(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                rows={2}
                placeholder="특이사항이 있으면 기록해주세요"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">서명</label>
              <div className="border rounded-lg overflow-hidden">
                <canvas
                  ref={canvasRef}
                  width={360}
                  height={150}
                  className="w-full bg-gray-50 touch-none"
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
                className="mt-2 text-sm text-gray-500 hover:text-gray-700"
              >
                서명 지우기
              </button>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowSignatureModal(false)}
                className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleVerify}
                disabled={isVerifying}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    처리중...
                  </>
                ) : (
                  '검증 완료'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
