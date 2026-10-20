'use strict';

const CACHE = 'schedule-in251-pwa-2.3.5';
const SHELL = [
  './',
  './index.html',
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

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then(response => {
        if (response.ok) caches.open(CACHE).then(cache => cache.put('./index.html', response.clone()));
        return response;
      }).catch(() => caches.open(CACHE).then(cache => cache.match('./index.html')))
    );
    return;
  }

  const shellUrls = SHELL.map(file => new URL(file, scope).href);
  if (!shellUrls.includes(url.href)) return;
  event.respondWith(
    caches.open(CACHE).then(cache => cache.match(request).then(cached => cached || fetch(request)))
  );
});
