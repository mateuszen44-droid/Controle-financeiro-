self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open("fmth-pro-v1").then((cache) => {
      return cache.addAll([
        "./",
        "./index.html",
        "./style.css",
        "./app.js",
        "./manifest.webmanifest"
      ]);
    })
  );
});