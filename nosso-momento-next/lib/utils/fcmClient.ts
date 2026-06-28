import { deleteToken, getMessaging, getToken, isSupported } from 'firebase/messaging';
import firebaseApp from '@/lib/firebase/client';
import { callFunction, FUNCTIONS } from '@/lib/firebase/functions';

const SW_PATH = '/firebase-messaging-sw.js';

export async function getFCMServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register(SW_PATH);
  } catch (err) {
    console.warn('[FCM] falha ao registrar service worker:', err);
    return null;
  }
}

async function readFCMToken(registration: ServiceWorkerRegistration): Promise<string | null> {
  if (!firebaseApp) return null;
  const supported = await isSupported();
  if (!supported) return null;

  const messaging = getMessaging(firebaseApp);
  return getToken(messaging, {
    vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration,
  });
}

/** Obtém token existente (sem pedir permissão) e sincroniza com o servidor. */
export async function syncFCMTokenSilently(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  if (!firebaseApp) return null;
  if (!('Notification' in window) || Notification.permission !== 'granted') return null;

  try {
    const registration = await getFCMServiceWorkerRegistration();
    if (!registration) return null;

    const token = await readFCMToken(registration);
    if (!token) return null;

    await callFunction(FUNCTIONS.setNotificationToken, { token });
    return token;
  } catch (err) {
    console.warn('[FCM] sync silencioso falhou:', err);
    return null;
  }
}

/** Remove subscription local e token FCM do dispositivo (best-effort). */
export async function revokeLocalFCM(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const registration = await navigator.serviceWorker.getRegistration(SW_PATH);
    if (registration) {
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
      }
    }
  } catch (err) {
    console.warn('[FCM] falha ao cancelar push subscription:', err);
  }

  if (!firebaseApp) return;

  try {
    const supported = await isSupported();
    if (!supported) return;
    const messaging = getMessaging(firebaseApp);
    await deleteToken(messaging);
  } catch (err) {
    console.warn('[FCM] falha ao remover token local:', err);
  }
}
