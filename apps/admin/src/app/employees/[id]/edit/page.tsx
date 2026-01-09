'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Header } from '@/components/layout/header';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  DatePicker,
  Alert,
  PageLoading,
  ButtonLoading,
} from '@/components/ui';
import { ArrowLeft, Save } from 'lucide-react';

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

const BANKS = [
  '국민은행',
  '신한은행',
  '우리은행',
  '하나은행',
  '농협은행',
  'IBK기업은행',
  '카카오뱅크',
  '토스뱅크',
  '케이뱅크',
  'SC제일은행',
  '씨티은행',
  '대구은행',
  '부산은행',
  '경남은행',
  '광주은행',
  '전북은행',
  '제주은행',
  '새마을금고',
  '신협',
  '우체국',
];

export default function EditEmployeePage() {
  const router = useRouter();
  const params = useParams();
  const employeeId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [stores, setStores] = useState<Store[]>([]);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    position: '',
    birthDate: undefined as Date | undefined,
    role: 'staff',
    status: 'ACTIVE',
    storeId: '',
    bankName: '',
    bankAccount: '',
    accountHolder: '',
  });

  useEffect(() => {
    fetchEmployee();
    fetchStores();
  }, [employeeId]);

  const fetchEmployee = async () => {
    try {
      const response = await fetch(`/api/users/${employeeId}`);
      if (response.ok) {
        const data = await response.json();
        setFormData({
          name: data.name || '',
          phone: data.phone || '',
          address: data.address || '',
          position: data.position || '',
          birthDate: data.birth_date ? new Date(data.birth_date) : undefined,
          role: data.role || 'staff',
          status: data.status || 'ACTIVE',
          storeId: data.store_id || '',
          bankName: data.bank_name || '',
          bankAccount: data.bank_account || '',
          accountHolder: data.account_holder || '',
        });
      } else {
        setError('직원 정보를 불러올 수 없습니다.');
      }
    } catch (err) {
      setError('직원 정보를 불러올 수 없습니다.');
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
    } catch (err) {
      console.error('Failed to fetch stores:', err);
    }
  };

  const handleSubmit = async () => {
    setError('');
    setSaving(true);

    try {
      const response = await fetch(`/api/users/${employeeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        router.push(`/employees/${employeeId}`);
      } else {
        const data = await response.json();
        setError(data.error || '저장에 실패했습니다.');
      }
    } catch (err) {
      setError('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoading />;

  return (
    <div>
      <Header title="직원 정보 수정" />

      <div className="p-6">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            돌아가기
          </Button>
        </div>

        <div className="max-w-2xl mx-auto">
          {error && (
            <Alert variant="error" className="mb-6">
              {error}
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle>기본 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label required>이름</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>전화번호</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="010-1234-5678"
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label>주소</Label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>생년월일</Label>
                  <DatePicker
                    value={formData.birthDate}
                    onChange={(date) => setFormData({ ...formData, birthDate: date })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>직책</Label>
                  <Input
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>역할</Label>
                  <Select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    options={Object.entries(roleLabels).map(([value, label]) => ({
                      value,
                      label,
                    }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>상태</Label>
                  <Select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    options={[
                      { value: 'ACTIVE', label: '활성' },
                      { value: 'PENDING', label: '대기' },
                      { value: 'INACTIVE', label: '비활성' },
                      { value: 'SUSPENDED', label: '정지' },
                    ]}
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label>매장</Label>
                <Select
                  value={formData.storeId}
                  onChange={(e) => setFormData({ ...formData, storeId: e.target.value })}
                  options={[
                    { value: '', label: '매장 선택' },
                    ...stores.map((s) => ({ value: s.id, label: s.name })),
                  ]}
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>급여 계좌 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>은행</Label>
                <Select
                  value={formData.bankName}
                  onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                  options={[
                    { value: '', label: '은행 선택' },
                    ...BANKS.map((bank) => ({ value: bank, label: bank })),
                  ]}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>계좌번호</Label>
                <Input
                  value={formData.bankAccount}
                  onChange={(e) => setFormData({ ...formData, bankAccount: e.target.value })}
                  placeholder="'-' 없이 입력"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>예금주</Label>
                <Input
                  value={formData.accountHolder}
                  onChange={(e) => setFormData({ ...formData, accountHolder: e.target.value })}
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>

          <div className="mt-6 flex justify-end gap-4">
            <Button variant="outline" onClick={() => router.back()}>
              취소
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? <ButtonLoading /> : <Save className="h-4 w-4 mr-2" />}
              저장
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
