// Bump SHELL_V whenever index.html or app-shell assets change to force a cache refresh.
const SHELL_V   = 'app-shell-v1';
const RUNTIME_V = 'runtime-v1';
const SHELL_URLS = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg', '/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(SHELL_V)
      .then(c => c.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== SHELL_V && k !== RUNTIME_V).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Navigation: network-first so deployments land quickly; fall back to cached shell.
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // esm.sh CDN modules: cache-first; store on network hit.
  if (url.hostname === 'esm.sh') {
    e.respondWith(
      caches.open(RUNTIME_V).then(async cache => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const resp = await fetch(request);
        if (resp.ok) cache.put(request, resp.clone());
        return resp;
      })
    );
    return;
  }

  // Same-origin assets: cache-first.
  if (url.origin === self.location.origin) {
    e.respondWith(caches.match(request).then(hit => hit || fetch(request)));
  }
});
