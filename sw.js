/* Service worker: la aplicación funciona sin conexión después de la primera visita. */
const CACHE = 'tgs-v2.0.0';
const SHELL = [
  './', 'index.html', 'css/app.css', 'js/engine.js', 'js/charts.js', 'js/pdf.js', 'js/app.js',
  'assets/flame.png', 'assets/brand.js', 'vendor/jspdf.umd.min.js', 'vendor/jspdf.plugin.autotable.min.js',
  'manifest.webmanifest', 'icons/icon-32.png', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'
];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  // Red primero para HTML (siempre la última versión), caché primero para lo demás.
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; }).catch(() => caches.match('index.html')));
    return;
  }
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((r) => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return r;
  })));
});
