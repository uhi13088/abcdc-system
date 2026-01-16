'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, Search, Factory } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  const [haccpEnabled, setHaccpEnabled] = useState(false);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    async function checkHaccpAccess() {
      const supabase = createClient();

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user profile with company info
      const { data: userData } = await supabase
        .from('users')
        .select('name, company_id')
        .eq('auth_id', user.id)
        .single();

      if (!userData?.company_id) return;

      setUserName(userData.name || '');

      // Check if company has HACCP add-on enabled
      // Use maybeSingle() to handle case where no subscription exists
      const { data: subscription, error } = await supabase
        .from('company_subscriptions')
        .select('haccp_addon_enabled')
        .eq('company_id', userData.company_id)
        .maybeSingle();

      // Only enable HACCP if subscription exists and add-on is enabled
      // Silently ignore errors (table may not exist or no data)
      if (!error && subscription?.haccp_addon_enabled) {
        setHaccpEnabled(true);
      }
    }

    checkHaccpAccess();
  }, []);

  // Get HACCP app URL (different subdomain in production)
  const haccpUrl = process.env.NEXT_PUBLIC_HACCP_URL || '/haccp';

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
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

        {/* HACCP Button - Only show if add-on is enabled */}
        {haccpEnabled && (
          <Link
            href={haccpUrl}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-md hover:bg-green-100 transition-colors"
          >
            <Factory className="w-4 h-4" />
            <span>HACCP</span>
          </Link>
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
  );
}
