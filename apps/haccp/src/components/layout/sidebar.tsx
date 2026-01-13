'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useCallback } from 'react';
import {
  LayoutDashboard,
  ShieldCheck,
  Thermometer,
  ClipboardCheck,
  Package,
  Truck,
  Bug,
  Sparkles,
  Factory,
  FileText,
  Settings,
  LogOut,
  ChevronDown,
  ChevronRight,
  Users,
  Box,
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
    name: 'CCP 관리',
    href: '/ccp',
    icon: Thermometer,
    children: [
      { name: 'CCP 현황', href: '/ccp' },
      { name: 'CCP 기록', href: '/ccp/records' },
      { name: 'CCP 검증', href: '/ccp/verification' },
    ],
  },
  { name: '위생 점검', href: '/hygiene', icon: Sparkles },
  { name: '정기 점검', href: '/inspections', icon: ClipboardCheck },
  { name: '방충/방서', href: '/pest-control', icon: Bug },
  {
    name: '원재료 관리',
    href: '/materials',
    icon: Package,
    children: [
      { name: '원재료 목록', href: '/materials' },
      { name: '공급업체', href: '/suppliers' },
    ],
  },
  {
    name: '제품 관리',
    href: '/products',
    icon: Box,
    children: [
      { name: '완제품', href: '/products' },
      { name: '반제품', href: '/semi-products' },
    ],
  },
  { name: '생산 관리', href: '/production', icon: Factory },
  { name: '재고 관리', href: '/inventory', icon: Package },
  { name: '출하 관리', href: '/shipments', icon: Truck },
  { name: '감사 보고서', href: '/audit-report', icon: FileText },
  { name: '교육 관리', href: '/training', icon: Users },
  { name: '설정', href: '/settings', icon: Settings },
];

function SidebarComponent() {
  const pathname = usePathname();
  const router = useRouter();
  const [expandedItems, setExpandedItems] = useState<string[]>(['CCP 관리', '원재료 관리', '제품 관리']);
  const [isHovered, setIsHovered] = useState(false);

  const handleSignOut = useCallback(async () => {
    const supabase = await createClient();
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
        'flex flex-col bg-emerald-900 text-emerald-100 transition-all duration-300 ease-in-out h-screen fixed left-0 top-0 z-50',
        isHovered ? 'w-64' : 'w-16'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-emerald-800">
        <div className="flex items-center justify-center w-8 h-8 min-w-[32px] min-h-[32px] bg-emerald-500 rounded-lg flex-shrink-0">
          <ShieldCheck className="w-5 h-5 text-white" />
        </div>
        <span
          className={cn(
            'ml-3 text-lg font-semibold text-white whitespace-nowrap transition-opacity duration-200',
            isHovered ? 'opacity-100' : 'opacity-0'
          )}
        >
          ABC HACCP
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
                      ? 'bg-emerald-800 text-white'
                      : 'text-emerald-200 hover:bg-emerald-800/50 hover:text-white'
                  )}
                  title={!isHovered ? item.name : undefined}
                >
                  <item.icon className={cn('w-5 h-5 flex-shrink-0', isActive ? 'text-emerald-300' : 'text-emerald-400')} />
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
                      <ChevronDown className="w-4 h-4 flex-shrink-0 text-emerald-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 flex-shrink-0 text-emerald-400" />
                    )
                  )}
                  {!isHovered && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-emerald-800 text-white text-sm rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg">
                      {item.name}
                    </div>
                  )}
                </button>
                {isExpanded && (
                  <div className="mt-1 space-y-1 bg-emerald-950/50">
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
                              ? 'bg-emerald-800 text-white font-medium'
                              : 'text-emerald-300 hover:bg-emerald-800/50 hover:text-white'
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
                  ? 'bg-emerald-800 text-white'
                  : 'text-emerald-200 hover:bg-emerald-800/50 hover:text-white'
              )}
              title={!isHovered ? item.name : undefined}
            >
              <item.icon className={cn('w-5 h-5 flex-shrink-0', isActive ? 'text-emerald-300' : 'text-emerald-400')} />
              <span
                className={cn(
                  'ml-3 whitespace-nowrap transition-opacity duration-200',
                  isHovered ? 'opacity-100' : 'opacity-0'
                )}
              >
                {item.name}
              </span>
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-400 rounded-r" />
              )}
              {!isHovered && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-emerald-800 text-white text-sm rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg">
                  {item.name}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Sign out button */}
      <div className="p-2 border-t border-emerald-800">
        <button
          onClick={handleSignOut}
          className="flex items-center w-full px-4 py-2.5 text-sm font-medium text-emerald-200 hover:bg-emerald-800/50 hover:text-white transition-colors rounded relative group"
          title={!isHovered ? '로그아웃' : undefined}
        >
          <LogOut className="w-5 h-5 flex-shrink-0 text-emerald-400" />
          <span
            className={cn(
              'ml-3 whitespace-nowrap transition-opacity duration-200',
              isHovered ? 'opacity-100' : 'opacity-0'
            )}
          >
            로그아웃
          </span>
          {!isHovered && (
            <div className="absolute left-full ml-2 px-2 py-1 bg-emerald-800 text-white text-sm rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg">
              로그아웃
            </div>
          )}
        </button>
      </div>
    </div>
  );
}

export { SidebarComponent as Sidebar };
