/**
 * Push Notification Service for Mobile Web App
 * Handles FCM token registration and notification handling
 */

import { logger } from '@abc/shared';

interface NotificationData {
  title: string;
  body: string;
  category?: string;
  priority?: string;
  deepLink?: string;
}

class PushNotificationService {
  private swRegistration: ServiceWorkerRegistration | null = null;

  /**
   * Initialize push notifications
   */
  async initialize(): Promise<boolean> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      logger.log('Push notifications not supported');
      return false;
    }

    try {
      // Register service worker
      this.swRegistration = await navigator.serviceWorker.register('/sw.js');
      logger.log('Service Worker registered');

      // Check permission
      const permission = await this.requestPermission();
      if (permission !== 'granted') {
        logger.log('Push notification permission denied');
        return false;
      }

      // Get FCM token
      const token = await this.getToken();
      if (token) {
        await this.registerToken(token);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to initialize push notifications:', error);
      return false;
    }
  }

  /**
   * Request notification permission
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      return 'denied';
    }

    if (Notification.permission === 'granted') {
      return 'granted';
    }

    if (Notification.permission !== 'denied') {
      return await Notification.requestPermission();
    }

    return Notification.permission;
  }

  /**
   * Get push subscription token
   */
  async getToken(): Promise<string | null> {
    if (!this.swRegistration) {
      return null;
    }

    try {
      // For web push, we use the Push API subscription
      // In a real implementation, this would integrate with Firebase
      const subscription = await this.swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
        ),
      });

      // Return the subscription endpoint as the "token"
      return JSON.stringify(subscription.toJSON());
    } catch (error) {
      console.error('Failed to get push token:', error);
      return null;
    }
  }

  /**
   * Register token with server
   */
  async registerToken(token: string): Promise<void> {
    try {
      const response = await fetch('/api/notifications/register-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fcmToken: token,
          platform: 'WEB',
          deviceInfo: {
            userAgent: navigator.userAgent,
            language: navigator.language,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to register token');
      }
    } catch (error) {
      console.error('Failed to register push token:', error);
    }
  }

  /**
   * Handle notification click
   */
  handleNotificationClick(notification: NotificationData): void {
    if (notification.deepLink) {
      window.location.href = notification.deepLink;
    }
  }

  /**
   * Show local notification
   */
  async showNotification(notification: NotificationData): Promise<void> {
    if (!this.swRegistration) {
      return;
    }

    await this.swRegistration.showNotification(notification.title, {
      body: notification.body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      tag: notification.category,
      data: {
        deepLink: notification.deepLink,
      },
    });
  }

  /**
   * Convert VAPID key to Uint8Array
   */
  private urlBase64ToUint8Array(base64String: string): ArrayBuffer {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray.buffer as ArrayBuffer;
  }
}

export const pushNotificationService = new PushNotificationService();

/**
 * Hook for managing push notifications
 */
export function usePushNotifications() {
  const [isEnabled, setIsEnabled] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const init = async () => {
      const enabled = await pushNotificationService.initialize();
      setIsEnabled(enabled);
      setIsLoading(false);
    };

    init();
  }, []);

  return { isEnabled, isLoading };
}

// Import React for the hook
import React from 'react';
