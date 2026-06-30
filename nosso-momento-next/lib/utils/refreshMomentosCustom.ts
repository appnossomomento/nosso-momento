import { doc, getDoc } from 'firebase/firestore';
import { db, waitForAppCheckToken } from '@/lib/firebase/client';
import { useAppStore } from '@/lib/store/appStore';
import type { MomentoCustom } from '@/lib/types';

function parseMomentosCustom(raw: unknown): Record<string, MomentoCustom[]> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return raw as Record<string, MomentoCustom[]>;
}

/** Aguarda o CF gravar momentosCustom e sincroniza o store (inputs não são legíveis no client). */
export async function waitForCustomMomentVisible(
  pareamentoId: string,
  ownerUid: string,
  nome: string,
  maxWaitMs = 35_000,
): Promise<boolean> {
  const ref = doc(db, 'pareamentos', pareamentoId);
  const deadline = Date.now() + maxWaitMs;
  const pollMs = 1_500;

  while (Date.now() < deadline) {
    await waitForAppCheckToken();
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const momentosCustomAtivo = parseMomentosCustom(snap.data()?.momentosCustom);
      if (momentosCustomAtivo) {
        useAppStore.getState().set({ momentosCustomAtivo });
        const list = momentosCustomAtivo[ownerUid];
        if (
          Array.isArray(list) &&
          list.some((m) => m && m.ativo !== false && m.nome === nome)
        ) {
          return true;
        }
      }
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  return false;
}
