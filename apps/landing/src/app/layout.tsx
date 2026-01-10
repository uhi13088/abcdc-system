import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ABC Staff System - 스마트 인력 관리 솔루션',
  description: '식품 프랜차이즈를 위한 올인원 직원 관리, HACCP, 경영관리 솔루션',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
