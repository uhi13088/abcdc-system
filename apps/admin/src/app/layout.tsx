import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

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
      <body className={inter.variable}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
