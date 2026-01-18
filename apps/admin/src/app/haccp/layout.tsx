'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Users,
  Box,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  children?: { name: string; href: string }[];
}

const navigation: NavItem[] = [
  { name: '대시보드', href: '/haccp', icon: LayoutDashboard },
  {
    name: 'CCP 관리',
    href: '/haccp/ccp',
    icon: Thermometer,
    children: [
      { name: 'CCP 현황', href: '/haccp/ccp' },
      { name: 'CCP 기록', href: '/haccp/ccp/records' },
      { name: 'CCP 검증', href: '/haccp/ccp/verification' },
    ],
  },
  { name: '위생 점검', href: '/haccp/hygiene', icon: Sparkles },
  { name: '입고 검사', href: '/haccp/inspections', icon: ClipboardCheck },
  { name: '방충/방서', href: '/haccp/pest-control', icon: Bug },
  {
    name: '원재료 관리',
    href: '/haccp/materials',
    icon: Package,
    children: [
      { name: '원재료 목록', href: '/haccp/materials' },
      { name: '공급업체', href: '/haccp/suppliers' },
    ],
  },
  {
    name: '제품 관리',
    href: '/haccp/products',
    icon: Box,
    children: [
      { name: '완제품', href: '/haccp/products' },
      { name: '반제품', href: '/haccp/semi-products' },
    ],
  },
  { name: '생산 관리', href: '/haccp/production', icon: Factory },
  { name: '재고 관리', href: '/haccp/inventory', icon: Package },
  { name: '출하 관리', href: '/haccp/shipments', icon: Truck },
];

function HACCPSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [expandedItems, setExpandedItems] = useState<string[]>(['CCP 관리', '원재료 관리', '제품 관리']);
  const [isHovered, setIsHovered] = useState(false);

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
        'flex flex-col bg-white text-gray-700 transition-all duration-300 ease-in-out h-screen fixed left-0 top-0 z-50 border-r border-gray-200 shadow-sm',
        isHovered ? 'w-64' : 'w-16'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Logo */}
      <Link href="/haccp" className="flex items-center h-16 px-4 border-b border-gray-200 hover:bg-gray-50 transition-colors">
        <div className="flex items-center justify-center w-8 h-8 min-w-[32px] min-h-[32px] bg-emerald-500 rounded-lg flex-shrink-0">
          <ShieldCheck className="w-5 h-5 text-white" />
        </div>
        <span
          className={cn(
            'ml-3 text-lg font-semibold text-gray-900 whitespace-nowrap transition-opacity duration-200',
            isHovered ? 'opacity-100' : 'opacity-0'
          )}
        >
          HACCP
        </span>
      </Link>

      {/* Navigation */}
      <nav className="flex-1 py-4 space-y-1 overflow-y-auto overflow-x-hidden scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {navigation.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/haccp' && pathname.startsWith(item.href + '/'));
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
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  )}
                  title={!isHovered ? item.name : undefined}
                >
                  <item.icon className={cn('w-5 h-5 flex-shrink-0', isActive ? 'text-emerald-600' : 'text-gray-400')} />
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
                      <ChevronDown className="w-4 h-4 flex-shrink-0 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 flex-shrink-0 text-gray-400" />
                    )
                  )}
                  {!isHovered && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-sm rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg">
                      {item.name}
                    </div>
                  )}
                </button>
                {isExpanded && (
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
                              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
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
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
              title={!isHovered ? item.name : undefined}
            >
              <item.icon className={cn('w-5 h-5 flex-shrink-0', isActive ? 'text-emerald-600' : 'text-gray-400')} />
              <span
                className={cn(
                  'ml-3 whitespace-nowrap transition-opacity duration-200',
                  isHovered ? 'opacity-100' : 'opacity-0'
                )}
              >
                {item.name}
              </span>
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-500 rounded-r" />
              )}
              {!isHovered && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-sm rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg">
                  {item.name}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Back to Admin button */}
      <div className="p-2 border-t border-gray-200">
        <Link
          href="/"
          className="flex items-center w-full px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors rounded relative group"
          title={!isHovered ? '관리자 홈' : undefined}
        >
          <ArrowLeft className="w-5 h-5 flex-shrink-0 text-gray-400" />
          <span
            className={cn(
              'ml-3 whitespace-nowrap transition-opacity duration-200',
              isHovered ? 'opacity-100' : 'opacity-0'
            )}
          >
            관리자 홈
          </span>
          {!isHovered && (
            <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-sm rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg">
              관리자 홈
            </div>
          )}
        </Link>
      </div>
    </div>
  );
}

export default function HACCPLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <HACCPSidebar />
      <main className="flex-1 ml-16 transition-all duration-300">
        {children}
      </main>
    </div>
  );
}
