'use client';

import { useEffect } from 'react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAppStore } from '@/lib/store/appStore';
import { sanitizeMomentoImgUrl } from '@/lib/utils/momentoImage';
import type { MomentoMestre } from '@/lib/types';

/**
 * Carrega o catálogo de momentos mestres do Firestore uma vez por sessão.
 * Deve ser chamado no AuthProvider após login.
 */
export function useMomentosMestres() {
  const { set, momentosMestres } = useAppStore();

  useEffect(() => {
    // Só carrega se ainda não tem dados
    if (momentosMestres.length > 0) return;

    async function carregar() {
      try {
        const snap = await getDocs(query(collection(db, 'momentosMestres'), orderBy('nome')));
        const porChave = new Map<string, MomentoMestre>();
        snap.forEach((doc) => {
          const data = { id: doc.id, ...doc.data() } as MomentoMestre;
          if (!data.nome) return;
          data.img = sanitizeMomentoImgUrl(data.img);
          const key = `${data.nome}::${data.targetGender ?? 'any'}`;
          if (!porChave.has(key)) porChave.set(key, data);
        });
        set({ momentosMestres: Array.from(porChave.values()) });
      } catch (err) {
        console.error('[useMomentosMestres] erro ao carregar catálogo:', err);
      }
    }

    carregar();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
