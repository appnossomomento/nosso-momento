'use client';

import { useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAppStore } from '@/lib/store/appStore';
import { isClimaFromToday } from '@/lib/clima/isClimaFromToday';
import { saoPauloDateString } from '@/lib/utils/saoPauloDate';
import type { ClimaItem, MomentoCustom } from '@/lib/types';

type ClimaSnap = { humor?: string; registradoEm?: unknown } | null;

function patchClimaHoje(
  items: ClimaItem[],
  hojeStr: string,
  /** null = limpar check-in de hoje; undefined = não mexer */
  meuHumor: string | null | undefined,
  partnerHumor: string | null | undefined,
): ClimaItem[] {
  if (!items.length) return items;
  let changed = false;
  const next = items.map((d) => {
    if (d.data !== hojeStr) return d;
    const humor = meuHumor !== undefined ? meuHumor : d.humor;
    const ph = partnerHumor !== undefined ? partnerHumor : d.partnerHumor;
    if (humor === d.humor && ph === d.partnerHumor) return d;
    changed = true;
    return { ...d, humor, partnerHumor: ph };
  });
  return changed ? next : items;
}

/**
 * Para cada pareamento ativo do usuário, abre um onSnapshot em
 * pareamentos/{pareamentoId} e atualiza foguinhos, momentos custom e clima
 * em tempo real. Equivalente ao setupPareamentoListeners() do index.html.
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

          const state = useAppStore.getState();
          const nextParceiros = state.parceirosAtivos.map((p) =>
            p.pareamentoId === pareamentoId ? { ...p, foguinhos: meuSaldo } : p,
          );

          const activeId = state.conexaoAtiva?.pareamentoId ?? state.idPareamentoAmigavel ?? null;
          if (pareamentoId !== activeId) {
            set({ parceirosAtivos: nextParceiros });
            return;
          }

          const raw = pData.momentosCustom;
          const momentosCustomAtivo =
            raw && typeof raw === 'object' && !Array.isArray(raw)
              ? (raw as Record<string, MomentoCustom[]>)
              : null;

          const partnerUid =
            state.conexaoAtiva?.uid ?? state.pareadoUid ?? parceiro.uid ?? null;
          const climaMap =
            (pData.climaHoje as Record<string, ClimaSnap> | undefined) ?? {};
          const meuRaw = climaMap[uid] ?? null;
          const partnerRaw = partnerUid ? (climaMap[partnerUid] ?? null) : null;
          const climaHoje = isClimaFromToday(meuRaw)
            ? { humor: String(meuRaw!.humor ?? ''), registradoEm: meuRaw!.registradoEm }
            : null;
          const climaPartnerHoje = isClimaFromToday(partnerRaw)
            ? {
                humor: String(partnerRaw!.humor ?? ''),
                registradoEm: partnerRaw!.registradoEm,
              }
            : null;

          const hojeStr = saoPauloDateString();
          // null quando não é de hoje — limpa o patch e evita manter humor “aceso” velho
          const climaSemana = patchClimaHoje(
            state.climaSemana,
            hojeStr,
            climaHoje ? climaHoje.humor : null,
            climaPartnerHoje ? climaPartnerHoje.humor : null,
          );
          const climaHistory = patchClimaHoje(
            state.climaHistory,
            hojeStr,
            climaHoje ? climaHoje.humor : null,
            climaPartnerHoje ? climaPartnerHoje.humor : null,
          );

          set({
            parceirosAtivos: nextParceiros,
            momentosCustomAtivo,
            climaHoje,
            climaPartnerHoje,
            climaSemana,
            climaHistory,
          });
        },
        (err) => console.warn('[usePareamentoListeners] erro no snapshot:', err),
      );

      unsubscribers.push(unsub);
    }

    return () => {
      unsubscribers.forEach((fn) => fn());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, pareamentoIds, set]);
}
