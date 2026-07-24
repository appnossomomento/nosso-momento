'use client';

import { useEffect } from 'react';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAppStore } from '@/lib/store/appStore';
import { isClimaFromToday } from '@/lib/clima/isClimaFromToday';

const LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const STREAK_LOOKBACK_DAYS = 120;

/**
 * Carrega dados de clima (hoje, semana e histórico p/ streak) do pareamento ativo.
 * Deve ser chamado no AuthProvider (ou no parceiro page).
 * Atualizações em tempo real do clima de hoje vêm de usePareamentoListeners.
 */
export function useClimaData() {
  const { usuario, pareado, idPareamentoAmigavel, pareadoUid, set } = useAppStore();
  const uid = usuario?.uid ?? null;

  useEffect(() => {
    if (!uid || !pareado || !idPareamentoAmigavel || !pareadoUid) return;

    const pareamentoId = idPareamentoAmigavel;

    async function carregar() {
      try {
        // 1. Clima de hoje
        const pDoc = await getDoc(doc(db, 'pareamentos', pareamentoId));
        if (pDoc.exists()) {
          const pData = pDoc.data();
          const climaHojeMap = pData.climaHoje ?? {};
          const meuClima = climaHojeMap[uid!] ?? null;
          const partnerClima = climaHojeMap[pareadoUid!] ?? null;
          set({
            climaHoje: isClimaFromToday(meuClima)
              ? { humor: String(meuClima.humor ?? ''), registradoEm: meuClima.registradoEm }
              : null,
            climaPartnerHoje: isClimaFromToday(partnerClima)
              ? {
                  humor: String(partnerClima.humor ?? ''),
                  registradoEm: partnerClima.registradoEm,
                }
              : null,
          });
        }

        // 2. Docs diários
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

        // 3. Histórico p/ streak (lookback)
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

        set({ climaSemana, climaHistory });
      } catch (err) {
        console.error('[useClimaData] erro ao carregar clima:', err);
      }
    }

    carregar();
  }, [uid, pareado, idPareamentoAmigavel, pareadoUid, set]);
}
