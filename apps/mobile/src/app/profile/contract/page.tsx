'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, FileText, Download, CheckCircle, Calendar, Clock } from 'lucide-react';
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
  signed_at?: string;
  hourly_wage?: number;
  monthly_salary?: number;
  work_hours_per_week?: number;
  stores: { name: string } | null;
}

export default function ContractPage() {
  const router = useRouter();
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const fetchContract = useCallback(async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        router.push('/auth/login');
        return;
      }

      // First get user's staff_id from users table (authUser.id is auth_id, not staff_id)
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', authUser.id)
        .single();

      if (!userData) {
        setLoading(false);
        return;
      }

      // Fetch the most recent active contract for this user
      // Use maybeSingle() to avoid error when no contract exists
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
          signed_at,
          hourly_wage,
          monthly_salary,
          work_hours_per_week,
          stores(name)
        `)
        .eq('staff_id', userData.id)
        .in('status', ['SIGNED', 'SENT'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Silently handle errors (no contract is a valid state)
      if (error) {
        console.error('Contract fetch error:', error);
        setLoading(false);
        return;
      }

      if (contractData) {
        // Supabase returns relations as arrays, extract first element
        const storeData = Array.isArray(contractData.stores) ? contractData.stores[0] : contractData.stores;
        setContract({
          ...contractData,
          stores: storeData || null,
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

  const getStatusBadge = (status: string) => {
    if (status === 'SIGNED' || status === 'ACTIVE') {
      return (
        <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full">
          유효
        </span>
      );
    }
    if (status === 'PENDING') {
      return (
        <span className="px-3 py-1 bg-yellow-100 text-yellow-700 text-sm font-medium rounded-full">
          서명 대기
        </span>
      );
    }
    return (
      <span className="px-3 py-1 bg-gray-100 text-gray-700 text-sm font-medium rounded-full">
        {status}
      </span>
    );
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
              {getStatusBadge(contract.status)}
            </div>
          </div>

          {/* Contract Info */}
          <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
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
          {(contract.hourly_wage || contract.monthly_salary || contract.work_hours_per_week) && (
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <h3 className="font-bold text-gray-900 mb-3 flex items-center">
                <Clock className="w-5 h-5 mr-2 text-primary" />
                급여 정보
              </h3>
              <div className="space-y-3">
                {contract.hourly_wage && contract.hourly_wage > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">시급</span>
                    <span className="font-medium text-gray-900">{formatCurrency(contract.hourly_wage)}</span>
                  </div>
                )}
                {contract.monthly_salary && contract.monthly_salary > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">월급</span>
                    <span className="font-medium text-gray-900">{formatCurrency(contract.monthly_salary)}</span>
                  </div>
                )}
                {contract.work_hours_per_week && contract.work_hours_per_week > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">주당 근무시간</span>
                    <span className="font-medium text-gray-900">{contract.work_hours_per_week}시간</span>
                  </div>
                )}
              </div>
            </div>
          )}

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
