'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, X, Check } from 'lucide-react';

interface PushNotificationPromptProps {
  onEnabled?: () => void;
  onDismiss?: () => void;
  autoShow?: boolean;
  delay?: number;
}

export function PushNotificationPrompt({
  onEnabled,
  onDismiss,
  autoShow = true,
  delay = 3000,
}: PushNotificationPromptProps) {
  const [show, setShow] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Check if notifications are supported
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setPermission('unsupported');
      return;
    }

    setPermission(Notification.permission);

    // Auto show prompt after delay if permission is default
    if (autoShow && Notification.permission === 'default') {
      const dismissed = localStorage.getItem('push-notification-dismissed');
      const dismissedAt = dismissed ? parseInt(dismissed, 10) : 0;
      const daysSinceDismissed = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);

      // Show again after 7 days
      if (!dismissed || daysSinceDismissed > 7) {
        const timer = setTimeout(() => setShow(true), delay);
        return () => clearTimeout(timer);
      }
    }
  }, [autoShow, delay]);

  const handleEnable = useCallback(async () => {
    setIsLoading(true);

    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === 'granted') {
        // Register service worker and get token
        await registerPushToken();
        onEnabled?.();
        setShow(false);
      }
    } catch (error) {
      console.error('Failed to enable notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [onEnabled]);

  const handleDismiss = useCallback(() => {
    localStorage.setItem('push-notification-dismissed', Date.now().toString());
    setShow(false);
    onDismiss?.();
  }, [onDismiss]);

  // Don't show if already granted, denied, or unsupported
  if (!show || permission !== 'default') {
    return null;
  }

  return (
    <div className="fixed inset-x-4 bottom-20 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4 max-w-md mx-auto">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <Bell className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900">알림을 켜시겠어요?</h3>
            <p className="text-sm text-gray-600 mt-1">
              근무 일정, 급여 확정, 중요 공지 등을 실시간으로 받아보세요.
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleEnable}
                disabled={isLoading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1"
              >
                {isLoading ? (
                  <span className="animate-spin">⏳</span>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    알림 켜기
                  </>
                )}
              </button>
              <button
                onClick={handleDismiss}
                className="px-4 py-2 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-100 transition-colors"
              >
                나중에
              </button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Register push token with server
 */
async function registerPushToken(): Promise<void> {
  try {
    // Register service worker
    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    // Get VAPID key from environment
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

    if (!vapidKey) {
      console.warn('VAPID key not configured, using fallback push registration');
      // Fallback: just save that notifications are enabled
      await fetch('/api/notifications/register-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fcmToken: 'web-push-enabled-' + Date.now(),
          platform: 'WEB',
          deviceInfo: {
            userAgent: navigator.userAgent,
            language: navigator.language,
          },
        }),
      });
      return;
    }

    // Subscribe to push
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

    // Send subscription to server
    await fetch('/api/notifications/register-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fcmToken: JSON.stringify(subscription.toJSON()),
        platform: 'WEB',
        deviceInfo: {
          userAgent: navigator.userAgent,
          language: navigator.language,
        },
      }),
    });

    console.log('Push notification registered successfully');
  } catch (error) {
    console.error('Failed to register push token:', error);
  }
}

/**
 * Convert VAPID key to ArrayBuffer
 */
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer as ArrayBuffer;
}

/**
 * Hook for checking notification status
 */
export function useNotificationStatus() {
  const [status, setStatus] = useState<{
    supported: boolean;
    permission: NotificationPermission | 'unsupported';
    isRegistered: boolean;
  }>({
    supported: false,
    permission: 'default',
    isRegistered: false,
  });

  useEffect(() => {
    if (!('Notification' in window)) {
      setStatus({
        supported: false,
        permission: 'unsupported',
        isRegistered: false,
      });
      return;
    }

    setStatus({
      supported: true,
      permission: Notification.permission,
      isRegistered: Notification.permission === 'granted',
    });
  }, []);

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return false;

    const result = await Notification.requestPermission();

    if (result === 'granted') {
      await registerPushToken();
      setStatus(prev => ({
        ...prev,
        permission: 'granted',
        isRegistered: true,
      }));
      return true;
    }

    setStatus(prev => ({
      ...prev,
      permission: result,
    }));
    return false;
  }, []);

  return { ...status, requestPermission };
}

export default PushNotificationPrompt;
