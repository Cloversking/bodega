/* Service worker de Bodega.
   - Solo cachea archivos propios: la página (index.html), catalogo.js, el manifest y los íconos.
   - NO toca ninguna petición externa (Leaflet, mapas, Nominatim, pdf.js, Tesseract, gstatic...).
   - index.html y catalogo.js se buscan primero en la red (network-first): los cambios se ven apenas se publican.
   - Este archivo no necesita cambiar cuando se publica una versión nueva de la app o del catálogo. */
const CACHE = 'bodega-shell';
const SHELL = ['./', 'index.html', 'catalogo.js', 'manifest.json', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];

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
  const esCatalogo = url.pathname.endsWith('/catalogo.js');
  if (esPagina || esCatalogo) {
    const clave = esCatalogo ? 'catalogo.js' : 'index.html';
    e.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((res) => { if (res && res.ok) { const copia = res.clone(); caches.open(CACHE).then((c) => c.put(clave, copia)); } return res; })
        .catch(() => caches.match(clave).then((r) => r || caches.match('./')))
    );
    return;
  }
  if (SHELL.some((u) => url.pathname.endsWith('/' + u))) {   // manifest e íconos: caché primero, se refresca de fondo
    e.respondWith(
      caches.match(req).then((hit) => {
        const red = fetch(req).then((res) => { if (res && res.ok) { const copia = res.clone(); caches.open(CACHE).then((c) => c.put(req, copia)); } return res; }).catch(() => hit);
        return hit || red;
      })
    );
  }
});
