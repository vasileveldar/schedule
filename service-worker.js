'use strict';

const CACHE = 'schedule-in251-f492037eeb11';
const SHELL = [
  "./",
  "./apple-touch-icon.png",
  "./css/app.css",
  "./data/app-config.json",
  "./data/assessment.json",
  "./data/schedule.json",
  "./data/translations.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable.png",
  "./index.html",
  "./js/app.js",
  "./js/boot.js",
  "./js/lazy-game.js",
  "./js/lazy-owner.js",
  "./js/telegram.js",
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
