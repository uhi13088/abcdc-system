'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, FileText, Download, CheckCircle, Calendar, Clock, PenTool, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface Contract {
  id: string;
  contract_number: string;
  contract_type: string;
  start_date: string;
  end_date?: string;
  position: string;
  department: string;
  status: string;
  employee_signed_at?: string;
  employer_signed_at?: string;
  employee_signature?: string;
  salary_config?: {
    baseSalaryType: string;
    baseSalaryAmount: number;
  };
  standard_hours_per_week?: number;
  stores: { name: string } | null;
  companies?: { name: string } | null;
}

export default function ContractPage() {
  const router = useRouter();
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSignModal, setShowSignModal] = useState(false);
  const [signing, setSigning] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const supabase = createClient();

  const fetchContract = useCallback(async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        router.push('/auth/login');
        return;
      }

      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', authUser.id)
        .single();

      if (!userData) {
        setLoading(false);
        return;
      }

      // Fetch contracts including those needing signature (DRAFT, SENT) and active ones
      const { data: contractData, error } = await supabase
        .from('contracts')
        .select(`
          id,
          contract_number,
          contract_type,
          start_date,
          end_date,
          position,
          department,
          status,
          employee_signed_at,
          employer_signed_at,
          employee_signature,
          salary_config,
          standard_hours_per_week,
          stores(name),
          companies(name)
        `)
        .eq('staff_id', userData.id)
        .in('status', ['DRAFT', 'SENT', 'SIGNED', 'ACTIVE'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Contract fetch error:', error);
        setLoading(false);
        return;
      }

      if (contractData) {
        const storeData = Array.isArray(contractData.stores) ? contractData.stores[0] : contractData.stores;
        const companyData = Array.isArray(contractData.companies) ? contractData.companies[0] : contractData.companies;
        setContract({
          ...contractData,
          stores: storeData || null,
          companies: companyData || null,
        } as Contract);
      }
    } catch (error) {
      console.error('Failed to fetch contract:', error);
    } finally {
      setLoading(false);
    }
  }, [supabase, router]);

  useEffect(() => {
    fetchContract();
  }, [fetchContract]);

  // Canvas drawing functions
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsDrawing(true);
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
    if (!isDrawing) return;
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

    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleSign = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !contract) return;

    // Check if canvas has any drawing
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const hasSignature = imageData.data.some((pixel, i) => i % 4 === 3 && pixel > 0);

    if (!hasSignature) {
      alert('서명을 입력해주세요.');
      return;
    }

    setSigning(true);
    try {
      const signatureData = canvas.toDataURL('image/png');

      const response = await fetch(`/api/contracts/${contract.id}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signature: signatureData,
          signerType: 'EMPLOYEE',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '서명 처리에 실패했습니다.');
      }

      alert('서명이 완료되었습니다.');
      setShowSignModal(false);
      fetchContract(); // Refresh contract data
    } catch (error) {
      console.error('Sign error:', error);
      alert(error instanceof Error ? error.message : '서명 처리에 실패했습니다.');
    } finally {
      setSigning(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('ko-KR') + '원';
  };

  const getContractTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      FULL_TIME: '정규직',
      PART_TIME: '시간제',
      CONTRACT: '계약직',
      INTERN: '인턴',
    };
    return types[type] || type;
  };

  const getStatusBadge = (status: string, employeeSigned: boolean) => {
    if (status === 'ACTIVE') {
      return (
        <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full">
          유효
        </span>
      );
    }
    if (status === 'SIGNED') {
      return (
        <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full">
          서명 완료
        </span>
      );
    }
    if (!employeeSigned) {
      return (
        <span className="px-3 py-1 bg-orange-100 text-orange-700 text-sm font-medium rounded-full">
          서명 필요
        </span>
      );
    }
    return (
      <span className="px-3 py-1 bg-yellow-100 text-yellow-700 text-sm font-medium rounded-full">
        처리 중
      </span>
    );
  };

  const needsSignature = contract && !contract.employee_signature && !contract.employee_signed_at;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 safe-top">
        <div className="flex items-center">
          <button onClick={() => router.back()} className="p-2 -ml-2 mr-2">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">근로계약서</h1>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : contract ? (
        <div className="p-4 space-y-4">
          {/* Contract Status */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  needsSignature ? 'bg-orange-100' : 'bg-green-100'
                }`}>
                  {needsSignature ? (
                    <PenTool className="w-6 h-6 text-orange-600" />
                  ) : (
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  )}
                </div>
                <div className="ml-3">
                  <p className="font-bold text-gray-900">
                    {needsSignature ? '서명이 필요합니다' : '계약 체결 완료'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {contract.employee_signed_at
                      ? `${formatDate(contract.employee_signed_at)} 서명됨`
                      : '아직 서명하지 않았습니다'
                    }
                  </p>
                </div>
              </div>
              {getStatusBadge(contract.status, !!contract.employee_signed_at)}
            </div>
          </div>

          {/* Sign Button for unsigned contracts */}
          {needsSignature && (
            <button
              onClick={() => setShowSignModal(true)}
              className="w-full bg-primary text-white rounded-xl py-4 font-medium flex items-center justify-center"
            >
              <PenTool className="w-5 h-5 mr-2" />
              계약서 서명하기
            </button>
          )}

          {/* Contract Info */}
          <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
            {contract.companies?.name && (
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <span className="text-sm text-gray-500">회사명</span>
                <span className="font-medium text-gray-900">{contract.companies.name}</span>
              </div>
            )}
            {contract.contract_number && (
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <span className="text-sm text-gray-500">계약 번호</span>
                <span className="font-medium text-gray-900">{contract.contract_number}</span>
              </div>
            )}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <span className="text-sm text-gray-500">계약 유형</span>
              <span className="font-medium text-gray-900">{getContractTypeLabel(contract.contract_type)}</span>
            </div>
            {contract.stores?.name && (
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <span className="text-sm text-gray-500">근무지</span>
                <span className="font-medium text-gray-900">{contract.stores.name}</span>
              </div>
            )}
            {contract.position && (
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <span className="text-sm text-gray-500">직책</span>
                <span className="font-medium text-gray-900">{contract.position}</span>
              </div>
            )}
            {contract.department && (
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <span className="text-sm text-gray-500">부서</span>
                <span className="font-medium text-gray-900">{contract.department}</span>
              </div>
            )}
          </div>

          {/* Contract Period */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-3 flex items-center">
              <Calendar className="w-5 h-5 mr-2 text-primary" />
              계약 기간
            </h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">시작일</p>
                <p className="font-medium text-gray-900">{formatDate(contract.start_date)}</p>
              </div>
              <div className="text-2xl text-gray-300">→</div>
              <div className="text-right">
                <p className="text-sm text-gray-500">종료일</p>
                <p className="font-medium text-gray-900">
                  {contract.end_date ? formatDate(contract.end_date) : '무기한'}
                </p>
              </div>
            </div>
          </div>

          {/* Wage Info */}
          {(contract.salary_config || contract.standard_hours_per_week) && (
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <h3 className="font-bold text-gray-900 mb-3 flex items-center">
                <Clock className="w-5 h-5 mr-2 text-primary" />
                급여 정보
              </h3>
              <div className="space-y-3">
                {contract.salary_config?.baseSalaryType === 'HOURLY' && contract.salary_config?.baseSalaryAmount > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">시급</span>
                    <span className="font-medium text-gray-900">{formatCurrency(contract.salary_config.baseSalaryAmount)}</span>
                  </div>
                )}
                {contract.salary_config?.baseSalaryType === 'MONTHLY' && contract.salary_config?.baseSalaryAmount > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">월급</span>
                    <span className="font-medium text-gray-900">{formatCurrency(contract.salary_config.baseSalaryAmount)}</span>
                  </div>
                )}
                {contract.standard_hours_per_week && contract.standard_hours_per_week > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">주당 근무시간</span>
                    <span className="font-medium text-gray-900">{contract.standard_hours_per_week}시간</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Download Button */}
          {!needsSignature && (
            <button
              onClick={() => {
                if (!contract) return;

                const content = `
                  <!DOCTYPE html>
                  <html>
                  <head>
                    <meta charset="UTF-8">
                    <title>근로계약서 - ${contract.contract_number}</title>
                    <style>
                      @page { size: A4; margin: 20mm; }
                      body {
                        font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif;
                        padding: 20px;
                        font-size: 12px;
                        line-height: 1.8;
                      }
                      h1 { text-align: center; margin-bottom: 30px; font-size: 24px; }
                      .header { text-align: center; margin-bottom: 20px; color: #666; font-size: 11px; }
                      .section { margin-bottom: 24px; }
                      .section-title { font-size: 14px; font-weight: bold; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #333; }
                      table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
                      th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                      th { background-color: #f5f5f5; font-weight: 600; width: 30%; }
                      .signature-section { margin-top: 40px; display: flex; justify-content: space-between; }
                      .signature-box { width: 45%; text-align: center; }
                      .signature-line { border-top: 1px solid #333; margin-top: 60px; padding-top: 8px; }
                      .footer { margin-top: 40px; text-align: center; font-size: 10px; color: #999; }
                      @media print { body { padding: 0; } }
                    </style>
                  </head>
                  <body>
                    <h1>근 로 계 약 서</h1>
                    <p class="header">계약번호: ${contract.contract_number} | 생성일: ${new Date().toLocaleDateString('ko-KR')}</p>

                    <div class="section">
                      <div class="section-title">계약 정보</div>
                      <table>
                        ${contract.companies?.name ? `<tr><th>회사명</th><td>${contract.companies.name}</td></tr>` : ''}
                        <tr><th>계약 유형</th><td>${getContractTypeLabel(contract.contract_type)}</td></tr>
                        ${contract.stores?.name ? `<tr><th>근무지</th><td>${contract.stores.name}</td></tr>` : ''}
                        ${contract.position ? `<tr><th>직책</th><td>${contract.position}</td></tr>` : ''}
                        ${contract.department ? `<tr><th>부서</th><td>${contract.department}</td></tr>` : ''}
                      </table>
                    </div>

                    <div class="section">
                      <div class="section-title">계약 기간</div>
                      <table>
                        <tr><th>시작일</th><td>${formatDate(contract.start_date)}</td></tr>
                        <tr><th>종료일</th><td>${contract.end_date ? formatDate(contract.end_date) : '무기한'}</td></tr>
                      </table>
                    </div>

                    ${contract.salary_config || contract.standard_hours_per_week ? `
                    <div class="section">
                      <div class="section-title">급여 정보</div>
                      <table>
                        ${contract.salary_config?.baseSalaryType === 'HOURLY' && contract.salary_config?.baseSalaryAmount > 0
                          ? `<tr><th>시급</th><td>${formatCurrency(contract.salary_config.baseSalaryAmount)}</td></tr>` : ''}
                        ${contract.salary_config?.baseSalaryType === 'MONTHLY' && contract.salary_config?.baseSalaryAmount > 0
                          ? `<tr><th>월급</th><td>${formatCurrency(contract.salary_config.baseSalaryAmount)}</td></tr>` : ''}
                        ${contract.standard_hours_per_week && contract.standard_hours_per_week > 0
                          ? `<tr><th>주당 근무시간</th><td>${contract.standard_hours_per_week}시간</td></tr>` : ''}
                      </table>
                    </div>
                    ` : ''}

                    <div class="section">
                      <div class="section-title">서명 정보</div>
                      <table>
                        <tr><th>근로자 서명일</th><td>${contract.employee_signed_at ? formatDate(contract.employee_signed_at) : '미서명'}</td></tr>
                        <tr><th>사용자 서명일</th><td>${contract.employer_signed_at ? formatDate(contract.employer_signed_at) : '미서명'}</td></tr>
                      </table>
                    </div>

                    <div class="footer">
                      본 계약서는 「근로기준법」에 의거하여 작성되었습니다.
                    </div>
                  </body>
                  </html>
                `;

                const printWindow = window.open('', '_blank');
                if (printWindow) {
                  printWindow.document.write(content);
                  printWindow.document.close();
                  printWindow.print();
                } else {
                  alert('팝업이 차단되었습니다. 팝업을 허용해주세요.');
                }
              }}
              className="w-full bg-gray-100 text-gray-700 rounded-xl py-4 font-medium flex items-center justify-center"
            >
              <Download className="w-5 h-5 mr-2" />
              계약서 다운로드 (PDF)
            </button>
          )}

          {/* Notice */}
          <p className="text-xs text-gray-400 text-center px-4">
            계약서 원본은 회사에서 보관하고 있습니다. 문의사항은 인사팀에 연락해 주세요.
          </p>
        </div>
      ) : (
        <div className="p-4">
          <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
            <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">등록된 계약서가 없습니다</p>
          </div>
        </div>
      )}

      {/* Signature Modal */}
      {showSignModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">서명하기</h2>
              <button onClick={() => setShowSignModal(false)} className="p-2">
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>

            <p className="text-sm text-gray-500 mb-4">
              아래 영역에 손가락으로 서명해 주세요.
            </p>

            <div className="border-2 border-gray-200 rounded-xl mb-4 bg-white">
              <canvas
                ref={canvasRef}
                width={320}
                height={200}
                className="w-full touch-none"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
            </div>

            <div className="flex space-x-3">
              <button
                onClick={clearCanvas}
                className="flex-1 py-3 border border-gray-300 rounded-xl font-medium text-gray-700"
              >
                다시 쓰기
              </button>
              <button
                onClick={handleSign}
                disabled={signing}
                className="flex-1 py-3 bg-primary text-white rounded-xl font-medium disabled:opacity-50"
              >
                {signing ? '처리 중...' : '서명 완료'}
              </button>
            </div>

            <p className="text-xs text-gray-400 text-center mt-4">
              서명 시 계약 내용에 동의하는 것으로 간주됩니다.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
