// Service Worker for Thoughts to Text PWA - Optimized Version
const CACHE_VERSION = '7';
const CACHE_NAME = `thoughts-to-text-v${CACHE_VERSION}`;
const STATIC_CACHE = `static-v${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-v${CACHE_VERSION}`;
const API_CACHE = `api-v${CACHE_VERSION}`;
const IMAGE_CACHE = `images-v${CACHE_VERSION}`;

// Resources to cache immediately (critical path)
// Do NOT include '/' here to avoid caching the root HTML with cache-first,
// which can cause hydration mismatches if the page changes.
const STATIC_ASSETS = [
  '/manifest.json',
  '/icon_192.png',
  '/icon_512.png',
  '/offline.html'
];

// Additional resources to prefetch
const PREFETCH_ASSETS = [
  '/',
  '/notes',
  '/settings'
];

// API endpoints that can be cached
const CACHEABLE_APIS = [
  '/api/transcribe',
  '/api/rewrite'
];

// Install event - cache static resources with optimization
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  
  event.waitUntil(
    Promise.all([
      // Cache critical static assets first
      caches.open(STATIC_CACHE).then(cache => {
        console.log('Caching critical static assets');
        return cache.addAll(STATIC_ASSETS.map(url => new Request(url, { cache: 'reload' })));
      }),
      // Initialize other caches
      caches.open(DYNAMIC_CACHE),
      caches.open(API_CACHE),
      caches.open(IMAGE_CACHE),
      // Prefetch non-critical assets
      caches.open(DYNAMIC_CACHE).then(cache => {
        console.log('Prefetching additional assets');
        return Promise.allSettled(
          PREFETCH_ASSETS.map(url => 
            fetch(url).then(response => {
              if (response.ok) {
                return cache.put(url, response);
              }
            }).catch(() => {
              // Ignore prefetch failures
            })
          )
        );
      })
    ]).then(() => {
      console.log('Service Worker installed and optimized');
      return self.skipWaiting();
    })
  );
});

// Activate event - optimized cache cleanup and client claiming
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches more efficiently
      caches.keys().then(cacheNames => {
        const currentCaches = [STATIC_CACHE, DYNAMIC_CACHE, API_CACHE, IMAGE_CACHE];
        const deletePromises = cacheNames
          .filter(cacheName => !currentCaches.includes(cacheName))
          .map(cacheName => {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          });
        return Promise.all(deletePromises);
      }),
      // Claim all clients immediately
      self.clients.claim(),
      // Optimize existing caches
      optimizeCaches()
    ]).then(() => {
      console.log('Service Worker activated and optimized');
      // Notify clients of successful activation
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'SW_ACTIVATED', version: CACHE_VERSION });
        });
      });
    })
  );
});

// Optimize caches by removing old or large entries
async function optimizeCaches() {
  try {
    const cache = await caches.open(DYNAMIC_CACHE);
    const requests = await cache.keys();
    
    // Remove entries older than 7 days
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    for (const request of requests) {
      const response = await cache.match(request);
      if (response) {
        const dateHeader = response.headers.get('date');
        if (dateHeader) {
          const responseDate = new Date(dateHeader).getTime();
          if (responseDate < oneWeekAgo) {
            await cache.delete(request);
          }
        }
      }
    }
  } catch (error) {
    console.warn('Cache optimization failed:', error);
  }
}

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and chrome-extension requests
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return;
  }

  // Handle different types of requests
  if (isStaticAsset(request)) {
    event.respondWith(handleStaticAsset(request));
  } else if (isAPIRequest(request)) {
    event.respondWith(handleAPIRequest(request));
  } else if (isNavigationRequest(request)) {
    event.respondWith(handleNavigationRequest(request));
  } else {
    event.respondWith(handleDynamicRequest(request));
  }
});

// Background sync for queued requests
self.addEventListener('sync', (event) => {
  console.log('Background sync triggered:', event.tag);
  
  if (event.tag === 'transcription-sync') {
    event.waitUntil(processTranscriptionQueue());
  } else if (event.tag === 'rewrite-sync') {
    event.waitUntil(processRewriteQueue());
  }
});

// Message handling for communication with main thread
self.addEventListener('message', (event) => {
  const { data } = event;
  
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    event.ports[0].postMessage({ success: true });
  } else if (data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  } else if (data.type === 'CLEAR_CACHE') {
    clearAllCaches().then(() => {
      event.ports[0].postMessage({ success: true });
    });
  }
});

// Helper functions
function isStaticAsset(request) {
  const url = new URL(request.url);
  return url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/) ||
         STATIC_ASSETS.includes(url.pathname);
}

function isAPIRequest(request) {
  const url = new URL(request.url);
  return url.pathname.startsWith('/api/');
}

function isNavigationRequest(request) {
  return request.mode === 'navigate' || 
         (request.method === 'GET' && request.headers.get('accept').includes('text/html'));
}

// Cache-first strategy for static assets
async function handleStaticAsset(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('Static asset fetch failed:', error);
    return new Response('Asset not available offline', { status: 503 });
  }
}

// Network-first strategy for API requests with offline fallback
async function handleAPIRequest(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok && request.method === 'GET') {
      const cache = await caches.open(API_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('API request failed, checking cache:', request.url);
    
    // Try to serve from cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline response for API calls
    return new Response(
      JSON.stringify({ 
        error: 'Offline - request queued for sync',
        offline: true 
      }), 
      { 
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Network-first strategy for navigation with offline fallback
async function handleNavigationRequest(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Navigation request failed, checking cache:', request.url);
    
    // Try cached version
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // For deep links to notes, try serving the notes index shell
    const requestUrl = new URL(request.url);
    if (requestUrl.pathname.startsWith('/notes/')) {
      const notesShell = await caches.match('/notes');
      if (notesShell) {
        return notesShell;
      }
    }
    
    // Try to serve the root page for SPA routing
    const rootResponse = await caches.match('/');
    if (rootResponse) {
      return rootResponse;
    }
    
    // Fallback to offline page
    return caches.match('/offline.html') || 
           new Response('Offline', { status: 503 });
  }
}

// Stale-while-revalidate for dynamic content
async function handleDynamicRequest(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cachedResponse = await cache.match(request);
  
  const fetchPromise = fetch(request).then(networkResponse => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => cachedResponse);
  
  return cachedResponse || fetchPromise;
}

// Background sync handlers
async function processTranscriptionQueue() {
  console.log('Processing transcription queue...');
  // This will be handled by the main application
  // Send message to all clients to process their queues
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({ type: 'PROCESS_TRANSCRIPTION_QUEUE' });
  });
}

async function processRewriteQueue() {
  console.log('Processing rewrite queue...');
  // This will be handled by the main application
  // Send message to all clients to process their queues
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({ type: 'PROCESS_REWRITE_QUEUE' });
  });
}

async function clearAllCaches() {
  const cacheNames = await caches.keys();
  return Promise.all(cacheNames.map(name => caches.delete(name)));
}

console.log('Service Worker loaded');