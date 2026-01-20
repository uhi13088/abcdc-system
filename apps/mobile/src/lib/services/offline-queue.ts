/**
 * Offline Queue Service
 * Handles offline actions and syncs when back online
 */

import React from 'react';

export interface OfflineAction {
  id: string;
  type: 'CHECK_IN' | 'CHECK_OUT' | 'LEAVE_REQUEST' | 'APPROVAL';
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: Record<string, unknown>;
  createdAt: Date;
  retryCount: number;
  lastError?: string;
}

const QUEUE_KEY = 'offline_queue';
const MAX_RETRIES = 3;

class OfflineQueueService {
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private syncInProgress: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleOnline());
      window.addEventListener('offline', () => this.handleOffline());
    }
  }

  /**
   * Add action to offline queue
   */
  async enqueue(action: Omit<OfflineAction, 'id' | 'createdAt' | 'retryCount'>): Promise<void> {
    const queue = await this.getQueue();

    const newAction: OfflineAction = {
      ...action,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      retryCount: 0,
    };

    queue.push(newAction);
    await this.saveQueue(queue);

    // Try to sync immediately if online
    if (this.isOnline) {
      void this.sync();
    }
  }

  /**
   * Get all queued actions
   */
  async getQueue(): Promise<OfflineAction[]> {
    try {
      const data = localStorage.getItem(QUEUE_KEY);
      if (!data) return [];

      const queue = JSON.parse(data);
      return queue.map((action: OfflineAction) => ({
        ...action,
        createdAt: new Date(action.createdAt),
      }));
    } catch (error) {
      console.error('Failed to get offline queue:', error);
      return [];
    }
  }

  /**
   * Save queue to storage
   */
  private async saveQueue(queue: OfflineAction[]): Promise<void> {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    } catch (error) {
      console.error('Failed to save offline queue:', error);
    }
  }

  /**
   * Remove action from queue
   */
  private async removeAction(id: string): Promise<void> {
    const queue = await this.getQueue();
    const filteredQueue = queue.filter((action) => action.id !== id);
    await this.saveQueue(filteredQueue);
  }

  /**
   * Update action in queue
   */
  private async updateAction(id: string, updates: Partial<OfflineAction>): Promise<void> {
    const queue = await this.getQueue();
    const index = queue.findIndex((action) => action.id === id);

    if (index !== -1) {
      queue[index] = { ...queue[index], ...updates };
      await this.saveQueue(queue);
    }
  }

  /**
   * Sync all queued actions
   */
  async sync(): Promise<{ success: number; failed: number }> {
    if (this.syncInProgress || !this.isOnline) {
      return { success: 0, failed: 0 };
    }

    this.syncInProgress = true;
    let success = 0;
    let failed = 0;

    try {
      const queue = await this.getQueue();

      for (const action of queue) {
        try {
          const response = await fetch(action.endpoint, {
            method: action.method,
            headers: { 'Content-Type': 'application/json' },
            body: action.body ? JSON.stringify(action.body) : undefined,
          });

          if (response.ok) {
            await this.removeAction(action.id);
            success++;
          } else {
            throw new Error(`HTTP ${response.status}`);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          action.retryCount++;
          action.lastError = errorMessage;

          if (action.retryCount >= MAX_RETRIES) {
            // Move to failed actions or remove
            await this.removeAction(action.id);
            console.error(`Action ${action.id} failed after ${MAX_RETRIES} retries:`, errorMessage);
            failed++;
          } else {
            await this.updateAction(action.id, {
              retryCount: action.retryCount,
              lastError: errorMessage,
            });
          }
        }
      }
    } finally {
      this.syncInProgress = false;
    }

    return { success, failed };
  }

  /**
   * Handle coming back online
   */
  private handleOnline(): void {
    this.isOnline = true;
    console.log('Back online, syncing offline queue...');
    void this.sync();
  }

  /**
   * Handle going offline
   */
  private handleOffline(): void {
    this.isOnline = false;
    console.log('Gone offline, queuing actions...');
  }

  /**
   * Check if online
   */
  getOnlineStatus(): boolean {
    return this.isOnline;
  }

  /**
   * Get queue size
   */
  async getQueueSize(): Promise<number> {
    const queue = await this.getQueue();
    return queue.length;
  }

  /**
   * Clear all queued actions
   */
  async clearQueue(): Promise<void> {
    await this.saveQueue([]);
  }
}

export const offlineQueue = new OfflineQueueService();

/**
 * Hook for offline status
 */
export function useOfflineStatus() {
  const [isOnline, setIsOnline] = React.useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [queueSize, setQueueSize] = React.useState(0);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check queue size periodically
    const checkQueue = async () => {
      const size = await offlineQueue.getQueueSize();
      setQueueSize(size);
    };

    checkQueue();
    const interval = setInterval(checkQueue, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  return { isOnline, queueSize };
}

/**
 * Hook for offline-first API calls
 */
export function useOfflineApi() {
  const { isOnline } = useOfflineStatus();

  const request = React.useCallback(
    async <T>(
      endpoint: string,
      options: {
        method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
        body?: Record<string, unknown>;
        offlineAction?: OfflineAction['type'];
      } = {}
    ): Promise<T | null> => {
      const { method = 'GET', body, offlineAction } = options;

      if (isOnline) {
        try {
          const response = await fetch(endpoint, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined,
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          return await response.json();
        } catch (error) {
          // If failed and has offline action type, queue it
          if (offlineAction && method !== 'GET') {
            await offlineQueue.enqueue({
              type: offlineAction,
              endpoint,
              method,
              body,
            });
          }
          throw error;
        }
      } else if (offlineAction && method !== 'GET') {
        // Queue action when offline
        await offlineQueue.enqueue({
          type: offlineAction,
          endpoint,
          method,
          body,
        });
        return null;
      }

      throw new Error('No network connection');
    },
    [isOnline]
  );

  return { request, isOnline };
}
