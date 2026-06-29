'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getMessaging, isSupported, onMessage } from 'firebase/messaging';
import { showToast } from '@/components/ui/Toast';
import { revokeLocalFCM, syncFCMTokenSilently } from '@/lib/utils/fcmClient';
import firebaseApp from '@/lib/firebase/client';
import { useAppStore } from '@/lib/store/appStore';
import { trackGA, trackMeta } from '@/lib/analytics';
import { resolveNotificationTarget } from '@/lib/utils/notificationRedirect';

/**
 * Solicita permissão de notificação, obtém o FCM token e o sincroniza com o servidor.
 * Deve ser chamado após o usuário estar autenticado.
 */
export async function requestFCMPermission(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  if (!firebaseApp) return null;
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return null;

  try {
    const supported = await isSupported();
    if (!supported) return null;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      showToast('Notificações desativadas.', 'aviso');
      return null;
    }

    const token = await syncFCMTokenSilently();
    if (!token) {
      showToast('Não foi possível ativar notificações.', 'aviso');
      return null;
    }

    return token;
  } catch (err) {
    console.error('Erro FCM:', err);
    return null;
  }
}

export { revokeLocalFCM, syncFCMTokenSilently };

/**
 * Foreground push + clique em notificação. Não registra token automaticamente.
 */
export function useFCM() {
  const router = useRouter();
  const usuario = useAppStore((s) => s.usuario);
  const fcmToken = useAppStore((s) => s.fcmToken);
  const set = useAppStore((s) => s.set);
  const syncedUidRef = useRef<string | null>(null);

  // Re-sincroniza token no login se permissão já foi concedida (best-effort, uma vez por sessão)
  useEffect(() => {
    if (!usuario?.uid) {
      syncedUidRef.current = null;
      return;
    }
    if (!usuario.notificationsEnabled) return;
    if (typeof window === 'undefined' || Notification.permission !== 'granted') return;
    if (syncedUidRef.current === usuario.uid) return;
    syncedUidRef.current = usuario.uid;

    void syncFCMTokenSilently().then((token) => {
      if (token) set({ fcmToken: token });
    });
  }, [usuario?.uid, usuario?.notificationsEnabled, set]);

  const navigateFromNotification = useCallback(
    (redirectTo?: string | null, tipo?: string | null) => {
      if (!usuario?.uid) return;
      const target = resolveNotificationTarget(redirectTo, tipo);
      if (target.openAchievementsPopup) {
        set({ showAchievementsPopup: true });
      }
      router.push(target.path);
    },
    [router, set, usuario?.uid],
  );

  // Deep link ao abrir app via ?achievements=1 (cold start pelo service worker)
  useEffect(() => {
    if (!usuario?.uid || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('achievements') !== '1') return;

    set({ showAchievementsPopup: true });
    params.delete('achievements');
    const qs = params.toString();
    const nextPath = `${window.location.pathname}${qs ? `?${qs}` : ''}`;
    router.replace(nextPath);
  }, [usuario?.uid, router, set]);

  // Clique em notificação com app já aberto (postMessage do service worker)
  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.serviceWorker) return;

    const onSwMessage = (event: MessageEvent) => {
      const data = event.data as {
        type?: string;
        redirectTo?: string | null;
        notificationType?: string | null;
      } | null;
      if (!data || data.type !== 'NOTIFICATION_CLICK') return;
      navigateFromNotification(data.redirectTo, data.notificationType);
    };

    navigator.serviceWorker.addEventListener('message', onSwMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onSwMessage);
  }, [navigateFromNotification]);

  // Foreground message handler — toast quando app está aberto
  useEffect(() => {
    if (typeof window === 'undefined' || !firebaseApp || !usuario?.uid) return;

    let unsub: (() => void) | undefined;

    void isSupported().then((supported) => {
      if (!supported) return;
      try {
        const app = firebaseApp;
        if (!app) return;
        const messaging = getMessaging(app);
        unsub = onMessage(messaging, (payload) => {
          const type = payload.data?.type ?? null;
          const title = payload.data?.title ?? '';
          const body = payload.data?.body ?? '';

          if (type === 'achievement') {
            // Conquistas: Firestore + AchievementCelebration já cuidam da UX
            trackGA('unlock_achievement', {
              achievement_id: payload.data?.achievementId ?? 'unknown',
            });
            trackMeta('UnlockAchievement', {
              achievement_id: payload.data?.achievementId ?? 'unknown',
            });
          } else if (type === 'pairing' || title.toLowerCase().includes('pareamento')) {
            // Popup de pareamento cuida disso
          } else if (title) {
            showToast(`🔔 ${title}${body ? ': ' + body : ''}`, 'sucesso');
          }
        });
      } catch {
        // Messaging não suportado neste ambiente
      }
    });

    return () => {
      unsub?.();
    };
  }, [usuario?.uid]);

  async function ativarNotificacoes() {
    if (fcmToken) {
      showToast('Notificações já ativadas!', 'sucesso');
      return;
    }
    const token = await requestFCMPermission();
    if (token) {
      set({ fcmToken: token });
      showToast('Notificações ativadas! 🔔', 'sucesso');
    }
  }

  return { ativarNotificacoes };
}
