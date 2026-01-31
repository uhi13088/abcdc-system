'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useCallback, useContext, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  ShieldCheck,
  Thermometer,
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
  Gauge,
  RotateCcw,
  Warehouse,
  X,
  Cpu,
  ListChecks,
  Bell,
  Building2,
  Check,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { SidebarContext } from './app-layout';
import { useHaccpStore } from '@/contexts/haccp-store-context';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  children?: { name: string; href: string }[];
}

const navigation: NavItem[] = [
  { name: '대시보드', href: '/dashboard', icon: LayoutDashboard },
  { name: '일일 체크리스트', href: '/todo', icon: ListChecks },
  {
    name: 'CCP 관리',
    href: '/ccp',
    icon: Thermometer,
    children: [
      { name: 'CCP 현황', href: '/ccp' },
      { name: 'CCP 기록', href: '/ccp/records' },
      { name: 'CCP 검증', href: '/ccp/verification' },
      { name: '개선조치', href: '/corrective-actions' },
    ],
  },
  { name: '위생 점검', href: '/hygiene', icon: Sparkles },
  {
    name: '장비 모니터링',
    href: '/equipment',
    icon: Thermometer,
    children: [
      { name: '온도 현황', href: '/equipment' },
      { name: '온도 기록', href: '/equipment/records' },
      { name: '장비/센서 관리', href: '/equipment/sensors' },
    ],
  },
  { name: '방충/방서', href: '/pest-control', icon: Bug },
  {
    name: '원부재료 관리',
    href: '/materials',
    icon: Package,
    children: [
      { name: '원부재료', href: '/materials' },
      { name: '공급업체', href: '/suppliers' },
      { name: '보관창고', href: '/materials/storage' },
    ],
  },
  {
    name: '완제품 관리',
    href: '/finished-products',
    icon: Factory,
    children: [
      { name: '생산관리', href: '/finished-products/production' },
      { name: '보관창고', href: '/finished-products/storage' },
      { name: '재고관리', href: '/finished-products/inventory' },
      { name: '출하관리', href: '/finished-products/shipments' },
      { name: '고객관리', href: '/finished-products/customers' },
    ],
  },
  {
    name: '제품 관리',
    href: '/products',
    icon: Box,
    children: [
      { name: '완제품', href: '/products' },
      { name: '반제품', href: '/semi-products' },
      { name: '레시피 관리', href: '/products/recipes' },
      { name: '패킹 규격', href: '/products/packing-specs' },
      { name: '한글표시사항', href: '/products/labeling' },
    ],
  },
  { name: '일일 종합 보고서', href: '/reports/daily', icon: FileText },
  { name: '감사 보고서', href: '/audit-report', icon: FileText },
  { name: '교육 관리', href: '/training', icon: Users },
  { name: '검교정 관리', href: '/calibration', icon: Gauge },
  { name: '반품/회수/폐기', href: '/returns-disposals', icon: RotateCcw },
  { name: '알림', href: '/notifications', icon: Bell },
  { name: '설정', href: '/settings', icon: Settings },
];

function SidebarComponent() {
  const pathname = usePathname();
  const router = useRouter();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [isHovered, setIsHovered] = useState(false);
  const [showStoreDropdown, setShowStoreDropdown] = useState(false);
  const storeDropdownRef = useRef<HTMLDivElement>(null);

  // Mobile sidebar state from context
  const { isMobileOpen, setIsMobileOpen } = useContext(SidebarContext);

  // HACCP Store context
  const { currentStore, haccpStores, canSwitchStore, switchStore, isLoading: storesLoading } = useHaccpStore();

  // Close mobile sidebar on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname, setIsMobileOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (storeDropdownRef.current && !storeDropdownRef.current.contains(event.target as Node)) {
        setShowStoreDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleStoreSwitch = useCallback(async (storeId: string) => {
    await switchStore(storeId);
    setShowStoreDropdown(false);
    router.refresh();
  }, [switchStore, router]);

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
          <div className="flex items-center justify-center w-8 h-8 min-w-[32px] min-h-[32px] bg-emerald-500 rounded-lg flex-shrink-0">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <span
            className={cn(
              'ml-3 text-lg font-semibold text-gray-900 whitespace-nowrap transition-opacity duration-200',
              isExpanded ? 'opacity-100' : 'opacity-0'
            )}
          >
            ABC HACCP
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

      {/* Store Switcher - Only show when multiple HACCP stores and manager+ role */}
      {canSwitchStore && !storesLoading && (
        <div className="px-2 py-3 border-b border-gray-200" ref={storeDropdownRef}>
          <button
            onClick={() => isExpanded && setShowStoreDropdown(!showStoreDropdown)}
            className={cn(
              'flex items-center w-full px-2 py-2 text-sm rounded-lg transition-colors',
              'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
            )}
            title={!isExpanded ? currentStore?.name || 'HACCP 매장' : undefined}
          >
            <Building2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
            <span
              className={cn(
                'ml-2 flex-1 text-left font-medium truncate transition-opacity duration-200',
                isExpanded ? 'opacity-100' : 'opacity-0'
              )}
            >
              {currentStore?.name || '매장 선택'}
            </span>
            {isExpanded && (
              <ChevronDown className={cn(
                'w-4 h-4 flex-shrink-0 text-emerald-600 transition-transform',
                showStoreDropdown && 'rotate-180'
              )} />
            )}
          </button>

          {/* Store Dropdown */}
          {showStoreDropdown && isExpanded && (
            <div className="absolute left-2 right-2 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
              {haccpStores.map((store) => (
                <button
                  key={store.id}
                  onClick={() => handleStoreSwitch(store.id)}
                  className={cn(
                    'flex items-center w-full px-3 py-2.5 text-sm transition-colors',
                    store.id === currentStore?.id
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-gray-700 hover:bg-gray-50'
                  )}
                >
                  <Factory className="w-4 h-4 flex-shrink-0 mr-2 text-gray-400" />
                  <span className="flex-1 text-left truncate">{store.name}</span>
                  {store.id === currentStore?.id && (
                    <Check className="w-4 h-4 text-emerald-600" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Current store indicator for single store (collapsed view) */}
      {!canSwitchStore && currentStore && !storesLoading && (
        <div className="px-2 py-3 border-b border-gray-200">
          <div
            className={cn(
              'flex items-center px-2 py-2 text-sm rounded-lg',
              'bg-gray-50 text-gray-600'
            )}
            title={!isExpanded ? currentStore.name : undefined}
          >
            <Building2 className="w-5 h-5 flex-shrink-0 text-gray-400" />
            <span
              className={cn(
                'ml-2 font-medium truncate transition-opacity duration-200',
                isExpanded ? 'opacity-100' : 'opacity-0'
              )}
            >
              {currentStore.name}
            </span>
          </div>
        </div>
      )}

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
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  )}
                  title={!isExpanded ? item.name : undefined}
                >
                  <item.icon className={cn('w-5 h-5 flex-shrink-0', isActive ? 'text-emerald-600' : 'text-gray-400')} />
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
              title={!isExpanded ? item.name : undefined}
            >
              <item.icon className={cn('w-5 h-5 flex-shrink-0', isActive ? 'text-emerald-600' : 'text-gray-400')} />
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
      </nav>

      {/* Sign out button */}
      <div className="p-2 border-t border-gray-200">
        <button
          onClick={handleSignOut}
          className="flex items-center w-full px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors rounded relative group"
          title={!isExpanded ? '로그아웃' : undefined}
        >
          <LogOut className="w-5 h-5 flex-shrink-0 text-gray-400" />
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

export { SidebarComponent as Sidebar };
