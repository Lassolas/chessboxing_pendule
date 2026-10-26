// Offline cache for the clock. Bump VERSION when the files change.
const VERSION = 'pendule-v23';
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'clock.js', 'sound.js', 'hands.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Network first so updates arrive at once, cache when offline. On a slow
// gym connection, the cached copy is served after 3 s instead of waiting.
const TIMEOUT_MS = 3000;

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const cacheable = url.origin === location.origin || url.hostname.startsWith('fonts.g');
  // no-cache: always ask GitHub Pages whether the file changed, instead of
  // reusing the phone's HTTP cache (Pages caches files for 10 minutes).
  const network = fetch(e.request, { cache: 'no-cache' }).then(res => {
    if (res.ok && cacheable) {
      const copy = res.clone();
      caches.open(VERSION).then(c => c.put(e.request, copy));
    }
    return res;
  });
  const cached = caches.match(e.request, { ignoreSearch: true });
  const slow = new Promise(resolve => setTimeout(resolve, TIMEOUT_MS)).then(() => cached);
  e.respondWith(
    Promise.race([network, slow.then(r => r || network)])
      .catch(() => cached)
      .then(r => r || cached)
      .then(r => r || Response.error())
  );
});
