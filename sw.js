// ============================================================
// sw.js — Service Worker unificado: Cache Shell + Firebase Cloud Messaging
// Nosso Momento PWA
// ============================================================

const CACHE_NAME = 'nosso-momento-v3';

// App shell: recursos essenciais para carregar o app instantaneamente
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/icons/iconprincipal.png',
  '/assets/icons/icon-192x192.png',
  '/assets/icons/icon-512x512.png',
  '/assets/icons/favicon.ico',
  '/assets/icons/favicon.png',
];

// CDNs que podem ser cacheados com TTL longo (imutáveis ou versionados)
const CACHEABLE_CDN_ORIGINS = [
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com',
  'https://cdn.jsdelivr.net',
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
];

// Origens que NUNCA devem ser cacheadas (dados dinâmicos, auth, APIs)
const NETWORK_ONLY_PATTERNS = [
  /firestore\.googleapis\.com/,
  /identitytoolkit\.googleapis\.com/,
  /securetoken\.googleapis\.com/,
  /cloudfunctions\.net/,
  /firebasestorage\.googleapis\.com/,
  /www\.google-analytics\.com/,
  /www\.googletagmanager\.com/,
  /region1\.google-analytics\.com/,
  /connect\.facebook\.net/,
  /www\.facebook\.com/,
  /stats\.g\.doubleclick\.net/,
];

// ============================================================
// INSTALL — Pré-cacheia o app shell
// ============================================================
self.addEventListener('install', (event) => {
  console.log('[SW] Install — cacheando app shell');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ============================================================
// ACTIVATE — Limpa caches antigos
// ============================================================
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate — limpando caches obsoletos');
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ============================================================
// FETCH — Estratégias de cache por tipo de recurso
// ============================================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignora requests não-GET (POST para criação de inputs, etc.)
  if (request.method !== 'GET') return;

  // --- Network Only: APIs dinâmicas (Firebase, Analytics, etc.) ---
  if (NETWORK_ONLY_PATTERNS.some((pattern) => pattern.test(url.href))) {
    return; // Deixa o browser lidar normalmente
  }

  // --- Cache First: CDNs conhecidos (fontes, libs) ---
  if (CACHEABLE_CDN_ORIGINS.some((origin) => url.href.startsWith(origin))) {
    event.respondWith(cacheFirstWithFallback(request));
    return;
  }

  // --- Stale-While-Revalidate: app shell e assets locais ---
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }
});

// ============================================================
// Estratégia: Cache First, fallback Network
// Ideal para CDNs imutáveis/versionados
// ============================================================
async function cacheFirstWithFallback(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    // Se não tem cache e rede falhou, retorna fallback genérico
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

// ============================================================
// Estratégia: Stale-While-Revalidate
// Retorna cache imediatamente, atualiza em background
// ============================================================
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const networkFetch = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => null);

  // Se tem cache, retorna imediatamente (network atualiza em background)
  if (cached) return cached;

  // Se não tem cache, espera a rede
  const networkResponse = await networkFetch;
  if (networkResponse) return networkResponse;

  // Fallback offline para navegação
  if (request.mode === 'navigate') {
    const fallback = await cache.match('/index.html');
    if (fallback) return fallback;
  }

  return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
}

// ============================================================
// FIREBASE CLOUD MESSAGING — Push notifications em background
// (migrado de firebase-messaging-sw.js)
// ============================================================
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: 'AIzaSyAppTP2vJuLofr9ueWsK3djbwSeEm5qb2c',
  authDomain: 'nosso-momento-app.firebaseapp.com',
  projectId: 'nosso-momento-app',
  storageBucket: 'nosso-momento-app.firebasestorage.app',
  messagingSenderId: '503855316994',
  appId: '1:503855316994:web:7d5ee171b44c4f8b86a71b',
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Push notification recebida em background:', payload);

  const notificationTitle = payload.data.title;
  const notificationOptions = {
    body: payload.data.body,
    icon: payload.data.icon || '/assets/icons/icon-192x192.png',
    badge: '/assets/icons/icon-192x192.png',
    vibrate: [100, 50, 100],
    data: payload.data,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Ao clicar na notificação, abre/foca o app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Se o app já está aberto, foca nele
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        // Senão, abre uma nova janela
        return self.clients.openWindow('/');
      })
  );
});
