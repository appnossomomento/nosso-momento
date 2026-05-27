importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyAppTP2vJuLofr9ueWsK3djbwSeEm5qb2c',
  authDomain: 'nosso-momento-app.firebaseapp.com',
  projectId: 'nosso-momento-app',
  storageBucket: 'nosso-momento-app.firebasestorage.app',
  messagingSenderId: '503855316994',
  appId: '1:503855316994:web:7d5ee171b44c4f8b86a71b',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.data?.title || 'Nosso Momento';
  const notificationOptions = {
    body: payload.data?.body || '',
    icon: payload.data?.icon || '/assets/icons/icon-192x192.png',
    badge: '/assets/icons/icon-192x192.png',
    vibrate: [100, 50, 100],
    data: payload.data,
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const redirectTo = event.notification.data?.redirectTo;
  const targetUrl = redirectTo ? `/?screen=${encodeURIComponent(redirectTo)}` : '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if (redirectTo) client.postMessage({ type: 'NOTIFICATION_CLICK', redirectTo });
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
