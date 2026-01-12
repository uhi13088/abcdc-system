'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button, Input, Select, Label, Alert } from '@/components/ui';
import { Check, Building2, MapPin, Clock, DollarSign, Smartphone, Download } from 'lucide-react';

interface InvitationData {
  id: string;
  name: string;
  phone: string;
  role: string;
  position: string | null;
  salary_type: string;
  salary_amount: number;
  work_days: number[];
  work_start_time: string;
  work_end_time: string;
  break_minutes: number;
  required_documents: string[];
  custom_fields: { name: string; type: string; required: boolean }[];
  stores: { id: string; name: string; brands: { id: string; name: string } | null } | null;
  companies: { id: string; name: string } | null;
}

const salaryTypeLabels: Record<string, string> = {
  hourly: '시급',
  daily: '일급',
  monthly: '월급',
};

const dayLabels = ['일', '월', '화', '수', '목', '금', '토'];

const bankOptions = [
  { value: '', label: '은행 선택' },
  { value: '신한은행', label: '신한은행' },
  { value: '국민은행', label: '국민은행' },
  { value: '우리은행', label: '우리은행' },
  { value: '하나은행', label: '하나은행' },
  { value: '농협은행', label: '농협은행' },
  { value: '기업은행', label: '기업은행' },
  { value: '카카오뱅크', label: '카카오뱅크' },
  { value: '토스뱅크', label: '토스뱅크' },
  { value: '케이뱅크', label: '케이뱅크' },
];

export default function InviteAcceptPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    passwordConfirm: '',
    birthDate: '',
    ssnLast: '',
    address: '',
    addressDetail: '',
    emergencyName: '',
    emergencyPhone: '',
    emergencyRelationship: '',
    bankName: '',
    bankAccount: '',
    bankHolder: '',
    salaryAmount: 0,
    position: '',
    vehicleNumber: '',
  });

  useEffect(() => {
    const fetchInvitation = async () => {
      try {
        const response = await fetch(`/api/invite/${token}`);
        const result = await response.json();

        if (response.ok) {
          setInvitation(result.data);
          setFormData((prev) => ({
            ...prev,
            salaryAmount: result.data.salary_amount,
            position: result.data.position || '',
          }));
        } else {
          setError(result.error || '초대 정보를 불러올 수 없습니다.');
        }
      } catch (err) {
        setError('초대 정보를 불러올 수 없습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchInvitation();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 유효성 검사
    if (formData.password !== formData.passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    if (formData.password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`/api/invite/${token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          birthDate: formData.birthDate || undefined,
          ssnLast: formData.ssnLast || undefined,
          address: formData.address || undefined,
          addressDetail: formData.addressDetail || undefined,
          emergencyContact: formData.emergencyName
            ? {
                name: formData.emergencyName,
                phone: formData.emergencyPhone,
                relationship: formData.emergencyRelationship,
              }
            : undefined,
          bankName: formData.bankName || undefined,
          bankAccount: formData.bankAccount || undefined,
          bankHolder: formData.bankHolder || undefined,
          salaryAmount: formData.salaryAmount,
          position: formData.position || undefined,
          vehicleNumber: formData.vehicleNumber || undefined,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setSuccess(true);
      } else {
        setError(result.error || '가입에 실패했습니다.');
      }
    } catch (err) {
      setError('가입에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatWorkDays = (days: number[]) => {
    return days.map((d) => dayLabels[d]).join(', ');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error && !invitation) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-sm p-8 text-center max-w-md w-full">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">❌</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">초대 링크 오류</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-sm p-8 text-center max-w-md w-full">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">가입이 완료되었습니다!</h1>
          <p className="text-gray-600 mb-4">
            {invitation?.stores?.name}의 직원으로 등록되었습니다.
            <br />
            관리자가 계약서를 보내드릴 예정입니다.
          </p>

          {/* 앱 설치 안내 */}
          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-center gap-2 text-blue-700 mb-3">
              <Smartphone className="h-5 w-5" />
              <span className="font-semibold">앱 설치 안내</span>
            </div>
            <p className="text-sm text-blue-600 mb-4">
              출퇴근 기록, 급여 확인, 스케줄 관리를 위해
              <br />
              <strong>ABC Staff 앱</strong>을 설치해주세요!
            </p>
            <div className="flex flex-col gap-2">
              <a
                href="https://apps.apple.com/app/abc-staff"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-black text-white rounded-lg py-3 px-4 hover:bg-gray-800 transition-colors"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
                <span>App Store에서 다운로드</span>
              </a>
              <a
                href="https://play.google.com/store/apps/details?id=com.abc.staff"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-green-600 text-white rounded-lg py-3 px-4 hover:bg-green-700 transition-colors"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z"/>
                </svg>
                <span>Google Play에서 다운로드</span>
              </a>
            </div>
          </div>

          <Button onClick={() => router.push('/auth/login')} variant="outline" className="w-full">
            웹에서 로그인하기
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* 헤더 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6 text-center">
          <div className="flex items-center justify-center gap-2 text-blue-600 mb-2">
            <Building2 className="h-5 w-5" />
            <span className="font-medium">{invitation?.companies?.name}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            {invitation?.stores?.name}
          </h1>
          <p className="text-gray-600">직원 등록</p>
        </div>

        {/* 근무 조건 요약 */}
        <div className="bg-blue-50 rounded-lg p-4 mb-6">
          <h3 className="font-medium text-blue-900 mb-3">근무 조건</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-blue-600" />
              <span>
                {salaryTypeLabels[invitation?.salary_type || 'hourly']}{' '}
                {invitation?.salary_amount?.toLocaleString()}원
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600" />
              <span>
                {invitation?.work_start_time} ~ {invitation?.work_end_time}
              </span>
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-blue-600" />
              <span>
                {formatWorkDays(invitation?.work_days || [])} 근무
              </span>
            </div>
          </div>
        </div>

        {/* 가입 폼 */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm p-6">
          {error && <Alert variant="error" className="mb-6">{error}</Alert>}

          {/* 계정 정보 */}
          <div className="space-y-4 mb-8">
            <h3 className="font-semibold text-gray-900 border-b pb-2">계정 정보</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>이름</Label>
                <Input value={invitation?.name || ''} disabled className="mt-1 bg-gray-50" />
              </div>
              <div>
                <Label>전화번호</Label>
                <Input value={invitation?.phone || ''} disabled className="mt-1 bg-gray-50" />
              </div>
            </div>
            <div>
              <Label required>이메일</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@example.com"
                className="mt-1"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label required>비밀번호</Label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="8자 이상"
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <Label required>비밀번호 확인</Label>
                <Input
                  type="password"
                  value={formData.passwordConfirm}
                  onChange={(e) => setFormData({ ...formData, passwordConfirm: e.target.value })}
                  placeholder="비밀번호 재입력"
                  className="mt-1"
                  required
                />
              </div>
            </div>
          </div>

          {/* 인적 사항 */}
          <div className="space-y-4 mb-8">
            <h3 className="font-semibold text-gray-900 border-b pb-2">인적 사항</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>생년월일</Label>
                <Input
                  type="date"
                  value={formData.birthDate}
                  onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>주민등록번호 뒷자리</Label>
                <Input
                  type="password"
                  maxLength={7}
                  value={formData.ssnLast}
                  onChange={(e) => setFormData({ ...formData, ssnLast: e.target.value })}
                  placeholder="●●●●●●●"
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label>주소</Label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="주소를 입력하세요"
                className="mt-1"
              />
            </div>
            <div>
              <Label>상세주소</Label>
              <Input
                value={formData.addressDetail}
                onChange={(e) => setFormData({ ...formData, addressDetail: e.target.value })}
                placeholder="상세주소"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>비상연락처 (이름)</Label>
                <Input
                  value={formData.emergencyName}
                  onChange={(e) => setFormData({ ...formData, emergencyName: e.target.value })}
                  placeholder="홍길순"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>비상연락처 (전화)</Label>
                <Input
                  value={formData.emergencyPhone}
                  onChange={(e) => setFormData({ ...formData, emergencyPhone: e.target.value })}
                  placeholder="010-0000-0000"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>관계</Label>
                <Input
                  value={formData.emergencyRelationship}
                  onChange={(e) => setFormData({ ...formData, emergencyRelationship: e.target.value })}
                  placeholder="부모, 배우자 등"
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          {/* 급여 정보 */}
          <div className="space-y-4 mb-8">
            <h3 className="font-semibold text-gray-900 border-b pb-2">급여 정보</h3>
            <div>
              <Label>시급 (확인)</Label>
              <Input
                type="number"
                value={formData.salaryAmount}
                onChange={(e) => setFormData({ ...formData, salaryAmount: parseInt(e.target.value) || 0 })}
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">합의된 시급을 입력해주세요</p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>은행</Label>
                <Select
                  value={formData.bankName}
                  onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                  options={bankOptions}
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
                  value={formData.bankHolder}
                  onChange={(e) => setFormData({ ...formData, bankHolder: e.target.value })}
                  placeholder="예금주명"
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          {/* 추가 정보 */}
          <div className="space-y-4 mb-8">
            <h3 className="font-semibold text-gray-900 border-b pb-2">추가 정보 (선택)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>직책/포지션</Label>
                <Input
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  placeholder="홀서빙, 주방보조 등"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>차량번호</Label>
                <Input
                  value={formData.vehicleNumber}
                  onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value })}
                  placeholder="12가 3456"
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          {/* 동의 및 제출 */}
          <div className="space-y-4">
            <label className="flex items-start gap-2">
              <input type="checkbox" required className="mt-1" />
              <span className="text-sm text-gray-600">
                개인정보 수집·이용에 동의합니다. 입력한 정보는 근로계약서 작성에 사용됩니다.
              </span>
            </label>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? '처리 중...' : '가입 완료'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
