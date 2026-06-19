const CACHE = 'buhay-v2'
const APP_SHELL = '/'
const ASSETS = [APP_SHELL, '/manifest.json', '/buhay-icon.svg', '/favicon.svg']

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)))
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ))
  self.clients.claim()
})

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)

  // Never cache Firebase, Google auth, API calls, or non-GET writes.
  if (
    url.hostname.includes('firebase') ||
    url.hostname.includes('google') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('gstatic') ||
    url.hostname.includes('firebaseapp') ||
    e.request.method !== 'GET'
  ) {
    return // Let browser handle normally
  }

  // Network-first for app navigations, fallback to the cached shell for PWA launches/offline refreshes.
  if (e.request.mode === 'navigate' || e.request.headers.get('accept')?.includes('text/html')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put(APP_SHELL, clone))
          return res
        })
        .catch(() => caches.match(e.request).then(cached => cached || caches.match(APP_SHELL)))
    )
    return
  }

  // Cache-first for static assets (JS, CSS, fonts)
  if (url.pathname.match(/\.(js|css|woff2?|ttf|svg|png|ico)$/)) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        const clone = res.clone()
        caches.open(CACHE).then(c => c.put(e.request, clone))
        return res
      }))
    )
    return
  }

  // Network-first for everything else
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)))
})
