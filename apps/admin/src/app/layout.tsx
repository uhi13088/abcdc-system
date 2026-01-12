import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';
import { Providers } from '@/components/providers';
import { AppLayout } from '@/components/layout/app-layout';

export const metadata: Metadata = {
  title: 'ABC Staff - 관리자 대시보드',
  description: '직원 관리, 출퇴근, 급여, 스케줄 통합 관리 시스템',
  manifest: '/manifest.json',
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#3b82f6',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body className="font-sans antialiased">
        <Providers>
          <AppLayout>{children}</AppLayout>
        </Providers>
        {/* Kakao SDK for sharing - optional */}
        {process.env.NEXT_PUBLIC_KAKAO_JS_KEY && (
          <>
            <Script
              src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.0/kakao.min.js"
              integrity="sha384-l+xbElFSnPZ2rOaPrU//2FF5B4LB8FiX5q4fXYTlfcG4PGpMkE1vcL7kNXI6Cci0"
              crossOrigin="anonymous"
              strategy="lazyOnload"
            />
            <Script id="kakao-init" strategy="lazyOnload">
              {`
                if (window.Kakao && !window.Kakao.isInitialized()) {
                  window.Kakao.init('${process.env.NEXT_PUBLIC_KAKAO_JS_KEY}');
                }
              `}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}
