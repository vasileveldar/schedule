// Retire the v3 offline cache after returning to the standalone v2.2 schedule.
const BASE = new URL('./', self.location.href);
const PREFIX = 'schedule-public-' + encodeURIComponent(BASE.pathname) + '-';
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const name of await caches.keys()) {
    if (name.startsWith(PREFIX)) await caches.delete(name);
  }
  await self.clients.claim();
  await self.registration.unregister();
})()));
// No fetch handler: all requests go directly to the published site.
