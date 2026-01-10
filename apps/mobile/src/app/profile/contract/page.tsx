'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, FileText, Download, CheckCircle, Calendar, Building2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Contract {
  id: string;
  contract_number: string;
  contract_type: string;
  start_date: string;
  end_date?: string;
  position: string;
  department: string;
  status: string;
  signed_at?: string;
  store: { name: string };
}

export default function ContractPage() {
  const router = useRouter();
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchContract();
  }, []);

  const fetchContract = async () => {
    try {
      // TODO: Replace with real API call
      // const response = await fetch('/api/my/contract');
      // const data = await response.json();
      // setContract(data);

      // Mock data for now
      setContract({
        id: '1',
        contract_number: 'CNT-202401-00001',
        contract_type: '정규직',
        start_date: '2023-06-01',
        end_date: undefined,
        position: '매장 직원',
        department: '홀',
        status: 'SIGNED',
        signed_at: '2023-05-28T10:00:00Z',
        store: { name: '강남점' },
      });
    } catch (error) {
      console.error('Failed to fetch contract:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

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
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div className="ml-3">
                  <p className="font-bold text-gray-900">계약 체결 완료</p>
                  <p className="text-sm text-gray-500">
                    {contract.signed_at && formatDate(contract.signed_at)} 서명됨
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full">
                유효
              </span>
            </div>
          </div>

          {/* Contract Info */}
          <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <span className="text-sm text-gray-500">계약 번호</span>
              <span className="font-medium text-gray-900">{contract.contract_number}</span>
            </div>
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <span className="text-sm text-gray-500">계약 유형</span>
              <span className="font-medium text-gray-900">{contract.contract_type}</span>
            </div>
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <span className="text-sm text-gray-500">근무지</span>
              <span className="font-medium text-gray-900">{contract.store.name}</span>
            </div>
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <span className="text-sm text-gray-500">직책</span>
              <span className="font-medium text-gray-900">{contract.position}</span>
            </div>
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <span className="text-sm text-gray-500">부서</span>
              <span className="font-medium text-gray-900">{contract.department}</span>
            </div>
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

          {/* Download Button */}
          <button className="w-full bg-primary text-white rounded-xl py-4 font-medium flex items-center justify-center">
            <Download className="w-5 h-5 mr-2" />
            계약서 다운로드 (PDF)
          </button>

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
    </div>
  );
}
