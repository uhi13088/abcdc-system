'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Clock, Download, CheckCircle } from 'lucide-react';

// Detect in-app browser
function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /KAKAOTALK|FBAN|FBAV|Instagram|Line|NAVER|DaumApps|SamsungBrowser.*CrossApp/i.test(ua);
}

// Open URL in external browser
function openInExternalBrowser(url: string): void {
  const isAndroid = /Android/i.test(navigator.userAgent);
  if (isAndroid) {
    const intentUrl = `intent://${url.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`;
    const link = document.createElement('a');
    link.href = intentUrl;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => window.open(url, '_blank'), 1000);
  } else {
    window.open(url, '_blank');
  }
}

// Inline PWA Install Button for mobile app (more reliable than shared component)
function MobilePWAInstallButton() {
  const [isInstalled, setIsInstalled] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showSuccessNotification, setShowSuccessNotification] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isInApp, setIsInApp] = useState(false);
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
    setIsInApp(isInAppBrowser());

    // Check for auto-install trigger from URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const shouldAutoInstall = urlParams.get('pwa_install') === 'true';

    // Listen for install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);

      // Auto-trigger install if came from in-app browser redirect
      if (shouldAutoInstall && !isInAppBrowser()) {
        setTimeout(async () => {
          if ('prompt' in e) {
            (e as { prompt: () => Promise<void> }).prompt();
          }
          // Clean up URL parameter
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.delete('pwa_install');
          window.history.replaceState({}, '', newUrl.toString());
        }, 500);
      }
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Listen for app installed
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowSuccessNotification(true);
      setTimeout(() => setShowSuccessNotification(false), 3000);
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = () => {
    setShowConfirmDialog(true);
  };

  const handleConfirmInstall = async () => {
    setShowConfirmDialog(false);

    // If in-app browser, open in external browser with auto-install flag
    if (isInApp) {
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('pwa_install', 'true');
      openInExternalBrowser(currentUrl.toString());
      return;
    }

    if (deferredPrompt && 'prompt' in deferredPrompt) {
      await (deferredPrompt as { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }).prompt();
      const { outcome } = await (deferredPrompt as { userChoice: Promise<{ outcome: string }> }).userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setShowSuccessNotification(true);
        setTimeout(() => setShowSuccessNotification(false), 3000);
      }
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
          onClick={handleInstallClick}
          className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
        >
          <Download className="w-4 h-4" />
          앱 설치하기
        </button>
      )}

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowConfirmDialog(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Download className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">앱을 설치하시겠습니까?</h3>
              <p className="text-sm text-gray-500">
                {isInApp
                  ? '외부 브라우저에서 앱을 설치합니다.'
                  : '홈 화면에 앱 아이콘이 추가됩니다.'}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                아니오
              </button>
              <button
                onClick={handleConfirmInstall}
                className="flex-1 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
              >
                예
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Notification */}
      {showSuccessNotification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-green-500 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2 animate-slide-down">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">앱이 설치되었습니다!</span>
          </div>
        </div>
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
        @keyframes fade-in {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes slide-down {
          from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
        .animate-slide-down {
          animation: slide-down 0.3s ease-out;
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
