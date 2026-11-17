/* Service worker: la aplicación instalada funciona siempre, con o sin internet.
   - Busca primero la versión nueva en internet, pero espera como máximo unos segundos:
     si internet está lento, cortado, o el sitio responde con error (404, 500...), abre la copia guardada.
   - Nunca deja la app en blanco ni muestra la página de error del servidor si hay una copia guardada.
   - La copia guardada se actualiza sola cada vez que hay internet. */
const CACHE = 'tgs-v3.9.0';
const ESPERA_MS = 3500; // tiempo máximo esperando a internet antes de abrir la copia guardada
let lentoHasta = 0;     // si internet acaba de fallar, por 30 s se usa la copia guardada sin esperar
const SHELL = [
  './', 'index.html', 'css/app.css', 'js/engine.js', 'js/charts.js', 'js/pdf.js', 'js/app.js',
  'assets/flame.png', 'assets/brand.js', 'vendor/jspdf.umd.min.js', 'vendor/jspdf.plugin.autotable.min.js',
  'manifest.webmanifest', 'assets/flame.svg', 'icons/favicon.ico', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-192.png', 'icons/maskable-512.png'
];

self.addEventListener('install', (e) => {
  // Cada archivo por separado: si uno falla, los demás igual quedan guardados (la instalación no se cae).
  e.waitUntil(caches.open(CACHE)
    .then((c) => Promise.all(SHELL.map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => null))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('tgs-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Copia guardada de una petición; para abrir la app, la página principal.
async function guardada(req) {
  const c = await caches.open(CACHE);
  return (await c.match(req, { ignoreSearch: true }))
    || (req.mode === 'navigate' ? (await c.match('index.html')) || (await c.match('./')) : undefined);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const red = fetch(req, { cache: 'no-cache' }).then((r) => {
      if (r && r.ok && r.type === 'basic') { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(req, copia)).catch(() => {}); }
      return r;
    });
    red.catch(() => {}); // si falla después del tiempo de espera, no importa: ya se respondió con la copia
    if (Date.now() < lentoHasta) { const c = await guardada(req); if (c) return c; }
    const tiempo = new Promise((ok) => setTimeout(() => ok('tiempo'), ESPERA_MS));
    let r;
    try { r = await Promise.race([red, tiempo]); } catch (err) { r = null; }
    if (r && r !== 'tiempo' && r.ok) return r; // internet respondió bien y a tiempo
    // Internet lento o cortado, o el sitio entero caído: por 30 s todo sale de la copia (misma versión).
    if (!r || r === 'tiempo' || req.mode === 'navigate') lentoHasta = Date.now() + 30000;
    const copia = await guardada(req);
    if (copia) return copia; // internet lento, cortado o con error: la copia guardada
    if (r && r !== 'tiempo') return r; // sin copia guardada: lo que haya respondido el servidor
    try { return await red; } catch (err) { return Response.error(); } // sin copia: seguir esperando
  })());
});

// La app puede pedir que se borre la copia guardada (botón "Reparar").
self.addEventListener('message', (e) => {
  if (e.data === 'reparar') e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('tgs-')).map((k) => caches.delete(k)))));
});
