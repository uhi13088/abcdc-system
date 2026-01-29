'use client';

import { useEffect, useState } from 'react';
import { Bell, Search, Factory, Coffee } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  const [addonAccess, setAddonAccess] = useState({ haccp: false, roasting: false });
  const [userName, setUserName] = useState('');

  useEffect(() => {
    async function checkAddonAccess() {
      const supabase = createClient();

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user profile with company info and role
      const { data: userData } = await supabase
        .from('users')
        .select('name, company_id, role')
        .eq('auth_id', user.id)
        .single();

      if (!userData) return;

      setUserName(userData.name || '');

      // super_admin has access to all addons
      if (userData.role === 'super_admin') {
        setAddonAccess({ haccp: true, roasting: true });
        return;
      }

      if (!userData.company_id) return;

      // Check if company has add-ons enabled
      const { data: subscription, error } = await supabase
        .from('company_subscriptions')
        .select('haccp_addon_enabled, roasting_addon_enabled')
        .eq('company_id', userData.company_id)
        .maybeSingle();

      if (!error && subscription) {
        setAddonAccess({
          haccp: subscription.haccp_addon_enabled || false,
          roasting: subscription.roasting_addon_enabled || false,
        });
      }
    }

    checkAddonAccess();
  }, []);

  // Get app URLs (external apps only)
  const haccpUrl = process.env.NEXT_PUBLIC_HACCP_URL || '';
  const roastingUrl = process.env.NEXT_PUBLIC_ROASTING_URL || '';

  const handleHaccpClick = () => {
    if (haccpUrl && haccpUrl.startsWith('http')) {
      window.open(haccpUrl, '_blank', 'noopener,noreferrer');
    } else {
      alert('HACCP 앱이 설치되지 않았습니다.\n관리자에게 HACCP 앱 설치를 요청하세요.');
    }
  };

  const handleRoastingClick = () => {
    if (roastingUrl && roastingUrl.startsWith('http')) {
      window.open(roastingUrl, '_blank', 'noopener,noreferrer');
    } else {
      alert('로스팅 앱이 설치되지 않았습니다.\n관리자에게 로스팅 앱 설치를 요청하세요.');
    }
  };

  return (
    <>
      {/* Mobile: Simple title only */}
      <header className="lg:hidden h-14 bg-white border-b border-gray-200 flex items-center px-4 pl-16">
        <h1 className="text-lg font-semibold text-gray-900 truncate">{title}</h1>
      </header>

      {/* Desktop: Full header with search and buttons */}
      <header className="hidden lg:flex h-16 bg-white border-b border-gray-200 items-center justify-between px-6">
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>

        <div className="flex items-center space-x-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="검색..."
              className="pl-10 pr-4 py-2 w-64 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          {/* HACCP Button */}
          {addonAccess.haccp && (
            <button
              onClick={handleHaccpClick}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-md hover:bg-green-100 transition-colors"
            >
              <Factory className="w-4 h-4" />
              <span>HACCP</span>
            </button>
          )}

          {/* Roasting Button */}
          {addonAccess.roasting && (
            <button
              onClick={handleRoastingClick}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-md hover:bg-amber-100 transition-colors"
            >
              <Coffee className="w-4 h-4" />
              <span>로스팅</span>
            </button>
          )}

          {/* Notifications */}
          <button className="relative p-2 text-gray-400 hover:text-gray-600">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>

          {/* User avatar */}
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center" title={userName}>
            <span className="text-white text-sm font-medium">
              {userName ? userName.charAt(0).toUpperCase() : 'A'}
            </span>
          </div>
        </div>
      </header>
    </>
  );
}
