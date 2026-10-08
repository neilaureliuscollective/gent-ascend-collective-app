const FALLBACK_CACHE = 'gent-ascend-fallback-v5';
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(FALLBACK_CACHE)
      .then((cache) =>
        cache.addAll([
          '/offline.html',
          '/brand/aether-20261007-192.png',
          '/performance-offline.html',
          '/performance-offline.css',
          '/performance-offline.js',
          '/performance-store.js',
        ]),
      )
      // Only static fallbacks change; never reload a page or interrupt a private draft.
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('gent-ascend-fallback-') && key !== FALLBACK_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const staticPerformance = [
    '/performance-offline.html',
    '/performance-offline.css',
    '/performance-offline.js',
    '/performance-store.js',
  ];
  if (url.origin === self.location.origin && staticPerformance.includes(url.pathname)) {
    event.respondWith(
      fetch(event.request).catch(async () =>
        (await caches.open(FALLBACK_CACHE)).match(url.pathname),
      ),
    );
    return;
  }
  if (
    url.origin !== self.location.origin ||
    event.request.mode !== 'navigate' ||
    (!/^\/app(?:\/|$)/.test(url.pathname) && !/^\/experience(?:\/|$)/.test(url.pathname))
  )
    return;
  event.respondWith(
    fetch(event.request).catch(async () => {
      const cache = await caches.open(FALLBACK_CACHE);
      return (
        (await cache.match(
          ['/app/performance', '/experience/performance/practice'].includes(url.pathname)
            ? '/performance-offline.html'
            : '/offline.html',
        )) ||
        new Response('Aethelios needs a connection. Reconnect and reload.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })
      );
    }),
  );
});
