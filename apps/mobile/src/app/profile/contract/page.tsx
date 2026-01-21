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
  probation_months?: number;
  employee_signed_at?: string;
  employer_signed_at?: string;
  employee_signature?: string;
  employer_signature?: string;
  salary_config?: {
    baseSalaryType: string;
    baseSalaryAmount: number;
    paymentDate?: number;
    paymentMethod?: string;
  };
  standard_hours_per_week?: number;
  standard_hours_per_day?: number;
  annual_leave_days?: number;
  work_schedules?: Array<{
    daysOfWeek: number[];
    startTime: string;
    endTime: string;
    breakMinutes: number;
  }>;
  duties?: string[];
  terms?: {
    specialTerms?: string;
  };
  created_at?: string;
  stores: { name: string; address?: string } | null;
  companies?: {
    name: string;
    business_number?: string;
    ceo_name?: string;
    address?: string;
  } | null;
  staff?: {
    name: string;
    address?: string;
    phone?: string;
    email?: string;
  } | null;
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
          probation_months,
          employee_signed_at,
          employer_signed_at,
          employee_signature,
          employer_signature,
          salary_config,
          standard_hours_per_week,
          standard_hours_per_day,
          annual_leave_days,
          work_schedules,
          duties,
          terms,
          created_at,
          stores(name, address),
          companies(name, business_number, ceo_name, address),
          staff:users!contracts_staff_id_fkey(name, address, phone, email)
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
        const staffData = Array.isArray((contractData as Record<string, unknown>).staff)
          ? ((contractData as Record<string, unknown>).staff as Record<string, unknown>[])[0]
          : (contractData as Record<string, unknown>).staff;
        setContract({
          ...contractData,
          stores: storeData || null,
          companies: companyData || null,
          staff: (staffData as Contract['staff']) || null,
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

                const DAYS = ['일', '월', '화', '수', '목', '금', '토'];
                const statusLabels: Record<string, string> = {
                  DRAFT: '초안',
                  SENT: '발송됨',
                  SIGNED: '서명완료',
                  ACTIVE: '유효',
                  REJECTED: '거부됨',
                };

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
                        line-height: 1.6;
                      }
                      h1 { text-align: center; margin-bottom: 30px; font-size: 24px; }
                      h2 { font-size: 14px; border-bottom: 1px solid #333; padding-bottom: 8px; margin-top: 24px; margin-bottom: 12px; }
                      .header { text-align: center; margin-bottom: 20px; }
                      .badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 11px; margin-right: 8px; }
                      .badge-draft { background: #e5e5e5; color: #666; }
                      .badge-sent { background: #dbeafe; color: #1d4ed8; }
                      .badge-signed, .badge-active { background: #d1fae5; color: #059669; }
                      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 16px; }
                      .label { color: #666; font-size: 11px; margin-bottom: 4px; }
                      .value { font-weight: 500; }
                      .section { margin-bottom: 24px; }
                      table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
                      th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                      th { background-color: #f5f5f5; font-weight: 600; }
                      .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; border-top: 1px solid #ddd; padding-top: 24px; }
                      .signature-box { text-align: center; }
                      .signature-placeholder { height: 80px; border: 2px dashed #ccc; display: flex; align-items: center; justify-content: center; color: #999; margin: 16px 0; }
                      .signature-img { height: 60px; margin: 16px auto; display: block; }
                      .footer { text-align: center; margin-top: 40px; padding-top: 16px; border-top: 1px solid #ddd; color: #666; }
                      @media print { body { padding: 0; } }
                    </style>
                  </head>
                  <body>
                    <h1>근 로 계 약 서</h1>
                    <div class="header">
                      <span class="badge badge-${contract.status.toLowerCase()}">${statusLabels[contract.status] || contract.status}</span>
                      <span style="color: #666;">${contract.contract_number}</span>
                    </div>

                    <h2>제1조 【계약 당사자】</h2>
                    <div class="grid">
                      <div>
                        <div class="label">사업주 (갑)</div>
                        <div class="value">${contract.companies?.name || '-'}</div>
                        <div style="font-size:11px; color:#666;">
                          ${contract.companies?.address || '-'}<br>
                          대표자: ${contract.companies?.ceo_name || '-'}<br>
                          사업자번호: ${contract.companies?.business_number || '-'}
                        </div>
                      </div>
                      <div>
                        <div class="label">근로자 (을)</div>
                        <div class="value">${contract.staff?.name || '-'}</div>
                        <div style="font-size:11px; color:#666;">
                          ${contract.staff?.address || '-'}<br>
                          연락처: ${contract.staff?.phone || '-'}<br>
                          이메일: ${contract.staff?.email || '-'}
                        </div>
                      </div>
                    </div>

                    <h2>제2조 【계약 조건】</h2>
                    <table>
                      <tr><th style="width:25%">계약 유형</th><td>${getContractTypeLabel(contract.contract_type)}</td><th style="width:25%">근무지</th><td>${contract.stores?.name || '-'}</td></tr>
                      <tr><th>계약 기간</th><td>${formatDate(contract.start_date)}${contract.end_date ? ' ~ ' + formatDate(contract.end_date) : ' (정함이 없음)'}</td><th>수습 기간</th><td>${contract.probation_months || 0}개월</td></tr>
                      <tr><th>직책</th><td>${contract.position || '-'}</td><th>부서</th><td>${contract.department || '-'}</td></tr>
                    </table>

                    <h2>제3조 【근로시간】</h2>
                    <table>
                      <tr><th style="width:25%">주당 근로시간</th><td>${contract.standard_hours_per_week || 0}시간</td><th style="width:25%">1일 근로시간</th><td>${contract.standard_hours_per_day || 0}시간</td></tr>
                      ${contract.work_schedules?.map((s, i) => `
                        <tr><th>근무 요일${(contract.work_schedules?.length || 0) > 1 ? ' (' + (i + 1) + ')' : ''}</th><td>${s.daysOfWeek.map(d => DAYS[d]).join(', ')}</td><th>근무 시간</th><td>${s.startTime} ~ ${s.endTime} (휴게 ${s.breakMinutes}분)</td></tr>
                      `).join('') || '<tr><td colspan="4">근무 스케줄 없음</td></tr>'}
                    </table>

                    <h2>제4조 【임금】</h2>
                    <table>
                      <tr><th style="width:25%">기본급</th><td>${contract.salary_config?.baseSalaryType || ''} ${formatCurrency(contract.salary_config?.baseSalaryAmount || 0)}</td></tr>
                      <tr><th>지급일</th><td>매월 ${contract.salary_config?.paymentDate || '-'}일 (${contract.salary_config?.paymentMethod || '계좌이체'})</td></tr>
                    </table>

                    <h2>제5조 【휴가】</h2>
                    <table>
                      <tr><th style="width:25%">연차휴가</th><td>${contract.annual_leave_days || 15}일</td></tr>
                    </table>

                    ${contract.duties && contract.duties.length > 0 ? `
                    <h2>제6조 【담당 업무】</h2>
                    <ul>${contract.duties.map(d => '<li>' + d + '</li>').join('')}</ul>
                    ` : ''}

                    ${contract.terms?.specialTerms ? `
                    <h2>특약사항</h2>
                    <div style="background:#f9f9f9; padding:12px; border-radius:4px; white-space:pre-wrap;">${contract.terms.specialTerms}</div>
                    ` : ''}

                    <div class="signatures">
                      <div class="signature-box">
                        <div class="label">사업주 (갑)</div>
                        ${contract.employer_signature
                          ? '<img src="' + contract.employer_signature + '" class="signature-img" alt="사업주 서명"><div style="font-size:10px; color:#999;">' + (contract.employer_signed_at ? new Date(contract.employer_signed_at).toLocaleString('ko-KR') : '') + '</div>'
                          : '<div class="signature-placeholder">서명 대기중</div>'}
                        <div class="value">${contract.companies?.ceo_name || ''}</div>
                      </div>
                      <div class="signature-box">
                        <div class="label">근로자 (을)</div>
                        ${contract.employee_signature
                          ? '<img src="' + contract.employee_signature + '" class="signature-img" alt="근로자 서명"><div style="font-size:10px; color:#999;">' + (contract.employee_signed_at ? new Date(contract.employee_signed_at).toLocaleString('ko-KR') : '') + '</div>'
                          : '<div class="signature-placeholder">서명 대기중</div>'}
                        <div class="value">${contract.staff?.name || ''}</div>
                      </div>
                    </div>

                    <div class="footer">
                      <p>본 계약서는 「근로기준법」에 의거하여 작성되었으며, 상기 내용에 동의하고 서명합니다.</p>
                      <p style="margin-top:12px;">${contract.created_at ? formatDate(contract.created_at) : formatDate(new Date().toISOString())}</p>
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
