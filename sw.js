const CACHE = "fmth_cache_v7";

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll([
      "./",
      "./index.html",
      "./styles.css",
      "./app.js",
      "./manifest.webmanifest"
    ]))
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
});