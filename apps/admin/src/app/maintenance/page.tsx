'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Wrench, RefreshCw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function MaintenancePage() {
  const router = useRouter();
  const [checking, setChecking] = useState(false);

  const checkMaintenanceStatus = async () => {
    setChecking(true);
    try {
      const supabase = createClient();
      const { data: settings } = await supabase
        .from('platform_settings')
        .select('maintenance_mode')
        .single();

      if (!settings?.maintenance_mode) {
        // Maintenance mode is off, redirect to dashboard
        router.push('/dashboard');
      }
    } catch {
      // Error checking, stay on maintenance page
    } finally {
      setChecking(false);
    }
  };

  // Check maintenance status periodically
  useEffect(() => {
    const interval = setInterval(checkMaintenanceStatus, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Wrench className="w-10 h-10 text-yellow-600" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          시스템 점검 중
        </h1>

        <p className="text-gray-600 mb-6">
          현재 시스템 점검이 진행 중입니다.<br />
          잠시 후 다시 이용해 주세요.
        </p>

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-500">
            문의: support@abcstaff.com
          </p>
        </div>

        <button
          onClick={checkMaintenanceStatus}
          disabled={checking}
          className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
          {checking ? '확인 중...' : '다시 확인하기'}
        </button>
      </div>
    </div>
  );
}
