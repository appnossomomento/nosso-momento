'use client';

import { useEffect } from 'react';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import firebaseApp from '@/lib/firebase/client';
import { callFunction, FUNCTIONS } from '@/lib/firebase/functions';
import { useAppStore } from '@/lib/store/appStore';
import { showToast } from '@/components/ui/Toast';
import { trackGA, trackMeta } from '@/lib/analytics';

/**
 * Solicita permissão de notificação, obtém o FCM token e o sincroniza com o servidor.
 * Deve ser chamado após o usuário estar autenticado.
 */
export async function requestFCMPermission(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return null;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      showToast('Notificações desativadas.', 'aviso');
      return null;
    }

    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const messaging = getMessaging(firebaseApp);
    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      showToast('Não foi possível ativar notificações.', 'aviso');
      return null;
    }

    await callFunction(FUNCTIONS.setNotificationToken, { token });
    return token;
  } catch (err) {
    console.error('Erro FCM:', err);
    return null;
  }
}

/**
 * Hook que, ao montar, verifica se já existe um token FCM salvo; caso não exista, tenta registrar.
 * Deve ser usado em componentes client-side após autenticação.
 */
export function useFCM() {
  const { usuario, fcmToken, set } = useAppStore();

  // Foreground message handler — mostra toast quando app está aberto
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const messaging = getMessaging(firebaseApp);
      const unsub = onMessage(messaging, (payload) => {
        const type = payload.data?.type ?? null;
        const title = payload.data?.title ?? '';
        const body = payload.data?.body ?? '';

        if (type === 'achievement') {
          const achievementId = payload.data?.achievementId ?? null;
          // Dispara celebração no store para o componente AchievementCelebration escutar
          set({ pendingCelebrationId: achievementId });
          trackGA('unlock_achievement', { achievement_id: achievementId ?? 'unknown' });
          trackMeta('UnlockAchievement', { achievement_id: achievementId ?? 'unknown' });
        } else if (type === 'pairing' || title.toLowerCase().includes('pareamento')) {
          // O popup de pareamento cuida disso — não exibe toast genérico
        } else if (title) {
          showToast(`🔔 ${title}${body ? ': ' + body : ''}`, 'sucesso');
        }
      });
      return unsub;
    } catch {
      // Messaging não suportado no ambiente (ex: SSR, Safari sem permissão)
    }
  }, [set]);

  useEffect(() => {
    if (!usuario?.uid || fcmToken) return;
    // Permissão solicitada apenas via ação explícita do usuário
  }, [usuario?.uid, fcmToken]);

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
