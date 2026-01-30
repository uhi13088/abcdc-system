'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Clock, Download, CheckCircle } from 'lucide-react';

// Inline PWA Install Button for mobile app (more reliable than shared component)
function MobilePWAInstallButton() {
  const [isInstalled, setIsInstalled] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);

  useEffect(() => {
    // Check if already installed (standalone mode)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    // Detect device
    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
    setIsAndroid(/Android/.test(ua));

    // Listen for install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt && 'prompt' in deferredPrompt) {
      (deferredPrompt as { prompt: () => Promise<void> }).prompt();
      setDeferredPrompt(null);
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      {isInstalled ? (
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle className="w-4 h-4" />
            앱이 이미 설치되어 있습니다
          </div>
          <button
            onClick={() => setShowGuide(true)}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            다시 설치하려면 클릭
          </button>
        </div>
      ) : (
        <button
          onClick={handleInstall}
          className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
        >
          <Download className="w-4 h-4" />
          앱 설치하기
        </button>
      )}

      {/* Install Guide Modal */}
      {showGuide && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-4" onClick={() => setShowGuide(false)}>
          <div
            className="bg-white rounded-t-2xl w-full max-w-md p-6 animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">{isInstalled ? '앱 재설치 방법' : '앱 설치 방법'}</h3>
              <button onClick={() => setShowGuide(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>

            {isInstalled && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                기존 앱을 삭제한 후 아래 방법으로 다시 설치하세요.
              </div>
            )}

            {isIOS ? (
              <ol className="space-y-3 text-sm text-gray-600">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-semibold">1</span>
                  <span>하단의 <strong>공유 버튼</strong> (□↑)을 탭하세요</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-semibold">2</span>
                  <span><strong>&quot;홈 화면에 추가&quot;</strong>를 선택하세요</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-semibold">3</span>
                  <span><strong>&quot;추가&quot;</strong>를 탭하면 완료!</span>
                </li>
              </ol>
            ) : isAndroid ? (
              <ol className="space-y-3 text-sm text-gray-600">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-xs font-semibold">1</span>
                  <span>주소창 오른쪽의 <strong>메뉴 버튼</strong> (⋮)을 탭하세요</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-xs font-semibold">2</span>
                  <span><strong>&quot;앱 설치&quot;</strong> 또는 <strong>&quot;홈 화면에 추가&quot;</strong>를 선택하세요</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-xs font-semibold">3</span>
                  <span><strong>&quot;설치&quot;</strong>를 탭하면 완료!</span>
                </li>
              </ol>
            ) : (
              <ol className="space-y-3 text-sm text-gray-600">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center text-xs font-semibold">1</span>
                  <span>브라우저 메뉴에서 <strong>&quot;앱 설치&quot;</strong>를 찾으세요</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center text-xs font-semibold">2</span>
                  <span>Chrome: 주소창의 설치 아이콘(⊕) 클릭</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center text-xs font-semibold">3</span>
                  <span><strong>&quot;설치&quot;</strong>를 클릭하면 완료!</span>
                </li>
              </ol>
            )}

            <button
              onClick={() => setShowGuide(false)}
              className="w-full mt-6 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
            >
              확인
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const supabase = createClient();

      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      router.push('/home');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-primary-50 to-white">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="mx-auto w-20 h-20 bg-primary rounded-2xl flex items-center justify-center mb-4">
            <Clock className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">PEANOTE</h1>
          <p className="text-gray-500 mt-1">직원용 모바일 앱</p>
          <div className="mt-4">
            <MobilePWAInstallButton />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 text-red-500 p-3 rounded-lg text-sm text-center">
              {error}
            </div>
          )}

          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="이메일"
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-center"
            />
          </div>

          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="비밀번호"
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-center"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>관리자에게 문의하여 계정을 받으세요</p>
        </div>
      </div>
    </div>
  );
}
