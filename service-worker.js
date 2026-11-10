'use strict';

const CACHE = 'schedule-in251-b53f37995259';
const SHELL = [
  "./",
  "./apple-touch-icon.png",
  "./css/android.css",
  "./css/base.css",
  "./css/design.css",
  "./data/assessment.json",
  "./data/schedule.json",
  "./data/translations.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable.png",
  "./index.html",
  "./js/android.js",
  "./js/boot.js",
  "./js/feedback.js",
  "./js/game.js",
  "./js/i18n.js",
  "./js/motion.js",
  "./js/navigation.js",
  "./js/telegram.js",
  "./js/ui.js",
  "./manifest.webmanifest"
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// Сначала сеть (всегда свежее расписание), без сети — копия из кэша.
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  const scope = new URL(self.registration.scope);
  if (request.method !== 'GET' || url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;

  event.respondWith(
    fetch(request, { cache: 'no-cache' }).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(request, copy));
      }
      return response;
    }).catch(() =>
      caches.open(CACHE).then(cache =>
        cache.match(request, { ignoreSearch: true }).then(hit => hit || (request.mode === 'navigate' ? cache.match('./index.html') : undefined))
      )
    )
  );
});
