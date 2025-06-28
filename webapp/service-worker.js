// 백야 프로토콜 서비스 워커
const CACHE_NAME = 'baekya-protocol-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/additional.css',
  '/input-fix.css',
  '/app.js',
  '/app-additions.js',
  '/ime-fix.js',
  '/icons/icon.svg',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
];

// 설치 이벤트
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('캐시 열기 완료');
        return cache.addAll(urlsToCache);
      })
  );
});

// 활성화 이벤트
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('이전 캐시 삭제:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// 페치 이벤트
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // 캐시에서 찾으면 반환
        if (response) {
          return response;
        }

        // 네트워크에서 가져오기
        return fetch(event.request).then(response => {
          // 유효하지 않은 응답은 캐시하지 않음
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // 응답 복제
          const responseToCache = response.clone();

          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });

          return response;
        });
      })
      .catch(() => {
        // 오프라인 페이지 반환 (필요시)
        return new Response('오프라인 상태입니다. 인터넷 연결을 확인해주세요.');
      })
  );
}); 