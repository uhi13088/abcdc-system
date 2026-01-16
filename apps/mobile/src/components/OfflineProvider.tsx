'use client';

/**
 * 오프라인 모드 Provider
 * - Service Worker 등록
 * - 오프라인 상태 관리
 * - 동기화 상태 표시
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { offlineSync } from '@/lib/services/offline-sync';
import { offlineDB } from '@/lib/services/indexed-db';

interface OfflineContextType {
  isOnline: boolean;
  isSyncing: boolean;
  pendingActionsCount: number;
  lastSyncTime: Date | null;
  syncNow: () => Promise<void>;
  refreshCache: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextType>({
  isOnline: true,
  isSyncing: false,
  pendingActionsCount: 0,
  lastSyncTime: null,
  syncNow: async () => {},
  refreshCache: async () => {},
});

export const useOffline = () => useContext(OfflineContext);

interface OfflineProviderProps {
  children: React.ReactNode;
}

export function OfflineProvider({ children }: OfflineProviderProps) {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingActionsCount, setPendingActionsCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [swRegistered, setSwRegistered] = useState(false);

  // Service Worker 등록
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('Service Worker registered:', registration.scope);
          setSwRegistered(true);

          // 업데이트 확인
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            newWorker?.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // 새 버전 사용 가능
                console.log('New service worker available');
              }
            });
          });
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
        });

      // Service Worker 메시지 수신
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'SYNC_REQUESTED') {
          offlineSync.sync();
        }
      });
    }
  }, []);

  // 오프라인 상태 및 콜백 설정
  useEffect(() => {
    setIsOnline(navigator.onLine);

    offlineSync.setCallbacks({
      onSyncStart: () => {
        setIsSyncing(true);
      },
      onSyncComplete: (result) => {
        setIsSyncing(false);
        setLastSyncTime(new Date());
        updatePendingCount();
        console.log('Sync complete:', result);
      },
      onOnlineStatusChange: (online) => {
        setIsOnline(online);
      },
    });

    // 초기 캐시 로드
    offlineDB.init().then(() => {
      updatePendingCount();
    });

    // 주기적으로 대기 액션 수 업데이트
    const interval = setInterval(updatePendingCount, 10000);

    return () => {
      clearInterval(interval);
      offlineSync.destroy();
    };
  }, []);

  const updatePendingCount = useCallback(async () => {
    const count = await offlineDB.getPendingActionCount();
    setPendingActionsCount(count);
  }, []);

  const syncNow = useCallback(async () => {
    if (!isOnline || isSyncing) return;
    await offlineSync.sync();
    await updatePendingCount();
  }, [isOnline, isSyncing, updatePendingCount]);

  const refreshCache = useCallback(async () => {
    if (!isOnline) return;
    await offlineSync.refreshCache();
  }, [isOnline]);

  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        isSyncing,
        pendingActionsCount,
        lastSyncTime,
        syncNow,
        refreshCache,
      }}
    >
      {children}
      <OfflineStatusBar />
    </OfflineContext.Provider>
  );
}

/**
 * 오프라인 상태 표시 바
 */
function OfflineStatusBar() {
  const { isOnline, isSyncing, pendingActionsCount } = useOffline();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isOnline || pendingActionsCount > 0) {
      setVisible(true);
    } else {
      // 온라인 복귀 시 잠시 후 숨김
      const timer = setTimeout(() => setVisible(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, pendingActionsCount]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '8px 16px',
        backgroundColor: isOnline
          ? pendingActionsCount > 0
            ? '#f59e0b'
            : '#10b981'
          : '#ef4444',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        fontSize: '14px',
        fontWeight: 500,
        zIndex: 9999,
        transition: 'all 0.3s ease',
      }}
    >
      {!isOnline ? (
        <>
          <span style={{ fontSize: '16px' }}>📡</span>
          <span>오프라인 모드 - 연결이 복구되면 자동 동기화됩니다</span>
        </>
      ) : isSyncing ? (
        <>
          <span
            style={{
              display: 'inline-block',
              width: '16px',
              height: '16px',
              border: '2px solid white',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
          <span>동기화 중...</span>
          <style>{`
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>
        </>
      ) : pendingActionsCount > 0 ? (
        <>
          <span style={{ fontSize: '16px' }}>⏳</span>
          <span>{pendingActionsCount}개 항목 동기화 대기 중</span>
        </>
      ) : (
        <>
          <span style={{ fontSize: '16px' }}>✓</span>
          <span>연결됨</span>
        </>
      )}
    </div>
  );
}

/**
 * 오프라인 출퇴근 기록 훅
 */
export function useOfflineAttendance() {
  const { isOnline } = useOffline();

  const checkIn = useCallback(
    async (payload: {
      scheduleId?: string;
      storeId: string;
      latitude?: number;
      longitude?: number;
      photoUrl?: string;
      note?: string;
    }) => {
      const result = await offlineSync.recordCheckIn(payload);

      if (result.queued) {
        return {
          success: true,
          offline: true,
          message: '오프라인으로 기록되었습니다. 연결 시 자동 동기화됩니다.',
        };
      }

      return {
        success: true,
        offline: false,
        message: '출근이 기록되었습니다.',
      };
    },
    []
  );

  const checkOut = useCallback(
    async (payload: {
      attendanceId?: string;
      latitude?: number;
      longitude?: number;
      photoUrl?: string;
      note?: string;
    }) => {
      const result = await offlineSync.recordCheckOut(payload);

      if (result.queued) {
        return {
          success: true,
          offline: true,
          message: '오프라인으로 기록되었습니다. 연결 시 자동 동기화됩니다.',
        };
      }

      return {
        success: true,
        offline: false,
        message: '퇴근이 기록되었습니다.',
      };
    },
    []
  );

  return { checkIn, checkOut, isOnline };
}

/**
 * 오프라인 캐시 데이터 훅
 */
export function useOfflineData() {
  const { isOnline } = useOffline();
  const [profile, setProfile] = useState<any>(null);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [attendances, setAttendances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCachedData = async () => {
      setLoading(true);
      try {
        const [cachedProfile, cachedSchedules, cachedAttendances] = await Promise.all([
          offlineSync.getCachedProfile(),
          offlineSync.getCachedWeekSchedules(),
          offlineSync.getCachedAttendances(),
        ]);

        setProfile(cachedProfile);
        setSchedules(cachedSchedules);
        setAttendances(cachedAttendances);
      } catch (error) {
        console.error('Failed to load cached data:', error);
      }
      setLoading(false);
    };

    loadCachedData();
  }, [isOnline]);

  return { profile, schedules, attendances, loading, isOnline };
}
