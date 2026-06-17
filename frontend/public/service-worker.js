/* Rurapp Service Worker - PWA + offline support */
const CACHE_VERSION = 'rurapp-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const API_CACHE = `${CACHE_VERSION}-api`;

const PRECACHE_URLS = [
    '/',
    '/manifest.json',
    '/icon.svg',
    '/icon-192.png',
    '/icon-512.png',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys
                    .filter((k) => !k.startsWith(CACHE_VERSION))
                    .map((k) => caches.delete(k))
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);

    // Skip cross-origin (except CDN fonts)
    const sameOrigin = url.origin === self.location.origin;
    const isFont = url.hostname.includes('fonts.g');
    const isTile = url.hostname.includes('tile.openstreetmap');

    // API: network-first, fallback to cache (only successful GETs)
    if (sameOrigin && url.pathname.startsWith('/api/')) {
        // Don't cache auth or AI streaming endpoints
        if (url.pathname.includes('/auth/') || url.pathname.includes('/ai/') || url.pathname.includes('/ws/')) {
            return;
        }
        event.respondWith(
            fetch(req)
                .then((res) => {
                    if (res.ok) {
                        const clone = res.clone();
                        caches.open(API_CACHE).then((cache) => cache.put(req, clone));
                    }
                    return res;
                })
                .catch(() => caches.match(req).then((c) => c || new Response(JSON.stringify({ offline: true }), {
                    status: 503,
                    headers: { 'Content-Type': 'application/json' },
                })))
        );
        return;
    }

    // Map tiles: cache-first
    if (isTile) {
        event.respondWith(
            caches.match(req).then((cached) => cached || fetch(req).then((res) => {
                if (res.ok) {
                    const clone = res.clone();
                    caches.open(RUNTIME_CACHE).then((cache) => cache.put(req, clone));
                }
                return res;
            }).catch(() => cached))
        );
        return;
    }

    // Fonts/Static: cache-first
    if (isFont || (sameOrigin && (url.pathname.includes('/static/') || url.pathname.endsWith('.png') || url.pathname.endsWith('.svg') || url.pathname.endsWith('.css') || url.pathname.endsWith('.js')))) {
        event.respondWith(
            caches.match(req).then((cached) => cached || fetch(req).then((res) => {
                if (res.ok) {
                    const clone = res.clone();
                    caches.open(STATIC_CACHE).then((cache) => cache.put(req, clone));
                }
                return res;
            }))
        );
        return;
    }

    // App shell: network-first with cache fallback (offline -> show cached index.html)
    if (sameOrigin) {
        event.respondWith(
            fetch(req)
                .then((res) => {
                    if (res.ok && req.mode === 'navigate') {
                        const clone = res.clone();
                        caches.open(STATIC_CACHE).then((cache) => cache.put('/', clone));
                    }
                    return res;
                })
                .catch(() => caches.match(req).then((c) => c || caches.match('/')))
        );
    }
});

// Listen for skip-waiting message from client (manual update)
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Push notification handler
self.addEventListener('push', (event) => {
    let payload = { title: 'Rurapp', body: 'Tienes una nueva actividad' };
    try {
        if (event.data) payload = event.data.json();
    } catch {}
    const options = {
        body: payload.body || payload.notification?.body || '',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        data: payload.data || {},
        tag: 'rurapp-notification',
    };
    event.waitUntil(
        self.registration.showNotification(payload.title || payload.notification?.title || 'Rurapp', options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const link = event.notification.data?.link || '/';
    event.waitUntil(
        self.clients.matchAll({ type: 'window' }).then((clients) => {
            for (const c of clients) {
                if ('focus' in c) { c.navigate(link); return c.focus(); }
            }
            if (self.clients.openWindow) return self.clients.openWindow(link);
        })
    );
});
