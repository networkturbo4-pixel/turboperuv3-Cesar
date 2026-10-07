// TurboNetwork PWA - High Performance Service Worker
const CACHE_NAME = 'turbonetwork-pwa-v2';

const STATIC_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/tailwind.min.css',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable.png',
  '/icons/icon.svg',
  '/js/maps-module.js',
  '/assets/mapbox-gl.css',
  '/js/mapbox-gl.js',
  '/js/jsQR.min.js'
];

// 1. INSTALACIÓN: Precarga del Shell de la aplicación
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Usar individualmente para que si uno falla no rompa la instalación
      await Promise.allSettled(
        STATIC_SHELL.map((url) =>
          cache.add(url).catch((err) => {
            console.warn(`[SW] Falló precarga de recurso opcional ${url}:`, err.message);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// 2. ACTIVACIÓN: Limpiar cachés antiguas y tomar control de clientes
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Purgando caché obsoleta:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. FETCH: Estrategias según tipo de solicitud
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Solo interceptar peticiones GET (ignorar POST/PUT/DELETE/PATCH para no alterar transacciones)
  if (req.method !== 'GET') {
    return;
  }

  // A. NAVEGACIÓN PRINCIPAL (HTML / SPA): Network First con fallback a Shell en caché
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          const fallback = await caches.match('/index.html');
          return fallback || caches.match('/');
        })
    );
    return;
  }

  // B. RUTAS API (/api/*): Network First estricto con respuesta offline controlada
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(req)
        .then((response) => {
          return response;
        })
        .catch(async () => {
          // Intentar responder con caché si existiera
          const cached = await caches.match(req);
          if (cached) return cached;

          // Si no hay red ni caché, devolver JSON offline controlado
          return new Response(
            JSON.stringify({
              error: 'NETWORK_OFFLINE',
              message: 'Sin conexión a Internet. Las funciones en vivo se sincronizarán al reconectar.',
              offline: true,
              timestamp: new Date().toISOString()
            }),
            {
              status: 503,
              statusText: 'Service Unavailable',
              headers: { 'Content-Type': 'application/json' }
            }
          );
        })
    );
    return;
  }

  // C. ASSETS ESTÁTICOS Y RECURSOS CDN (CSS, JS, Fonts, Img): Stale-While-Revalidate
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      const fetchPromise = fetch(req)
        .then((networkResponse) => {
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkResponse;
        })
        .catch(() => {
          // Silencioso ante pérdida de red para recursos en segundo plano
        });

      // Retornar caché inmediatamente si existe, o esperar a la red
      return cachedResponse || fetchPromise;
    })
  );
});
