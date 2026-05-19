const CACHE_NAME    = "iglesia-app-v2.1"
const CACHE_URLS = [
  "/",
  "/index.html",
  "/dashboard.html",
  "/login.html",
  "/miembros.html",      // ← nuevo
  "/style.css",
  "/app.js",
  "/auth.js",
  "/dashboard.js",
  "/miembros.js",        // ← nuevo
  "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap",
  "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
  "https://cdn.jsdelivr.net/npm/chart.js"
]

// ─── Instalación: guarda los archivos en caché ────────────────────
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CACHE_URLS))
      .then(() => self.skipWaiting())
  )
})

// ─── Activación: limpia cachés antiguos ───────────────────────────
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  )
})

// ─── Fetch: responde desde caché si está disponible ──────────────
self.addEventListener("fetch", event => {

  // Las peticiones a la API siempre van al servidor (datos frescos)
  if (event.request.url.includes("/api/")) {
    return
  }

  event.respondWith(
    caches.match(event.request)
      .then(cached => cached || fetch(event.request))
  )
})