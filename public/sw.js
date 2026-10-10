// TurboNetwork PWA - High Performance Service Worker
const CACHE_NAME = 'turbonetwork-pwa-v3';

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
  // IMPORTANTE: Omitir SSE (Server-Sent Events) para que el navegador mantenga el flujo continuo directo sin buffering
  if (url.pathname.startsWith('/api/messages/events') || req.headers.get('accept')?.includes('text/event-stream')) {
    return;
  }
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

// ==============================================================================
// 4. NOTIFICACIONES PUSH & MOBILE (ANDROID & IPHONE IOS 16.4+ PWA)
// ==============================================================================

// Manejar clic en una notificación en Android e iOS
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : '/chat';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Si la ventana de chat ya está abierta, traerla al frente
      for (const client of clientList) {
        if (client.url.includes('/chat') && 'focus' in client) {
          return client.focus();
        }
      }
      // Si no hay ventana abierta, abrir una nueva
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Evento Push remoto (Web Push API)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const title = payload.title || 'TurboChat • Mensaje Nuevo';
    const options = {
      body: payload.body || 'Has recibido un nuevo mensaje',
      icon: payload.icon || '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      vibrate: [200, 100, 200],
      tag: payload.tag || 'turbochat-push-' + Date.now(),
      renotify: true,
      data: {
        url: payload.url || '/chat',
        conversationId: payload.conversationId,
        timestamp: Date.now()
      }
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    // Si el payload es texto plano
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification('TurboChat', {
        body: text,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        data: { url: '/chat' }
      })
    );
  }
});
