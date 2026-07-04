const CACHE_NAME = 'gzmn-v2';
const APP_SHELL = [
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './data/index.json'
];

self.addEventListener('install', function(event){
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      return cache.addAll(APP_SHELL);
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== CACHE_NAME; }).map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(event){
  var req = event.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  var isHtmlOrRoot = req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/') || url.pathname.endsWith('manifest.json');

  // HTML page + manifest: network-first, so updates show up immediately.
  // Falls back to cache only if the network is unavailable (offline).
  if (isHtmlOrRoot){
    event.respondWith(
      fetch(req).then(function(res){
        if (res && res.status === 200){
          caches.open(CACHE_NAME).then(function(cache){ cache.put(req, res.clone()); });
        }
        return res;
      }).catch(function(){
        return caches.match(req);
      })
    );
    return;
  }

  // Data JSON files: cache-first, fall back to network, then update cache (stale-while-revalidate)
  if (url.pathname.indexOf('/data/') !== -1) {
    event.respondWith(
      caches.open(CACHE_NAME).then(function(cache){
        return cache.match(req).then(function(cached){
          var networkFetch = fetch(req).then(function(res){
            if (res && res.status === 200) cache.put(req, res.clone());
            return res;
          }).catch(function(){ return cached; });
          return cached || networkFetch;
        });
      })
    );
    return;
  }

  // Everything else (icons, etc.): cache-first
  event.respondWith(
    caches.match(req).then(function(cached){
      return cached || fetch(req).then(function(res){
        if (res && res.status === 200 && url.origin === location.origin){
          caches.open(CACHE_NAME).then(function(cache){ cache.put(req, res.clone()); });
        }
        return res;
      }).catch(function(){ return cached; });
    })
  );
});
