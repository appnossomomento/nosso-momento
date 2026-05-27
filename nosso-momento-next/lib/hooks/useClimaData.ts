'use client';

import { useEffect } from 'react';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAppStore } from '@/lib/store/appStore';

const LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

function isHoje(registradoEm: unknown): boolean {
  if (!registradoEm) return false;
  try {
    const ts = typeof registradoEm === 'object' && registradoEm !== null && 'toDate' in registradoEm
      ? (registradoEm as { toDate: () => Date }).toDate()
      : new Date(registradoEm as string);
    const agora = new Date(Date.now() - 3 * 60 * 60 * 1000); // UTC-3
    return ts.toISOString().slice(0, 10) === agora.toISOString().slice(0, 10);
  } catch { return false; }
}

/**
 * Carrega dados de clima (hoje e semana) do pareamento ativo.
 * Deve ser chamado no AuthProvider (ou no parceiro page).
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
            climaHoje: meuClima && isHoje(meuClima.registradoEm) ? meuClima : null,
            climaPartnerHoje: partnerClima && isHoje(partnerClima.registradoEm) ? partnerClima : null,
          });
        }

        // 2. Semana atual (UTC-3)
        const spNow = new Date(Date.now() - 3 * 60 * 60 * 1000);
        const dayOfWeek = spNow.getUTCDay(); // 0=Dom..6=Sab
        const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const mondayMs = spNow.getTime() + diffToMonday * 86400000;
        const mondayDate = new Date(mondayMs);
        const mondayNorm = Date.UTC(mondayDate.getUTCFullYear(), mondayDate.getUTCMonth(), mondayDate.getUTCDate());

        const dias: string[] = [];
        for (let i = 0; i < 7; i++) {
          dias.push(new Date(mondayNorm + i * 86400000).toISOString().slice(0, 10));
        }

        const hojeStr = spNow.toISOString().slice(0, 10);
        const docsSnaps = await getDocs(collection(db, 'pareamentos', pareamentoId, 'climaDiario'));
        const docsMap: Record<string, Record<string, unknown>> = {};
        docsSnaps.forEach((d) => { docsMap[d.id] = d.data() as Record<string, unknown>; });

        const climaSemana = dias.map((dia, i) => {
          const dData = docsMap[dia] ?? {};
          const meu = (dData[uid!] as { humor?: string } | undefined)?.humor ?? null;
          const parceiro = (dData[pareadoUid!] as { humor?: string } | undefined)?.humor ?? null;
          return { data: dia, label: LABELS[i], humor: meu, partnerHumor: parceiro, isHoje: dia === hojeStr };
        });

        set({ climaSemana });
      } catch (err) {
        console.error('[useClimaData] erro ao carregar clima:', err);
      }
    }

    carregar();
  }, [uid, pareado, idPareamentoAmigavel, pareadoUid, set]);
}
