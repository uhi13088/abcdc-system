'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Header } from '@/components/layout/header';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  PageLoading,
  Alert,
} from '@/components/ui';
import { ArrowLeft, Send, FileText, Download, Pen, CalendarPlus } from 'lucide-react';

interface ContractDetail {
  id: string;
  contract_number: string;
  contract_type: string;
  start_date: string;
  end_date: string | null;
  probation_months: number;
  position: string;
  department: string;
  duties: string[];
  work_schedules: Array<{
    daysOfWeek: number[];
    startTime: string;
    endTime: string;
    breakMinutes: number;
  }>;
  salary_config: {
    baseSalaryType: string;
    baseSalaryAmount: number;
    allowances: Record<string, unknown>;
    paymentDate: number;
    paymentMethod: string;
  };
  deduction_config: Record<string, boolean>;
  standard_hours_per_week: number;
  standard_hours_per_day: number;
  annual_leave_days: number;
  status: string;
  employee_signature: string | null;
  employee_signed_at: string | null;
  employer_signature: string | null;
  employer_signed_at: string | null;
  created_at: string;
  staff: {
    id: string;
    name: string;
    email: string;
    phone: string;
    position: string;
    address: string;
    birth_date: string;
  };
  stores: {
    id: string;
    name: string;
    address: string;
  };
  brands: {
    id: string;
    name: string;
  };
  companies: {
    id: string;
    name: string;
    business_number: string;
    ceo_name: string;
    address: string;
  };
}

const statusMap: Record<string, { label: string; variant: 'default' | 'info' | 'success' | 'warning' }> = {
  DRAFT: { label: '초안', variant: 'default' },
  SENT: { label: '발송됨', variant: 'info' },
  SIGNED: { label: '서명완료', variant: 'success' },
  REJECTED: { label: '거부됨', variant: 'warning' },
};

const DAYS_OF_WEEK = ['일', '월', '화', '수', '목', '금', '토'];

export default function ContractDetailPage() {
  const router = useRouter();
  const params = useParams();
  const contractId = params.id as string;

  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showSignature, setShowSignature] = useState(false);
  const [signatureType, setSignatureType] = useState<'employee' | 'employer'>('employer');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [generatingSchedules, setGeneratingSchedules] = useState(false);

  useEffect(() => {
    fetchContract();
  }, [contractId]);

  const handleGenerateSchedules = async () => {
    if (!confirm('계약서 내용을 기반으로 스케줄을 생성하시겠습니까?\n기존 스케줄이 있으면 덮어씌워집니다.')) return;

    setGeneratingSchedules(true);
    try {
      const response = await fetch(`/api/contracts/${contractId}/generate-schedules`, {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok) {
        alert(`스케줄이 생성되었습니다.\n생성된 스케줄: ${data.generated}개`);
      } else {
        alert(data.error || '스케줄 생성에 실패했습니다.');
      }
    } catch (err) {
      alert('스케줄 생성에 실패했습니다.');
    } finally {
      setGeneratingSchedules(false);
    }
  };

  const fetchContract = async () => {
    try {
      const response = await fetch(`/api/contracts/${contractId}`);
      if (response.ok) {
        const data = await response.json();
        setContract(data);
      } else {
        setError('계약서를 불러올 수 없습니다.');
      }
    } catch (err) {
      setError('계약서를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!confirm('계약서를 직원에게 발송하시겠습니까?')) return;

    try {
      const response = await fetch(`/api/contracts/${contractId}/send`, {
        method: 'POST',
      });

      if (response.ok) {
        fetchContract();
        alert('계약서가 발송되었습니다.');
      } else {
        const data = await response.json();
        alert(data.error || '발송에 실패했습니다.');
      }
    } catch (err) {
      alert('발송에 실패했습니다.');
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const response = await fetch(`/api/contracts/${contractId}/pdf`);

      if (!response.ok) {
        const data = await response.json();
        alert(data.error || 'PDF 다운로드에 실패했습니다.');
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `근로계약서_${contract?.contract_number || 'contract'}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert('PDF 다운로드에 실패했습니다.');
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
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

  const saveSignature = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const signature = canvas.toDataURL('image/png');

    try {
      const response = await fetch(`/api/contracts/${contractId}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature, signerType: signatureType }),
      });

      if (response.ok) {
        setShowSignature(false);
        fetchContract();
        alert('서명이 완료되었습니다.');
      } else {
        const data = await response.json();
        alert(data.error || '서명에 실패했습니다.');
      }
    } catch (err) {
      alert('서명에 실패했습니다.');
    }
  };

  if (loading) return <PageLoading />;

  if (error || !contract) {
    return (
      <div>
        <Header title="계약서 상세" />
        <div className="p-6">
          <Alert variant="error">{error || '계약서를 찾을 수 없습니다.'}</Alert>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header title="계약서 상세" />

      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            목록으로
          </Button>
          <div className="flex gap-2">
            {contract.status === 'DRAFT' && (
              <Button onClick={handleSend}>
                <Send className="h-4 w-4 mr-2" />
                발송하기
              </Button>
            )}
            {(contract.status === 'SENT' || contract.status === 'SIGNED') && !contract.employer_signature && (
              <Button
                onClick={() => {
                  setSignatureType('employer');
                  setShowSignature(true);
                }}
              >
                <Pen className="h-4 w-4 mr-2" />
                사업자 서명
              </Button>
            )}
            <Button variant="outline" onClick={handleDownloadPDF}>
              <Download className="h-4 w-4 mr-2" />
              PDF 다운로드
            </Button>
            <Button
              variant="outline"
              onClick={handleGenerateSchedules}
              disabled={generatingSchedules}
            >
              <CalendarPlus className="h-4 w-4 mr-2" />
              {generatingSchedules ? '생성 중...' : '스케줄 생성'}
            </Button>
          </div>
        </div>

        {/* Contract Document */}
        <Card className="max-w-4xl mx-auto">
          <CardHeader className="text-center border-b">
            <CardTitle className="text-2xl">근로계약서</CardTitle>
            <div className="flex justify-center gap-4 mt-2">
              <Badge variant={statusMap[contract.status]?.variant}>
                {statusMap[contract.status]?.label}
              </Badge>
              <span className="text-sm text-gray-500">{contract.contract_number}</span>
            </div>
          </CardHeader>

          <CardContent className="p-8 space-y-8">
            {/* Parties */}
            <section>
              <h3 className="font-semibold mb-4 pb-2 border-b">계약 당사자</h3>
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <p className="text-sm text-gray-500 mb-1">사업주 (갑)</p>
                  <p className="font-medium">{contract.companies?.name}</p>
                  <p className="text-sm text-gray-600">{contract.companies?.address}</p>
                  <p className="text-sm text-gray-600">대표자: {contract.companies?.ceo_name}</p>
                  <p className="text-sm text-gray-600">사업자번호: {contract.companies?.business_number}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">근로자 (을)</p>
                  <p className="font-medium">{contract.staff?.name}</p>
                  <p className="text-sm text-gray-600">{contract.staff?.address}</p>
                  <p className="text-sm text-gray-600">연락처: {contract.staff?.phone}</p>
                  <p className="text-sm text-gray-600">이메일: {contract.staff?.email}</p>
                </div>
              </div>
            </section>

            {/* Contract Terms */}
            <section>
              <h3 className="font-semibold mb-4 pb-2 border-b">계약 조건</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">계약 유형</p>
                    <p className="font-medium">{contract.contract_type}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">근무지</p>
                    <p className="font-medium">{contract.stores?.name}</p>
                    <p className="text-sm text-gray-600">{contract.stores?.address}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">계약 기간</p>
                    <p className="font-medium">
                      {new Date(contract.start_date).toLocaleDateString('ko-KR')}
                      {contract.end_date && ` ~ ${new Date(contract.end_date).toLocaleDateString('ko-KR')}`}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">수습 기간</p>
                    <p className="font-medium">{contract.probation_months}개월</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">직책</p>
                    <p className="font-medium">{contract.position || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">부서</p>
                    <p className="font-medium">{contract.department || '-'}</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Work Schedule */}
            <section>
              <h3 className="font-semibold mb-4 pb-2 border-b">근무 시간</h3>
              {contract.work_schedules?.map((schedule, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">근무 요일</p>
                      <p className="font-medium">
                        {schedule.daysOfWeek.map((d) => DAYS_OF_WEEK[d]).join(', ')}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">근무 시간</p>
                      <p className="font-medium">
                        {schedule.startTime} ~ {schedule.endTime}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">휴게 시간</p>
                      <p className="font-medium">{schedule.breakMinutes}분</p>
                    </div>
                  </div>
                </div>
              ))}
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">주당 소정근로시간</p>
                  <p className="font-medium">{contract.standard_hours_per_week}시간</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">1일 소정근로시간</p>
                  <p className="font-medium">{contract.standard_hours_per_day}시간</p>
                </div>
              </div>
            </section>

            {/* Salary */}
            <section>
              <h3 className="font-semibold mb-4 pb-2 border-b">임금</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">기본급</p>
                  <p className="font-medium">
                    {contract.salary_config?.baseSalaryType} {contract.salary_config?.baseSalaryAmount?.toLocaleString()}원
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">지급일</p>
                  <p className="font-medium">
                    매월 {contract.salary_config?.paymentDate}일 ({contract.salary_config?.paymentMethod})
                  </p>
                </div>
              </div>
            </section>

            {/* Leave */}
            <section>
              <h3 className="font-semibold mb-4 pb-2 border-b">휴가</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-500">연차휴가</p>
                  <p className="font-medium">{contract.annual_leave_days}일</p>
                </div>
              </div>
            </section>

            {/* Duties */}
            {contract.duties && contract.duties.length > 0 && (
              <section>
                <h3 className="font-semibold mb-4 pb-2 border-b">담당 업무</h3>
                <ul className="list-disc list-inside space-y-1">
                  {contract.duties.map((duty, idx) => (
                    <li key={idx} className="text-sm">{duty}</li>
                  ))}
                </ul>
              </section>
            )}

            {/* Signatures */}
            <section className="border-t pt-8">
              <h3 className="font-semibold mb-4">서명</h3>
              <div className="grid grid-cols-2 gap-8">
                <div className="text-center">
                  <p className="text-sm text-gray-500 mb-4">사업주 (갑)</p>
                  {contract.employer_signature ? (
                    <div>
                      <img
                        src={contract.employer_signature}
                        alt="사업주 서명"
                        className="h-20 mx-auto"
                      />
                      <p className="text-xs text-gray-400 mt-2">
                        {new Date(contract.employer_signed_at!).toLocaleString('ko-KR')}
                      </p>
                    </div>
                  ) : (
                    <div className="h-20 border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-sm">
                      서명 대기중
                    </div>
                  )}
                  <p className="mt-2 font-medium">{contract.companies?.ceo_name}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-500 mb-4">근로자 (을)</p>
                  {contract.employee_signature ? (
                    <div>
                      <img
                        src={contract.employee_signature}
                        alt="근로자 서명"
                        className="h-20 mx-auto"
                      />
                      <p className="text-xs text-gray-400 mt-2">
                        {new Date(contract.employee_signed_at!).toLocaleString('ko-KR')}
                      </p>
                    </div>
                  ) : (
                    <div className="h-20 border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-sm">
                      서명 대기중
                    </div>
                  )}
                  <p className="mt-2 font-medium">{contract.staff?.name}</p>
                </div>
              </div>
            </section>

            <section className="text-center text-sm text-gray-500 pt-4 border-t">
              <p>본 계약서는 「근로기준법」에 의거하여 작성되었으며,</p>
              <p>상기 내용에 동의하고 서명합니다.</p>
              <p className="mt-4">
                {new Date(contract.created_at).toLocaleDateString('ko-KR')}
              </p>
            </section>
          </CardContent>
        </Card>

        {/* Signature Modal */}
        {showSignature && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="fixed inset-0 bg-black/50"
              onClick={() => setShowSignature(false)}
            />
            <div className="relative z-50 bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">
                {signatureType === 'employer' ? '사업주' : '근로자'} 서명
              </h3>
              <div className="border rounded-lg mb-4">
                <canvas
                  ref={canvasRef}
                  width={400}
                  height={200}
                  className="cursor-crosshair"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                />
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={clearSignature}>
                  지우기
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowSignature(false)}>
                    취소
                  </Button>
                  <Button onClick={saveSignature}>서명 완료</Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
