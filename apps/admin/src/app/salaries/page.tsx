'use client';

import { useEffect, useState } from 'react';
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
  Pagination,
  Card,
  CardContent,
  Alert,
} from '@/components/ui';
import { DollarSign, Calculator, Check, Download, FileSpreadsheet } from 'lucide-react';

interface Store {
  id: string;
  name: string;
}

interface Salary {
  id: string;
  year: number;
  month: number;
  base_salary: number;
  overtime_pay: number;
  night_pay: number;
  total_gross_pay: number;
  total_deductions: number;
  net_pay: number;
  work_days: number;
  total_hours: number;
  status: string;
  confirmed_at: string | null;
  staff: {
    id: string;
    name: string;
    email: string;
    position: string;
    store_id?: string;
  };
}

const statusMap: Record<string, { label: string; variant: 'default' | 'warning' | 'success' }> = {
  PENDING: { label: '대기', variant: 'warning' },
  CONFIRMED: { label: '확정', variant: 'success' },
  PAID: { label: '지급완료', variant: 'default' },
};

export default function SalariesPage() {
  const [salaries, setSalaries] = useState<Salary[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [statusFilter, setStatusFilter] = useState('');
  const [storeFilter, setStoreFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [message, setMessage] = useState('');
  const [summary, setSummary] = useState({ totalGross: 0, totalDeductions: 0, totalNet: 0 });

  const fetchStores = async () => {
    try {
      const response = await fetch('/api/stores');
      if (response.ok) {
        const data = await response.json();
        setStores(data);
      }
    } catch (error) {
      console.error('Failed to fetch stores:', error);
    }
  };

  const fetchSalaries = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10',
        year: selectedYear.toString(),
        month: selectedMonth.toString(),
      });
      if (statusFilter) params.set('status', statusFilter);
      if (storeFilter) params.set('storeId', storeFilter);

      const response = await fetch(`/api/salaries?${params}`);
      const result = await response.json();

      if (response.ok) {
        setSalaries(result.data);
        setTotalPages(result.pagination.totalPages);
        if (result.summary) {
          setSummary(result.summary);
        }
      }
    } catch (error) {
      console.error('Failed to fetch salaries:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStores();
  }, []);

  useEffect(() => {
    fetchSalaries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, selectedYear, selectedMonth, statusFilter, storeFilter]);

  const handleCalculate = async () => {
    if (!confirm(`${selectedYear}년 ${selectedMonth}월 급여를 계산하시겠습니까?`)) return;

    setCalculating(true);
    setMessage('');

    try {
      const response = await fetch('/api/salaries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: selectedYear,
          month: selectedMonth,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(data.message);
        fetchSalaries();
      } else {
        setMessage(data.error || '급여 계산에 실패했습니다.');
      }
    } catch (_error) {
      setMessage('급여 계산에 실패했습니다.');
    } finally {
      setCalculating(false);
    }
  };

  const handleConfirm = async (id: string) => {
    try {
      const response = await fetch(`/api/salaries/${id}/confirm`, {
        method: 'POST',
      });

      if (response.ok) {
        fetchSalaries();
      } else {
        const data = await response.json();
        alert(data.error || '확정에 실패했습니다.');
      }
    } catch (_error) {
      alert('확정에 실패했습니다.');
    }
  };

  const handleExportExcel = () => {
    if (salaries.length === 0) {
      alert('내보낼 데이터가 없습니다.');
      return;
    }

    try {
      // CSV header
      const headers = ['직원명', '직책', '근무일수', '총근무시간', '기본급', '연장수당', '야간수당', '총지급액', '공제액', '실지급액', '상태'];

      // CSV rows
      const rows = salaries.map((salary) => [
        salary.staff?.name || '',
        salary.staff?.position || '',
        salary.work_days,
        salary.total_hours?.toFixed(1) || '0',
        salary.base_salary || 0,
        salary.overtime_pay || 0,
        salary.night_pay || 0,
        salary.total_gross_pay || 0,
        salary.total_deductions || 0,
        salary.net_pay || 0,
        statusMap[salary.status]?.label || salary.status,
      ]);

      // Build CSV content with BOM for Excel Korean support
      const BOM = '\uFEFF';
      const csvContent = BOM + [headers, ...rows].map(row => row.join(',')).join('\n');

      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `급여내역_${selectedYear}년${selectedMonth}월.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
      alert('내보내기에 실패했습니다.');
    }
  };

  // Summary stats (from API - includes all salaries for the month, not just current page)
  const { totalGross, totalDeductions, totalNet } = summary;

  return (
    <div>
      <Header title="급여 관리" />

      <div className="p-6">
        {message && (
          <Alert
            variant={message.includes('실패') ? 'error' : 'success'}
            className="mb-6"
          >
            {message}
          </Alert>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">총 지급액</p>
                  <p className="text-2xl font-bold">
                    ₩{totalGross.toLocaleString()}
                  </p>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <DollarSign className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">총 공제액</p>
                  <p className="text-2xl font-bold text-red-600">
                    -₩{totalDeductions.toLocaleString()}
                  </p>
                </div>
                <div className="p-3 bg-red-100 rounded-full">
                  <Calculator className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">실 지급액</p>
                  <p className="text-2xl font-bold text-green-600">
                    ₩{totalNet.toLocaleString()}
                  </p>
                </div>
                <div className="p-3 bg-green-100 rounded-full">
                  <Check className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Toolbar */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex gap-4 flex-wrap">
            <Select
              value={selectedYear.toString()}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              options={Array.from({ length: 5 }, (_, i) => ({
                value: (new Date().getFullYear() - i).toString(),
                label: `${new Date().getFullYear() - i}년`,
              }))}
              className="w-28"
            />
            <Select
              value={selectedMonth.toString()}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              options={Array.from({ length: 12 }, (_, i) => ({
                value: (i + 1).toString(),
                label: `${i + 1}월`,
              }))}
              className="w-24"
            />
            <Select
              value={storeFilter}
              onChange={(e) => setStoreFilter(e.target.value)}
              options={[
                { value: '', label: '전체 매장' },
                ...stores.map((s) => ({ value: s.id, label: s.name })),
              ]}
              className="w-40"
            />
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: '', label: '전체 상태' },
                { value: 'PENDING', label: '대기' },
                { value: 'CONFIRMED', label: '확정' },
                { value: 'PAID', label: '지급완료' },
              ]}
              className="w-32"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportExcel}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              엑셀 내보내기
            </Button>
            <Button onClick={handleCalculate} disabled={calculating}>
              <Calculator className="h-4 w-4 mr-2" />
              {calculating ? '계산 중...' : '급여 계산'}
            </Button>
          </div>
        </div>

        {loading ? (
          <PageLoading />
        ) : salaries.length === 0 ? (
          <EmptyState
            icon={DollarSign}
            title="급여 내역이 없습니다"
            description="급여 계산 버튼을 눌러 급여를 계산하세요."
            action={
              <Button onClick={handleCalculate}>
                <Calculator className="h-4 w-4 mr-2" />
                급여 계산
              </Button>
            }
          />
        ) : (
          <>
            <div className="bg-white rounded-lg border border-gray-200">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>직원</TableHead>
                    <TableHead className="text-right">근무일수</TableHead>
                    <TableHead className="text-right">총 근무시간</TableHead>
                    <TableHead className="text-right">기본급</TableHead>
                    <TableHead className="text-right">연장수당</TableHead>
                    <TableHead className="text-right">총지급액</TableHead>
                    <TableHead className="text-right">공제액</TableHead>
                    <TableHead className="text-right">실지급액</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead className="text-right">액션</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salaries.map((salary) => (
                    <TableRow key={salary.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{salary.staff?.name}</p>
                          <p className="text-sm text-gray-500">{salary.staff?.position}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{salary.work_days}일</TableCell>
                      <TableCell className="text-right">{salary.total_hours?.toFixed(1)}h</TableCell>
                      <TableCell className="text-right">
                        ₩{(salary.base_salary || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        ₩{(salary.overtime_pay || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ₩{(salary.total_gross_pay || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        -₩{(salary.total_deductions || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-bold text-green-600">
                        ₩{(salary.net_pay || 0).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusMap[salary.status]?.variant}>
                          {statusMap[salary.status]?.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          {salary.status === 'PENDING' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleConfirm(salary.id)}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              확정
                            </Button>
                          )}
                          <Button size="sm" variant="ghost">
                            <Download className="h-4 w-4" />
                          </Button>
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
