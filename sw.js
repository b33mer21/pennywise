// Offline support: serve the app shell from cache, refresh it in the background.
// Bump CACHE when you want every device to drop old files.
const CACHE = 'pennywise-v10';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/banks/amana.png',
  './icons/banks/boc.png',
  './icons/banks/boch.png',
  './icons/banks/cargills.png',
  './icons/banks/citi.png',
  './icons/banks/combank.png',
  './icons/banks/deutsche.png',
  './icons/banks/dfcc.png',
  './icons/banks/hbl.png',
  './icons/banks/hnb.png',
  './icons/banks/indianbank.png',
  './icons/banks/iob.png',
  './icons/banks/mcb.png',
  './icons/banks/ndb.png',
  './icons/banks/ntb.png',
  './icons/banks/pabc.png',
  './icons/banks/peoples.png',
  './icons/banks/publicbank.png',
  './icons/banks/sampath.png',
  './icons/banks/seylan.png',
  './icons/banks/scb.png',
  './icons/banks/sbi.png',
  './icons/banks/hsbc.png',
  './icons/banks/unionbank.png',
  './icons/banks/hdfc.png',
  './icons/banks/nsb.png',
  './icons/banks/rdb.png',
  './icons/banks/sdb.png',
  './icons/banks/smib.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      const refresh = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached || (req.mode === 'navigate' ? caches.match('./index.html') : undefined));
      event.waitUntil(refresh.catch(() => {}));
      return cached || refresh;
    })
  );
});
