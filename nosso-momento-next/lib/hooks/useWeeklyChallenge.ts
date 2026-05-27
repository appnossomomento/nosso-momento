'use client';
import { useEffect, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAppStore } from '@/lib/store/appStore';
import type { PendingChallenge } from '@/lib/types';

// Deadline local de segurança: 7 dias. O backend é autoritativo para expiração (status: 'expirado').
const CYCLE_MS = 7 * 24 * 60 * 60 * 1000;

export function useWeeklyChallenge() {
  const uid = useAppStore((s) => s.usuario?.uid ?? null);
  const pareadoUid = useAppStore((s) => s.pareadoUid ?? s.usuario?.pareadoUid ?? null);
  const set = useAppStore((s) => s.set);
  const unsubRef = useRef<(() => void)[]>([]);

  useEffect(() => {
    unsubRef.current.forEach((fn) => fn());
    unsubRef.current = [];

    if (!uid || !pareadoUid) return;

    const pairKey = [uid, pareadoUid].sort().join('_');

    const docs: { docId: string; tipo: PendingChallenge['tipo'] }[] = [
      { docId: `alma_gemea_${pairKey}`, tipo: 'pergunta' },
      { docId: `preferencias_${pairKey}`, tipo: 'escolha' },
      { docId: `roleta_${pairKey}`, tipo: 'roleta' },
    ];

    for (const { docId, tipo } of docs) {
      const unsub = onSnapshot(
        doc(db, 'weeklyChallenges', docId),
        (snap) => {
          if (!snap.exists()) return;
          const data = snap.data() as Record<string, unknown>;

          // Only show if pending and not expired
          if (data['status'] !== 'pendente') return;
          const startedAtMs =
            typeof data['startedAtMs'] === 'number' ? data['startedAtMs'] : 0;
          const deadline = startedAtMs + CYCLE_MS;
          if (Date.now() >= deadline) return;

          // Only show if user hasn't answered yet
          const respostas =
            (data['respostas'] as Record<string, unknown>) ?? {};
          if (respostas[uid] !== undefined) {
            // User already answered — decrement pending count if it was tracked
            return;
          }

          const challengeId = (data['id'] as string) ?? docId;

          // Don't reopen if user already spun/dismissed this challenge in this session
          if (useAppStore.getState().dismissedChallengeIds.includes(challengeId)) return;

          const challenge: PendingChallenge = {
            id: (data['id'] as string) ?? docId,
            titulo: (data['titulo'] as string) ?? 'Desafio da Semana',
            descricao: data['descricao'] as string | undefined,
            pergunta: data['pergunta'] as string | undefined,
            deadline,
            tipo,
            opcaoA: data['opcaoA'] as string | undefined,
            opcaoB: data['opcaoB'] as string | undefined,
          };

          const store = useAppStore.getState();
          if (!store.showChallengePopup) {
            set({
              showChallengePopup: true,
              pendingChallenge: challenge,
              challengeDeadline: deadline,
              desafiosPendentes: store.desafiosPendentes + 1,
            });
          } else {
            const queue = store.pendingChallengeQueue ?? [];
            if (!queue.find((c) => c.id === challenge.id)) {
              set({
                pendingChallengeQueue: [...queue, challenge],
                desafiosPendentes: store.desafiosPendentes + 1,
              });
            }
          }
        },
        (err) => console.warn('[useWeeklyChallenge]', err),
      );
      unsubRef.current.push(unsub);
    }

    return () => {
      unsubRef.current.forEach((fn) => fn());
      unsubRef.current = [];
    };
  }, [uid, pareadoUid, set]);
}
