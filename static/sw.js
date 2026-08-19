// 四语母语习得套件 Service Worker：缓存应用外壳，支持离线使用
const CACHE_NAME = 'tril-pwa-v2';
const ASSETS = [
  './',
  './index.html',
  './三语母语习得学习器.html',
  './三语母语习得测试器.html',
  './三语母语习得快速播放器.html',
  './三语母语习得闪记.html',
  './learner.webmanifest',
  './tester.webmanifest',
  './index.webmanifest',
  './icon-learner.png',
  './icon-learner-192.png',
  './icon-tester.png',
  './icon-tester-192.png',
  './favicon-learner.png',
  './favicon-tester.png',
  './扫码安装.png',
  './auth-client.js',
  './tril-lib.js',
  './tril-tts.js',
  './tril-ai.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // 逐个缓存，任一失败不影响整体
      return Promise.all(
        ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[SW] 缓存失败:', url, err.message);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((resp) => {
        // 不缓存跨域/非成功响应
        if (!resp || resp.status !== 200 || resp.type !== 'basic') return resp;
        const clone = resp.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return resp;
      }).catch(() => cached);
    })
  );
});
