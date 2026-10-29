// Service worker: uygulama dosyalarını cihazda saklar; çevrimdışı açılışı sağlar.
// Kendi dosyalarımız için "önce ağ" kullanılır, böylece yeni sürümler hemen gelir.
// Firebase SDK dosyaları sürüm numaralı olduğu için "önce önbellek" kullanılır.
// Veritabanı ve giriş istekleri (googleapis.com) hiç önbelleğe alınmaz.
const ONBELLEK = 'ders-planlari-v3';
const KABUK = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'js/util.js', 'js/db.js', 'js/yetki.js', 'js/ders.js', 'js/ui.js', 'js/takvim.js', 'js/liste.js',
  'js/yonetim.js', 'js/rapor.js', 'js/demo.js', 'js/app.js', 'js/bulut.js', 'js/firebase-config.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(ONBELLEK).then(c => c.addAll(KABUK)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(adlar => Promise.all(adlar.filter(a => a !== ONBELLEK).map(a => caches.delete(a))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const istek = e.request;
  if (istek.method !== 'GET') return;
  const url = new URL(istek.url);

  if (url.origin === location.origin) {
    // no-cache: tarayıcının HTTP önbelleği yerine sunucuya sorulur (GitHub Pages 10 dk önbellekler).
    e.respondWith(fetch(istek, { cache: 'no-cache' }).then(yanit => {
      if (yanit.ok) { const kopya = yanit.clone(); caches.open(ONBELLEK).then(c => c.put(istek, kopya)); }
      return yanit;
    }).catch(() => caches.match(istek, { ignoreSearch: true }).then(y => y || caches.match('index.html'))));
    return;
  }

  if (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/')) {
    e.respondWith(caches.match(istek).then(y => y || fetch(istek).then(yanit => {
      if (yanit.ok) { const kopya = yanit.clone(); caches.open(ONBELLEK).then(c => c.put(istek, kopya)); }
      return yanit;
    })));
  }
});
