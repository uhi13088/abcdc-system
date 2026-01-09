'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import {
  Button,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  EmptyState,
  PageLoading,
  Select,
  Input,
  Pagination,
} from '@/components/ui';
import { Plus, FileText, Search, Eye, Send, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Contract {
  id: string;
  contract_number: string;
  contract_type: string;
  start_date: string;
  end_date: string | null;
  status: string;
  created_at: string;
  staff: {
    id: string;
    name: string;
    email: string;
    phone: string;
    position: string;
  };
  stores: {
    id: string;
    name: string;
  };
  brands: {
    id: string;
    name: string;
  };
}

const statusMap: Record<string, { label: string; variant: 'default' | 'info' | 'success' | 'warning' }> = {
  DRAFT: { label: '초안', variant: 'default' },
  SENT: { label: '발송됨', variant: 'info' },
  SIGNED: { label: '서명완료', variant: 'success' },
  REJECTED: { label: '거부됨', variant: 'warning' },
};

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchContracts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10',
      });
      if (statusFilter) params.set('status', statusFilter);

      const response = await fetch(`/api/contracts?${params}`);
      const result = await response.json();

      if (response.ok) {
        setContracts(result.data);
        setTotalPages(result.pagination.totalPages);
      }
    } catch (error) {
      console.error('Failed to fetch contracts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContracts();
  }, [currentPage, statusFilter]);

  const handleSendContract = async (id: string) => {
    if (!confirm('계약서를 직원에게 발송하시겠습니까?')) return;

    try {
      const response = await fetch(`/api/contracts/${id}/send`, {
        method: 'POST',
      });

      if (response.ok) {
        fetchContracts();
        alert('계약서가 발송되었습니다.');
      } else {
        const data = await response.json();
        alert(data.error || '발송에 실패했습니다.');
      }
    } catch (error) {
      alert('발송에 실패했습니다.');
    }
  };

  const handleDeleteContract = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
      const response = await fetch(`/api/contracts/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchContracts();
      } else {
        const data = await response.json();
        alert(data.error || '삭제에 실패했습니다.');
      }
    } catch (error) {
      alert('삭제에 실패했습니다.');
    }
  };

  const filteredContracts = contracts.filter((contract) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      contract.staff?.name?.toLowerCase().includes(query) ||
      contract.contract_number.toLowerCase().includes(query) ||
      contract.stores?.name?.toLowerCase().includes(query)
    );
  });

  return (
    <div>
      <Header title="계약서 관리" />

      <div className="p-6">
        <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="직원명, 계약번호 검색"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: '', label: '전체 상태' },
                { value: 'DRAFT', label: '초안' },
                { value: 'SENT', label: '발송됨' },
                { value: 'SIGNED', label: '서명완료' },
                { value: 'REJECTED', label: '거부됨' },
              ]}
              className="w-40"
            />
          </div>
          <Link href="/contracts/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              계약서 작성
            </Button>
          </Link>
        </div>

        {loading ? (
          <PageLoading />
        ) : filteredContracts.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="계약서가 없습니다"
            description="새로운 근로계약서를 작성해보세요."
            action={
              <Link href="/contracts/new">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  계약서 작성
                </Button>
              </Link>
            }
          />
        ) : (
          <>
            <div className="bg-white rounded-lg border border-gray-200">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>계약번호</TableHead>
                    <TableHead>직원명</TableHead>
                    <TableHead>매장</TableHead>
                    <TableHead>계약유형</TableHead>
                    <TableHead>계약기간</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead>작성일</TableHead>
                    <TableHead className="text-right">액션</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContracts.map((contract) => (
                    <TableRow key={contract.id}>
                      <TableCell className="font-medium">
                        {contract.contract_number}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{contract.staff?.name}</p>
                          <p className="text-sm text-gray-500">{contract.staff?.position}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p>{contract.stores?.name}</p>
                          <p className="text-sm text-gray-500">{contract.brands?.name}</p>
                        </div>
                      </TableCell>
                      <TableCell>{contract.contract_type}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p>{new Date(contract.start_date).toLocaleDateString('ko-KR')}</p>
                          {contract.end_date && (
                            <p className="text-gray-500">
                              ~ {new Date(contract.end_date).toLocaleDateString('ko-KR')}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusMap[contract.status]?.variant || 'default'}>
                          {statusMap[contract.status]?.label || contract.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(contract.created_at).toLocaleDateString('ko-KR')}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Link href={`/contracts/${contract.id}`}>
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          {contract.status === 'DRAFT' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSendContract(contract.id)}
                              >
                                <Send className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteContract(contract.id)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <div className="mt-6">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
