/* The Interactive Notebook — offline helper. Change VERSION when images or icons change. */
const VERSION = 'inb-v3';
const SHELL = [
  './', 'index.html', 'manifest.json',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png',
  'img/signin-globe.webp', 'img/hdr-compass.webp', 'img/signin-plane.webp', 'img/corner-books.webp',
  'img/signin-top.webp', 'img/hdr-home.webp', 'img/corner-compass.webp'
];

self.addEventListener('install', (e) => {
  // cache: 'reload' gets fresh copies from GitHub, not the browser's short-term copies.
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function withTimeout(p, ms) {
  return new Promise((ok, no) => { const t = setTimeout(() => no(new Error('slow')), ms); p.then((r) => { clearTimeout(t); ok(r); }, (e) => { clearTimeout(t); no(e); }); });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // The app page: get the newest version when online (so updates arrive), use the saved copy when offline or slow.
  // 'no-cache' always asks GitHub whether the page changed (a tiny check when it didn't), and slow classroom Wi-Fi
  // gets 15 seconds. With no internet at all the saved copy opens right away.
  if (req.mode === 'navigate' || (url.origin === location.origin && url.pathname.endsWith('/index.html'))) {
    e.respondWith(
      withTimeout(fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }), 15000)
        .then((res) => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put('index.html', copy)); } return res; })
        .catch(() => caches.match('index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  // Pictures, icons and the app's own files: saved copy first.
  if (url.origin === location.origin) {
    e.respondWith(caches.match(req).then((r) => r || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    })));
    return;
  }

  // Fonts: use the saved copy, refresh it in the background.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(VERSION).then((c) => c.match(req).then((hit) => {
      const net = fetch(req).then((res) => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })));
    return;
  }
  // Everything else (the Google Sheet, PDF reader) goes straight to the internet, never saved.
});
