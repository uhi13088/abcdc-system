'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    phone: '',
    ssn1: '', // 주민번호 앞자리
    ssn2: '', // 주민번호 뒷자리
    address: '',
    addressDetail: '',
    companyName: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    // 전화번호 자동 포맷팅
    if (name === 'phone') {
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
    if (!formData.email || !formData.password || !formData.name || !formData.phone) {
      setError('이메일, 비밀번호, 이름, 전화번호는 필수입니다.');
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
          address: formData.address,
          addressDetail: formData.addressDetail,
          companyName: formData.companyName || null,
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

          <div className="space-y-4">
            {/* 이메일 */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                이메일 <span className="text-red-500">*</span>
              </label>
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
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                이름 <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                required
                value={formData.name}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                placeholder="홍길동"
              />
            </div>

            {/* 전화번호 */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                전화번호 <span className="text-red-500">*</span>
              </label>
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
              <label className="block text-sm font-medium text-gray-700">
                주민등록번호 <span className="text-red-500">*</span>
              </label>
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
              <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                주소 <span className="text-gray-400">(선택)</span>
              </label>
              <input
                id="address"
                name="address"
                type="text"
                value={formData.address}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                placeholder="서울시 강남구 테헤란로 123"
              />
              <input
                id="addressDetail"
                name="addressDetail"
                type="text"
                value={formData.addressDetail}
                onChange={handleChange}
                className="mt-2 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                placeholder="상세주소 (동/호수)"
              />
            </div>

            {/* 회사명 */}
            <div>
              <label htmlFor="companyName" className="block text-sm font-medium text-gray-700">
                회사명 <span className="text-gray-400">(선택)</span>
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

            {/* 비밀번호 */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                비밀번호 <span className="text-red-500">*</span>
              </label>
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
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                비밀번호 확인 <span className="text-red-500">*</span>
              </label>
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
