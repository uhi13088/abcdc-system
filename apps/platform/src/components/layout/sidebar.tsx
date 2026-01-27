'use client';

import { useState, useCallback, useContext, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  Users,
  Layers,
  BarChart3,
  Settings,
  LogOut,
  Shield,
  CreditCard,
  Scale,
  X,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { SidebarContext } from './app-layout';

const navigation = [
  { name: '대시보드', href: '/dashboard', icon: LayoutDashboard },
  { name: '회사 관리', href: '/companies', icon: Building2 },
  { name: '브랜드 관리', href: '/brands', icon: Layers },
  { name: '사용자 관리', href: '/users', icon: Users },
  { name: '구독 관리', href: '/subscriptions', icon: CreditCard },
  { name: '근로기준법', href: '/labor-law', icon: Scale },
  { name: '분석', href: '/analytics', icon: BarChart3 },
  { name: '설정', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isHovered, setIsHovered] = useState(false);

  // Mobile sidebar state from context
  const { isMobileOpen, setIsMobileOpen } = useContext(SidebarContext);

  // Close mobile sidebar on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname, setIsMobileOpen]);

  const handleSignOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/auth/login');
    router.refresh();
  }, [router]);

  // Determine if sidebar should be expanded (desktop hover or mobile open)
  const isExpanded = isHovered || isMobileOpen;

  return (
    <div
      className={cn(
        'flex flex-col bg-white border-r border-gray-200 transition-all duration-300 ease-in-out h-screen fixed left-0 top-0 z-50 shadow-sm',
        // Desktop: w-16 collapsed, w-64 expanded on hover
        // Mobile: hidden by default, w-64 when open
        isMobileOpen ? 'w-64 translate-x-0' : 'w-16 -translate-x-full lg:translate-x-0',
        isHovered && !isMobileOpen && 'lg:w-64'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-gray-200">
        <Link href="/dashboard" className="flex items-center flex-1 overflow-hidden hover:opacity-80 transition-opacity">
          <Shield className="w-6 h-6 text-primary flex-shrink-0" />
          <span
            className={cn(
              'ml-2 text-xl font-bold text-primary whitespace-nowrap transition-opacity duration-300',
              isExpanded ? 'opacity-100' : 'opacity-0'
            )}
          >
            Platform Admin
          </span>
        </Link>
        {/* Mobile close button */}
        {isMobileOpen && (
          <button
            onClick={() => setIsMobileOpen(false)}
            className="lg:hidden p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
            aria-label="메뉴 닫기"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto overflow-x-hidden">
        {navigation.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors relative group',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
              title={!isExpanded ? item.name : undefined}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <span
                className={cn(
                  'ml-3 whitespace-nowrap transition-opacity duration-300',
                  isExpanded ? 'opacity-100' : 'opacity-0 w-0'
                )}
              >
                {item.name}
              </span>
              {/* Tooltip for collapsed state (desktop only) */}
              {!isExpanded && (
                <div className="hidden lg:block absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-sm rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg">
                  {item.name}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Sign out button */}
      <div className="p-2 border-t border-gray-200">
        <button
          onClick={handleSignOut}
          className="flex items-center w-full px-3 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-50 hover:text-gray-900 transition-colors relative group"
          title={!isExpanded ? '로그아웃' : undefined}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          <span
            className={cn(
              'ml-3 whitespace-nowrap transition-opacity duration-300',
              isExpanded ? 'opacity-100' : 'opacity-0 w-0'
            )}
          >
            로그아웃
          </span>
          {/* Tooltip for collapsed state (desktop only) */}
          {!isExpanded && (
            <div className="hidden lg:block absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-sm rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg">
              로그아웃
            </div>
          )}
        </button>
      </div>
    </div>
  );
}
