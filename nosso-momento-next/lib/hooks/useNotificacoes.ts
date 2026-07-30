'use client';

import { useEffect } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAppStore } from '@/lib/store/appStore';
import type { Notificacao } from '@/lib/types';

const TIPOS_MOMENTOS = new Set(['momento_resgatado', 'moment_completion', 'catalog_update']);
const TIPOS_CONQUISTAS = new Set(['achievement', 'milestone']);

/** IDs marcadas como lidas nesta sessão — evita o onSnapshot reacender o badge. */
const locallyReadIds = new Set<string>();

/** Só considera lida quando o campo é explicitamente true (ou marcada localmente). */
export function isNotificacaoLida(n: Notificacao): boolean {
  return n.lida === true || locallyReadIds.has(n.id);
}

function applyLocalReadState(docs: Notificacao[]): Notificacao[] {
  if (!locallyReadIds.size) return docs;
  return docs.map((n) =>
    locallyReadIds.has(n.id) && n.lida !== true
      ? ({ ...n, lida: true } as Notificacao)
      : n,
  );
}

function derivarContadores(docs: Notificacao[]) {
  let tarefas = 0;
  let presentes = 0;
  let conquistas = 0;

  for (const n of docs) {
    if (isNotificacaoLida(n)) continue;
    const tipo = String(n.tipo ?? '');
    const icone = String(n.icone ?? '');
    if (TIPOS_CONQUISTAS.has(tipo)) {
      conquistas += 1;
    } else if (icone === 'fa-gift') {
      presentes += 1;
    } else if (TIPOS_MOMENTOS.has(tipo)) {
      tarefas += 1;
    } else {
      tarefas += 1;
    }
  }

  return {
    notificacoesTarefasNaoLidas: tarefas,
    notificacoesPresentesNaoLidas: presentes,
    notificacoesConquistasNaoLidas: conquistas,
  };
}

/**
 * Escuta a coleção `notificacoes` do usuário em tempo real e popula
 * o Zustand store com as notificações e contadores de não lidas.
 */
export function useNotificacoes() {
  const { usuario, set } = useAppStore();
  const uid = usuario?.uid ?? null;

  useEffect(() => {
    if (!uid) {
      locallyReadIds.clear();
      set({
        notificacoes: [],
        notificacoesTarefasNaoLidas: 0,
        notificacoesPresentesNaoLidas: 0,
        notificacoesConquistasNaoLidas: 0,
      });
      return;
    }

    const q = query(
      collection(db, 'notificacoes'),
      where('userId', '==', uid),
      orderBy('timestamp', 'desc'),
      limit(50),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs = applyLocalReadState(
          snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          })) as Notificacao[],
        );

        set({
          notificacoes: docs,
          ...derivarContadores(docs),
        });
      },
      (err) => {
        console.error('[useNotificacoes] erro ao escutar notificações:', err);
      },
    );

    return () => unsub();
  }, [uid, set]);
}

/**
 * Marca como lidas todas as notificações não lidas de um subconjunto.
 * Atualiza o store na hora e mantém IDs locais para o badge do Início não voltar.
 */
export async function marcarNotificacoesComoLidas(
  notificacoes: Notificacao[],
): Promise<void> {
  const naoLidas = notificacoes.filter((n) => !isNotificacaoLida(n));
  if (!naoLidas.length) return;

  for (const n of naoLidas) {
    locallyReadIds.add(n.id);
  }

  const ids = new Set(naoLidas.map((n) => n.id));
  const { notificacoes: atuais, set } = useAppStore.getState();
  const atualizadas = atuais.map((n) =>
    ids.has(n.id) ? ({ ...n, lida: true } as Notificacao) : n,
  );
  set({
    notificacoes: atualizadas,
    ...derivarContadores(atualizadas),
  });

  const results = await Promise.allSettled(
    naoLidas.map(async (n) => {
      try {
        await updateDoc(doc(db, 'notificacoes', n.id), { lida: true });
      } catch (err) {
        console.error('[marcarNotificacoesComoLidas] doc', n.id, err);
        throw err;
      }
    }),
  );

  const falhas = results.filter((r) => r.status === 'rejected');
  if (falhas.length) {
    console.error(
      '[marcarNotificacoesComoLidas] falha ao persistir',
      falhas.length,
      'de',
      naoLidas.length,
    );
  }
}
