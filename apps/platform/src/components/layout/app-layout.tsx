'use client';

import { useState, createContext, useContext } from 'react';
import { Sidebar } from './sidebar';
import { Menu } from 'lucide-react';

// Context for sidebar state management
interface SidebarContextType {
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
}

export const SidebarContext = createContext<SidebarContextType>({
  isMobileOpen: false,
  setIsMobileOpen: () => {},
});

export const useSidebar = () => useContext(SidebarContext);

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <SidebarContext.Provider value={{ isMobileOpen, setIsMobileOpen }}>
      <div className="flex min-h-screen bg-gray-50">
        {/* Mobile menu button */}
        <button
          onClick={() => setIsMobileOpen(true)}
          className="lg:hidden fixed top-4 left-4 z-40 p-2 bg-white rounded-lg shadow-md border border-gray-200 hover:bg-gray-50 transition-colors"
          aria-label="메뉴 열기"
        >
          <Menu className="w-5 h-5 text-gray-600" />
        </button>

        {/* Mobile overlay */}
        {isMobileOpen && (
          <div
            className="lg:hidden fixed inset-0 bg-black/50 z-40 transition-opacity"
            onClick={() => setIsMobileOpen(false)}
          />
        )}

        {/* Sidebar */}
        <Sidebar />

        {/* Main content with left margin for collapsed sidebar (w-16 = 4rem) */}
        <main className="flex-1 ml-0 lg:ml-16 overflow-y-auto p-6 pt-16 lg:pt-6">
          {children}
        </main>
      </div>
    </SidebarContext.Provider>
  );
}
