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

function resolveNotificationUrl(redirectTo, tipo) {
  var screenMap = {
    main: '/dashboard',
    momentos: '/momentos',
    perfil: '/perfil',
    perfilParceiro: '/parceiro',
    achievementsPopup: '/dashboard?achievements=1',
  };
  var key = typeof redirectTo === 'string' ? redirectTo.trim() : '';
  if (key && screenMap[key]) return screenMap[key];
  if (key.indexOf('/') === 0) return key;

  var type = typeof tipo === 'string' ? tipo.trim() : '';
  if (type === 'lembrete_humor') return '/clima';
  if (type === 'momento_resgatado' || type === 'moment_completion') return '/momentos';
  if (type === 'achievement' || type === 'milestone') return '/dashboard?achievements=1';
  if (type === 'pairing') return '/parear';
  if (type === 'vip_activated') return '/perfil';

  return key ? '/notificacoes' : '/dashboard';
}

messaging.onBackgroundMessage(function (payload) {
  var notificationTitle = (payload.data && payload.data.title) || 'Nosso Momento';
  var notificationOptions = {
    body: (payload.data && payload.data.body) || '',
    icon: (payload.data && payload.data.icon) || '/assets/icons/icon-192x192.png',
    badge: '/assets/icons/icon-192x192.png',
    vibrate: [100, 50, 100],
    data: payload.data || {},
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var data = event.notification.data || {};
  var redirectTo = data.redirectTo;
  var tipo = data.type;
  var targetUrl = resolveNotificationUrl(redirectTo, tipo);
  var origin = self.location.origin;
  var absoluteUrl = targetUrl.indexOf('http') === 0 ? targetUrl : origin + targetUrl;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clients) {
      for (var i = 0; i < clients.length; i++) {
        var client = clients[i];
        if (client.url.indexOf(origin) !== -1 && 'focus' in client) {
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            redirectTo: redirectTo || null,
            notificationType: tipo || null,
          });
          return client.focus();
        }
      }
      return self.clients.openWindow(absoluteUrl);
    }),
  );
});
