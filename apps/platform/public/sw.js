/**
 * Service Worker for PEANOTE Platform App
 * - 푸시 알림 수신
 * - 알림 클릭 처리
 */

const CACHE_NAME = 'peanote-platform-v1';

// 설치 이벤트
self.addEventListener('install', (event) => {
  console.log('[Platform SW] Installing service worker...');
  event.waitUntil(self.skipWaiting());
});

// 활성화 이벤트
self.addEventListener('activate', (event) => {
  console.log('[Platform SW] Activating service worker...');
  event.waitUntil(self.clients.claim());
});

// 푸시 알림 수신
self.addEventListener('push', (event) => {
  console.log('[Platform SW] Push received');

  let data = {
    title: 'PEANOTE Platform',
    body: '새로운 알림이 있습니다.',
    category: 'GENERAL'
  };

  try {
    data = event.data?.json() || data;
  } catch (e) {
    data.body = event.data?.text() || data.body;
  }

  const options = {
    body: data.body,
    icon: '/icon.svg',
    badge: '/icon.svg',
    vibrate: [100, 50, 100],
    tag: data.category || 'platform',
    data: data.data || {},
    actions: data.actions || [
      { action: 'view', title: '확인' },
      { action: 'dismiss', title: '닫기' }
    ],
  };

  // 긴급 알림 처리
  if (data.priority === 'HIGH') {
    options.requireInteraction = true;
    options.vibrate = [200, 100, 200];
  }

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// 알림 클릭
self.addEventListener('notificationclick', (event) => {
  console.log('[Platform SW] Notification clicked:', event.action);

  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const deepLink = event.notification.data?.deepLink || '/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // 이미 열린 창이 있으면 포커스
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(deepLink);
            return client.focus();
          }
        }
        // 없으면 새 창 열기
        if (self.clients.openWindow) {
          return self.clients.openWindow(deepLink);
        }
      })
  );
});

// 알림 닫기
self.addEventListener('notificationclose', (event) => {
  console.log('[Platform SW] Notification closed');
});

// 메시지 수신 (클라이언트와 통신)
self.addEventListener('message', (event) => {
  console.log('[Platform SW] Message received:', event.data);

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('[Platform SW] Service Worker loaded');
