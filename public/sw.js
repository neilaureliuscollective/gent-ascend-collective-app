const FALLBACK_CACHE = 'gent-ascend-fallback-v1';
self.addEventListener('install', event => {
  event.waitUntil(caches.open(FALLBACK_CACHE).then(cache => cache.addAll(['/offline.html', '/brand/icon-192.png'])));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('gent-ascend-fallback-') && key !== FALLBACK_CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.mode !== 'navigate' || !/^\/app(?:\/|$)/.test(url.pathname)) return;
  event.respondWith(fetch(event.request).catch(async () => {
    const cache = await caches.open(FALLBACK_CACHE);
    return await cache.match('/offline.html') || new Response('Gent Ascend needs a connection. Reconnect and reload.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }));
});
