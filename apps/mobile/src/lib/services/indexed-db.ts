/**
 * IndexedDB 기반 오프라인 데이터 저장소
 * - 대용량 데이터 지원
 * - 구조화된 데이터 저장
 * - 오프라인 시 캐시된 데이터 제공
 */

import { logger } from '@abc/shared';

const DB_NAME = 'abc_staff_offline_db';
const DB_VERSION = 1;

interface OfflineStore {
  userProfile: UserProfile | null;
  todaySchedule: Schedule | null;
  weekSchedules: Schedule[];
  monthlyAttendances: Attendance[];
  pendingActions: PendingAction[];
  lastSyncTime: Record<string, number>;
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  position: string | null;
  companyId: string;
  companyName: string;
  storeId: string | null;
  storeName: string | null;
  profileImage: string | null;
  cachedAt: number;
}

interface Schedule {
  id: string;
  workDate: string;
  startTime: string;
  endTime: string;
  position: string | null;
  storeName: string;
  storeId: string;
  status: string;
  isEmergency: boolean;
}

interface Attendance {
  id: string;
  workDate: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  actualCheckIn: string | null;
  actualCheckOut: string | null;
  isLate: boolean;
  isEarlyLeave: boolean;
  storeName: string;
}

interface PendingAction {
  id: string;
  type: 'CHECK_IN' | 'CHECK_OUT' | 'LEAVE_REQUEST' | 'SCHEDULE_CHANGE';
  payload: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
  lastError: string | null;
  status: 'PENDING' | 'SYNCING' | 'FAILED';
}

class IndexedDBService {
  private db: IDBDatabase | null = null;
  private isInitialized: boolean = false;

  async init(): Promise<void> {
    if (this.isInitialized) return;

    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        console.warn('IndexedDB not available');
        resolve();
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('IndexedDB open error:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isInitialized = true;
        logger.log('IndexedDB initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 사용자 프로필 저장소
        if (!db.objectStoreNames.contains('userProfile')) {
          db.createObjectStore('userProfile', { keyPath: 'id' });
        }

        // 스케줄 저장소
        if (!db.objectStoreNames.contains('schedules')) {
          const scheduleStore = db.createObjectStore('schedules', { keyPath: 'id' });
          scheduleStore.createIndex('workDate', 'workDate', { unique: false });
        }

        // 출퇴근 기록 저장소
        if (!db.objectStoreNames.contains('attendances')) {
          const attendanceStore = db.createObjectStore('attendances', { keyPath: 'id' });
          attendanceStore.createIndex('workDate', 'workDate', { unique: false });
        }

        // 대기 중인 액션 저장소
        if (!db.objectStoreNames.contains('pendingActions')) {
          const actionStore = db.createObjectStore('pendingActions', { keyPath: 'id' });
          actionStore.createIndex('status', 'status', { unique: false });
          actionStore.createIndex('type', 'type', { unique: false });
        }

        // 메타데이터 저장소 (동기화 시간 등)
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'key' });
        }
      };
    });
  }

  private ensureInit(): void {
    if (!this.db) {
      throw new Error('IndexedDB not initialized. Call init() first.');
    }
  }

  // ========== 사용자 프로필 ==========

  async saveUserProfile(profile: UserProfile): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['userProfile'], 'readwrite');
      const store = transaction.objectStore('userProfile');
      const request = store.put({ ...profile, cachedAt: Date.now() });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getUserProfile(): Promise<UserProfile | null> {
    await this.init();
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['userProfile'], 'readonly');
      const store = transaction.objectStore('userProfile');
      const request = store.getAll();

      request.onsuccess = () => {
        const profiles = request.result;
        resolve(profiles.length > 0 ? profiles[0] : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // ========== 스케줄 ==========

  async saveSchedules(schedules: Schedule[]): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['schedules'], 'readwrite');
      const store = transaction.objectStore('schedules');

      // 기존 데이터 삭제 후 새 데이터 삽입
      store.clear();

      let completed = 0;
      for (const schedule of schedules) {
        const request = store.put(schedule);
        request.onsuccess = () => {
          completed++;
          if (completed === schedules.length) resolve();
        };
        request.onerror = () => reject(request.error);
      }

      if (schedules.length === 0) resolve();
    });
  }

  async getScheduleByDate(workDate: string): Promise<Schedule | null> {
    await this.init();
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['schedules'], 'readonly');
      const store = transaction.objectStore('schedules');
      const index = store.index('workDate');
      const request = index.get(workDate);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getSchedulesInRange(startDate: string, endDate: string): Promise<Schedule[]> {
    await this.init();
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['schedules'], 'readonly');
      const store = transaction.objectStore('schedules');
      const index = store.index('workDate');
      const range = IDBKeyRange.bound(startDate, endDate);
      const request = index.getAll(range);

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // ========== 출퇴근 기록 ==========

  async saveAttendances(attendances: Attendance[]): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['attendances'], 'readwrite');
      const store = transaction.objectStore('attendances');

      // 기존 데이터 삭제 후 새 데이터 삽입
      store.clear();

      let completed = 0;
      for (const attendance of attendances) {
        const request = store.put(attendance);
        request.onsuccess = () => {
          completed++;
          if (completed === attendances.length) resolve();
        };
        request.onerror = () => reject(request.error);
      }

      if (attendances.length === 0) resolve();
    });
  }

  async getAttendanceByDate(workDate: string): Promise<Attendance | null> {
    await this.init();
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['attendances'], 'readonly');
      const store = transaction.objectStore('attendances');
      const index = store.index('workDate');
      const request = index.get(workDate);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllAttendances(): Promise<Attendance[]> {
    await this.init();
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['attendances'], 'readonly');
      const store = transaction.objectStore('attendances');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // ========== 대기 중인 액션 ==========

  async addPendingAction(action: Omit<PendingAction, 'id' | 'timestamp' | 'retryCount' | 'lastError' | 'status'>): Promise<string> {
    await this.init();
    if (!this.db) throw new Error('IndexedDB not available');

    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const pendingAction: PendingAction = {
      ...action,
      id,
      timestamp: Date.now(),
      retryCount: 0,
      lastError: null,
      status: 'PENDING',
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['pendingActions'], 'readwrite');
      const store = transaction.objectStore('pendingActions');
      const request = store.put(pendingAction);

      request.onsuccess = () => resolve(id);
      request.onerror = () => reject(request.error);
    });
  }

  async getPendingActions(): Promise<PendingAction[]> {
    await this.init();
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['pendingActions'], 'readonly');
      const store = transaction.objectStore('pendingActions');
      const request = store.getAll();

      request.onsuccess = () => {
        const actions = request.result || [];
        // 시간순 정렬
        actions.sort((a, b) => a.timestamp - b.timestamp);
        resolve(actions);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async updatePendingAction(id: string, updates: Partial<PendingAction>): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['pendingActions'], 'readwrite');
      const store = transaction.objectStore('pendingActions');
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        if (getRequest.result) {
          const updated = { ...getRequest.result, ...updates };
          const putRequest = store.put(updated);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          resolve();
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async removePendingAction(id: string): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['pendingActions'], 'readwrite');
      const store = transaction.objectStore('pendingActions');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getPendingActionCount(): Promise<number> {
    await this.init();
    if (!this.db) return 0;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['pendingActions'], 'readonly');
      const store = transaction.objectStore('pendingActions');
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // ========== 메타데이터 ==========

  async setLastSyncTime(key: string): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['metadata'], 'readwrite');
      const store = transaction.objectStore('metadata');
      const request = store.put({ key: `lastSync_${key}`, value: Date.now() });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getLastSyncTime(key: string): Promise<number | null> {
    await this.init();
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['metadata'], 'readonly');
      const store = transaction.objectStore('metadata');
      const request = store.get(`lastSync_${key}`);

      request.onsuccess = () => {
        resolve(request.result?.value || null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // ========== 유틸리티 ==========

  async clearAll(): Promise<void> {
    await this.init();
    if (!this.db) return;

    const stores = ['userProfile', 'schedules', 'attendances', 'pendingActions', 'metadata'];

    for (const storeName of stores) {
      await new Promise<void>((resolve, reject) => {
        const transaction = this.db!.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  }

  async getStorageStats(): Promise<{ pendingActions: number; schedules: number; attendances: number }> {
    await this.init();
    if (!this.db) return { pendingActions: 0, schedules: 0, attendances: 0 };

    const [pendingActions, schedules, attendances] = await Promise.all([
      this.getPendingActionCount(),
      new Promise<number>((resolve, reject) => {
        const transaction = this.db!.transaction(['schedules'], 'readonly');
        const store = transaction.objectStore('schedules');
        const request = store.count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
      new Promise<number>((resolve, reject) => {
        const transaction = this.db!.transaction(['attendances'], 'readonly');
        const store = transaction.objectStore('attendances');
        const request = store.count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
    ]);

    return { pendingActions, schedules, attendances };
  }
}

export const offlineDB = new IndexedDBService();

export type { UserProfile, Schedule, Attendance, PendingAction };
