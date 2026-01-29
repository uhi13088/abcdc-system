'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ShieldCheck } from 'lucide-react';
import type { Provider } from '@supabase/supabase-js';
import { PWAInstallButton } from '@abc/shared';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      if (!email || !password) {
        setError('이메일과 비밀번호를 입력해주세요.');
        setLoading(false);
        return;
      }

      // Save or remove email based on remember me
      if (rememberMe) {
        localStorage.setItem('rememberedEmail', email);
      } else {
        localStorage.removeItem('rememberedEmail');
      }

      const supabase = await createClient();
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(
          authError.message === 'Invalid login credentials'
            ? '이메일 또는 비밀번호가 올바르지 않습니다.'
            : authError.message
        );
        setLoading(false);
        return;
      }

      // Check HACCP access permission
      const { data: userData } = await supabase
        .from('users')
        .select('company_id, store_id, haccp_access, role')
        .eq('auth_id', authData.user.id)
        .single();

      if (!userData) {
        setError('사용자 정보를 찾을 수 없습니다.');
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      // Check if company has HACCP add-on enabled
      const { data: subscription } = await supabase
        .from('company_subscriptions')
        .select('haccp_addon_enabled')
        .eq('company_id', userData.company_id)
        .maybeSingle();

      if (!subscription?.haccp_addon_enabled) {
        setError('HACCP 애드온이 활성화되지 않았습니다. 관리자에게 문의하세요.');
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      // Check if user has HACCP access
      // Access granted if:
      // 1. User is admin (super_admin, company_admin, manager)
      // 2. User's store has haccp_enabled = true
      // 3. User has individual haccp_access = true (override)
      const isAdmin = ['super_admin', 'company_admin', 'manager'].includes(userData.role);

      let hasStoreAccess = false;
      if (userData.store_id) {
        const { data: storeData } = await supabase
          .from('stores')
          .select('haccp_enabled')
          .eq('id', userData.store_id)
          .single();
        hasStoreAccess = storeData?.haccp_enabled || false;
      }

      if (!isAdmin && !hasStoreAccess && !userData.haccp_access) {
        setError('HACCP 앱 접근 권한이 없습니다. HACCP 매장에 배정되어 있어야 합니다.');
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('로그인 중 오류가 발생했습니다.');
      setLoading(false);
    }
  };

  const clearLoginHistory = () => {
    localStorage.removeItem('loginHistory');
    localStorage.removeItem('rememberedEmail');
    setEmail('');
    setRememberMe(false);
  };

  const handleOAuthLogin = async (provider: Provider) => {
    setError(null);
    setLoading(true);

    try {
      const supabase = await createClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (oauthError) {
        setError(`${provider} 로그인에 실패했습니다.`);
        setLoading(false);
      }
    } catch {
      setError('소셜 로그인 중 오류가 발생했습니다.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-100 px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
            <ShieldCheck className="w-10 h-10 text-white" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">PEANOTE HACCP</h2>
          <p className="mt-2 text-sm text-gray-600">
            식품 안전 관리 시스템
          </p>
          <div className="mt-4">
            <PWAInstallButton />
          </div>
        </div>

        <form className="mt-8 space-y-6 bg-white p-8 rounded-xl shadow-lg" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                placeholder="email@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                placeholder="비밀번호 입력"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                이메일 기억하기
              </label>
            </div>

            <button
              type="button"
              onClick={clearLoginHistory}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              로그인 기록 삭제
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>

          {/* OAuth 로그인 */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">간편 로그인</span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleOAuthLogin('google')}
                disabled={loading}
                className="w-full inline-flex justify-center items-center py-2.5 px-4 border border-gray-300 rounded-lg shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                className="w-full inline-flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-[#191919] bg-[#FEE500] hover:bg-[#FDD835] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path fill="#191919" d="M12 3C6.477 3 2 6.463 2 10.714c0 2.683 1.764 5.037 4.407 6.387-.138.49-.888 3.156-.916 3.363 0 0-.019.159.084.22.103.062.224.014.224.014.295-.041 3.421-2.235 3.96-2.612.735.103 1.494.157 2.241.157 5.523 0 10-3.463 10-7.529C22 6.463 17.523 3 12 3z"/>
                </svg>
                카카오
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
