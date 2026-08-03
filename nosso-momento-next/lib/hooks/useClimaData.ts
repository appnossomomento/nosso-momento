'use client';

import { useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAppStore } from '@/lib/store/appStore';

const LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const STREAK_LOOKBACK_DAYS = 120;

/** Evita re-fetch pesado de climaDiario ao remontar / re-render do AuthProvider. */
let climaHistoryLoadedFor: string | null = null;

/**
 * Carrega semana + histórico p/ streak do pareamento ativo.
 * Clima de hoje em tempo real vem de usePareamentoListeners (sem getDoc duplicado).
 */
export function useClimaData() {
  const uid = useAppStore((s) => s.usuario?.uid ?? null);
  const pareado = useAppStore((s) => s.pareado);
  const idPareamentoAmigavel = useAppStore((s) => s.idPareamentoAmigavel);
  const pareadoUid = useAppStore((s) => s.pareadoUid);
  const set = useAppStore((s) => s.set);

  useEffect(() => {
    if (!uid || !pareado || !idPareamentoAmigavel || !pareadoUid) {
      if (!pareado || !idPareamentoAmigavel) {
        climaHistoryLoadedFor = null;
      }
      return;
    }

    const pareamentoId = idPareamentoAmigavel;

    // Já carregou histórico deste pareamento nesta sessão
    if (
      climaHistoryLoadedFor === pareamentoId &&
      useAppStore.getState().climaHistory.length > 0
    ) {
      return;
    }

    async function carregar() {
      try {
        const spNow = new Date(Date.now() - 3 * 60 * 60 * 1000);
        const dayOfWeek = spNow.getUTCDay();
        const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const mondayMs = spNow.getTime() + diffToMonday * 86400000;
        const mondayDate = new Date(mondayMs);
        const mondayNorm = Date.UTC(
          mondayDate.getUTCFullYear(),
          mondayDate.getUTCMonth(),
          mondayDate.getUTCDate(),
        );

        const semanaDias: string[] = [];
        for (let i = 0; i < 7; i++) {
          semanaDias.push(new Date(mondayNorm + i * 86400000).toISOString().slice(0, 10));
        }

        const hojeStr = spNow.toISOString().slice(0, 10);
        const docsSnaps = await getDocs(
          collection(db, 'pareamentos', pareamentoId, 'climaDiario'),
        );
        const docsMap: Record<string, Record<string, unknown>> = {};
        docsSnaps.forEach((d) => {
          docsMap[d.id] = d.data() as Record<string, unknown>;
        });

        const climaSemana = semanaDias.map((dia, i) => {
          const dData = docsMap[dia] ?? {};
          const meu = (dData[uid!] as { humor?: string } | undefined)?.humor ?? null;
          const parceiro =
            (dData[pareadoUid!] as { humor?: string } | undefined)?.humor ?? null;
          return {
            data: dia,
            label: LABELS[i],
            humor: meu,
            partnerHumor: parceiro,
            isHoje: dia === hojeStr,
          };
        });

        const todayNorm = Date.UTC(
          spNow.getUTCFullYear(),
          spNow.getUTCMonth(),
          spNow.getUTCDate(),
        );
        const climaHistory = Array.from({ length: STREAK_LOOKBACK_DAYS }, (_, i) => {
          const dia = new Date(todayNorm - i * 86400000).toISOString().slice(0, 10);
          const dData = docsMap[dia] ?? {};
          const meu = (dData[uid!] as { humor?: string } | undefined)?.humor ?? null;
          const parceiro =
            (dData[pareadoUid!] as { humor?: string } | undefined)?.humor ?? null;
          return {
            data: dia,
            label: '',
            humor: meu,
            partnerHumor: parceiro,
            isHoje: dia === hojeStr,
          };
        });

        climaHistoryLoadedFor = pareamentoId;
        set({ climaSemana, climaHistory });
      } catch (err) {
        console.error('[useClimaData] erro ao carregar clima:', err);
      }
    }

    void carregar();
  }, [uid, pareado, idPareamentoAmigavel, pareadoUid, set]);
}
