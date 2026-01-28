'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { LoginSchema, PWAInstallButton } from '@abc/shared';
import type { Provider } from '@supabase/supabase-js';

// Demo accounts for development testing only
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';
const DEMO_ACCOUNTS = IS_DEVELOPMENT ? [
  { email: 'admin@demo.com', password: 'demo1234', role: '관리자' },
  { email: 'manager@demo.com', password: 'demo1234', role: '매장관리자' },
  { email: 'staff@demo.com', password: 'demo1234', role: '직원' },
] : [];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDemoAccounts, setShowDemoAccounts] = useState(false);

  // Load saved email on mount
  useEffect(() => {
    const savedEmail = localStorage.getItem('rememberedEmail');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Validate input
      const validation = LoginSchema.safeParse({ email, password });
      if (!validation.success) {
        setError(validation.error.errors[0].message);
        setLoading(false);
        return;
      }

      // Save or remove email based on remember me
      if (rememberMe) {
        localStorage.setItem('rememberedEmail', email);
      } else {
        localStorage.removeItem('rememberedEmail');
      }

      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        // 친절한 에러 메시지 매핑
        const errorMessages: Record<string, string> = {
          'Invalid login credentials': '이메일 또는 비밀번호가 올바르지 않습니다.',
          'Email not confirmed': '이메일 인증이 완료되지 않았습니다. 메일함을 확인해주세요.',
          'Invalid email or password': '이메일 또는 비밀번호가 올바르지 않습니다.',
          'User not found': '등록되지 않은 이메일입니다.',
          'Email rate limit exceeded': '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.',
          'Too many requests': '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
          'Network request failed': '네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.',
        };

        const friendlyMessage = errorMessages[authError.message] ||
          (authError.message.includes('password') ? '비밀번호가 올바르지 않습니다.' :
           authError.message.includes('email') ? '이메일이 올바르지 않습니다.' :
           authError.message.includes('rate') ? '잠시 후 다시 시도해주세요.' :
           '로그인에 실패했습니다. 다시 시도해주세요.');

        setError(friendlyMessage);
        setLoading(false);
        return;
      }

      // Save login history
      const loginHistory = JSON.parse(localStorage.getItem('loginHistory') || '[]');
      loginHistory.unshift({
        email,
        timestamp: new Date().toISOString(),
      });
      // Keep only last 10 entries
      localStorage.setItem('loginHistory', JSON.stringify(loginHistory.slice(0, 10)));

      router.push('/dashboard');
      router.refresh();
    } catch (_err) {
      setError('로그인 중 오류가 발생했습니다.');
      setLoading(false);
    }
  };

  const handleDemoLogin = (account: typeof DEMO_ACCOUNTS[0]) => {
    setEmail(account.email);
    setPassword(account.password);
    setShowDemoAccounts(false);
  };

  const clearLoginHistory = () => {
    localStorage.removeItem('loginHistory');
    localStorage.removeItem('rememberedEmail');
    setEmail('');
    setRememberMe(false);
    alert('로그인 기록이 삭제되었습니다.');
  };

  const enterDemoMode = () => {
    // Set demo mode cookie (expires in 24 hours)
    document.cookie = 'demo_mode=true; path=/; max-age=86400';
    router.push('/dashboard');
    router.refresh();
  };

  const handleOAuthLogin = async (provider: Provider) => {
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: provider === 'kakao' ? {
            prompt: 'login',
          } : undefined,
        },
      });

      if (oauthError) {
        setError(`${provider} 로그인에 실패했습니다.`);
        setLoading(false);
      }
    } catch (_err) {
      setError('소셜 로그인 중 오류가 발생했습니다.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h1 className="text-center text-3xl font-bold text-gray-900">
            PEANOTE
          </h1>
          <h2 className="mt-2 text-center text-lg text-gray-600">
            관리자 대시보드
          </h2>
          <div className="mt-4 flex justify-center">
            <PWAInstallButton />
          </div>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700"
              >
                이메일
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                placeholder="admin@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700"
              >
                비밀번호
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                placeholder="••••••••"
              />
            </div>
          </div>

          {/* Remember Me & Clear History */}
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                이메일 기억하기
              </label>
            </div>
            <button
              type="button"
              onClick={clearLoginHistory}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              로그인 기록 삭제
            </button>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </div>

          {/* OAuth 로그인 */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-gray-50 text-gray-500">간편 로그인</span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleOAuthLogin('google')}
                disabled={loading}
                className="w-full inline-flex justify-center items-center py-2.5 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Google
              </button>

              <button
                type="button"
                onClick={() => handleOAuthLogin('kakao')}
                disabled={loading}
                className="w-full inline-flex justify-center items-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-[#191919] bg-[#FEE500] hover:bg-[#FDD835] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path fill="#191919" d="M12 3C6.477 3 2 6.463 2 10.714c0 2.683 1.764 5.037 4.407 6.387-.138.49-.888 3.156-.916 3.363 0 0-.019.159.084.22.103.062.224.014.224.014.295-.041 3.421-2.235 3.96-2.612.735.103 1.494.157 2.241.157 5.523 0 10-3.463 10-7.529C22 6.463 17.523 3 12 3z"/>
                </svg>
                카카오
              </button>
            </div>
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-600">
              계정이 없으신가요?{' '}
              <Link
                href="/auth/register"
                className="font-medium text-primary hover:text-primary/90"
              >
                관리자 회원가입
              </Link>
            </p>
          </div>
        </form>

        {/* Demo Account Section - Only visible in development */}
        {IS_DEVELOPMENT && (
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-gray-50 text-gray-500">개발 테스트용</span>
              </div>
            </div>

            <button
              type="button"
              onClick={enterDemoMode}
              className="mt-4 w-full flex justify-center py-3 px-4 border-2 border-primary rounded-md shadow-sm text-sm font-bold text-primary bg-primary/5 hover:bg-primary/10 transition-colors"
            >
              🚀 데모 모드로 바로 입장
            </button>

            <button
              type="button"
              onClick={() => setShowDemoAccounts(!showDemoAccounts)}
              className="mt-2 w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              {showDemoAccounts ? '닫기' : '데모 계정 보기'}
            </button>

            {showDemoAccounts && (
              <div className="mt-3 space-y-2">
                {DEMO_ACCOUNTS.map((account) => (
                  <button
                    key={account.email}
                    type="button"
                    onClick={() => handleDemoLogin(account)}
                    className="w-full flex items-center justify-between px-4 py-3 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    <div className="text-left">
                      <p className="text-sm font-medium text-gray-900">{account.email}</p>
                      <p className="text-xs text-gray-500">비밀번호: {account.password}</p>
                    </div>
                    <span className="px-2 py-1 text-xs font-medium bg-primary/10 text-primary rounded">
                      {account.role}
                    </span>
                  </button>
                ))}
                <p className="text-xs text-center text-gray-400 mt-2">
                  * Supabase에 해당 계정이 등록되어 있어야 합니다
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
