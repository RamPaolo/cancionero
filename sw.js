/* Cancionero: guarda la app en el equipo para usarla sin internet y abrirla al instante.
   - La app (index.html, app.js, core.js, app.css): se abre SIEMPRE con la copia guardada (al instante, con o sin internet).
     Cuando hay una versión nueva en GitHub, el navegador baja este archivo (sw.js) cambiado, que guarda la versión nueva
     completa en otra caja; al terminar, la app avisa «Hay una versión nueva» y al tocar «Actualizar» se usa la nueva.
     Así nunca se mezclan archivos de dos versiones.
   - Las canciones (canciones.json): primero internet (espera corta) y si no, la copia guardada.
   - Fuentes e íconos: la copia guardada (no cambian). */
var VERSION = 'cfp-20261007-183559';
var ARCHIVOS = ["./", "index.html", "app.css", "core.js", "app.js", "canciones.json", "manifest.webmanifest", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png", "favicon-32.png", "balsamiq-sans-400.woff2", "balsamiq-sans-700.woff2", "balsamiq-sans-700i.woff2", "barlow-condensed-600.woff2", "barlow-condensed-700.woff2", "barlow-400.woff2", "barlow-600.woff2", "barlow-700.woff2"];

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
function buscarCopia(clave) { return caches.open(VERSION).then(function (c) { return c.match(clave, { ignoreSearch: true }); }); }

/* Primero internet (con espera máxima); si no responde a tiempo o falla, la copia guardada. */
function primeroRed(req, clave, espera) {
  return new Promise(function (resolve) {
    var listo = false;
    function conCopia(final) {
      return buscarCopia(clave).then(function (r) {
        if (listo) return;
        if (r) { listo = true; marcarCopia(r).then(resolve); }
        else if (final) { listo = true; resolve(new Response('Sin conexión y sin copia guardada.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })); }
      });
    }
    var t = setTimeout(function () { conCopia(false); }, espera || 2500);
    // sin la caché del navegador: GitHub Pages la guarda 10 minutos y retrasaría las actualizaciones
    fetch(req.url, { cache: 'no-store', credentials: 'same-origin' }).then(function (res) {
      clearTimeout(t);
      guardar(clave, res);
      if (!listo) { listo = true; resolve(res); }
    }).catch(function () { clearTimeout(t); conCopia(true); });
  });
}
/* Primero la copia guardada; si todavía no hay copia (la primera vez), internet. */
function primeroCopia(req, clave) {
  return buscarCopia(clave).then(function (r) {
    return r || fetch(req).then(function (res) { guardar(clave, res); return res; });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.searchParams.has('v')) return;   // búsqueda de actualizaciones: siempre directo a internet
  if (req.mode === 'navigate') { e.respondWith(primeroCopia(req, new URL('index.html', self.location).href)); return; }
  if (/\/canciones\.json$/.test(url.pathname)) { e.respondWith(primeroRed(req, new URL('canciones.json', self.location).href, 2500)); return; }
  e.respondWith(primeroCopia(req, req));
});
