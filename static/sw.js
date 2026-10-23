// 四语母语习得套件 Service Worker：缓存应用外壳，支持离线使用
const CACHE_NAME = 'tril-pwa-v111';
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
  './guofeng-seal.svg',
  './guofeng-landscape-left.png',
  './guofeng-landscape-right.png',
  './guofeng-dragon.png',
  './malaysia-seal.svg',
  './malaysia-panel-left.png',
  './malaysia-panel-right.png',
  './malaysia-emblem.svg',
  './malaysia-watermark.svg',
  './tril-skin-widget.js',
  './app-tester.js',
  './app-player.js',
  './app-flash.js?v=11',
  './app-review.js',
  './pinyin-pro.min.js',
  './tril-pinyin.js',
  './三语母语习得核心词库.index.js',
  './tril-part1.js',
  './tril-part2.js',
  './tril-part3.js',
  './tril-part4.js',
  './donggang-pronounce.html',
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
const PART_RE = /^.*(三语母语习得核心词库\.part\d+|tril-part\d+)\.js$/;
// HTML 页面：network-first —— 保证用户刷新后一定拿到最新页面
// （此前 HTML 也走 cache-first，导致「代码已修但用户看到的还是旧版」；
//   Safari 上尤其明显：旧 SW 一直服务旧 HTML，改了也不生效）
const HTML_RE = /\.html$/;
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = event.request.url;
  const isPart = PART_RE.test(url);
  const isHtml = HTML_RE.test(url.split('?')[0].split('#')[0]);

  if (isHtml) {
    // network-first：优先用网络版本，网络失败才回退缓存（离线仍可用）
    event.respondWith(
      fetch(event.request).then((resp) => {
        if (resp && resp.status === 200 && resp.type === 'basic') {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
        }
        return resp;
      }).catch(() => caches.match(event.request).then((cached) => cached || Response.error()))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if(cached){
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
