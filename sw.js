/* Service worker de Bodega.
   - Solo cachea archivos propios: la página (index.html), el manifest y los íconos.
   - NO toca ninguna petición externa (Leaflet, mapas, Nominatim, pdf.js, Tesseract, gstatic...).
   - La página siempre se busca primero en la red (network-first), así los cambios se ven apenas se publican.
   - Este archivo no necesita cambiar cuando se publica una versión nueva de la app. */
const CACHE = 'bodega-shell';
const SHELL = ['./', 'index.html', 'manifest.json', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(SHELL.map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;           // externo: no se toca

  const esPagina = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');
  if (esPagina) {
    e.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((res) => {
          if (res && res.ok) { const copia = res.clone(); caches.open(CACHE).then((c) => c.put('index.html', copia)); }
          return res;
        })
        .catch(() => caches.match('index.html').then((r) => r || caches.match('./')))
    );
    return;
  }
  // manifest e íconos: primero caché, y se refresca en segundo plano
  if (SHELL.some((u) => url.pathname.endsWith('/' + u) || url.pathname.endsWith(u))) {
    e.respondWith(
      caches.match(req).then((hit) => {
        const red = fetch(req).then((res) => { if (res && res.ok) { const copia = res.clone(); caches.open(CACHE).then((c) => c.put(req, copia)); } return res; }).catch(() => hit);
        return hit || red;
      })
    );
  }
});
