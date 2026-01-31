'use client';

import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

// Global cache for beforeinstallprompt event (to catch it before component mounts)
let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    globalDeferredPrompt = e as BeforeInstallPromptEvent;
  });
}

interface PWAInstallButtonProps {
  className?: string;
  onInstallSuccess?: () => void;
}

// Detect in-app browser
function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || navigator.vendor || '';
  // Common in-app browsers: KakaoTalk, Line, Facebook, Instagram, Samsung Browser in-app, etc.
  return /KAKAOTALK|FBAN|FBAV|Instagram|Line|NAVER|DaumApps|SamsungBrowser.*CrossApp/i.test(ua);
}

// Open URL in external browser (Chrome for Android)
function openInExternalBrowser(url: string): void {
  const isAndroid = /Android/i.test(navigator.userAgent);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  if (isAndroid) {
    // Try intent:// scheme to open in Chrome
    const intentUrl = `intent://${url.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`;

    // Create a hidden link and click it
    const link = document.createElement('a');
    link.href = intentUrl;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Fallback: try to open normally after a delay (in case intent didn't work)
    setTimeout(() => {
      window.open(url, '_blank');
    }, 1000);
  } else if (isIOS) {
    // iOS: Try to open in Safari using a workaround
    // Unfortunately, iOS doesn't support intent:// scheme
    // Copy URL and show instructions
    navigator.clipboard?.writeText(url);
    window.open(url, '_blank');
  } else {
    window.open(url, '_blank');
  }
}

export function PWAInstallButton({ className = '', onInstallSuccess }: PWAInstallButtonProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isInApp, setIsInApp] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showSuccessNotification, setShowSuccessNotification] = useState(false);

  // Auto-trigger install prompt
  const triggerInstallPrompt = useCallback(async () => {
    if (globalDeferredPrompt) {
      try {
        await globalDeferredPrompt.prompt();
        const { outcome } = await globalDeferredPrompt.userChoice;
        if (outcome === 'accepted') {
          globalDeferredPrompt = null;
          setDeferredPrompt(null);
          setShowSuccessNotification(true);
          onInstallSuccess?.();
          // Auto-hide success notification after 3 seconds
          setTimeout(() => setShowSuccessNotification(false), 3000);
        }
      } catch {
        // Prompt already shown or not available
      }
    }
  }, [onInstallSuccess]);

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

    // Check for auto-install trigger from URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const shouldAutoInstall = urlParams.get('pwa_install') === 'true';

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

    // Detect in-app browser
    const inApp = isInAppBrowser();
    setIsInApp(inApp);

    // Use globally cached prompt if available
    if (globalDeferredPrompt) {
      setDeferredPrompt(globalDeferredPrompt);

      // Auto-trigger install if came from in-app browser redirect
      if (shouldAutoInstall && !inApp) {
        // Small delay to ensure prompt is ready
        setTimeout(() => {
          triggerInstallPrompt();
          // Clean up URL parameter
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.delete('pwa_install');
          window.history.replaceState({}, '', newUrl.toString());
        }, 500);
      }
    }

    // Listen for beforeinstallprompt event (Android/Chrome)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      globalDeferredPrompt = e as BeforeInstallPromptEvent;
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      // Auto-trigger install if came from in-app browser redirect
      if (shouldAutoInstall && !inApp) {
        setTimeout(() => {
          triggerInstallPrompt();
          // Clean up URL parameter
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.delete('pwa_install');
          window.history.replaceState({}, '', newUrl.toString());
        }, 500);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      globalDeferredPrompt = null;
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [triggerInstallPrompt]);

  // Handle confirmation and proceed with install
  const handleConfirmInstall = async () => {
    setShowConfirmDialog(false);

    // If in-app browser, open in external browser with auto-install flag
    if (isInApp) {
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('pwa_install', 'true');
      openInExternalBrowser(currentUrl.toString());
      return;
    }

    // If we have the native prompt, use it
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        globalDeferredPrompt = null;
        setShowSuccessNotification(true);
        onInstallSuccess?.();
        setTimeout(() => setShowSuccessNotification(false), 3000);
      }
      return;
    }

    // Otherwise show manual installation guide
    setShowInstallGuide(true);
  };

  const handleInstallClick = async () => {
    // Show confirmation dialog first
    setShowConfirmDialog(true);
  };

  // Install Guide Modal (always rendered to allow showing from any state)
  const installGuideModal = showInstallGuide && (
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
          <h3 className="text-lg font-semibold">{isInstalled ? '앱 재설치 방법' : '앱 설치 방법'}</h3>
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

        {isInstalled && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
            기존 앱을 삭제한 후 아래 방법으로 다시 설치하세요.
          </div>
        )}

        {isIOS ? (
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
  );

  // Confirmation Dialog
  const confirmDialog = showConfirmDialog && (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={() => setShowConfirmDialog(false)}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        style={{
          animation: 'fadeIn 0.2s ease-out',
        }}
      >
        <style dangerouslySetInnerHTML={{
          __html: `
            @keyframes fadeIn {
              from { opacity: 0; transform: scale(0.95); }
              to { opacity: 1; transform: scale(1); }
            }
          `
        }} />
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
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
            className="flex-1 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors"
          >
            예
          </button>
        </div>
      </div>
    </div>
  );

  // Success Notification
  const successNotification = showSuccessNotification && (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
      <div
        className="bg-green-500 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2"
        style={{
          animation: 'slideDown 0.3s ease-out',
        }}
      >
        <style dangerouslySetInnerHTML={{
          __html: `
            @keyframes slideDown {
              from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
              to { opacity: 1; transform: translateX(-50%) translateY(0); }
            }
          `
        }} />
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
        <span className="font-medium">앱이 설치되었습니다!</span>
      </div>
    </div>
  );

  // Show different UI if already installed
  if (isInstalled) {
    return (
      <>
        <div className={`flex flex-col items-center gap-2 ${className}`}>
          <div className="flex items-center gap-2 text-sm text-green-600">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            앱이 이미 설치되어 있습니다
          </div>
          <button
            onClick={() => setShowInstallGuide(true)}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            다시 설치하려면 여기를 클릭하세요
          </button>
        </div>
        {installGuideModal}
        {successNotification}
      </>
    );
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
      {confirmDialog}
      {installGuideModal}
      {successNotification}
    </>
  );
}
