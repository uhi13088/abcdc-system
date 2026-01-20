'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Label } from '@/components/ui/label';

// Daum Postcode API 타입 정의
declare global {
  interface Window {
    daum: {
      Postcode: new (config: {
        oncomplete: (data: DaumPostcodeData) => void;
        onclose?: () => void;
      }) => { open: () => void };
    };
  }
}

interface DaumPostcodeData {
  address: string;
  addressType: string;
  bname: string;
  buildingName: string;
  zonecode: string;
  roadAddress: string;
  jibunAddress: string;
  autoRoadAddress: string;
  autoJibunAddress: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    phone: '',
    ssn1: '',
    ssn2: '',
    zonecode: '',
    address: '',
    addressDetail: '',
    // 회사 정보 (선택)
    companyName: '',
    businessNumber: '',
    companyZonecode: '',
    companyAddress: '',
    companyAddressDetail: '',
    companyPhone: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  // Daum Postcode 스크립트 로드
  useEffect(() => {
    const script = document.createElement('script');
    script.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
    script.async = true;
    script.onload = () => setScriptLoaded(true);
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  // 주소 검색 (개인)
  const handleAddressSearch = () => {
    if (!scriptLoaded || !window.daum) {
      alert('주소 검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    new window.daum.Postcode({
      oncomplete: (data: DaumPostcodeData) => {
        const address = data.roadAddress || data.jibunAddress;
        setFormData(prev => ({
          ...prev,
          zonecode: data.zonecode,
          address: address,
        }));
      },
    }).open();
  };

  // 주소 검색 (회사)
  const handleCompanyAddressSearch = () => {
    if (!scriptLoaded || !window.daum) {
      alert('주소 검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    new window.daum.Postcode({
      oncomplete: (data: DaumPostcodeData) => {
        const address = data.roadAddress || data.jibunAddress;
        setFormData(prev => ({
          ...prev,
          companyZonecode: data.zonecode,
          companyAddress: address,
        }));
      },
    }).open();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    // 전화번호 자동 포맷팅
    if (name === 'phone' || name === 'companyPhone') {
      const cleaned = value.replace(/\D/g, '');
      let formatted = cleaned;
      if (cleaned.length >= 4 && cleaned.length < 8) {
        formatted = `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
      } else if (cleaned.length >= 8) {
        formatted = `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7, 11)}`;
      }
      setFormData(prev => ({ ...prev, [name]: formatted }));
      return;
    }

    // 사업자번호 자동 포맷팅 (000-00-00000)
    if (name === 'businessNumber') {
      const cleaned = value.replace(/\D/g, '').slice(0, 10);
      let formatted = cleaned;
      if (cleaned.length >= 4 && cleaned.length < 6) {
        formatted = `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
      } else if (cleaned.length >= 6) {
        formatted = `${cleaned.slice(0, 3)}-${cleaned.slice(3, 5)}-${cleaned.slice(5)}`;
      }
      setFormData(prev => ({ ...prev, [name]: formatted }));
      return;
    }

    // 주민번호 앞자리 (6자리)
    if (name === 'ssn1') {
      const cleaned = value.replace(/\D/g, '').slice(0, 6);
      setFormData(prev => ({ ...prev, [name]: cleaned }));
      return;
    }

    // 주민번호 뒷자리 (7자리)
    if (name === 'ssn2') {
      const cleaned = value.replace(/\D/g, '').slice(0, 7);
      setFormData(prev => ({ ...prev, [name]: cleaned }));
      return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // 비밀번호 유효성 검사
  const getPasswordStrength = (password: string) => {
    const checks = {
      length: password.length >= 8,
      letter: /[A-Za-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    };

    const passed = Object.values(checks).filter(Boolean).length;

    return { checks, passed, isValid: passed === 4 };
  };

  const passwordStrength = getPasswordStrength(formData.password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // 필수 필드 검증
    if (!formData.email || !formData.password || !formData.name || !formData.phone || !formData.address) {
      setError('이메일, 비밀번호, 이름, 전화번호, 주소는 필수입니다.');
      setLoading(false);
      return;
    }

    // 주민번호 검증
    if (!formData.ssn1 || !formData.ssn2 || formData.ssn1.length !== 6 || formData.ssn2.length !== 7) {
      setError('주민등록번호를 정확히 입력해주세요.');
      setLoading(false);
      return;
    }

    // 비밀번호 강도 검증
    if (!passwordStrength.isValid) {
      setError('비밀번호는 8자 이상, 영문, 숫자, 특수문자를 모두 포함해야 합니다.');
      setLoading(false);
      return;
    }

    // 비밀번호 확인
    if (formData.password !== formData.confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      setLoading(false);
      return;
    }

    try {
      const fullAddress = formData.addressDetail
        ? `(${formData.zonecode}) ${formData.address} ${formData.addressDetail}`
        : `(${formData.zonecode}) ${formData.address}`;

      const fullCompanyAddress = formData.companyAddress
        ? formData.companyAddressDetail
          ? `(${formData.companyZonecode}) ${formData.companyAddress} ${formData.companyAddressDetail}`
          : `(${formData.companyZonecode}) ${formData.companyAddress}`
        : null;

      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          name: formData.name,
          phone: formData.phone,
          ssn: `${formData.ssn1}-${formData.ssn2}`,
          address: fullAddress,
          // 회사 정보 (선택)
          companyName: formData.companyName || null,
          businessNumber: formData.businessNumber || null,
          companyAddress: fullCompanyAddress,
          companyPhone: formData.companyPhone || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || '회원가입에 실패했습니다.');
        setLoading(false);
        return;
      }

      setSuccess(true);

      setTimeout(() => {
        router.push('/auth/login');
      }, 2000);

    } catch (err) {
      setError('회원가입 중 오류가 발생했습니다.');
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="bg-green-50 border border-green-200 rounded-lg p-8">
            <div className="text-green-600 text-5xl mb-4">✓</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              회원가입 완료!
            </h2>
            <p className="text-gray-600">
              로그인 페이지로 이동합니다...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-lg w-full space-y-8">
        <div>
          <h1 className="text-center text-3xl font-bold text-gray-900">
            ABC Staff
          </h1>
          <h2 className="mt-2 text-center text-lg text-gray-600">
            관리자 회원가입
          </h2>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          {/* 개인 정보 섹션 */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 border-b pb-2">개인 정보</h3>

            {/* 이메일 */}
            <div>
              <Label htmlFor="email" required className="block text-gray-700">이메일</Label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                placeholder="admin@example.com"
              />
            </div>

            {/* 이름 */}
            <div>
              <Label htmlFor="name" required className="block text-gray-700">이름</Label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                required
                value={formData.name}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                placeholder="이름 입력"
              />
            </div>

            {/* 전화번호 */}
            <div>
              <Label htmlFor="phone" required className="block text-gray-700">전화번호</Label>
              <input
                id="phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                required
                value={formData.phone}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                placeholder="010-1234-5678"
              />
            </div>

            {/* 주민등록번호 */}
            <div>
              <Label required className="block text-gray-700">주민등록번호</Label>
              <div className="mt-1 flex items-center space-x-2">
                <input
                  name="ssn1"
                  type="text"
                  inputMode="numeric"
                  required
                  value={formData.ssn1}
                  onChange={handleChange}
                  className="block w-1/2 px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                  placeholder="앞 6자리"
                  maxLength={6}
                />
                <span className="text-gray-400">-</span>
                <div className="relative w-1/2">
                  <input
                    name="ssn2"
                    type="password"
                    inputMode="numeric"
                    required
                    value={formData.ssn2}
                    onChange={handleChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                    placeholder="뒤 7자리"
                    maxLength={7}
                  />
                </div>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                중복 가입 방지를 위해 주민등록번호를 수집합니다. 암호화하여 안전하게 보관됩니다.
              </p>
            </div>

            {/* 주소 */}
            <div>
              <Label required className="block text-gray-700">주소</Label>
              <div className="mt-1 flex space-x-2">
                <input
                  name="zonecode"
                  type="text"
                  value={formData.zonecode}
                  readOnly
                  className="block w-24 px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 text-gray-500 sm:text-sm"
                  placeholder="우편번호"
                />
                <button
                  type="button"
                  onClick={handleAddressSearch}
                  className="px-4 py-2 border border-primary text-primary rounded-md hover:bg-primary/5 text-sm font-medium"
                >
                  주소 검색
                </button>
              </div>
              <input
                name="address"
                type="text"
                value={formData.address}
                readOnly
                required
                className="mt-2 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 text-gray-700 sm:text-sm"
                placeholder="주소 검색을 클릭하세요"
              />
              <input
                name="addressDetail"
                type="text"
                value={formData.addressDetail}
                onChange={handleChange}
                className="mt-2 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                placeholder="상세주소 (동/호수)"
              />
            </div>
          </div>

          {/* 회사 정보 섹션 (선택) */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 border-b pb-2">
              회사 정보 <span className="text-sm font-normal text-gray-400">(선택)</span>
            </h3>

            {/* 회사명 */}
            <div>
              <label htmlFor="companyName" className="block text-sm font-medium text-gray-700">
                회사명
              </label>
              <input
                id="companyName"
                name="companyName"
                type="text"
                value={formData.companyName}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                placeholder="ABC 디저트"
              />
            </div>

            {/* 사업자번호 */}
            <div>
              <label htmlFor="businessNumber" className="block text-sm font-medium text-gray-700">
                사업자번호
              </label>
              <input
                id="businessNumber"
                name="businessNumber"
                type="text"
                value={formData.businessNumber}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                placeholder="000-00-00000"
                maxLength={12}
              />
            </div>

            {/* 회사 주소 */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                회사 주소
              </label>
              <div className="mt-1 flex space-x-2">
                <input
                  name="companyZonecode"
                  type="text"
                  value={formData.companyZonecode}
                  readOnly
                  className="block w-24 px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 text-gray-500 sm:text-sm"
                  placeholder="우편번호"
                />
                <button
                  type="button"
                  onClick={handleCompanyAddressSearch}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm font-medium"
                >
                  주소 검색
                </button>
              </div>
              <input
                name="companyAddress"
                type="text"
                value={formData.companyAddress}
                readOnly
                className="mt-2 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 text-gray-700 sm:text-sm"
                placeholder="주소 검색을 클릭하세요"
              />
              <input
                name="companyAddressDetail"
                type="text"
                value={formData.companyAddressDetail}
                onChange={handleChange}
                className="mt-2 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                placeholder="상세주소 (동/호수)"
              />
            </div>

            {/* 회사 전화번호 */}
            <div>
              <label htmlFor="companyPhone" className="block text-sm font-medium text-gray-700">
                회사 전화번호
              </label>
              <input
                id="companyPhone"
                name="companyPhone"
                type="tel"
                value={formData.companyPhone}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                placeholder="02-1234-5678"
              />
            </div>
          </div>

          {/* 비밀번호 섹션 */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 border-b pb-2">비밀번호 설정</h3>

            {/* 비밀번호 */}
            <div>
              <Label htmlFor="password" required className="block text-gray-700">비밀번호</Label>
              <div className="relative mt-1">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm pr-10"
                  placeholder="8자 이상, 영문+숫자+특수문자"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? '숨김' : '보기'}
                </button>
              </div>

              {/* 비밀번호 강도 표시 */}
              {formData.password && (
                <div className="mt-2 space-y-1">
                  <div className="flex space-x-1">
                    {[1, 2, 3, 4].map((level) => (
                      <div
                        key={level}
                        className={`h-1 flex-1 rounded ${
                          passwordStrength.passed >= level
                            ? passwordStrength.passed >= 3
                              ? 'bg-green-500'
                              : 'bg-yellow-500'
                            : 'bg-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="text-xs space-y-0.5">
                    <p className={passwordStrength.checks.length ? 'text-green-600' : 'text-gray-500'}>
                      {passwordStrength.checks.length ? '✓' : '○'} 8자 이상
                    </p>
                    <p className={passwordStrength.checks.letter ? 'text-green-600' : 'text-gray-500'}>
                      {passwordStrength.checks.letter ? '✓' : '○'} 영문 포함
                    </p>
                    <p className={passwordStrength.checks.number ? 'text-green-600' : 'text-gray-500'}>
                      {passwordStrength.checks.number ? '✓' : '○'} 숫자 포함
                    </p>
                    <p className={passwordStrength.checks.special ? 'text-green-600' : 'text-gray-500'}>
                      {passwordStrength.checks.special ? '✓' : '○'} 특수문자 포함 (!@#$%^&* 등)
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* 비밀번호 확인 */}
            <div>
              <Label htmlFor="confirmPassword" required className="block text-gray-700">비밀번호 확인</Label>
              <div className="relative mt-1">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className={`block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm pr-10 ${
                    formData.confirmPassword && formData.password !== formData.confirmPassword
                      ? 'border-red-300'
                      : 'border-gray-300'
                  }`}
                  placeholder="비밀번호 재입력"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? '숨김' : '보기'}
                </button>
              </div>
              {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                <p className="mt-1 text-xs text-red-500">비밀번호가 일치하지 않습니다.</p>
              )}
              {formData.confirmPassword && formData.password === formData.confirmPassword && (
                <p className="mt-1 text-xs text-green-600">✓ 비밀번호가 일치합니다.</p>
              )}
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading || !passwordStrength.isValid}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '가입 중...' : '회원가입'}
            </button>
          </div>
        </form>

        <div className="text-center">
          <p className="text-sm text-gray-600">
            이미 계정이 있으신가요?{' '}
            <Link
              href="/auth/login"
              className="font-medium text-primary hover:text-primary/90"
            >
              로그인
            </Link>
          </p>
        </div>

        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-800">
            <strong>안내:</strong> 관리자로 가입 후, 슈퍼 관리자 권한이 필요하시면
            Supabase 대시보드에서 users 테이블의 role을 &apos;super_admin&apos;으로 변경하세요.
          </p>
        </div>
      </div>
    </div>
  );
}
