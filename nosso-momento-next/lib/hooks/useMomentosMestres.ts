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
  const set = useAppStore((s) => s.set);

  useEffect(() => {
    if (useAppStore.getState().momentosMestres.length > 0) return;

    async function carregar() {
      try {
        const snap = await getDocs(query(collection(db, 'momentosMestres'), orderBy('nome')));
        const porChave = new Map<string, MomentoMestre>();
        snap.forEach((docSnap) => {
          const data = { id: docSnap.id, ...docSnap.data() } as MomentoMestre;
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

    void carregar();
  }, [set]);
}
