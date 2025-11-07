// Knot Testing App Service Worker
const CACHE_NAME = 'knot-app-cache-v1';

// Resources to cache on install
const PRECACHE_RESOURCES = [
  './KnotPractice/',
  './KnotPractice/index.html',
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.min.js',
  'https://unpkg.com/lucide-static@latest/font/Lucide.ttf',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  'https://fonts.gstatic.com',
  'https://fonts.googleapis.com'
];

// Cache Lucide SVG icons that the app uses
const ICON_URLS = [
  'list', 'plus', 'test-tube', 'chart-no-axes-combined', 'download', 'upload',
  'pencil', 'trash', 'eye', 'chevron-left', 'book-open', 'x', 'check',
  'search', 'filter', 'rotate-ccw', 'save', 'menu'
].map(icon => `https://unpkg.com/lucide-static@latest/icons/${icon}.svg`);

// Install event - cache core resources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching app resources');
        return cache.addAll([...PRECACHE_RESOURCES, ...ICON_URLS]);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => {
          return cacheName !== CACHE_NAME;
        }).map(cacheName => {
          return caches.delete(cacheName);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip browser extension and cross-origin requests without credentials
  const url = new URL(event.request.url);
  if (url.origin !== location.origin && !event.request.url.includes('unpkg.com') && 
      !event.request.url.includes('cdn.jsdelivr.net') && !event.request.url.includes('fonts.googleapis.com') &&
      !event.request.url.includes('fonts.gstatic.com')) {
    return;
  }
  
  // Handle requests for JSON data specially (for URL imports)
  if (url.pathname.endsWith('.json')) {
    event.respondWith(
      fetch(event.request).then(response => {
        // Clone the response to store in cache
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });
        return response;
      }).catch(() => {
        // If failed, try to serve from cache
        return caches.match(event.request);
      })
    );
    return;
  }
  
  // For all other requests, try cache first, then network
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // Not in cache, get from network
        return fetch(event.request).then(response => {
          // Check if valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            // Don't cache non-successful or non-basic responses
            return response;
          }
          
          // Clone the response to store in cache
          const responseToCache = response.clone();
          
          // Cache media resources for offline use
          if (event.request.url.match(/\.(jpg|jpeg|png|gif|svg|webp|mp4|webm)$/i)) {
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
          }
          
          return response;
        }).catch(error => {
          console.log('Fetch failed:', error);
          // Could return a custom offline page/image here
          return new Response('Network error occurred', {
            status: 503,
            statusText: 'Service Unavailable'
          });
        });
      })
  );
});

// Handle cache updates for media resources
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'CACHE_MEDIA') {
    const urls = event.data.urls;
    if (Array.isArray(urls) && urls.length > 0) {
      event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
          return Promise.all(
            urls.map(url => 
              fetch(url, { mode: 'no-cors' })
                .then(response => cache.put(url, response))
                .catch(err => console.warn('Failed to cache media:', url, err))
            )
          );
        })
      );
    }
  }
}); 
