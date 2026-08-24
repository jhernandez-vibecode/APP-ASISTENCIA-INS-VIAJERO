/* Service worker de Asistencia INS Viajero.
   Estrategia: RED PRIMERO con respaldo en caché.
   - Con internet: siempre la versión más nueva (nada de páginas viejas pegadas).
   - Sin internet: sirve la última copia buena — la guía de emergencia
     tiene que abrir aunque el roaming falle.
   Al cambiar la versión del caché, el activate borra los viejos. */
var CACHE = 'viajero-v1';
var CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './sdi-logo.svg',
  './INS BLANCO.png',
  './favicon.ico',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(function (res) {
      // Guardar copia fresca (también CDNs: Tailwind, Lucide, fuentes).
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copy); }).catch(function () {});
      return res;
    }).catch(function () {
      // Sin red: última copia buena; una navegación cae al index.
      return caches.match(e.request, { ignoreSearch: e.request.mode === 'navigate' }).then(function (m) {
        return m || caches.match('./index.html');
      });
    })
  );
});
