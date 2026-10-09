// Diva's Agenda — Service Worker
const CACHE = 'divas-v8';
const SHELL = [
  './', './index.html', './styles.css', './app.js', './manifest.webmanifest',
  './vendor/supabase.js', './img/logo.png', './img/sky.jpg',
  './img/icon-192.png', './img/icon-512.png', './img/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // Supabase sempre in rete
  // network-first: aggiornamenti immediati, cache se offline
  e.respondWith(
    fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
  );
});

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data.json(); } catch { d = { title: "Diva's", body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || "Diva's Hairboutique", {
    body: d.body || '',
    icon: './img/icon-192.png',
    badge: './img/icon-192.png',
    tag: d.tag,
    renotify: true,
    vibrate: [120, 60, 120],
    data: { url: d.url || './' }
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = new URL(e.notification.data?.url || './', self.registration.scope).href;
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if (c.url.startsWith(self.registration.scope)) {
        await c.focus();
        c.postMessage({ type: 'navigate', url: target });
        return;
      }
    }
    await self.clients.openWindow(target);
  })());
});
