'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, memo, useCallback, useContext } from 'react';
import {
  LayoutDashboard,
  Users,
  Calendar,
  DollarSign,
  FileText,
  CheckSquare,
  Building2,
  Settings,
  LogOut,
  Clock,
  AlertTriangle,
  Bell,
  MessageSquare,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Factory,
  Coffee,
  ExternalLink,
  X,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { SidebarContext } from './app-layout';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  children?: { name: string; href: string }[];
}

const navigation: NavItem[] = [
  { name: '대시보드', href: '/dashboard', icon: LayoutDashboard },
  {
    name: '직원 관리',
    href: '/employees',
    icon: Users,
    children: [
      { name: '직원 목록', href: '/employees' },
      { name: '직원 초대', href: '/employees/invite' },
      { name: '초대 목록', href: '/employees/invitations' },
      { name: '직원 평가', href: '/employees/evaluations' },
      { name: '교육 관리', href: '/employees/training' },
    ],
  },
  { name: '출퇴근', href: '/attendance', icon: Clock },
  { name: '스케줄', href: '/schedules', icon: Calendar },
  { name: '급여 관리', href: '/salaries', icon: DollarSign },
  { name: '계약서', href: '/contracts', icon: FileText },
  { name: '승인 관리', href: '/approvals', icon: CheckSquare },
  { name: '긴급 근무', href: '/emergency', icon: AlertTriangle },
  { name: '공지사항', href: '/notices', icon: Bell },
  { name: '메시지', href: '/messages', icon: MessageSquare },
  { name: '경영관리', href: '/business', icon: BarChart3 },
  {
    name: '조직 관리',
    href: '/brands',
    icon: Building2,
    children: [
      { name: '브랜드 관리', href: '/brands' },
      { name: '매장 관리', href: '/stores' },
      { name: '팀 관리', href: '/teams' },
    ],
  },
  { name: '설정', href: '/settings', icon: Settings },
];

function SidebarComponent() {
  const pathname = usePathname();
  const router = useRouter();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [isHovered, setIsHovered] = useState(false);
  const [addonAccess, setAddonAccess] = useState({ haccp: false, roasting: false });

  // Mobile sidebar state from context
  const { isMobileOpen, setIsMobileOpen } = useContext(SidebarContext);

  // Check addon access
  useEffect(() => {
    async function checkAddonAccess() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: userData } = await supabase
          .from('users')
          .select('company_id, store_id, role, haccp_access, roasting_access')
          .eq('auth_id', user.id)
          .single();

        if (!userData) return;

        // super_admin has access to all addons
        if (userData.role === 'super_admin') {
          setAddonAccess({ haccp: true, roasting: true });
          return;
        }

        // Check company subscription for addons
        const { data: subscription } = await supabase
          .from('company_subscriptions')
          .select('haccp_addon_enabled, roasting_addon_enabled')
          .eq('company_id', userData.company_id)
          .single();

        // Check store-level access if user has a store
        let storeHaccp = false;
        let storeRoasting = false;
        if (userData.store_id) {
          const { data: store } = await supabase
            .from('stores')
            .select('haccp_enabled, roasting_enabled')
            .eq('id', userData.store_id)
            .single();
          storeHaccp = store?.haccp_enabled || false;
          storeRoasting = store?.roasting_enabled || false;
        }

        setAddonAccess({
          haccp: (subscription?.haccp_addon_enabled && storeHaccp) || userData.haccp_access || false,
          roasting: (subscription?.roasting_addon_enabled && storeRoasting) || userData.roasting_access || false,
        });
      } catch (error) {
        console.error('Failed to check addon access:', error);
      }
    }
    checkAddonAccess();
  }, []);

  // Close mobile sidebar on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname, setIsMobileOpen]);

  const handleSignOut = useCallback(async () => {
    // Clear demo mode cookie
    document.cookie = 'demo_mode=; path=/; max-age=0';
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/auth/login');
    router.refresh();
  }, [router]);

  const toggleExpand = useCallback((name: string) => {
    setExpandedItems(prev =>
      prev.includes(name)
        ? prev.filter(item => item !== name)
        : [...prev, name]
    );
  }, []);

  // Determine if sidebar should be expanded (desktop hover or mobile open)
  const isExpanded = isHovered || isMobileOpen;

  return (
    <div
      className={cn(
        'flex flex-col bg-white text-gray-700 transition-all duration-300 ease-in-out h-screen fixed left-0 top-0 z-50 border-r border-gray-200 shadow-sm overflow-hidden',
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
        <Link href="/dashboard" className="flex items-center flex-1 hover:opacity-80 transition-opacity">
          <div className="flex items-center justify-center w-8 h-8 min-w-[32px] min-h-[32px] bg-emerald-500 rounded-lg text-white font-bold text-sm flex-shrink-0">
            A
          </div>
          <span
            className={cn(
              'ml-3 text-lg font-semibold text-gray-900 whitespace-nowrap transition-opacity duration-200',
              isExpanded ? 'opacity-100' : 'opacity-0'
            )}
          >
            ABC Staff
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
      <nav className="flex-1 py-4 space-y-1 overflow-y-auto overflow-x-hidden scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const isItemExpanded = expandedItems.includes(item.name) && isExpanded;
          const hasChildren = item.children && item.children.length > 0;

          if (hasChildren) {
            return (
              <div key={item.name}>
                <button
                  onClick={() => isExpanded && toggleExpand(item.name)}
                  className={cn(
                    'flex items-center w-full px-4 py-2.5 text-sm font-medium transition-colors relative group',
                    isActive
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  )}
                  title={!isExpanded ? item.name : undefined}
                >
                  <item.icon className={cn('w-5 h-5 flex-shrink-0', isActive ? 'text-emerald-600' : 'text-gray-500')} />
                  <span
                    className={cn(
                      'ml-3 flex-1 text-left whitespace-nowrap transition-opacity duration-200',
                      isExpanded ? 'opacity-100' : 'opacity-0'
                    )}
                  >
                    {item.name}
                  </span>
                  {isExpanded && (
                    isItemExpanded ? (
                      <ChevronDown className="w-4 h-4 flex-shrink-0 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 flex-shrink-0 text-gray-400" />
                    )
                  )}
                  {/* Tooltip for collapsed state (desktop only) */}
                  {!isExpanded && (
                    <div className="hidden lg:block absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-sm rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg">
                      {item.name}
                    </div>
                  )}
                </button>
                {isItemExpanded && (
                  <div className="mt-1 space-y-1 bg-gray-50">
                    {item.children!.map((child) => {
                      const isChildActive = pathname === child.href;
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          prefetch={true}
                          className={cn(
                            'block pl-12 pr-4 py-2 text-sm transition-colors',
                            isChildActive
                              ? 'bg-emerald-50 text-emerald-700 font-medium'
                              : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                          )}
                        >
                          {child.name}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.name}
              href={item.href}
              prefetch={true}
              className={cn(
                'flex items-center px-4 py-2.5 text-sm font-medium transition-colors relative group',
                isActive
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
              title={!isExpanded ? item.name : undefined}
            >
              <item.icon className={cn('w-5 h-5 flex-shrink-0', isActive ? 'text-emerald-600' : 'text-gray-500')} />
              <span
                className={cn(
                  'ml-3 whitespace-nowrap transition-opacity duration-200',
                  isExpanded ? 'opacity-100' : 'opacity-0'
                )}
              >
                {item.name}
              </span>
              {/* Active indicator */}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-500 rounded-r" />
              )}
              {/* Tooltip for collapsed state (desktop only) */}
              {!isExpanded && (
                <div className="hidden lg:block absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-sm rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg">
                  {item.name}
                </div>
              )}
            </Link>
          );
        })}

        {/* 애드온 앱 링크 */}
        {(addonAccess.haccp || addonAccess.roasting) && (
          <div className={cn("mt-4 pt-4 border-t border-gray-200", isExpanded ? "mx-2" : "mx-2")}>
            {isExpanded && <p className="px-2 text-xs text-gray-400 mb-2">애드온</p>}

            {addonAccess.haccp && (
              <a
                href={process.env.NEXT_PUBLIC_HACCP_URL || 'https://haccp.abcstaff.com'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-green-50 hover:text-green-700 transition-colors relative group rounded"
                title={!isExpanded ? 'HACCP 시스템' : undefined}
              >
                <Factory className="w-5 h-5 flex-shrink-0 text-green-600" />
                <span className={cn(
                  'ml-3 whitespace-nowrap transition-opacity duration-200 flex-1',
                  isExpanded ? 'opacity-100' : 'opacity-0'
                )}>
                  HACCP 시스템
                </span>
                {isExpanded && <ExternalLink className="w-4 h-4 text-gray-400" />}
                {!isExpanded && (
                  <div className="hidden lg:block absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-sm rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg">
                    HACCP 시스템
                  </div>
                )}
              </a>
            )}

            {addonAccess.roasting && (
              <a
                href={process.env.NEXT_PUBLIC_ROASTING_URL || 'https://roasting.abcstaff.com'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-amber-50 hover:text-amber-700 transition-colors relative group rounded"
                title={!isExpanded ? '로스팅 시스템' : undefined}
              >
                <Coffee className="w-5 h-5 flex-shrink-0 text-amber-600" />
                <span className={cn(
                  'ml-3 whitespace-nowrap transition-opacity duration-200 flex-1',
                  isExpanded ? 'opacity-100' : 'opacity-0'
                )}>
                  로스팅 시스템
                </span>
                {isExpanded && <ExternalLink className="w-4 h-4 text-gray-400" />}
                {!isExpanded && (
                  <div className="hidden lg:block absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-sm rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg">
                    로스팅 시스템
                  </div>
                )}
              </a>
            )}
          </div>
        )}
      </nav>

      {/* Sign out button */}
      <div className="p-2 border-t border-gray-200">
        <button
          onClick={handleSignOut}
          className="flex items-center w-full px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors rounded relative group"
          title={!isExpanded ? '로그아웃' : undefined}
        >
          <LogOut className="w-5 h-5 flex-shrink-0 text-gray-500" />
          <span
            className={cn(
              'ml-3 whitespace-nowrap transition-opacity duration-200',
              isExpanded ? 'opacity-100' : 'opacity-0'
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

// Memoize to prevent unnecessary re-renders
export const Sidebar = memo(SidebarComponent);
