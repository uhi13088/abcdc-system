'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
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
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui';
import { ArrowLeft, Edit, Mail, Phone, MapPin, Building, Calendar, FileText } from 'lucide-react';

interface EmployeeDetail {
  id: string;
  email: string;
  name: string;
  role: string;
  phone: string;
  address: string;
  position: string;
  birth_date: string;
  status: string;
  bank_name: string;
  bank_account: string;
  account_holder: string;
  created_at: string;
  last_login_at: string;
  stores: { id: string; name: string; address: string } | null;
  brands: { id: string; name: string } | null;
  companies: { id: string; name: string } | null;
  teams: { id: string; name: string } | null;
}

interface Contract {
  id: string;
  contract_number: string;
  contract_type: string;
  start_date: string;
  end_date: string | null;
  status: string;
}

const roleLabels: Record<string, string> = {
  super_admin: '플랫폼 관리자',
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

export default function EmployeeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const employeeId = params.id as string;

  const [employee, setEmployee] = useState<EmployeeDetail | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchEmployee();
    fetchContracts();
  }, [employeeId]);

  const fetchEmployee = async () => {
    try {
      const response = await fetch(`/api/users/${employeeId}`);
      if (response.ok) {
        const data = await response.json();
        setEmployee(data);
      } else {
        setError('직원 정보를 불러올 수 없습니다.');
      }
    } catch (err) {
      setError('직원 정보를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  const fetchContracts = async () => {
    try {
      const response = await fetch(`/api/contracts?staffId=${employeeId}`);
      if (response.ok) {
        const data = await response.json();
        setContracts(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch contracts:', err);
    }
  };

  if (loading) return <PageLoading />;

  if (error || !employee) {
    return (
      <div>
        <Header title="직원 상세" />
        <div className="p-6">
          <Alert variant="error">{error || '직원을 찾을 수 없습니다.'}</Alert>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header title="직원 상세" />

      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            목록으로
          </Button>
          <Link href={`/employees/${employeeId}/edit`}>
            <Button>
              <Edit className="h-4 w-4 mr-2" />
              수정
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Card */}
          <Card>
            <CardContent className="pt-6">
              <div className="text-center mb-6">
                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-primary">
                    {employee.name?.charAt(0)}
                  </span>
                </div>
                <h2 className="text-xl font-semibold">{employee.name}</h2>
                <p className="text-gray-500">{employee.position || '-'}</p>
                <div className="flex justify-center gap-2 mt-2">
                  <Badge variant={statusMap[employee.status]?.variant}>
                    {statusMap[employee.status]?.label}
                  </Badge>
                  <Badge variant="secondary">
                    {roleLabels[employee.role] || employee.role}
                  </Badge>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center text-sm">
                  <Mail className="h-4 w-4 mr-3 text-gray-400" />
                  <span>{employee.email}</span>
                </div>
                {employee.phone && (
                  <div className="flex items-center text-sm">
                    <Phone className="h-4 w-4 mr-3 text-gray-400" />
                    <span>{employee.phone}</span>
                  </div>
                )}
                {employee.address && (
                  <div className="flex items-center text-sm">
                    <MapPin className="h-4 w-4 mr-3 text-gray-400" />
                    <span>{employee.address}</span>
                  </div>
                )}
                <div className="flex items-center text-sm">
                  <Building className="h-4 w-4 mr-3 text-gray-400" />
                  <span>
                    {employee.stores?.name || '-'}
                    {employee.brands?.name && ` (${employee.brands.name})`}
                  </span>
                </div>
                {employee.birth_date && (
                  <div className="flex items-center text-sm">
                    <Calendar className="h-4 w-4 mr-3 text-gray-400" />
                    <span>{new Date(employee.birth_date).toLocaleDateString('ko-KR')}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Detail Tabs */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="info">
              <TabsList>
                <TabsTrigger value="info">기본 정보</TabsTrigger>
                <TabsTrigger value="contracts">계약 내역</TabsTrigger>
                <TabsTrigger value="bank">급여 정보</TabsTrigger>
              </TabsList>

              <TabsContent value="info">
                <Card>
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <p className="text-sm text-gray-500">회사</p>
                        <p className="font-medium">{employee.companies?.name || '-'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">브랜드</p>
                        <p className="font-medium">{employee.brands?.name || '-'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">매장</p>
                        <p className="font-medium">{employee.stores?.name || '-'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">팀</p>
                        <p className="font-medium">{employee.teams?.name || '-'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">등록일</p>
                        <p className="font-medium">
                          {new Date(employee.created_at).toLocaleDateString('ko-KR')}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">최근 로그인</p>
                        <p className="font-medium">
                          {employee.last_login_at
                            ? new Date(employee.last_login_at).toLocaleString('ko-KR')
                            : '-'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="contracts">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg">계약 내역</CardTitle>
                    <Link href={`/contracts/new?staffId=${employeeId}`}>
                      <Button size="sm">
                        <FileText className="h-4 w-4 mr-2" />
                        계약서 작성
                      </Button>
                    </Link>
                  </CardHeader>
                  <CardContent>
                    {contracts.length === 0 ? (
                      <p className="text-center text-gray-500 py-8">
                        계약 내역이 없습니다.
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>계약번호</TableHead>
                            <TableHead>유형</TableHead>
                            <TableHead>기간</TableHead>
                            <TableHead>상태</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {contracts.map((contract) => (
                            <TableRow key={contract.id}>
                              <TableCell>
                                <Link
                                  href={`/contracts/${contract.id}`}
                                  className="text-primary hover:underline"
                                >
                                  {contract.contract_number}
                                </Link>
                              </TableCell>
                              <TableCell>{contract.contract_type}</TableCell>
                              <TableCell>
                                {new Date(contract.start_date).toLocaleDateString('ko-KR')}
                                {contract.end_date &&
                                  ` ~ ${new Date(contract.end_date).toLocaleDateString('ko-KR')}`}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    contract.status === 'SIGNED'
                                      ? 'success'
                                      : contract.status === 'DRAFT'
                                      ? 'default'
                                      : 'info'
                                  }
                                >
                                  {contract.status === 'SIGNED'
                                    ? '서명완료'
                                    : contract.status === 'DRAFT'
                                    ? '초안'
                                    : contract.status === 'SENT'
                                    ? '발송됨'
                                    : contract.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="bank">
                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-gray-500">은행명</p>
                        <p className="font-medium">{employee.bank_name || '-'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">계좌번호</p>
                        <p className="font-medium">{employee.bank_account || '-'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">예금주</p>
                        <p className="font-medium">{employee.account_holder || '-'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
