/**
 * Service Worker for ABC Staff Mobile App
 * - 오프라인 지원
 * - 리소스 캐싱
 * - 백그라운드 동기화
 */

const CACHE_NAME = 'abc-staff-v1';
const STATIC_CACHE = 'abc-staff-static-v1';
const API_CACHE = 'abc-staff-api-v1';

// 캐시할 정적 리소스
const STATIC_ASSETS = [
  '/',
  '/home',
  '/schedule',
  '/profile',
  '/manifest.json',
  '/favicon.ico',
];

// 캐시할 API 경로 (오프라인에서 사용)
const CACHEABLE_API_ROUTES = [
  '/api/me',
  '/api/schedules/today',
  '/api/schedules/week',
  '/api/attendances/today',
  '/api/attendances/month',
  '/api/notices',
];

// 설치 이벤트
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// 활성화 이벤트
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME && name !== STATIC_CACHE && name !== API_CACHE)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch 이벤트
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API 요청 처리
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // 정적 리소스 처리 (Cache First)
  event.respondWith(handleStaticRequest(request));
});

// API 요청 처리 (Network First with Cache Fallback)
async function handleApiRequest(request) {
  const url = new URL(request.url);
  const isCacheable = CACHEABLE_API_ROUTES.some(route => url.pathname.startsWith(route));

  // GET 요청이 아니거나 캐시 불가 경로면 네트워크만 사용
  if (request.method !== 'GET' || !isCacheable) {
    try {
      return await fetch(request);
    } catch (error) {
      // POST 요청 실패 시 오프라인 표시
      if (request.method === 'POST' || request.method === 'PUT') {
        return new Response(
          JSON.stringify({
            error: 'Offline',
            message: '오프라인 상태입니다. 연결이 복구되면 자동으로 동기화됩니다.',
            offline: true
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
      throw error;
    }
  }

  // GET 요청: Network First, Cache Fallback
  try {
    const networkResponse = await fetch(request);

    // 성공적인 응답이면 캐시에 저장
    if (networkResponse.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', url.pathname);

    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      // 캐시된 응답에 오프라인 표시 헤더 추가
      const headers = new Headers(cachedResponse.headers);
      headers.set('X-From-Cache', 'true');

      return new Response(cachedResponse.body, {
        status: cachedResponse.status,
        statusText: cachedResponse.statusText,
        headers,
      });
    }

    // 캐시도 없으면 오프라인 응답
    return new Response(
      JSON.stringify({
        error: 'Offline',
        message: '오프라인 상태이며 캐시된 데이터가 없습니다.',
        offline: true
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// 정적 리소스 처리 (Cache First with Network Fallback)
async function handleStaticRequest(request) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    // 백그라운드에서 업데이트
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse.ok) {
          caches.open(STATIC_CACHE)
            .then((cache) => cache.put(request, networkResponse));
        }
      })
      .catch(() => {/* 네트워크 실패 무시 */});

    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    // HTML 요청이면 오프라인 페이지 반환
    if (request.headers.get('accept')?.includes('text/html')) {
      return new Response(
        `<!DOCTYPE html>
        <html lang="ko">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>오프라인 - ABC Staff</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
            }
            .container {
              text-align: center;
              padding: 2rem;
            }
            .icon { font-size: 4rem; margin-bottom: 1rem; }
            h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
            p { opacity: 0.9; margin-bottom: 1.5rem; }
            button {
              background: white;
              color: #667eea;
              border: none;
              padding: 0.75rem 1.5rem;
              border-radius: 0.5rem;
              font-size: 1rem;
              cursor: pointer;
              font-weight: 600;
            }
            button:hover { opacity: 0.9; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">📡</div>
            <h1>오프라인 상태입니다</h1>
            <p>인터넷 연결을 확인해주세요.<br>연결이 복구되면 자동으로 새로고침됩니다.</p>
            <button onclick="window.location.reload()">다시 시도</button>
          </div>
          <script>
            window.addEventListener('online', () => window.location.reload());
          </script>
        </body>
        </html>`,
        {
          status: 200,
          headers: { 'Content-Type': 'text/html' }
        }
      );
    }

    throw error;
  }
}

// 백그라운드 동기화
self.addEventListener('sync', (event) => {
  console.log('[SW] Sync event:', event.tag);

  if (event.tag === 'sync-pending-actions') {
    event.waitUntil(syncPendingActions());
  }
});

async function syncPendingActions() {
  // IndexedDB에서 대기 중인 액션 조회 및 동기화
  // 실제 동기화는 클라이언트 측 offlineSync 서비스에서 처리
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({ type: 'SYNC_REQUESTED' });
  });
}

// 푸시 알림
self.addEventListener('push', (event) => {
  console.log('[SW] Push received');

  let data = { title: 'ABC Staff', body: '새로운 알림이 있습니다.' };

  try {
    data = event.data?.json() || data;
  } catch (e) {
    data.body = event.data?.text() || data.body;
  }

  const options = {
    body: data.body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    vibrate: [100, 50, 100],
    data: data.data || {},
    actions: data.actions || [],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// 알림 클릭
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');

  event.notification.close();

  const deepLink = event.notification.data?.deepLink || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window' })
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

// 메시지 수신 (클라이언트와 통신)
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((names) => {
      names.forEach((name) => caches.delete(name));
    });
  }
});

console.log('[SW] Service Worker loaded');
