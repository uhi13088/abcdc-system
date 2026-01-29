'use client';

import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface PWAInstallButtonProps {
  className?: string;
}

export function PWAInstallButton({ className = '' }: PWAInstallButtonProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);

  useEffect(() => {
    // Check if already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Check if running inside PWA
    if ((window.navigator as { standalone?: boolean }).standalone === true) {
      setIsInstalled(true);
      return;
    }

    // Detect iOS (including iPad with desktop mode)
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(isIOSDevice);

    // Detect Android
    const isAndroidDevice = /Android/.test(navigator.userAgent);
    setIsAndroid(isAndroidDevice);

    // Detect mobile
    const isMobileDevice = isIOSDevice || isAndroidDevice || /webOS|BlackBerry|Opera Mini|IEMobile/.test(navigator.userAgent);
    setIsMobile(isMobileDevice);

    // Listen for beforeinstallprompt event (Android/Chrome)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for app installed event
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    // If we have the native prompt, use it
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
      return;
    }

    // Otherwise show manual installation guide
    setShowInstallGuide(true);
  };

  // Don't show if already installed
  if (isInstalled) {
    return null;
  }

  // Always show on mobile (iOS/Android), or on desktop if prompt is available
  const shouldShow = isMobile || deferredPrompt;
  if (!shouldShow) {
    return null;
  }

  return (
    <>
      <button
        onClick={handleInstallClick}
        className={`flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors ${className}`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        앱 설치하기
      </button>

      {/* Install Guide Modal */}
      {showInstallGuide && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-4">
          <div
            className="bg-white rounded-t-2xl w-full max-w-md p-6"
            style={{
              animation: 'slideUp 0.3s ease-out',
            }}
          >
            <style dangerouslySetInnerHTML={{
              __html: `
                @keyframes slideUp {
                  from { transform: translateY(100%); }
                  to { transform: translateY(0); }
                }
              `
            }} />
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">앱 설치 방법</h3>
              <button
                onClick={() => setShowInstallGuide(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {isIOS ? (
              // iOS 설치 가이드
              <ol className="space-y-4 text-sm text-gray-600">
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
              // Android 설치 가이드
              <ol className="space-y-4 text-sm text-gray-600">
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
              // 일반 브라우저 가이드
              <ol className="space-y-4 text-sm text-gray-600">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center text-xs font-semibold">1</span>
                  <span>브라우저 메뉴에서 <strong>&quot;앱 설치&quot;</strong> 또는 <strong>&quot;바로가기 만들기&quot;</strong>를 찾으세요</span>
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
              onClick={() => setShowInstallGuide(false)}
              className="w-full mt-6 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </>
  );
}
