// 四语母语习得套件 Service Worker：缓存应用外壳，支持离线使用
const CACHE_NAME = 'tril-pwa-v20';
const ASSETS = [
  './',
  './index.html',
  './三语母语习得学习器.html',
  './三语母语习得测试器.html',
  './三语母语习得快速播放器.html',
  './三语母语习得闪记.html',
  './三语母语习得复习.html',
  './三语母语习得错题复习.html',
  './词典.html',
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
  './tril-ai.js',
  './tril-db.js',
  './tril-migrate.js',
  './tril-csv.js',
  './tril-study.js',
  './tril-skin.css',
  './tril-skin-widget.js',
  './app-tester.js',
  './app-player.js',
  './app-flash.js?v=11',
  './app-review.js',
  './pinyin-pro.min.js',
  './tril-pinyin.js',
  './三语母语习得核心词库.index.js',
  './三语母语习得核心词库.part1.js',
  './三语母语习得核心词库.part2.js',
  './三语母语习得核心词库.part3.js',
  './三语母语习得核心词库.part4.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // 逐个缓存，任一失败不影响整体；part 文件大，但 cache.addAll 会一次性下载
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

// 词库 part 文件：cache-first 永久缓存，避免每次访问重复下载 30MB
const PART_RE = /^.*三语母语习得核心词库\.part\d+\.js$/;
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = event.request.url;
  const isPart = PART_RE.test(url);
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached){
        // 后台异步刷新（stale-while-revalidate）
        if(isPart){
          fetch(event.request).then(resp => {
            if(resp && resp.status === 200){
              const clone = resp.clone();
              caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
            }
          }).catch(()=>{});
        }
        return cached;
      }
      return fetch(event.request).then((resp) => {
        if (!resp || resp.status !== 200 || resp.type !== 'basic') return resp;
        const clone = resp.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return resp;
      }).catch(() => cached);
    })
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
