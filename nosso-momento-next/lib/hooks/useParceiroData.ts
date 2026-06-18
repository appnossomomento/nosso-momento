import { useEffect } from 'react';
import { useAppStore } from '@/lib/store/appStore';
import { applyParceiroPerfilToStore, fetchParceiroPerfil } from '@/lib/services/parceiroPerfil';
import { waitForAppCheckToken } from '@/lib/firebase/client';
import type { ParceiroData } from '@/lib/types';

function buildParceiroFromLista(pareadoUid: string): ParceiroData | null {
  const parEntry = useAppStore.getState().parceirosAtivos.find((p) => p.uid === pareadoUid);
  if (!parEntry) return null;
  return {
    uid: pareadoUid,
    nome: parEntry.nome ?? '',
    fotoUrl: parEntry.fotoUrl,
    foguinhos: parEntry.foguinhos,
    catalogoPersonalizado: {},
    pareamentoId: parEntry.pareamentoId,
  };
}

/**
 * Carrega o perfil público do parceiro via Cloud Function (sem leitura direta do doc /usuarios).
 * Foguinhos em tempo real continuam via usePareamentoListeners → parceirosAtivos.
 */
export function useParceiroData() {
  const pareadoUid = useAppStore((s) => s.pareadoUid);
  const authInitialized = useAppStore((s) => s.authInitialized);
  const parceirosAtivos = useAppStore((s) => s.parceirosAtivos);
  const { set } = useAppStore();

  useEffect(() => {
    if (!authInitialized || !pareadoUid) {
      if (!pareadoUid) {
        set({
          parceiroData: null,
          parceiroNome: null,
          pareado: false,
          idPareamentoAmigavel: null,
          parceiroTelefone: null,
        });
      }
      return;
    }

    let cancelled = false;
    const parEntry = parceirosAtivos.find((p) => p.uid === pareadoUid);

    (async () => {
      await waitForAppCheckToken(10000);

      for (let attempt = 0; attempt < 3; attempt++) {
        if (cancelled) return;
        try {
          const profile = await fetchParceiroPerfil(pareadoUid);
          if (cancelled) return;
          applyParceiroPerfilToStore(profile, parEntry?.foguinhos);
          return;
        } catch (err) {
          const msg = String(err);
          const appCheckErr = msg.includes('missing_app_check') || msg.includes('invalid_app_check');
          if (appCheckErr && attempt < 2) {
            await waitForAppCheckToken(5000);
            continue;
          }
          throw err;
        }
      }
    })().catch((err) => {
        console.error('[useParceiroData] erro ao carregar parceiro:', err);
        if (cancelled) return;

        const fallback = buildParceiroFromLista(pareadoUid);
        if (fallback) {
          const pareamentoId =
            typeof fallback.pareamentoId === 'string' ? fallback.pareamentoId : null;
          set({
            pareado: true,
            pareadoUid,
            parceiroNome: fallback.nome,
            idPareamentoAmigavel: pareamentoId,
            parceiroData: fallback,
          });
          return;
        }

        set({
          parceiroData: null,
          parceiroNome: null,
          pareado: false,
          idPareamentoAmigavel: null,
          parceiroTelefone: null,
          pareadoUid: null,
        });
    });

    return () => {
      cancelled = true;
    };
  }, [pareadoUid, authInitialized, set]);

  // Mescla foguinhos atualizados de parceirosAtivos no parceiroData exibido.
  useEffect(() => {
    if (!pareadoUid) return;
    const parEntry = parceirosAtivos.find((p) => p.uid === pareadoUid);
    if (!parEntry?.foguinhos && parEntry?.foguinhos !== 0) return;

    const current = useAppStore.getState().parceiroData;
    if (!current || current.uid !== pareadoUid) return;
    if (current.foguinhos === parEntry.foguinhos) return;

    set({
      parceiroData: { ...current, foguinhos: parEntry.foguinhos },
    });
  }, [pareadoUid, parceirosAtivos, set]);
}
