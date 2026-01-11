'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function BusinessSettingsPage() {
  const router = useRouter();

  useEffect(() => {
    // 설정 페이지의 연동/API 탭으로 리다이렉트
    router.replace('/settings?tab=integrations');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-500">연동 설정으로 이동 중...</p>
      </div>
    </div>
  );
}
