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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Label,
  Alert,
} from '@/components/ui';
import { Plus, Users, Search, Eye, Edit, Trash2, Phone, Mail } from 'lucide-react';
import { UserRole, UserStatus } from '@abc/shared';

interface Employee {
  id: string;
  email: string;
  name: string;
  role: string;
  phone: string;
  position: string;
  status: string;
  created_at: string;
  stores: { id: string; name: string } | null;
  brands: { id: string; name: string } | null;
}

interface Store {
  id: string;
  name: string;
  brand_id: string;
}

const roleLabels: Record<string, string> = {
  platform_admin: '플랫폼 관리자',
  company_admin: '회사 관리자',
  manager: '본사 관리자',
  store_manager: '매장 관리자',
  team_leader: '팀장',
  staff: '직원',
};

const statusMap: Record<string, { label: string; variant: 'success' | 'warning' | 'default' | 'danger' }> = {
  ACTIVE: { label: '활성', variant: 'success' },
  PENDING: { label: '대기', variant: 'warning' },
  INACTIVE: { label: '비활성', variant: 'default' },
  SUSPENDED: { label: '정지', variant: 'danger' },
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [storeFilter, setStoreFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // New employee dialog
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newEmployee, setNewEmployee] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
    role: 'staff',
    storeId: '',
    position: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10',
      });
      if (statusFilter) params.set('status', statusFilter);
      if (roleFilter) params.set('role', roleFilter);
      if (storeFilter) params.set('storeId', storeFilter);

      const response = await fetch(`/api/users?${params}`);
      const result = await response.json();

      if (response.ok) {
        setEmployees(result.data);
        setTotalPages(result.pagination.totalPages);
      }
    } catch (error) {
      console.error('Failed to fetch employees:', error);
    } finally {
      setLoading(false);
    }
  };

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

  useEffect(() => {
    fetchStores();
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [currentPage, statusFilter, roleFilter, storeFilter]);

  const handleCreateEmployee = async () => {
    setError('');
    setSubmitting(true);

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEmployee),
      });

      if (response.ok) {
        setShowNewDialog(false);
        setNewEmployee({
          email: '',
          password: '',
          name: '',
          phone: '',
          role: 'staff',
          storeId: '',
          position: '',
        });
        fetchEmployees();
      } else {
        const data = await response.json();
        setError(data.error || '직원 생성에 실패했습니다.');
      }
    } catch (err) {
      setError('직원 생성에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    if (!confirm('정말 비활성화하시겠습니까?')) return;

    try {
      const response = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchEmployees();
      } else {
        const data = await response.json();
        alert(data.error || '비활성화에 실패했습니다.');
      }
    } catch (error) {
      alert('비활성화에 실패했습니다.');
    }
  };

  const filteredEmployees = employees.filter((emp) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      emp.name?.toLowerCase().includes(query) ||
      emp.email?.toLowerCase().includes(query) ||
      emp.phone?.includes(query)
    );
  });

  return (
    <div>
      <Header title="직원 관리" />

      <div className="p-6">
        <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex gap-4 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="이름, 이메일, 전화번호 검색"
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
                { value: 'ACTIVE', label: '활성' },
                { value: 'PENDING', label: '대기' },
                { value: 'INACTIVE', label: '비활성' },
              ]}
              className="w-32"
            />
            <Select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              options={[
                { value: '', label: '전체 역할' },
                ...Object.entries(roleLabels).map(([value, label]) => ({ value, label })),
              ]}
              className="w-40"
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
          </div>
          <Button onClick={() => setShowNewDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            직원 등록
          </Button>
        </div>

        {loading ? (
          <PageLoading />
        ) : filteredEmployees.length === 0 ? (
          <EmptyState
            icon={Users}
            title="직원이 없습니다"
            description="새로운 직원을 등록해보세요."
            action={
              <Button onClick={() => setShowNewDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                직원 등록
              </Button>
            }
          />
        ) : (
          <>
            <div className="bg-white rounded-lg border border-gray-200">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>이름</TableHead>
                    <TableHead>연락처</TableHead>
                    <TableHead>역할</TableHead>
                    <TableHead>매장</TableHead>
                    <TableHead>직책</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead>등록일</TableHead>
                    <TableHead className="text-right">액션</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell>
                        <div className="font-medium">{employee.name}</div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center text-sm">
                            <Mail className="h-3 w-3 mr-1 text-gray-400" />
                            {employee.email}
                          </div>
                          {employee.phone && (
                            <div className="flex items-center text-sm text-gray-500">
                              <Phone className="h-3 w-3 mr-1 text-gray-400" />
                              {employee.phone}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {roleLabels[employee.role] || employee.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p>{employee.stores?.name || '-'}</p>
                          <p className="text-sm text-gray-500">{employee.brands?.name}</p>
                        </div>
                      </TableCell>
                      <TableCell>{employee.position || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={statusMap[employee.status]?.variant || 'default'}>
                          {statusMap[employee.status]?.label || employee.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(employee.created_at).toLocaleDateString('ko-KR')}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Link href={`/employees/${employee.id}`}>
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Link href={`/employees/${employee.id}/edit`}>
                            <Button variant="ghost" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </Link>
                          {employee.status === 'ACTIVE' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteEmployee(employee.id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
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

      {/* New Employee Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>직원 등록</DialogTitle>
          </DialogHeader>

          {error && (
            <Alert variant="error" className="mb-4">
              {error}
            </Alert>
          )}

          <div className="space-y-4">
            <div>
              <Label required>이메일</Label>
              <Input
                type="email"
                value={newEmployee.email}
                onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                placeholder="email@example.com"
                className="mt-1"
              />
            </div>
            <div>
              <Label required>비밀번호</Label>
              <Input
                type="password"
                value={newEmployee.password}
                onChange={(e) => setNewEmployee({ ...newEmployee, password: e.target.value })}
                placeholder="8자 이상"
                className="mt-1"
              />
            </div>
            <div>
              <Label required>이름</Label>
              <Input
                value={newEmployee.name}
                onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                placeholder="홍길동"
                className="mt-1"
              />
            </div>
            <div>
              <Label>전화번호</Label>
              <Input
                value={newEmployee.phone}
                onChange={(e) => setNewEmployee({ ...newEmployee, phone: e.target.value })}
                placeholder="010-1234-5678"
                className="mt-1"
              />
            </div>
            <div>
              <Label required>역할</Label>
              <Select
                value={newEmployee.role}
                onChange={(e) => setNewEmployee({ ...newEmployee, role: e.target.value })}
                options={Object.entries(roleLabels).map(([value, label]) => ({ value, label }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>매장</Label>
              <Select
                value={newEmployee.storeId}
                onChange={(e) => setNewEmployee({ ...newEmployee, storeId: e.target.value })}
                options={[
                  { value: '', label: '매장 선택' },
                  ...stores.map((s) => ({ value: s.id, label: s.name })),
                ]}
                className="mt-1"
              />
            </div>
            <div>
              <Label>직책</Label>
              <Input
                value={newEmployee.position}
                onChange={(e) => setNewEmployee({ ...newEmployee, position: e.target.value })}
                placeholder="매니저, 파트타임 등"
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>
              취소
            </Button>
            <Button onClick={handleCreateEmployee} disabled={submitting}>
              {submitting ? '등록 중...' : '등록'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
