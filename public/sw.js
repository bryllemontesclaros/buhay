// Buhay / Takda Service Worker (Network-First, Auto-Purge Old Caches)
self.addEventListener('install', e => {
  self.skipWaiting()
})

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)

  // Never intercept Firebase, Google auth, analytics, APIs, or non-GET writes.
  if (
    url.hostname.includes('firebase') ||
    url.hostname.includes('google') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('gstatic') ||
    url.hostname.includes('firebaseapp') ||
    url.hostname.includes('openstreetmap') ||
    url.hostname.includes('cartocdn') ||
    url.hostname.includes('unpkg') ||
    e.request.method !== 'GET'
  ) {
    return
  }

  // Network-first for EVERYTHING: Always try network to get newest deployment, fallback to cache only if truly offline
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  )
})
