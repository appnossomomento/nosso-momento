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

function derivarContadores(docs: Notificacao[]) {
  let tarefas = 0;
  let presentes = 0;
  let conquistas = 0;

  for (const n of docs) {
    if (n.lida) continue;
    const tipo = String(n.tipo ?? '');
    const icone = String(n.icone ?? '');
    if (TIPOS_CONQUISTAS.has(tipo)) {
      conquistas += 1;
    } else if (icone === 'fa-gift') {
      presentes += 1;
    } else if (TIPOS_MOMENTOS.has(tipo)) {
      tarefas += 1;
    } else {
      // diário: desafio, clima, lembrete_humor
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
        const docs = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Notificacao[];

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
 * As regras do Firestore permitem update apenas no campo `lida`.
 */
export async function marcarNotificacoesComoLidas(
  notificacoes: Notificacao[],
): Promise<void> {
  const naoLidas = notificacoes.filter((n) => !n.lida);
  if (!naoLidas.length) return;

  await Promise.allSettled(
    naoLidas.map((n) =>
      updateDoc(doc(db, 'notificacoes', n.id), { lida: true }),
    ),
  );
}
