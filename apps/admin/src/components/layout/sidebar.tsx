'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, memo, useCallback } from 'react';
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
  ShieldCheck,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Package,
  Store,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

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
  { name: 'HACCP', href: '/haccp', icon: ShieldCheck },
  { name: '경영관리', href: '/business', icon: BarChart3 },
  {
    name: '조직 관리',
    href: '/brands',
    icon: Building2,
    children: [
      { name: '브랜드 관리', href: '/brands' },
      { name: '매장 관리', href: '/stores' },
    ],
  },
  { name: '설정', href: '/settings', icon: Settings },
];

function SidebarComponent() {
  const pathname = usePathname();
  const router = useRouter();
  const [expandedItems, setExpandedItems] = useState<string[]>(['직원 관리', '조직 관리']);
  const [isHovered, setIsHovered] = useState(false);

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

  return (
    <div
      className={cn(
        'flex flex-col bg-[#0f172a] text-slate-300 transition-all duration-300 ease-in-out h-screen fixed left-0 top-0 z-50 border-r border-slate-800/50',
        isHovered ? 'w-64' : 'w-16'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-slate-800/50">
        <div className="flex items-center justify-center w-8 h-8 min-w-[32px] min-h-[32px] bg-emerald-500 rounded-lg text-white font-bold text-sm flex-shrink-0">
          A
        </div>
        <span
          className={cn(
            'ml-3 text-lg font-semibold text-white whitespace-nowrap transition-opacity duration-200',
            isHovered ? 'opacity-100' : 'opacity-0'
          )}
        >
          ABC Staff
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 space-y-1 overflow-y-auto overflow-x-hidden scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const isExpanded = expandedItems.includes(item.name) && isHovered;
          const hasChildren = item.children && item.children.length > 0;

          if (hasChildren) {
            return (
              <div key={item.name}>
                <button
                  onClick={() => isHovered && toggleExpand(item.name)}
                  className={cn(
                    'flex items-center w-full px-4 py-2.5 text-sm font-medium transition-colors relative group',
                    isActive
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  )}
                  title={!isHovered ? item.name : undefined}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  <span
                    className={cn(
                      'ml-3 flex-1 text-left whitespace-nowrap transition-opacity duration-200',
                      isHovered ? 'opacity-100' : 'opacity-0'
                    )}
                  >
                    {item.name}
                  </span>
                  {isHovered && (
                    isExpanded ? (
                      <ChevronDown className="w-4 h-4 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 flex-shrink-0" />
                    )
                  )}
                  {/* Tooltip for collapsed state */}
                  {!isHovered && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-sm rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg">
                      {item.name}
                    </div>
                  )}
                </button>
                {isExpanded && (
                  <div className="mt-1 space-y-1 bg-slate-950/50">
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
                              ? 'bg-slate-800 text-emerald-400 font-medium'
                              : 'text-slate-500 hover:bg-slate-800 hover:text-white'
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
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              )}
              title={!isHovered ? item.name : undefined}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <span
                className={cn(
                  'ml-3 whitespace-nowrap transition-opacity duration-200',
                  isHovered ? 'opacity-100' : 'opacity-0'
                )}
              >
                {item.name}
              </span>
              {/* Active indicator */}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-500 rounded-r" />
              )}
              {/* Tooltip for collapsed state */}
              {!isHovered && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-sm rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg">
                  {item.name}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Sign out button */}
      <div className="p-2 border-t border-slate-700">
        <button
          onClick={handleSignOut}
          className="flex items-center w-full px-4 py-2.5 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors rounded relative group"
          title={!isHovered ? '로그아웃' : undefined}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          <span
            className={cn(
              'ml-3 whitespace-nowrap transition-opacity duration-200',
              isHovered ? 'opacity-100' : 'opacity-0'
            )}
          >
            로그아웃
          </span>
          {/* Tooltip for collapsed state */}
          {!isHovered && (
            <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-sm rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg">
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
