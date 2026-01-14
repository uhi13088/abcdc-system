'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Script from 'next/script';
import { Button, Input, Select, Label, Alert } from '@/components/ui';
import { Check, Building2, MapPin, Clock, DollarSign, Smartphone, Search, Briefcase } from 'lucide-react';

// 다음 주소검색 타입 정의
declare global {
  interface Window {
    daum: {
      Postcode: new (options: {
        oncomplete: (data: DaumPostcodeData) => void;
        onclose?: () => void;
      }) => { open: () => void };
    };
  }
}

interface DaumPostcodeData {
  zonecode: string;
  address: string;
  addressType: string;
  bname: string;
  buildingName: string;
  apartment: string;
  jibunAddress: string;
  roadAddress: string;
}

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
  const [postcodeLoaded, setPostcodeLoaded] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    passwordConfirm: '',
    birthDate: '',
    ssnLast: '',
    zonecode: '',
    address: '',
    addressDetail: '',
    emergencyName: '',
    emergencyPhone: '',
    emergencyRelationship: '',
    bankName: '',
    bankAccount: '',
    bankHolder: '',
    vehicleNumber: '',
    agreePrivacy: false,
  });

  useEffect(() => {
    const fetchInvitation = async () => {
      try {
        const response = await fetch(`/api/invite/${token}`);
        const result = await response.json();

        if (response.ok) {
          setInvitation(result.data);
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

  const openAddressSearch = () => {
    if (!postcodeLoaded || !window.daum) {
      alert('주소 검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    new window.daum.Postcode({
      oncomplete: (data: DaumPostcodeData) => {
        // 도로명 주소 우선, 없으면 지번 주소
        const fullAddress = data.roadAddress || data.jibunAddress;

        setFormData(prev => ({
          ...prev,
          zonecode: data.zonecode,
          address: fullAddress,
        }));
      },
    }).open();
  };

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

    if (!formData.birthDate) {
      setError('생년월일을 입력해주세요.');
      return;
    }

    if (!formData.ssnLast || formData.ssnLast.length !== 7) {
      setError('주민등록번호 뒷자리 7자리를 입력해주세요.');
      return;
    }

    if (!formData.address) {
      setError('주소를 검색하여 입력해주세요.');
      return;
    }

    if (!formData.addressDetail) {
      setError('상세주소를 입력해주세요.');
      return;
    }

    if (!formData.emergencyPhone) {
      setError('비상연락처 전화번호를 입력해주세요.');
      return;
    }

    if (!formData.emergencyRelationship) {
      setError('비상연락처 관계를 입력해주세요.');
      return;
    }

    if (!formData.bankName) {
      setError('은행을 선택해주세요.');
      return;
    }

    if (!formData.bankAccount) {
      setError('계좌번호를 입력해주세요.');
      return;
    }

    if (!formData.bankHolder) {
      setError('예금주를 입력해주세요.');
      return;
    }

    if (!formData.agreePrivacy) {
      setError('개인정보 수집·이용에 동의해주세요.');
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
          birthDate: formData.birthDate,
          ssnLast: formData.ssnLast,
          zonecode: formData.zonecode,
          address: formData.address,
          addressDetail: formData.addressDetail,
          emergencyContact: {
            name: formData.emergencyName || undefined,
            phone: formData.emergencyPhone,
            relationship: formData.emergencyRelationship,
          },
          bankName: formData.bankName,
          bankAccount: formData.bankAccount,
          bankHolder: formData.bankHolder,
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
    <>
      {/* 다음 주소검색 API 로드 */}
      <Script
        src="//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"
        onLoad={() => setPostcodeLoaded(true)}
        strategy="lazyOnload"
      />

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
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-blue-600" />
                <span>
                  {formatWorkDays(invitation?.work_days || [])} 근무
                </span>
              </div>
              {invitation?.position && (
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-blue-600" />
                  <span>{invitation.position}</span>
                </div>
              )}
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
                  <Input value={invitation?.name || ''} disabled className="mt-1 bg-gray-100 cursor-not-allowed" />
                </div>
                <div>
                  <Label>전화번호</Label>
                  <Input value={invitation?.phone || ''} disabled className="mt-1 bg-gray-100 cursor-not-allowed" />
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
                  <Label required>생년월일</Label>
                  <Input
                    type="date"
                    value={formData.birthDate}
                    onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                    className="mt-1"
                    required
                  />
                </div>
                <div>
                  <Label required>주민등록번호 뒷자리</Label>
                  <Input
                    type="password"
                    maxLength={7}
                    value={formData.ssnLast}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 7);
                      setFormData({ ...formData, ssnLast: value });
                    }}
                    placeholder="7자리 숫자"
                    className="mt-1"
                    required
                  />
                </div>
              </div>
              <div>
                <Label required>주소</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={formData.zonecode ? `[${formData.zonecode}] ${formData.address}` : formData.address}
                    placeholder="주소 검색 버튼을 클릭하세요"
                    className="flex-1 bg-gray-50 cursor-not-allowed"
                    readOnly
                    required
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={openAddressSearch}
                    className="shrink-0"
                  >
                    <Search className="h-4 w-4 mr-1" />
                    주소 검색
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-1">실제 우편물 수령이 가능한 주소를 검색해주세요</p>
              </div>
              <div>
                <Label required>상세주소</Label>
                <Input
                  value={formData.addressDetail}
                  onChange={(e) => setFormData({ ...formData, addressDetail: e.target.value })}
                  placeholder="동/호수, 건물명 등"
                  className="mt-1"
                  required
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
                  <Label required>비상연락처 (전화)</Label>
                  <Input
                    value={formData.emergencyPhone}
                    onChange={(e) => setFormData({ ...formData, emergencyPhone: e.target.value })}
                    placeholder="010-0000-0000"
                    className="mt-1"
                    required
                  />
                </div>
                <div>
                  <Label required>관계</Label>
                  <Input
                    value={formData.emergencyRelationship}
                    onChange={(e) => setFormData({ ...formData, emergencyRelationship: e.target.value })}
                    placeholder="부모, 배우자 등"
                    className="mt-1"
                    required
                  />
                </div>
              </div>
            </div>

            {/* 급여 정보 */}
            <div className="space-y-4 mb-8">
              <h3 className="font-semibold text-gray-900 border-b pb-2">급여 정보</h3>
              <div>
                <Label>{salaryTypeLabels[invitation?.salary_type || 'hourly']}</Label>
                <Input
                  type="text"
                  value={`${invitation?.salary_amount?.toLocaleString()}원`}
                  disabled
                  className="mt-1 bg-gray-100 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">초대 시 설정된 급여입니다. 변경이 필요하면 관리자에게 문의하세요.</p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label required>은행</Label>
                  <Select
                    value={formData.bankName}
                    onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                    options={bankOptions}
                    className="mt-1"
                    required
                  />
                </div>
                <div>
                  <Label required>계좌번호</Label>
                  <Input
                    value={formData.bankAccount}
                    onChange={(e) => setFormData({ ...formData, bankAccount: e.target.value.replace(/\D/g, '') })}
                    placeholder="숫자만 입력"
                    className="mt-1"
                    required
                  />
                </div>
                <div>
                  <Label required>예금주</Label>
                  <Input
                    value={formData.bankHolder}
                    onChange={(e) => setFormData({ ...formData, bankHolder: e.target.value })}
                    placeholder="예금주명"
                    className="mt-1"
                    required
                  />
                </div>
              </div>
            </div>

            {/* 추가 정보 */}
            <div className="space-y-4 mb-8">
              <h3 className="font-semibold text-gray-900 border-b pb-2">추가 정보 (선택)</h3>
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

            {/* 동의 및 제출 */}
            <div className="space-y-4">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.agreePrivacy}
                  onChange={(e) => setFormData({ ...formData, agreePrivacy: e.target.checked })}
                  className="mt-1"
                />
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
    </>
  );
}
