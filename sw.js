/* HFS-Simulationen – Service Worker: erst Netz, dann Cache. Nur eigene GET-Anfragen, nur erfolgreiche Antworten. */
const CACHE = 'hfs-sim';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || !r.url.startsWith(self.location.origin)) return;
  if (r.url.endsWith('.zip') || r.url.includes('version.json')) return;   // große Datei und Versionsabfrage nicht cachen
  e.respondWith(fetch(r).then(res => {
    if (res.ok && res.type === 'basic') { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); }
    return res;
  }).catch(() => caches.match(r, { ignoreSearch: true }).then(m => m || Response.error())));
});
