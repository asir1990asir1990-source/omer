// Service worker: يخزّن واجهة التطبيق فقط. بيانات Supabase لا تُخزَّن هنا أبداً.
const CACHE = 'ff-shell-v1'
self.addEventListener('install', () => { self.skipWaiting() })
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', e => {
  const req = e.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== location.origin) return
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(CACHE).then(ch => ch.put('/index.html', c)); return r }).catch(() => caches.match('/index.html')))
    return
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(ch => ch.put(req, c)) } return r })))
})
