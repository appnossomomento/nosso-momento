'use client';

import { useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAppStore } from '@/lib/store/appStore';
import type { MomentoCustom } from '@/lib/types';

/**
 * Para cada pareamento ativo do usuário, abre um onSnapshot em
 * pareamentos/{pareamentoId} e atualiza os foguinhos em tempo real.
 * Equivalente ao setupPareamentoListeners() do index.html.
 */
export function usePareamentoListeners() {
  const uid = useAppStore((s) => s.usuario?.uid ?? null);
  const parceirosAtivos = useAppStore((s) => s.parceirosAtivos);
  const set = useAppStore((s) => s.set);

  const pareamentoIds = parceirosAtivos
    .map((p) => p.pareamentoId)
    .filter(Boolean)
    .join(',');

  useEffect(() => {
    if (!uid || !parceirosAtivos.length) return;

    const unsubscribers: (() => void)[] = [];

    for (const parceiro of parceirosAtivos) {
      const { pareamentoId } = parceiro;
      if (!pareamentoId) continue;

      const unsub = onSnapshot(
        doc(db, 'pareamentos', pareamentoId),
        (snap) => {
          if (!snap.exists()) return;
          const pData = snap.data() as Record<string, unknown>;
          const isMePessoa1 = pData.pessoa1Uid === uid;
          const meuSaldo = isMePessoa1
            ? ((pData.foguinhos_pessoa1 as number) || 0)
            : ((pData.foguinhos_pessoa2 as number) || 0);

          set({
            parceirosAtivos: useAppStore
              .getState()
              .parceirosAtivos.map((p) =>
                p.pareamentoId === pareamentoId ? { ...p, foguinhos: meuSaldo } : p
              ),
          });

          if (pareamentoId === (useAppStore.getState().conexaoAtiva?.pareamentoId ?? null)) {
            const raw = pData.momentosCustom;
            const momentosCustomAtivo =
              raw && typeof raw === 'object' && !Array.isArray(raw)
                ? (raw as Record<string, MomentoCustom[]>)
                : null;
            set({ momentosCustomAtivo });
          }
        },
        (err) => console.warn('[usePareamentoListeners] erro no snapshot:', err)
      );

      unsubscribers.push(unsub);
    }

    return () => {
      unsubscribers.forEach((fn) => fn());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, pareamentoIds, set]);
}
