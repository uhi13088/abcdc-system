'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from './sidebar';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Don't show sidebar on auth pages and public invite pages
  const isAuthPage = pathname?.startsWith('/auth');
  const isInvitePage = pathname?.startsWith('/invite');

  if (isAuthPage || isInvitePage) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      {/* Main content with left margin for collapsed sidebar (w-16 = 4rem) */}
      <main className="flex-1 ml-16 overflow-auto">
        {children}
      </main>
    </div>
  );
}
