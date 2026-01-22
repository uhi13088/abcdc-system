/**
 * 오프라인 동기화 서비스
 * - 네트워크 복구 시 자동 동기화
 * - 충돌 해결 로직
 * - 백그라운드 동기화 지원
 */

import { offlineDB, type PendingAction } from './indexed-db';
import { logger } from '@abc/shared';
import { formatLocalDate } from '@/lib/utils';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

interface SyncResult {
  success: number;
  failed: number;
  pending: number;
  errors: Array<{ actionId: string; error: string }>;
}

interface SyncCallbacks {
  onSyncStart?: () => void;
  onSyncComplete?: (result: SyncResult) => void;
  onActionSynced?: (action: PendingAction) => void;
  onActionFailed?: (action: PendingAction, error: string) => void;
  onOnlineStatusChange?: (isOnline: boolean) => void;
}

class OfflineSyncService {
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private syncInProgress: boolean = false;
  private callbacks: SyncCallbacks = {};
  private syncInterval: NodeJS.Timeout | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleOnline());
      window.addEventListener('offline', () => this.handleOffline());

      // 주기적 동기화 (5분마다)
      this.syncInterval = setInterval(() => {
        if (this.isOnline) {
          this.sync();
        }
      }, 5 * 60 * 1000);
    }
  }

  /**
   * 콜백 등록
   */
  setCallbacks(callbacks: SyncCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * 온라인 상태 반환
   */
  getOnlineStatus(): boolean {
    return this.isOnline;
  }

  /**
   * 동기화 진행 중 여부
   */
  isSyncing(): boolean {
    return this.syncInProgress;
  }

  /**
   * 출퇴근 기록 오프라인 처리
   */
  async recordCheckIn(payload: {
    scheduleId?: string;
    storeId: string;
    latitude?: number;
    longitude?: number;
    photoUrl?: string;
    note?: string;
  }): Promise<{ queued: boolean; actionId?: string }> {
    // 온라인이면 바로 API 호출
    if (this.isOnline) {
      try {
        const response = await fetch('/api/attendances/check-in', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          return { queued: false };
        }
        throw new Error(`HTTP ${response.status}`);
      } catch (error) {
        // API 실패 시 오프라인 큐에 추가
        console.warn('Check-in API failed, queuing offline:', error);
      }
    }

    // 오프라인이거나 API 실패 시 큐에 추가
    const actionId = await offlineDB.addPendingAction({
      type: 'CHECK_IN',
      payload: {
        ...payload,
        offlineTimestamp: new Date().toISOString(),
      },
    });

    return { queued: true, actionId };
  }

  /**
   * 퇴근 기록 오프라인 처리
   */
  async recordCheckOut(payload: {
    attendanceId?: string;
    latitude?: number;
    longitude?: number;
    photoUrl?: string;
    note?: string;
  }): Promise<{ queued: boolean; actionId?: string }> {
    if (this.isOnline) {
      try {
        const response = await fetch('/api/attendances/check-out', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          return { queued: false };
        }
        throw new Error(`HTTP ${response.status}`);
      } catch (error) {
        console.warn('Check-out API failed, queuing offline:', error);
      }
    }

    const actionId = await offlineDB.addPendingAction({
      type: 'CHECK_OUT',
      payload: {
        ...payload,
        offlineTimestamp: new Date().toISOString(),
      },
    });

    return { queued: true, actionId };
  }

  /**
   * 휴가 신청 오프라인 처리
   */
  async submitLeaveRequest(payload: {
    type: string;
    startDate: string;
    endDate: string;
    reason: string;
  }): Promise<{ queued: boolean; actionId?: string }> {
    if (this.isOnline) {
      try {
        const response = await fetch('/api/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            requestType: 'LEAVE',
          }),
        });

        if (response.ok) {
          return { queued: false };
        }
        throw new Error(`HTTP ${response.status}`);
      } catch (error) {
        console.warn('Leave request API failed, queuing offline:', error);
      }
    }

    const actionId = await offlineDB.addPendingAction({
      type: 'LEAVE_REQUEST',
      payload,
    });

    return { queued: true, actionId };
  }

  /**
   * 대기 중인 액션 동기화
   */
  async sync(): Promise<SyncResult> {
    if (this.syncInProgress || !this.isOnline) {
      const pendingCount = await offlineDB.getPendingActionCount();
      return { success: 0, failed: 0, pending: pendingCount, errors: [] };
    }

    this.syncInProgress = true;
    this.callbacks.onSyncStart?.();

    const result: SyncResult = {
      success: 0,
      failed: 0,
      pending: 0,
      errors: [],
    };

    try {
      const actions = await offlineDB.getPendingActions();

      for (const action of actions) {
        if (action.status === 'FAILED' && action.retryCount >= MAX_RETRIES) {
          continue;
        }

        await offlineDB.updatePendingAction(action.id, { status: 'SYNCING' });

        try {
          await this.executeAction(action);

          // 성공 시 삭제
          await offlineDB.removePendingAction(action.id);
          result.success++;
          this.callbacks.onActionSynced?.(action);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const newRetryCount = action.retryCount + 1;

          if (newRetryCount >= MAX_RETRIES) {
            await offlineDB.updatePendingAction(action.id, {
              status: 'FAILED',
              retryCount: newRetryCount,
              lastError: errorMessage,
            });
            result.failed++;
            result.errors.push({ actionId: action.id, error: errorMessage });
            this.callbacks.onActionFailed?.(action, errorMessage);
          } else {
            await offlineDB.updatePendingAction(action.id, {
              status: 'PENDING',
              retryCount: newRetryCount,
              lastError: errorMessage,
            });
          }
        }

        // 요청 간 딜레이
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      result.pending = await offlineDB.getPendingActionCount();
    } finally {
      this.syncInProgress = false;
      this.callbacks.onSyncComplete?.(result);
    }

    return result;
  }

  /**
   * 개별 액션 실행
   */
  private async executeAction(action: PendingAction): Promise<void> {
    const endpointMap: Record<PendingAction['type'], { endpoint: string; method: string }> = {
      CHECK_IN: { endpoint: '/api/attendances/check-in', method: 'POST' },
      CHECK_OUT: { endpoint: '/api/attendances/check-out', method: 'POST' },
      LEAVE_REQUEST: { endpoint: '/api/request', method: 'POST' },
      SCHEDULE_CHANGE: { endpoint: '/api/request', method: 'POST' },
    };

    const config = endpointMap[action.type];
    if (!config) {
      throw new Error(`Unknown action type: ${action.type}`);
    }

    // 오프라인 타임스탬프 추가
    const payload = {
      ...action.payload,
      isOfflineSync: true,
      originalTimestamp: action.timestamp,
    };

    const response = await fetch(config.endpoint, {
      method: config.method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }
  }

  /**
   * 데이터 캐시 새로고침
   */
  async refreshCache(): Promise<void> {
    if (!this.isOnline) return;

    try {
      // 사용자 프로필 캐시
      const profileResponse = await fetch('/api/me');
      if (profileResponse.ok) {
        const data = await profileResponse.json();
        await offlineDB.saveUserProfile({
          id: data.id,
          name: data.name,
          email: data.email,
          phone: data.phone,
          position: data.position,
          companyId: data.company_id,
          companyName: data.company_name,
          storeId: data.store_id,
          storeName: data.store_name,
          profileImage: data.profile_image,
          cachedAt: Date.now(),
        });
        await offlineDB.setLastSyncTime('profile');
      }

      // 주간 스케줄 캐시
      const scheduleResponse = await fetch('/api/schedules/week');
      if (scheduleResponse.ok) {
        const data = await scheduleResponse.json();
        const schedules = (data.schedules || []).map((s: any) => ({
          id: s.id,
          workDate: s.work_date,
          startTime: s.start_time,
          endTime: s.end_time,
          position: s.position,
          storeName: s.store_name,
          storeId: s.store_id,
          status: s.status,
          isEmergency: s.is_emergency || false,
        }));
        await offlineDB.saveSchedules(schedules);
        await offlineDB.setLastSyncTime('schedules');
      }

      // 월간 출퇴근 기록 캐시
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const attendanceResponse = await fetch(`/api/attendances/month?year=${year}&month=${month}`);
      if (attendanceResponse.ok) {
        const data = await attendanceResponse.json();
        // API returns array directly, and uses 'status' field instead of is_late/is_early_leave
        const attendanceList = Array.isArray(data) ? data : (data.attendances || []);
        const attendances = attendanceList.map((a: any) => ({
          id: a.id,
          workDate: a.work_date,
          scheduledStart: a.scheduled_check_in,
          scheduledEnd: a.scheduled_check_out,
          actualCheckIn: a.actual_check_in,
          actualCheckOut: a.actual_check_out,
          status: a.status,
          isLate: a.status === 'LATE',
          isEarlyLeave: a.status === 'EARLY_LEAVE',
          workHours: a.work_hours,
        }));
        await offlineDB.saveAttendances(attendances);
        await offlineDB.setLastSyncTime('attendances');
      }

      logger.log('Offline cache refreshed');
    } catch (error) {
      console.error('Failed to refresh offline cache:', error);
    }
  }

  /**
   * 캐시된 데이터 조회
   */
  async getCachedProfile() {
    return offlineDB.getUserProfile();
  }

  async getCachedTodaySchedule() {
    const today = formatLocalDate(new Date());
    return offlineDB.getScheduleByDate(today);
  }

  async getCachedWeekSchedules() {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    return offlineDB.getSchedulesInRange(
      formatLocalDate(startOfWeek),
      formatLocalDate(endOfWeek)
    );
  }

  async getCachedAttendances() {
    return offlineDB.getAllAttendances();
  }

  /**
   * 온라인 복귀 처리
   */
  private async handleOnline(): Promise<void> {
    this.isOnline = true;
    this.callbacks.onOnlineStatusChange?.(true);
    logger.log('Back online, starting sync...');

    // 잠시 대기 후 동기화 (네트워크 안정화)
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    await this.sync();
    await this.refreshCache();
  }

  /**
   * 오프라인 전환 처리
   */
  private handleOffline(): void {
    this.isOnline = false;
    this.callbacks.onOnlineStatusChange?.(false);
    logger.log('Gone offline, will queue actions');
  }

  /**
   * 정리
   */
  destroy(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
  }
}

export const offlineSync = new OfflineSyncService();
