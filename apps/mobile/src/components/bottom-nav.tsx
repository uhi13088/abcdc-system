'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Clock, Calendar, Bell, User, PlusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { name: '홈', href: '/home', icon: Home },
  { name: '출퇴근', href: '/attendance', icon: Clock },
  { name: '스케줄', href: '/schedule', icon: Calendar },
  { name: '공지', href: '/notices', icon: Bell },
  { name: '내 정보', href: '/profile', icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-bottom">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center w-full h-full',
                isActive ? 'text-primary' : 'text-gray-400'
              )}
            >
              <item.icon className="w-6 h-6" />
              <span className="text-xs mt-1">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
