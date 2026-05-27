import { useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAppStore } from '@/lib/store/appStore';

const ACHIEVEMENT_TRIGGERS: Record<string, string> = {
  first_check_in: 'daily_check_in',
  checkin_streak_7: 'daily_check_in',
  checkin_master: 'daily_check_in',
  sou_fiel: 'daily_check_in',
  sintonia_clima: 'daily_check_in',
  relacao_saudavel: 'daily_check_in',
  first_moment_redeem: 'moment_redeem',
  moment_collector: 'moment_redeem',
  to_amando: 'moment_redeem',
  jornada_iniciada: 'moment_redeem_received',
  atitude: 'moment_complete',
  foguinhos_investor: 'moment_redeem',
  caliente: 'moment_redeem',
  em_sincronia: 'weekly_challenge_answer',
  ligeiro: 'weekly_challenge_answer',
  primeiro_mes: 'daily_check_in',
  com_cara: 'profile_photo_upload',
  criando_memorias: 'moment_photo_upload',
};

/**
 * Escuta as conquistas (achievements) do usuário no Firestore.
 * Atualiza o store quando novas conquistas são desbloqueadas.
 */
export function useConquistas() {
  const { usuario, set } = useAppStore();
  const uid = usuario?.uid ?? null;

  useEffect(() => {
    if (!uid) return;

    const unsub = onSnapshot(
      doc(db, 'usuarios', uid),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        const conquistas: Record<string, unknown> = data.conquistas ?? {};
        const achievementStats: Record<string, number> = data.achievementStats ?? {};

        // Conta quantas não lidas (novas conquistas desde o último acesso)
        const naoLidas = Object.keys(conquistas).filter((id) => {
          const c = conquistas[id] as Record<string, unknown> | boolean;
          return typeof c === 'object' && c !== null && !(c as Record<string, unknown>).lida;
        }).length;

        set({
          usuario: {
            ...useAppStore.getState().usuario!,
            conquistas: conquistas as Record<string, boolean>,
            achievementStats,
          },
          notificacoesConquistasNaoLidas: naoLidas,
        });
      },
      (err) => {
        console.error('[useConquistas] erro ao escutar conquistas:', err);
      }
    );

    return () => unsub();
  }, [uid, set]);
}

export { ACHIEVEMENT_TRIGGERS };
