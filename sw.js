const CACHE_NAME = 'cybersec-news-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;600&family=Inter:wght@300;400;600&display=swap'
];

// Instalación del Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Archivos cacheados exitosamente');
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
  self.skipWaiting();
});

// Activación y limpieza de cachés antiguos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('Limpiando caché antiguo', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Estrategia Network First, fallback a Cache
self.addEventListener('fetch', event => {
  // Evitar interceptar requests que no son GET o de chrome-extension
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
      return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Clonar la respuesta
        const responseClone = response.clone();
        
        // No cacheamos news.json agresivamente para siempre ver las nuevas
        if (!event.request.url.includes('news.json')) {
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseClone);
              });
        }
        return response;
      })
      .catch(() => {
        // Si no hay red, buscar en caché
        return caches.match(event.request);
      })
  );
});
