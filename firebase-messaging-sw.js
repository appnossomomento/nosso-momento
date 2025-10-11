// Importa os scripts necessários do Firebase.
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

// As mesmas configurações do seu app principal.
const firebaseConfig = {
    apiKey: "AIzaSyAppTP2vJuLofr9ueWsK3djbwSeEm5qb2c",
    authDomain: "nosso-momento-app.firebaseapp.com",
    projectId: "nosso-momento-app",
    storageBucket: "nosso-momento-app.firebasestorage.app",
    messagingSenderId: "503855316994",
    appId: "1:503855316994:web:7d5ee171b44c4f8b86a71b",
};

// Inicializa o Firebase
firebase.initializeApp(firebaseConfig);

// Obtém a instância do serviço de mensagens
const messaging = firebase.messaging();

// Este código lida com notificações recebidas enquanto o app está em segundo plano.
messaging.onBackgroundMessage((payload) => {
  console.log(
    "[firebase-messaging-sw.js] Received background message ",
    payload
  );
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/assets/icons/favicon.ico' // Lembre-se de criar essa pasta/arquivo de ícone se quiser usá-lo
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});