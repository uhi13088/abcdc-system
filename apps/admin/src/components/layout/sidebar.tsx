'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

const navigation = [
  { name: '대시보드', href: '/dashboard', icon: LayoutDashboard },
  { name: '직원 관리', href: '/employees', icon: Users },
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
  { name: '매장 관리', href: '/stores', icon: Building2 },
  { name: '설정', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/auth/login');
    router.refresh();
  };

  return (
    <div className="flex flex-col w-64 bg-white border-r border-gray-200">
      {/* Logo */}
      <div className="flex items-center h-16 px-6 border-b border-gray-200">
        <span className="text-xl font-bold text-primary">ABC Staff</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <item.icon className="w-5 h-5 mr-3" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Sign out button */}
      <div className="p-3 border-t border-gray-200">
        <button
          onClick={handleSignOut}
          className="flex items-center w-full px-3 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-50 hover:text-gray-900 transition-colors"
        >
          <LogOut className="w-5 h-5 mr-3" />
          로그아웃
        </button>
      </div>
    </div>
  );
}
