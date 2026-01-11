import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';
import { AppLayout } from '@/components/layout/app-layout';

export const metadata: Metadata = {
  title: 'ABC Staff - 관리자 대시보드',
  description: '직원 관리, 출퇴근, 급여, 스케줄 통합 관리 시스템',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Providers>
          <AppLayout>{children}</AppLayout>
        </Providers>
      </body>
    </html>
  );
}
