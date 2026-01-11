import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ABC Platform Admin',
  description: 'ABC Staff System - Platform Administration',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="font-sans">{children}</body>
    </html>
  );
}
