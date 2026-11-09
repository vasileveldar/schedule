'use strict';

const CACHE = 'schedule-in251-pwa-android-fork-0.2.0';
const SHELL = [
  './',
  './index.html',
  './android-fork.css',
  './android-fork.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(key => (key.startsWith('schedule-in251-pwa-') || key.startsWith('in251-v2-')) && key !== CACHE)
        .map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  const scope = new URL(self.registration.scope);
  if (request.method !== 'GET' || url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;

  // Навигация (HTML): сначала сеть, при офлайне — кэш
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put('./index.html', copy));
        }
        return response;
      }).catch(() => caches.open(CACHE).then(cache => cache.match('./index.html')))
    );
    return;
  }

  // Для JS, CSS и манифеста тоже используем Network First, чтобы обновления в Telegram WebView применялись сразу
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname.endsWith('.webmanifest')) {
    event.respondWith(
      fetch(request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, copy));
        }
        return response;
      }).catch(() => caches.open(CACHE).then(cache => cache.match(request)))
    );
    return;
  }

  // Иконки и статика: Cache First
  const shellUrls = SHELL.map(file => new URL(file, scope).href);
  if (!shellUrls.includes(url.href)) return;
  event.respondWith(
    caches.open(CACHE).then(cache => cache.match(request).then(cached => cached || fetch(request)))
  );
});