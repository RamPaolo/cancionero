/* Cancionero: guarda la app en el equipo para usarla sin internet.
   - La app (index.html) y las canciones (canciones.json): primero internet, y si no hay, la copia guardada.
   - Fuentes e íconos: primero la copia guardada (no cambian). */
var VERSION = 'cfp-20260926-134333';
var ARCHIVOS = ["./", "index.html", "canciones.json", "manifest.webmanifest", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png", "favicon-32.png", "balsamiq-sans-400.woff2", "balsamiq-sans-700.woff2", "balsamiq-sans-700i.woff2", "barlow-condensed-600.woff2", "barlow-condensed-700.woff2", "barlow-400.woff2", "barlow-600.woff2", "barlow-700.woff2"];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) {
    // uno por uno: si falta un archivo en el servidor, lo demás igual queda guardado
    return Promise.all(ARCHIVOS.map(function (u) { return c.add(new Request(u, { cache: 'reload' })).catch(function () { return null; }); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('cfp-') === 0 && k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function marcarCopia(res) {
  var h = new Headers(res.headers);
  h.set('X-Cancionero-Copia', '1');
  return res.blob().then(function (b) { return new Response(b, { status: res.status, statusText: res.statusText, headers: h }); });
}
function guardar(clave, res) {
  if (!res || !res.ok || res.type === 'opaque') return;
  var copia = res.clone();
  caches.open(VERSION).then(function (c) { c.put(clave, copia); });
}
function buscarCopia(clave) { return caches.match(clave, { ignoreSearch: true }); }

/* Primero internet (con espera máxima); si no responde a tiempo o falla, la copia guardada. */
function primeroRed(req, clave) {
  return new Promise(function (resolve) {
    var listo = false;
    function conCopia(final) {
      return buscarCopia(clave).then(function (r) {
        if (listo) return;
        if (r) { listo = true; marcarCopia(r).then(resolve); }
        else if (final) { listo = true; resolve(new Response('Sin conexión y sin copia guardada.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })); }
      });
    }
    var espera = setTimeout(function () { conCopia(false); }, 4000);
    fetch(req).then(function (res) {
      clearTimeout(espera);
      guardar(clave, res);
      if (!listo) { listo = true; resolve(res); }
    }).catch(function () { clearTimeout(espera); conCopia(true); });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') { e.respondWith(primeroRed(req, new URL('index.html', self.location).href)); return; }
  if (/\/canciones\.json$/.test(url.pathname)) { e.respondWith(primeroRed(req, new URL('canciones.json', self.location).href)); return; }
  e.respondWith(buscarCopia(req).then(function (r) {
    return r || fetch(req).then(function (res) { guardar(req, res); return res; });
  }));
});
